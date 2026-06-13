/**
 * Resolves a backend asset URL (e.g. /uploads/avatars/foo.jpg)
 * to an absolute URL including the backend base.
 *
 * The backend serves static files at http://localhost:5000/uploads/...
 * The frontend is at http://localhost:5173 — so relative paths won't work.
 */
const BACKEND_BASE = import.meta.env.VITE_API_BASE
  ? import.meta.env.VITE_API_BASE.replace('/api', '')
  : 'http://localhost:5000';

export function assetUrl(path) {
  if (!path) return null;
  // Already absolute (blob:, http:, https:)
  if (path.startsWith('blob:') || path.startsWith('http')) return path;
  // Relative backend path like /uploads/avatars/file.jpg
  return `${BACKEND_BASE}${path}`;
}
