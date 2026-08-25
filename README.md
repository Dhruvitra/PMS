# Producteev PMS 🚀

A comprehensive, full-featured Project Management & Employee Tracking System built with modern technologies: **React 19**, **Node.js (Express 5)**, **PostgreSQL (Prisma)**, **Socket.IO**, and an **Electron Desktop Time Tracker**.

---

## 🌟 Key Features

- **🏢 Multi-Tenant Workspace & Spaces:** Manage organizations, spaces, folders, and lists with granular role-based access control (Super Admin, Owner, Admin, Member, Limited Member, Guest).
- **📋 Advanced Task Management:**
  - Multiple views: List View, Kanban Board, Calendar View, and Gantt View.
  - Task priorities, statuses, due dates, tags, custom fields, rich descriptions, checklists, and attachments.
  - Quick filters and global search.
- **💬 Real-Time Chat & Collaboration:**
  - Direct 1-on-1 team messaging with WhatsApp-styled theme.
  - Voice notes, emoji picker, mentions, and file/video attachments.
  - Live 1-on-1 WebRTC Video Calls and Admin Screen Monitoring.
- **⏱️ Desktop Time Tracker (Electron App):**
  - Cross-platform desktop time tracker with start/stop timer.
  - Automatic screenshot capture every 3 minutes while active.
  - Employee productivity logs, activity levels, and daily/monthly summaries.
- **💰 Payroll & HR Management:**
  - Salary master, allowance/deduction structures, and payroll run generation.
  - Employee attendance and late-in tracking.
- **🗑️ Admin Recycle Bin:** Recover or permanently purge deleted tasks, lists, folders, and attachments.
- **🌓 Dark / Light Mode:** Sleek modern UI with dark & light themes.

---

## 🛠️ Tech Stack

### **Frontend (`/frontend`)**
- **Framework:** React 19 (TypeScript)
- **Styling:** Tailwind CSS v4
- **State Management:** Redux Toolkit
- **Routing:** React Router v7
- **Animations:** Framer Motion
- **Charts:** Recharts
- **Icons:** Lucide React
- **Build Tool:** Vite

### **Backend (`/backend`)**
- **Runtime:** Node.js (TypeScript)
- **Framework:** Express 5
- **ORM & Database:** Prisma ORM with PostgreSQL
- **Real-Time Communication:** Socket.IO
- **Cache & Memory Store:** Redis
- **Authentication:** JWT (JSON Web Tokens) & bcrypt
- **File Storage:** Local uploads with static serving

### **Desktop Tracker (`/tracker`)**
- **Framework:** Electron 34 + electron-vite
- **Renderer:** React 19 + TypeScript
- **Features:** Desktop screenshot capture, system idle detection, real-time timer sync

---

## 📁 Repository Structure

```
Producteev-Producteev/
├── backend/               # Node.js + Express + Prisma backend API
│   ├── prisma/            # Database schema & migrations
│   ├── src/               # Controllers, routes, services, socket handlers
│   └── uploads/           # Uploaded files and screenshots
├── frontend/              # React 19 web application
│   ├── src/               # Components, pages, hooks, store
│   └── public/            # Static assets
├── tracker/               # Electron desktop time tracker application
│   ├── src/main/          # Electron main process (screenshots, idle tracker)
│   ├── src/preload/       # Context bridge
│   └── src/renderer/      # React UI for tracker
└── docker-compose.yml     # PostgreSQL and Redis services
```

---

## 🚀 Getting Started

### 📋 Prerequisites
- **Node.js:** v20+ recommended
- **npm** or **pnpm**
- **PostgreSQL** (Running instance or Docker)
- **Redis** (Running instance or Docker)

---

### 1. Clone Repository & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/Dhruvitra/PMS.git
cd PMS

# Install root dependencies
npm install

# Install workspace dependencies
cd backend && npm install
cd ../frontend && npm install
cd ../tracker && npm install
cd ..
```

---

### 2. Environment Configuration

Create `.env` file in `backend/`:

```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://username:password@localhost:5432/producteev_pms?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:5173"
CLIENT_URL="http://localhost:5173"
```

---

### 3. Database Setup & Migrations

```bash
cd backend

# Run database migrations
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate

# Seed initial data (optional)
npm run db:seed
```

---

### 4. Running the Applications Locally

Open separate terminals or run in concurrent mode:

#### **Backend Server** (Port 4000):
```bash
cd backend
npm run dev
```

#### **Frontend Web App** (Port 5173):
```bash
cd frontend
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

#### **Desktop Time Tracker**:
```bash
cd tracker
npm run dev
```

---

## 🛠️ Useful Commands

| Command | Location | Description |
|---|---|---|
| `npx prisma studio` | `backend/` | Open visual database GUI |
| `npx prisma db push` | `backend/` | Push schema changes directly |
| `npm run build` | `frontend/` | Create production bundle for frontend |
| `npm run build` | `tracker/` | Package Electron desktop app |

---

## 📄 License

This project is licensed under the ISC License.
