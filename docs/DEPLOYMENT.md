# AgencyOS Deployment & Configuration Guide

This guide details configuring and deploying AgencyOS in local development and production cloud environments.

---

## 1. Environment Configuration (`.env`)

Create or update `.env` in the project root:

```ini
# Database (Supabase Cloud PostgreSQL)
DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:5432/postgres
DB_SSL=true

# Security
JWT_SECRET=super_secure_random_string_min_16_characters

# Server Port
PORT=4000
```

### Key Environment Variables

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection URI | `postgresql://postgres:pass@host:5432/postgres` |
| `DB_SSL` | Enable TLS/SSL connection (required for Supabase) | `true` |
| `JWT_SECRET` | Secret key used for signing JWT session tokens | Min. 16 characters |
| `PORT` | Port for Express backend server | `4000` |
| `VITE_PORT` | Port for Vite frontend web server | `3000` |

---

## 2. Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Environment**:
   ```bash
   npm run dev
   ```
   This concurrently launches:
   - **Backend API**: `http://localhost:4000`
   - **Frontend App**: `http://localhost:3000`

3. **Verify Health**:
   Open `http://localhost:4000` or check `http://localhost:4000/api/status` to confirm the PostgreSQL database is connected.

---

## 3. Production Deployment

### 3.1 Database (Supabase)
1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Obtain your connection string from **Project Settings > Database > Connection Pooling (Session mode or Direct mode, Port 5432)**.
3. Supply `DATABASE_URL` and `DB_SSL=true` in your deployment environment variables.

### 3.2 Hosting Backend & Frontend (Vercel)
AgencyOS includes `vercel.json` and serverless API handlers in `api/`:
1. Push your repository to GitHub.
2. Import the project in Vercel.
3. Configure Environment Variables in Vercel project settings:
   - `DATABASE_URL`
   - `DB_SSL=true`
   - `JWT_SECRET`
4. Deploy. Vercel automatically routes `/api/*` to the serverless backend and serves the Vite static build.
