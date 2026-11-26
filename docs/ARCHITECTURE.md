# AgencyOS Architecture

AgencyOS is an integrated enterprise ERP and management operating system built for advertising and creative agencies. It combines human resources, client relationship management, task orchestration, financial billing, and audit reporting into an offline-first, client-synchronized web platform.

---

## 1. High-Level System Architecture

```mermaid
flowchart TD
    subgraph BrowserClient["Browser Client (React 19 + Vite)"]
        UI["React Component Tree"]
        AppContext["AppContext State & Reducers"]
        Router["Centralized Router (History API)"]
        SharedStore["sharedStore (CustomEvent Pub/Sub)"]
        LocalStorage["Browser localStorage (Entity Snapshot)"]
        DBSync["dbSync.ts (Storage Synchronization)"]
    end

    subgraph BackendServer["Backend Server (Express 4.21 + pg)"]
        ServerEntry["server/index.mjs"]
        AuthMiddleware["JWT Authentication Middleware"]
        BootstrapRoute["GET /api/bootstrap"]
        SyncRoute["POST /api/sync"]
        ResourceRoutes["Paginated API Endpoints (/api/leads, /invoices, etc.)"]
        Integrations["Third-party Services (Google Calendar, OAuth)"]
    end

    subgraph Database["PostgreSQL 15+ (Supabase Cloud or Local)"]
        Tables["29 Hybrid Relational / JSONB Tables"]
        AppSettings["app_settings (Configuration Store)"]
        AppRecords["app_records (Store-ID JSONB)"]
        AuditLogs["audit_logs (Append-Only Trigger)"]
    end

    UI --> AppContext
    UI --> Router
    AppContext --> LocalStorage
    SharedStore --> LocalStorage
    LocalStorage -- "Storage Hook" --> DBSync
    DBSync -- "Debounced HTTP POST" --> SyncRoute
    BootstrapRoute -- "Full Table Dumps" --> DBSync
    DBSync -- "writeAll()" --> LocalStorage
    SyncRoute --> Tables
    SyncRoute --> AppRecords
    ResourceRoutes --> Tables
```

---

## 2. Core Architectural Pillars

### 2.1 Hybrid Offline-First / Client Synchronization
- **Client Store**: Frontend state is loaded into memory and backed by `localStorage` for responsive UI rendering and offline tolerance.
- **Sync Engine (`src/os/dbSync.ts`)**: Changes trigger debounced synchronization requests (`POST /api/sync`) to persist modifications into PostgreSQL.
- **Bootstrap (`GET /api/bootstrap`)**: On session initialization, the client syncs table snapshots from the backend to ensure consistency across devices and users.

### 2.2 Hybrid PostgreSQL Model
- **Structured Columns**: High-frequency query columns (e.g., `employee_code`, `status`, `date`, `client_id`, `total`) are extracted as native columns with relational indexes and foreign keys.
- **Full Entity JSONB (`data jsonb`)**: Retains complete record documents with flexible schema attributes and version tracking.
- **Optimistic Concurrency**: Records increment `version` counter upon mutations to detect conflicts.

### 2.3 Role-Based Access Control (RBAC)
- **Role Hierarchy**: Roles include `super_admin`, `admin`, `manager`, `hr`, `finance`, `sales_manager`, `team_leader`, `staff`, `auditor`, and more.
- **Permission Matrix**: Module-level view permissions (`V`) and CRUD actions:
  - `C`: Create
  - `E`: Edit
  - `D`: Delete
  - `A`: Approve (leave, attendance, reimbursements)
  - `X`: Export
- **Row-Level Ownership**: Staff users are constrained to records assigned to their own `employee_id`.

### 2.4 Immutable Audit Logging
- **Append-Only Integrity**: The `audit_logs` table has a database-level trigger (`audit_no_change()`) blocking `UPDATE` and `DELETE` queries, ensuring tamper-proof audit trails for compliance.
