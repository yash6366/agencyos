# AgencyOS API Reference

The backend API runs on Node.js (Express ESM) at `http://localhost:4000` (proxied by Vite under `/api`).

---

## 1. Authentication & Session Endpoints

### `POST /api/auth/login`
Authenticates a user with email/employee ID and password.
- **Request Body:**
  ```json
  {
    "login": "john@priorityadsagency.com",
    "password": "Password123"
  }
  ```
- **Response (200):**
  ```json
  {
    "token": "<JWT_BEARER_TOKEN>",
    "user": {
      "id": "emp-1",
      "name": "John Doe",
      "role": "manager",
      "mustChange": false
    }
  }
  ```

### `GET /api/auth/profile`
Retrieves profile information for the authenticated user.
- **Headers:** `Authorization: Bearer <TOKEN>`

### `GET /api/sessions`
Returns active sessions for the current user.

---

## 2. Data Synchronization Endpoints

### `GET /api/bootstrap`
Pulls table data for all client-synced stores upon initial application load.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Response:** Object mapping store keys (e.g. `paa_employees`, `paa_leads`, etc.) to arrays of entity objects.

### `POST /api/sync`
Debounced batch write endpoint for pushing modifications made in the browser to PostgreSQL.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Request Body:**
  ```json
  {
    "store": "paa_tasks",
    "records": [ ... ],
    "deleted": [ "task-id-1" ]
  }
  ```

---

## 3. Paginated Resource Endpoints

Cursor-based paginated endpoints for large dataset rendering:

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

## 4. System Status & Health

- `GET /api/health`: Health check endpoint (`{ "ok": true, "db": true }`).
- `GET /api/status`: JSON report detailing node version, PostgreSQL connection status, table count, active sessions, and recent sync events.
- `GET /api/server`: Interactive HTML diagnostics dashboard.
