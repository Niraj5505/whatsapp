# NexaFlow - WhatsApp Automation SaaS

NexaFlow is a modern, production-grade WhatsApp Automation & Business Messaging SaaS built with **Pure JavaScript**, **Node.js/Express**, **MongoDB/Mongoose**, **React + Vite**, **Tailwind CSS**, and **Socket.IO**.

---

## 🚀 Key Features

- **Multi-Tenant / User Authentication**: Secure JWT + bcrypt authentication, role management, and user settings.
- **Meta WhatsApp Cloud API Integration**:
  - Secure Webhook Verification (`GET /api/webhooks/whatsapp`)
  - Webhook Event Processing (`POST /api/webhooks/whatsapp`) for incoming chats, media, and status receipts (sent, delivered, read, failed).
  - Graph API client for dispatching Text, Images, Documents, Interactive Buttons, and approved Meta Templates.
- **Flow & Bot Automation Engine**:
  - Keyword trigger rules (e.g., `#support`, `help`, `pricing`).
  - Automatic welcome messages & after-hours fallback replies.
  - Interactive branching logic with contact tag assignment.
- **Broadcasting & Campaign Manager**:
  - Targeted bulk WhatsApp campaigns with variable interpolation (`{{name}}`, `{{company}}`).
  - Real-time campaign delivery, open/read rate tracking.
- **Live Two-Way Inbox & CRM**:
  - Instant live messaging powered by **Socket.IO**.
  - Contact tagging, custom fields, and conversation status tracking (Open, Pending, Resolved).
- **Template Management**:
  - Create, view, and test Meta WhatsApp message templates directly.
- **Real-Time Analytics**:
  - Dynamic KPI cards, daily message volume charts, delivery vs read ratios, and flow execution logs.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js (JavaScript), Socket.IO, Helmet, Morgan, Express-Rate-Limit, Zod
- **Database**: MongoDB with Mongoose ODM
- **Frontend**: React 18, Vite (JavaScript), Tailwind CSS, Lucide React, React Hot Toast, React Router DOM, Socket.IO Client, Axios
- **Strictly No**: TypeScript, Prisma, PostgreSQL, SQLite, Firebase, Supabase.

---

## ⚙️ Environment Variables

Create `.env` inside `server/` (or use the root `.env`):

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.la5bw0i.mongodb.net/whatsapp?retryWrites=true&w=majority&appName=Whatsapp
JWT_SECRET=nexaflow_super_secret_jwt_key_2025_prod
META_ACCESS_TOKEN=
META_APP_SECRET=
META_VERIFY_TOKEN=nexaflow_verify_token_secure_123
META_PHONE_NUMBER_ID=
META_BUSINESS_ACCOUNT_ID=
CLIENT_URL=http://localhost:5173
```

---

## 🏃 Running the Application

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Start Development Servers (Backend + Frontend concurrently)
```bash
npm run dev
```

- Backend runs on: `http://localhost:5000` (Health Check: `http://localhost:5000/api/health`)
- Frontend runs on: `http://localhost:5173`
