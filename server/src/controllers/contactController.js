const mongoose = require('mongoose');
const { Contact, Conversation, Message, Tag } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Helper to parse tag names into Tag ObjectIds for a workspace
 */
const resolveTagIds = async (workspaceId, tagsInput = []) => {
  if (!Array.isArray(tagsInput) || tagsInput.length === 0) {
    return [];
  }

  const tagIds = [];
  for (const item of tagsInput) {
    if (!item) continue;

    // If it's already an ObjectId
    if (mongoose.Types.ObjectId.isValid(item) && String(new mongoose.Types.ObjectId(item)) === String(item)) {
      tagIds.push(new mongoose.Types.ObjectId(item));
      continue;
    }

    const tagName = String(item).trim();
    if (!tagName) continue;

    let tagDoc = await Tag.findOne({ workspaceId, name: tagName });
    if (!tagDoc) {
      tagDoc = await Tag.create({
        workspaceId,
        name: tagName,
        color: '#10B981',
      });
    }
    tagIds.push(tagDoc._id);
  }

  return tagIds;
};

/**
 * 1. Get All Contacts with Search, Tag Filtering, Opt-Out Filtering, and Pagination
 * GET /api/contacts
 */
const getContacts = async (req, res, next) => {
  try {
    const { search, tag, optedOut, page = 1, limit = 20, sortBy = 'lastInteractionAt', sortOrder = 'desc' } = req.query;

    const query = { workspaceId: req.workspaceId };

    // Search by Name, Phone Number, WhatsApp ID, or Email
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { phoneNumber: searchRegex },
        { whatsappId: searchRegex },
        { email: searchRegex },
      ];
    }

    // Filter by Tag
    if (tag && tag.trim() !== '' && tag !== 'all') {
      if (mongoose.Types.ObjectId.isValid(tag)) {
        query.tags = tag;
      } else {
        const foundTag = await Tag.findOne({ workspaceId: req.workspaceId, name: tag.trim() });
        if (foundTag) {
          query.tags = foundTag._id;
        } else {
          // Tag doesn't exist in workspace -> return empty
          return sendSuccess(res, 'Contacts retrieved', {
            contacts: [],
            pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 },
            tags: [],
          });
        }
      }
    }

    // Filter by Opt-Out status
    if (optedOut !== undefined && optedOut !== '') {
      query.optedOut = optedOut === 'true' || optedOut === true;
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const sortOption = {};
    sortOption[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [total, contacts, workspaceTags] = await Promise.all([
      Contact.countDocuments(query),
      Contact.find(query)
        .populate('tags')
        .sort(sortOption)
        .skip(skip)
        .limit(parsedLimit),
      Tag.find({ workspaceId: req.workspaceId }).sort({ name: 1 }),
    ]);

    return sendSuccess(res, 'Contacts retrieved successfully', {
      contacts,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
      tags: workspaceTags,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get Single Contact with Conversation & Message Timeline
 * GET /api/contacts/:id
 */
const getContactById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid contact ID format', 400);
    }

    const contact = await Contact.findOne({
      _id: id,
      workspaceId: req.workspaceId,
    }).populate('tags');

    if (!contact) {
      return sendError(res, 'Contact not found in this workspace', 404);
    }

    // Fetch associated conversation and recent messages
    const conversation = await Conversation.findOne({
      workspaceId: req.workspaceId,
      contactId: contact._id,
    });

    let messages = [];
    if (conversation) {
      messages = await Message.find({
        workspaceId: req.workspaceId,
        conversationId: conversation._id,
      })
        .sort({ createdAt: -1 })
        .limit(50);
      messages.reverse();
    }

    return sendSuccess(res, 'Contact details retrieved', {
      contact,
      conversation,
      messages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Create Contact with Duplicate Prevention
 * POST /api/contacts
 */
const createContact = async (req, res, next) => {
  try {
    const { phoneNumber, name, email, tags = [], customFields = {}, notes = '', optedOut = false } = req.body;

    if (!phoneNumber) {
      return sendError(res, 'Phone number is required', 400);
    }

    const cleanedPhone = String(phoneNumber).replace(/[^0-9]/g, '');
    if (!cleanedPhone || cleanedPhone.length < 7) {
      return sendError(res, 'Please provide a valid phone number with country code', 400);
    }

    // Duplicate Check within the workspace
    const existing = await Contact.findOne({
      workspaceId: req.workspaceId,
      $or: [{ phoneNumber: cleanedPhone }, { whatsappId: cleanedPhone }],
    });

    if (existing) {
      return sendError(
        res,
        `A contact with phone number ${cleanedPhone} already exists in this workspace.`,
        400
      );
    }

    // Resolve Tag ObjectIds
    const tagIds = await resolveTagIds(req.workspaceId, tags);

    const contact = await Contact.create({
      workspaceId: req.workspaceId,
      name: (name && name.trim()) || cleanedPhone,
      phoneNumber: cleanedPhone,
      whatsappId: cleanedPhone,
      email: (email && email.toLowerCase().trim()) || '',
      tags: tagIds,
      customFields: customFields || {},
      notes: notes || '',
      optedOut: Boolean(optedOut),
      lastInteractionAt: new Date(),
    });

    // Create default Conversation for contact if not present
    await Conversation.findOneAndUpdate(
      { workspaceId: req.workspaceId, contactId: contact._id },
      {
        $setOnInsert: {
          workspaceId: req.workspaceId,
          contactId: contact._id,
          status: 'open',
          unreadCount: 0,
        },
      },
      { upsert: true, new: true }
    );

    const populated = await Contact.findById(contact._id).populate('tags');

    return sendSuccess(res, 'Contact created successfully', { contact: populated }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Update Contact
 * PUT /api/contacts/:id
 */
const updateContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, email, tags, customFields, notes, optedOut } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid contact ID format', 400);
    }

    const contact = await Contact.findOne({ _id: id, workspaceId: req.workspaceId });
    if (!contact) {
      return sendError(res, 'Contact not found in this workspace', 404);
    }

    // If changing phone number, check uniqueness within workspace
    if (phoneNumber) {
      const cleanedPhone = String(phoneNumber).replace(/[^0-9]/g, '');
      if (cleanedPhone !== contact.phoneNumber) {
        const conflict = await Contact.findOne({
          workspaceId: req.workspaceId,
          _id: { $ne: contact._id },
          $or: [{ phoneNumber: cleanedPhone }, { whatsappId: cleanedPhone }],
        });

        if (conflict) {
          return sendError(
            res,
            `Another contact already has the phone number ${cleanedPhone} in this workspace.`,
            400
          );
        }

        contact.phoneNumber = cleanedPhone;
        contact.whatsappId = cleanedPhone;
      }
    }

    if (name !== undefined) contact.name = name.trim();
    if (email !== undefined) contact.email = email.toLowerCase().trim();
    if (notes !== undefined) contact.notes = notes;
    if (customFields !== undefined) contact.customFields = customFields;
    if (optedOut !== undefined) contact.optedOut = Boolean(optedOut);

    if (tags !== undefined) {
      contact.tags = await resolveTagIds(req.workspaceId, tags);
    }

    await contact.save();
    const updated = await Contact.findById(contact._id).populate('tags');

    return sendSuccess(res, 'Contact updated successfully', { contact: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Delete Contact
 * DELETE /api/contacts/:id
 */
const deleteContact = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid contact ID format', 400);
    }

    const contact = await Contact.findOneAndDelete({
      _id: id,
      workspaceId: req.workspaceId,
    });

    if (!contact) {
      return sendError(res, 'Contact not found in this workspace', 404);
    }

    // Cleanup conversations and messages for this contact in this workspace
    const conversation = await Conversation.findOneAndDelete({
      workspaceId: req.workspaceId,
      contactId: contact._id,
    });

    if (conversation) {
      await Message.deleteMany({
        workspaceId: req.workspaceId,
        conversationId: conversation._id,
      });
    }

    return sendSuccess(res, 'Contact and associated conversations removed successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Bulk Import Contacts from CSV or JSON Array
 * POST /api/contacts/import
 */
const importContacts = async (req, res, next) => {
  try {
    let rowsToImport = [];

    // Case A: JSON Array `contacts`
    if (Array.isArray(req.body.contacts)) {
      rowsToImport = req.body.contacts;
    }
    // Case B: Raw CSV Text in `csvData` or `csv`
    else if (req.body.csvData || req.body.csv || typeof req.body === 'string') {
      const csvText = req.body.csvData || req.body.csv || req.body;
      const lines = String(csvText).trim().split(/\r?\n/);
      if (lines.length > 1) {
        const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('whatsapp') || h.includes('number'));
        const nameIdx = header.findIndex((h) => h.includes('name'));
        const emailIdx = header.findIndex((h) => h.includes('email'));
        const tagsIdx = header.findIndex((h) => h.includes('tag'));
        const notesIdx = header.findIndex((h) => h.includes('note'));

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
          
          const rawPhone = phoneIdx !== -1 ? cols[phoneIdx] : cols[0];
          const rawName = nameIdx !== -1 ? cols[nameIdx] : (cols[1] || '');
          const rawEmail = emailIdx !== -1 ? cols[emailIdx] : (cols[2] || '');
          const rawTags = tagsIdx !== -1 ? cols[tagsIdx] : '';
          const rawNotes = notesIdx !== -1 ? cols[notesIdx] : '';

          if (rawPhone) {
            rowsToImport.push({
              phoneNumber: rawPhone,
              name: rawName,
              email: rawEmail,
              tags: rawTags ? rawTags.split(';').map((t) => t.trim()) : [],
              notes: rawNotes,
            });
          }
        }
      }
    }

    if (rowsToImport.length === 0) {
      return sendError(
        res,
        'No valid contact rows found. Please provide an array of contacts or a CSV string with a phone number column.',
        400
      );
    }

    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const item of rowsToImport) {
      if (!item.phoneNumber) {
        skippedCount++;
        continue;
      }

      const cleanedPhone = String(item.phoneNumber).replace(/[^0-9]/g, '');
      if (!cleanedPhone || cleanedPhone.length < 7) {
        skippedCount++;
        errors.push(`Invalid phone format: ${item.phoneNumber}`);
        continue;
      }

      // Check duplicate in workspace
      const exists = await Contact.findOne({
        workspaceId: req.workspaceId,
        $or: [{ phoneNumber: cleanedPhone }, { whatsappId: cleanedPhone }],
      });

      if (exists) {
        skippedCount++;
        continue;
      }

      const tagList = Array.isArray(item.tags) ? item.tags : (item.tags ? String(item.tags).split(/[;,]/).map((t) => t.trim()) : []);
      const tagIds = await resolveTagIds(req.workspaceId, tagList);

      await Contact.create({
        workspaceId: req.workspaceId,
        name: (item.name && item.name.trim()) || cleanedPhone,
        phoneNumber: cleanedPhone,
        whatsappId: cleanedPhone,
        email: (item.email && item.email.toLowerCase().trim()) || '',
        tags: tagIds,
        customFields: item.customFields || {},
        notes: item.notes || '',
        optedOut: Boolean(item.optedOut),
        lastInteractionAt: new Date(),
      });

      importedCount++;
    }

    return sendSuccess(res, `CSV Import Complete: ${importedCount} added, ${skippedCount} skipped.`, {
      imported: importedCount,
      skipped: skippedCount,
      total: rowsToImport.length,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Export Contacts to CSV
 * GET /api/contacts/export
 */
const exportContacts = async (req, res, next) => {
  try {
    const contacts = await Contact.find({ workspaceId: req.workspaceId })
      .populate('tags')
      .sort({ createdAt: -1 });

    const csvHeaders = ['Name', 'PhoneNumber', 'WhatsAppId', 'Email', 'Tags', 'OptedOut', 'Notes', 'LastInteractionAt', 'CreatedAt'];
    const csvRows = [csvHeaders.join(',')];

    for (const c of contacts) {
      const tagNames = (c.tags || []).map((t) => t.name || t).join(';');
      const escapeCsv = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

      const row = [
        escapeCsv(c.name),
        escapeCsv(c.phoneNumber),
        escapeCsv(c.whatsappId),
        escapeCsv(c.email),
        escapeCsv(tagNames),
        c.optedOut ? 'TRUE' : 'FALSE',
        escapeCsv(c.notes),
        c.lastInteractionAt ? c.lastInteractionAt.toISOString() : '',
        c.createdAt ? c.createdAt.toISOString() : '',
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=nexaflow_contacts_${Date.now()}.csv`
    );

    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  importContacts,
  exportContacts,
};
