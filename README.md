# AgencyOS

> Enterprise Operating System & ERP for Modern Agencies

AgencyOS is an integrated enterprise platform designed for creative, marketing, and advertising agencies. It combines HR, CRM, Project Management, Billing & Financial Tracking, and Compliance into a unified, offline-first web application.

---

## 🚀 Features

- **Human Resources (HR)**: Employee directory, attendance logging, leave approvals, reimbursement claims, and automatic payroll/payslip calculations.
- **Client Relationship Management (CRM)**: Inbound lead tracking, client accounts, quotations, and retainer/service contracts.
- **Projects & Task Management**: Project tracking, task delegation, team schedules, and activity reports.
- **Financial Accounting**: Invoices, payment settlement tracking, expense logging, and real-time revenue analytics.
- **Role-Based Access Control (RBAC)**: Fine-grained permission matrix with row-level ownership and role enforcement.
- **Tamper-Proof Audit Trail**: Immutable append-only audit logging triggered directly in PostgreSQL.
- **Offline-First Synchronization**: Client-side responsiveness backed by localStorage with debounced background database synchronization.

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend**: Node.js (ESM), Express 4.21
- **Database**: PostgreSQL 15+ (Hosted on Supabase or Local PostgreSQL)
- **Authentication**: JWT sessions with bcrypt credential hashing
- **Deployment**: Vercel ready (serverless configuration in `vercel.json` and `api/`)

---

## ⚡ Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- PostgreSQL database (or free [Supabase](https://supabase.com) project)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone <YOUR_REPOSITORY_URL>
cd agencyos
npm install
```

### 3. Environment Variables
Create a `.env` file in the project root:
```ini
# Supabase Cloud Database (or local PostgreSQL)
DATABASE_URL=postgresql://<USER>:<PASSWORD>@<HOST>:5432/postgres
DB_SSL=true

# Security
JWT_SECRET=your_super_secret_jwt_key_at_least_16_chars
PORT=4000
```

### 4. Run Development Server
```bash
npm run dev
```

This concurrently launches:
- **AgencyOS Server**: [http://localhost:4000](http://localhost:4000)
- **Web Application**: [http://localhost:3000](http://localhost:3000)

---

## 📚 Documentation

Detailed documentation is available in the [`docs/`](docs/) directory:

- 🏗 **[Architecture Overview](docs/ARCHITECTURE.md)**: System design, offline-first sync lifecycle, and RBAC matrix.
- 🗄 **[Database Specification](docs/DATABASE.md)**: Entity-relationship diagram, hybrid relational/JSONB schema, and tables reference.
- 🔌 **[API Reference](docs/API.md)**: Endpoints for authentication, synchronization, pagination, and health checks.
- 🚢 **[Deployment Guide](docs/DEPLOYMENT.md)**: Step-by-step instructions for deploying to Supabase and Vercel.

---

## 📜 Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Runs both Express backend and Vite frontend concurrently |
| `npm run build` | Compiles the production Vite build to `dist/` |
| `npm run preview` | Previews the compiled frontend build locally |
| `npm run server` | Starts only the Express backend server on port 4000 |
| `npm run dev:web` | Starts only the Vite frontend dev server on port 3000 |

---

## 📄 License

Internal Agency Platform — Proprietary. All rights reserved.
