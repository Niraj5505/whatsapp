import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Loader, Modal, Badge } from '../components/common/StatCard';
import {
  Users,
  Plus,
  Upload,
  Download,
  Search,
  Trash2,
  Edit2,
  Phone,
  Tag as TagIcon,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Eye,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ContactsPage = () => {
  const { workspace } = useAuth();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [optedOutFilter, setOptedOutFilter] = useState('');

  // Pagination State
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Active Contact for Edit / View
  const [activeContact, setActiveContact] = useState(null);
  const [contactHistory, setContactHistory] = useState({ conversation: null, messages: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    phoneNumber: '',
    name: '',
    email: '',
    tags: '',
    notes: '',
    optedOut: false,
    customFields: [{ key: '', value: '' }],
  });

  // CSV Import State
  const [csvText, setCsvText] = useState(
    'Phone,Name,Email,Tags,Notes\n+15551234567,Alice Walker,alice@example.com,VIP;Lead,Interested in Pro plan\n+15559876543,Bob Johnson,bob@acme.com,Support,Pending onboarding'
  );
  const [importing, setImporting] = useState(false);

  const fetchContacts = useCallback(
    async (page = pagination.page) => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: String(pagination.limit),
        });

        if (searchTerm.trim()) queryParams.append('search', searchTerm.trim());
        if (selectedTag) queryParams.append('tag', selectedTag);
        if (optedOutFilter !== '') queryParams.append('optedOut', optedOutFilter);

        const res = await api.get(`/contacts?${queryParams.toString()}`);
        const data = res.data.data;

        setContacts(data.contacts || []);
        setTags(data.tags || []);
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages || 1,
        });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to fetch contacts');
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit, searchTerm, selectedTag, optedOutFilter]
  );

  useEffect(() => {
    fetchContacts(1);
  }, [searchTerm, selectedTag, optedOutFilter, workspace?.id]);

  const resetForm = () => {
    setFormData({
      phoneNumber: '',
      name: '',
      email: '',
      tags: '',
      notes: '',
      optedOut: false,
      customFields: [{ key: '', value: '' }],
    });
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (contact) => {
    setActiveContact(contact);
    const existingCustom = contact.customFields
      ? Object.entries(contact.customFields).map(([k, v]) => ({ key: k, value: String(v) }))
      : [];

    setFormData({
      phoneNumber: contact.phoneNumber || '',
      name: contact.name || '',
      email: contact.email || '',
      tags: (contact.tags || []).map((t) => (typeof t === 'object' ? t.name : t)).join(', '),
      notes: contact.notes || '',
      optedOut: Boolean(contact.optedOut),
      customFields: existingCustom.length > 0 ? existingCustom : [{ key: '', value: '' }],
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDetails = async (contact) => {
    setActiveContact(contact);
    setIsDetailsModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/contacts/${contact._id}`);
      setContactHistory({
        conversation: res.data.data.conversation,
        messages: res.data.data.messages || [],
      });
    } catch (err) {
      toast.error('Failed to load contact history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCustomFieldChange = (index, field, value) => {
    const updated = [...formData.customFields];
    updated[index][field] = value;
    setFormData({ ...formData, customFields: updated });
  };

  const addCustomField = () => {
    setFormData({
      ...formData,
      customFields: [...formData.customFields, { key: '', value: '' }],
    });
  };

  const removeCustomField = (index) => {
    const updated = formData.customFields.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      customFields: updated.length > 0 ? updated : [{ key: '', value: '' }],
    });
  };

  const parseCustomFieldsObj = () => {
    const obj = {};
    formData.customFields.forEach((item) => {
      if (item.key && item.key.trim()) {
        obj[item.key.trim()] = item.value;
      }
    });
    return obj;
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    try {
      const tagsArray = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        phoneNumber: formData.phoneNumber,
        name: formData.name,
        email: formData.email,
        tags: tagsArray,
        notes: formData.notes,
        optedOut: formData.optedOut,
        customFields: parseCustomFieldsObj(),
      };

      if (isEditModalOpen && activeContact) {
        await api.put(`/contacts/${activeContact._id}`, payload);
        toast.success('Contact updated');
        setIsEditModalOpen(false);
      } else {
        await api.post('/contacts', payload);
        toast.success('Contact created');
        setIsAddModalOpen(false);
      }

      fetchContacts(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save contact');
    }
  };

  const handleDeleteContact = async (id) => {
    if (!window.confirm('Delete this contact and their conversation history?')) {
      return;
    }
    try {
      await api.delete(`/contacts/${id}`);
      toast.success('Contact deleted');
      if (isDetailsModalOpen) setIsDetailsModalOpen(false);
      fetchContacts(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete contact');
    }
  };

  const handleImportCsv = async (e) => {
    e.preventDefault();
    setImporting(true);
    try {
      const res = await api.post('/contacts/import', { csvData: csvText });
      toast.success(res.data.message || 'Contacts imported successfully');
      setIsImportModalOpen(false);
      fetchContacts(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to import CSV');
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target?.result || '');
    };
    reader.readAsText(file);
  };

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/contacts/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contacts_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Contacts exported to CSV');
    } catch (err) {
      toast.error('Failed to export contacts');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            Contacts & Audience
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage WhatsApp customer directory, audience tags, opt-out status, and conversation history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1.5"
          >
            <Download size={13} className="text-zinc-400" />
            <span>Export</span>
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1.5"
          >
            <Upload size={13} className="text-zinc-400" />
            <span>Import</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus size={14} />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="w-full bg-zinc-950 text-zinc-100 text-xs pl-8 pr-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Status filter */}
          <select
            value={optedOutFilter}
            onChange={(e) => setOptedOutFilter(e.target.value)}
            className="bg-zinc-950 text-zinc-300 text-xs px-2.5 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-600 font-mono"
          >
            <option value="">All Statuses</option>
            <option value="false">Subscribed Only</option>
            <option value="true">Opted-Out Only</option>
          </select>

          {/* Tags list */}
          {tags.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5">
              <button
                onClick={() => setSelectedTag('')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  !selectedTag
                    ? 'bg-zinc-800 text-zinc-100 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All
              </button>
              {tags.map((t) => (
                <button
                  key={t._id || t.name}
                  onClick={() => setSelectedTag(t._id || t.name)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
                    selectedTag === (t._id || t.name)
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                      : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  #{t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950 text-[10px] uppercase tracking-wider font-semibold text-zinc-400 border-b border-zinc-800 font-mono">
              <tr>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Phone Number</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader size="md" />
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500 text-xs">
                    <Users size={28} className="mx-auto mb-2 text-zinc-700" />
                    <p className="font-medium text-zinc-400">No contacts found</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Add a contact or import CSV to populate this workspace.</p>
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c._id} className="hover:bg-zinc-850/50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-medium text-xs text-zinc-200 shrink-0">
                          {c.name?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div>
                          <div
                            onClick={() => handleOpenDetails(c)}
                            className="font-medium text-zinc-100 hover:text-emerald-400 cursor-pointer transition-colors"
                          >
                            {c.name}
                          </div>
                          {c.email ? (
                            <div className="text-[10px] text-zinc-500">{c.email}</div>
                          ) : (
                            <div className="text-[10px] text-zinc-600 italic">No email</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-200">
                      {c.phoneNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {c.tags && c.tags.length > 0 ? (
                          c.tags.map((tag) => (
                            <span
                              key={tag._id || tag.name || tag}
                              className="px-1.5 py-0.2 rounded bg-zinc-950 text-[10px] font-mono text-zinc-400 border border-zinc-800"
                            >
                              #{tag.name || tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-zinc-600">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.optedOut ? 'danger' : 'success'}>
                        {c.optedOut ? 'Opted-Out' : 'Subscribed'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-zinc-400">
                      {c.lastInteractionAt ? new Date(c.lastInteractionAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenDetails(c)}
                          title="View Details"
                          className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          title="Edit"
                          className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(c._id)}
                          title="Delete"
                          className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-zinc-950 px-4 py-2.5 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-400 font-mono">
          <div>
            Showing <span className="text-zinc-200 font-semibold">{contacts.length}</span> of{' '}
            <span className="text-zinc-200 font-semibold">{pagination.total}</span> contacts
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchContacts(pagination.page - 1)}
              className="p-1 rounded border border-zinc-800 bg-zinc-900 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2">
              {pagination.page} / {pagination.totalPages || 1}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchContacts(pagination.page + 1)}
              className="p-1 rounded border border-zinc-800 bg-zinc-900 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Contact Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
        }}
        title={isEditModalOpen ? 'Edit Contact' : 'New Contact'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveContact} className="space-y-3.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">
                Phone Number (E.164) *
              </label>
              <input
                type="text"
                required
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="+15551234567"
                className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Jane Smith"
                className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="jane@example.com"
                className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="VIP, Lead"
                className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Background notes..."
              className="w-full bg-zinc-950 text-zinc-100 text-xs p-2.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Opt-out Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="optedOut"
              checked={formData.optedOut}
              onChange={(e) => setFormData({ ...formData, optedOut: e.target.checked })}
              className="w-3.5 h-3.5 rounded text-zinc-100 bg-zinc-950 border-zinc-800"
            />
            <label htmlFor="optedOut" className="text-xs text-zinc-300 select-none">
              Mark as Opted-Out (excludes from broadcasts)
            </label>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setIsEditModalOpen(false);
              }}
              className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-750"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md bg-zinc-100 text-zinc-950 hover:bg-white text-xs font-semibold"
            >
              {isEditModalOpen ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import CSV Contacts"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleImportCsv} className="space-y-3.5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                Paste CSV content
              </label>
              <label className="text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer underline flex items-center gap-1">
                <Upload size={11} />
                <span>Upload file</span>
                <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full font-mono text-xs bg-zinc-950 text-zinc-100 p-3 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-750"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={importing}
              className="px-3 py-1.5 rounded-md bg-zinc-100 text-zinc-950 hover:bg-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
            >
              {importing && <Loader size="sm" />}
              <span>{importing ? 'Importing...' : 'Import CSV'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Contact Details & History Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={activeContact ? `${activeContact.name}` : 'Contact Details'}
        maxWidth="max-w-xl"
      >
        {activeContact && (
          <div className="space-y-4">
            <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-3.5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100">{activeContact.name}</h3>
                  <Badge variant={activeContact.optedOut ? 'danger' : 'success'}>
                    {activeContact.optedOut ? 'Opted-Out' : 'Subscribed'}
                  </Badge>
                </div>
                <div className="font-mono text-xs text-zinc-400 mt-0.5">{activeContact.phoneNumber}</div>
              </div>

              <button
                onClick={() => navigate('/inbox')}
                className="px-2.5 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium flex items-center gap-1"
              >
                <MessageSquare size={13} />
                <span>Open Chat</span>
              </button>
            </div>

            {/* Notes */}
            <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-3 text-xs space-y-1">
              <span className="font-mono text-[10px] text-zinc-500 uppercase">Notes</span>
              <p className="text-zinc-300 whitespace-pre-wrap">{activeContact.notes || 'No notes attached.'}</p>
            </div>

            {/* Conversation Messages */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Recent Message History
              </h4>
              {loadingHistory ? (
                <Loader size="sm" />
              ) : contactHistory.messages.length === 0 ? (
                <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-lg text-center text-xs text-zinc-500">
                  No conversation messages found.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto p-2.5 bg-zinc-950 border border-zinc-850 rounded-lg">
                  {contactHistory.messages.map((m) => (
                    <div
                      key={m._id}
                      className={`p-2 rounded text-xs max-w-sm ${
                        m.direction === 'outbound'
                          ? 'ml-auto bg-zinc-800 text-zinc-100'
                          : 'mr-auto bg-zinc-900 border border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-0.5">
                        <span>{m.direction === 'outbound' ? 'Outbound' : 'Inbound'}</span>
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p>{m.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ContactsPage;
