# AgencyOS API Reference

The AgencyOS backend API is an Express (Node.js ESM) service running at `http://localhost:4000` (proxied by the Vite frontend under `/api`).

All endpoints under `/api` (except `/api/health`, `/api/status`, `/api/server`, `/api/auth/login`, `/api/setup/*`, and webhook receivers) require JWT authentication passed via the `Authorization: Bearer <TOKEN>` header.

---

## 1. Authentication & Session Management

### `POST /api/auth/login`
Authenticates a user using their work email or employee code.
- **Request Body:**
  ```json
  {
    "login": "rajesh.sharma@priorityadsagency.com",
    "password": "Password123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "<JWT_BEARER_TOKEN>",
    "user": {
      "id": "emp-1",
      "name": "Rajesh Sharma",
      "role": "super_admin",
      "mustChange": false
    }
  }
  ```

### `POST /api/auth/logout`
Revokes the current JWT session.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Response (200 OK):**
  ```json
  { "ok": true }
  ```

### `POST /api/auth/logout-others`
Terminates all active sessions for the current user except the caller's active session.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Response (200 OK):**
  ```json
  { "ok": true, "ended": 2 }
  ```

### `GET /api/auth/sessions`
Returns a list of all active or recent sessions for the authenticated user.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Response (200 OK):**
  ```json
  [
    {
      "id": "sess-uuid-1",
      "ip": "127.0.0.1",
      "user_agent": "Mozilla/5.0 ...",
      "created_at": "2026-11-27T10:00:00Z",
      "last_seen": "2026-11-27T12:00:00Z",
      "revoked_at": null,
      "current": true
    }
  ]
  ```

### `POST /api/auth/sessions/:id/revoke`
Revokes a specific session belonging to the user.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Response (200 OK):**
  ```json
  { "ok": true }
  ```

### `POST /api/auth/password`
Updates the authenticated user's password and clears the `must_change` flag.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Request Body:**
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewStrongPassword456!"
  }
  ```
- **Response (200 OK):**
  ```json
  { "ok": true }
  ```

### `GET /api/auth/profile`
Retrieves detailed profile information for the authenticated user.
- **Headers:** `Authorization: Bearer <TOKEN>`

### `PUT /api/auth/profile`
Updates profile contact details, address, or emergency information for the current user.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Request Body:** JSON containing editable profile fields.

---

## 2. Setup & Initialization

### `GET /api/setup/status`
Checks whether the database has been initialized and seeded with an administrative account.
- **Response (200 OK):**
  ```json
  {
    "initialized": true,
    "hasAdmin": true,
    "tablesCount": 29
  }
  ```

### `POST /api/setup/import`
Performs bulk import of initial tenant configurations during first-time onboarding.

---

## 3. Data Synchronization & Search

### `GET /api/bootstrap`
Pulls complete snapshots for all client-synchronized stores upon initial application load.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Response:** Object mapping store keys (`paa_employees`, `paa_clients`, `paa_tasks`, `paa_leads`, etc.) to arrays of entity records.

### `POST /api/sync`
Debounced batch mutation endpoint. Writes local changes to PostgreSQL with optimistic concurrency checks.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Request Body:**
  ```json
  {
    "store": "paa_tasks",
    "records": [
      {
        "id": "task-101",
        "taskCode": "TSK-0101",
        "title": "Update Landing Page",
        "projectId": "proj-1",
        "assignedEmployeeId": "emp-2",
        "status": "in_progress",
        "dueDate": "2026-12-01",
        "version": 2
      }
    ],
    "deleted": ["task-099"]
  }
  ```
- **Response (200 OK):**
  ```json
  { "ok": true, "synced": 1, "deleted": 1 }
  ```

### `GET /api/changes?since=<TIMESTAMP>`
Retrieves a delta change feed of entity mutations since a specific ISO-8601 timestamp.
- **Headers:** `Authorization: Bearer <TOKEN>`

### `GET /api/search?q=<QUERY>&module=<MODULE>`
Unified global full-text search querying across leads, clients, projects, tasks, and employees.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Query Parameters:**
  - `q`: Search term (minimum 2 characters)
  - `module` (optional): Filter to specific domain (`crm`, `tasks`, `employees`, etc.)

---

## 4. Paginated Resource Endpoints

High-performance cursor-paginated endpoints for browsing large collections:

- `GET /api/leads?limit=25&cursor=<ID>`
- `GET /api/clients?limit=25&cursor=<ID>`
- `GET /api/tasks?limit=25&cursor=<ID>`
- `GET /api/invoices?limit=25&cursor=<ID>`

**Response Format:**
```json
{
  "items": [ ... ],
  "nextCursor": "lead-105",
  "hasMore": true,
  "limit": 25
}
```

---

## 5. Specialized Workflow Endpoints

### `POST /api/field-visits/:id/check-in`
Registers a GPS check-in timestamp and coordinates for a scheduled field visit.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Request Body:**
  ```json
  {
    "latitude": 13.0827,
    "longitude": 77.5877,
    "locationName": "Client HQ Bengaluru",
    "notes": "Arrived at reception"
  }
  ```

### `POST /api/field-visits/:id/check-out`
Completes a field visit with checkout notes and optional signature/proof.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Request Body:**
  ```json
  {
    "notes": "Meeting concluded with marketing VP",
    "signatureUrl": "data:image/png;base64,..."
  }
  ```

### `POST /api/leads/:id/convert`
Converts a qualified lead into an active client account and automatically scaffolds associated agreements or project shells.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Request Body:**
  ```json
  {
    "clientData": { ... },
    "agreementData": { ... }
  }
  ```

### `POST /api/invoices`
Creates a validated invoice record with financial authorization verification.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Request Body:**
  ```json
  {
    "clientId": "client-1",
    "items": [ ... ],
    "taxRate": 18,
    "dueDate": "2026-12-15"
  }
  ```

### `POST /api/payroll/calculate`
Executes server-side payroll calculation for an employee and pay period adhering to configured statutory rules (PF, ESI, TDS, allowances).
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Request Body:**
  ```json
  {
    "employeeId": "emp-1",
    "month": 11,
    "year": 2026
  }
  ```

---

## 6. Third-Party Integrations & Webhooks

### Google Calendar Integration
- `GET /api/integrations/google/auth-url`: Generates Google OAuth 2.0 authorization URL.
- `POST /api/integrations/google/callback`: Exchanges authorization code for refresh & access tokens.
- `GET /api/integrations/google/status`: Returns current calendar sync health and connected account details.
- `POST /api/integrations/google/sync`: Triggers bi-directional synchronization between AgencyOS tasks/events and Google Calendar.
- `POST /api/integrations/google/disconnect`: Revokes Google OAuth tokens and disables sync.
- `GET /api/integrations/google/logs`: Fetches the history of calendar sync operations and diagnostic events.

### Webhooks
- `POST /api/webhooks/whatsapp`: Inbound webhook endpoint for WhatsApp messaging events. Verified via HMAC-SHA256 signature in the `X-Hub-Signature-256` header using `WHATSAPP_WEBHOOK_SECRET`.

---

## 7. System Diagnostics & Health

- `GET /api/health`: Basic liveness and database ping (`{ "ok": true, "db": true }`).
- `GET /api/status`: Detailed system status report containing Node.js version, database latency, table metrics, active sessions, and recent sync transactions.
- `GET /api/server`: Interactive browser-accessible diagnostic portal.
