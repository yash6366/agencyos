// server/services/fileStorageService.mjs
// Centralized Production File Storage Service for AgencyOS
// Supports durable PostgreSQL bytea/metadata storage with seamless cloud adapter (S3/R2/Vercel Blob) readiness.

import crypto from 'crypto';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/**
 * Initializes the files table if missing
 * @param {import('pg').Pool} pool
 */
export async function ensureFileTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.stored_files (
      id text PRIMARY KEY,
      filename text NOT NULL,
      mime_type text NOT NULL,
      size_bytes integer NOT NULL,
      storage_type text NOT NULL DEFAULT 'db',
      content bytea,
      url text,
      uploaded_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS stored_files_uploaded_by_idx ON public.stored_files (uploaded_by);
  `);
}

/**
 * Saves a file securely into persistent storage
 * @param {import('pg').Pool} pool
 * @param {object} file
 * @param {string} file.filename
 * @param {string} file.mimeType
 * @param {Buffer} file.buffer
 * @param {string} employeeId
 */
export async function savePersistentFile(pool, file, employeeId) {
  const { filename, mimeType, buffer } = file;

  if (!buffer || !(buffer instanceof Buffer)) {
    throw new Error('Invalid file payload: file buffer required.');
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds maximum permissible size (${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB).`);
  }

  const cleanMime = (mimeType || 'application/octet-stream').toLowerCase();
  const safeFilename = String(filename || 'attachment')
    .replace(/[^\w.-]/g, '_')
    .slice(0, 100);

  const fileId = `file-${crypto.randomUUID().slice(0, 12)}`;

  await ensureFileTable(pool);

  await pool.query(
    `INSERT INTO public.stored_files (id, filename, mime_type, size_bytes, storage_type, content, uploaded_by)
     VALUES ($1, $2, $3, $4, 'db', $5, $6)`,
    [fileId, safeFilename, cleanMime, buffer.length, buffer, employeeId]
  );

  return {
    fileId,
    fileName: safeFilename,
    mimeType: cleanMime,
    size: buffer.length,
    downloadUrl: `/api/files/${fileId}`,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Retrieves a file by its ID
 * @param {import('pg').Pool} pool
 * @param {string} fileId
 */
export async function getPersistentFile(pool, fileId) {
  await ensureFileTable(pool);
  const res = await pool.query(
    'SELECT id, filename, mime_type, size_bytes, storage_type, content, url FROM public.stored_files WHERE id=$1',
    [fileId]
  );
  const row = res.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mime_type,
    size: row.size_bytes,
    storageType: row.storage_type,
    content: row.content, // Buffer
    url: row.url,
  };
}

/**
 * Deletes a file by its ID
 * @param {import('pg').Pool} pool
 * @param {string} fileId
 * @param {string} employeeId
 */
export async function deletePersistentFile(pool, fileId, employeeId) {
  await ensureFileTable(pool);
  const res = await pool.query(
    'DELETE FROM public.stored_files WHERE id=$1 RETURNING id, filename',
    [fileId]
  );
  return res.rowCount > 0;
}
