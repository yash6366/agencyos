# AgencyOS Deployment & Configuration Guide

This guide details configuring and deploying AgencyOS in local development and production cloud environments.

---

## 1. Environment Configuration (`.env`)

Create or update `.env` in the project root from `.env.example`:

```ini
# Database (PostgreSQL / Supabase)
DATABASE_URL=postgresql://postgres:<PASSWORD>@<HOST>:5432/postgres
DB_SSL=true

# Authentication & Security
JWT_SECRET=super_secure_random_string_min_16_characters
TOKEN_ENCRYPTION_KEY=your_32_byte_token_encryption_key_for_integrations

# Optional Initial Super Admin Credentials (used during db:seed)
INITIAL_ADMIN_EMAIL=rajesh.sharma@priorityadsagency.com
INITIAL_ADMIN_PASSWORD=YourStrongInitialAdminPassword123!

# Server Port
PORT=4000

# Integrations (Optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
WHATSAPP_WEBHOOK_SECRET=
```

### Key Environment Variables

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection URI | `postgresql://postgres:pass@host:5432/postgres` |
| `DB_SSL` | Enable TLS/SSL connection (required for Supabase) | `true` |
| `JWT_SECRET` | Secret key used for signing JWT session tokens | Min. 16 characters |
| `TOKEN_ENCRYPTION_KEY` | 32-byte key used for encrypting stored OAuth integration tokens | 32-character string |
| `INITIAL_ADMIN_EMAIL` | Initial super admin email seeded on setup | `rajesh.sharma@priorityadsagency.com` |
| `INITIAL_ADMIN_PASSWORD` | Initial super admin password seeded on setup | Min. 8 characters |
| `PORT` | Port for Express backend server | `4000` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console | `xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret from Google Cloud Console | `GOCSPX-xxxx` |
| `GOOGLE_REDIRECT_URI` | Authorized OAuth redirect URI | `http://localhost:3000/integrations/google/callback` |
| `WHATSAPP_WEBHOOK_SECRET`| Secret key for validating WhatsApp HMAC-SHA256 signatures | Random string |

---

## 2. Local Development

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher (verified by engine checks and CI runner)
- **PostgreSQL**: PostgreSQL 15+ or a free cloud instance on [Supabase](https://supabase.com)

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Migration & Seeding
Initialize schema tables, apply versioned migrations, and seed initial master data:
```bash
npm run db:setup
```

### 4. Start Development Environment
```bash
npm run dev
```

This concurrently launches:
- **Backend API**: `http://localhost:4000`
- **Frontend App**: `http://localhost:3000`

### 5. Running Tests & Linters
```bash
npm run lint    # TypeScript compile check (tsc --noEmit)
npm test        # AgencyOS test runner (scripts/test-runner.mjs)
```

---

## 3. Production Deployment

### 3.1 Database Setup (Supabase)
1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Obtain your connection string from **Project Settings > Database > Connection Pooling (Session mode or Direct mode, Port 5432)**.
3. Supply `DATABASE_URL` and `DB_SSL=true` in your deployment environment variables.
4. Execute `npm run db:setup` via your deployment pipeline or CI job to initialize tables and migrations.

### 3.2 Hosting on Vercel
AgencyOS includes full serverless configuration in `vercel.json` and API proxies in `api/`:
1. Push your repository to GitHub.
2. Import the project in Vercel.
3. Configure Environment Variables in Vercel project settings:
   - `DATABASE_URL`
   - `DB_SSL=true`
   - `JWT_SECRET`
   - `TOKEN_ENCRYPTION_KEY`
4. Deploy. Vercel automatically routes `/api/*` to the serverless backend and serves the Vite static build.

---

## 4. CI/CD Pipeline

Continuous Integration is automated via GitHub Actions (`.github/workflows/ci.yml`):
- Runs on push and pull requests to `main` and `master`.
- Sets up Node.js 22.x.
- Installs dependencies using `npm ci`.
- Executes `npm run lint` for type checking.
- Executes `npm test` for runtime test validations.
- Compiles production assets with `npm run build`.
