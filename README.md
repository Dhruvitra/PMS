# Producteev PMS 🚀

A modern Project Management System built with **React 19**, **Node.js (Express 5)**, and **PostgreSQL**.

---

## 🛠 Tech Stack

### **Backend**
- **Framework:** Express 5 (TypeScript)
- **Database:** PostgreSQL with Prisma ORM
- **Real-time:** Socket.IO
- **Caching/Queue:** Redis
- **Auth:** JWT (JSON Web Tokens)

### **Frontend**
- **Framework:** React 19 (TypeScript)
- **State Management:** Redux Toolkit
- **Routing:** React Router v7
- **Styling:** Tailwind CSS v4
- **Build Tool:** Vite

---

## 📋 Prerequisites

- **Node.js** >= 20
- **PostgreSQL** (Running instance)
- **Redis** (Running instance)

---

## 🚀 Setup & Installation

### 1. Install Dependencies
Run from the root directory to install both frontend and backend packages:
```bash
npm install

### cp backend/.env.example backend/.env
# Open backend/.env and update DATABASE_URL, REDIS_URL, and JWT_SECRET

# Run migrations
### npm run db:migrate

# Seed initial data (optional)
### npm run db:seed

### npm run dev

### cd backend
### npx prisma studio

### npx prisma db push

# Check migration status
### npx prisma migrate status

# Rollback a specific migration
### npx prisma migrate resolve --rolled-back 20260316_add_spaces_and_hierarchy

# Deploy & Generate
### npx prisma migrate deploy
### npx prisma generate

