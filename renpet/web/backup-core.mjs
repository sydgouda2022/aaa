// Renpet's private, offline-only backup format. Never reads unrelated site storage.
export const BACKUP_FORMAT = 'renpet.backup.v1';
export const STORAGE_KEYS = Object.freeze(['renpet.settings.v1', 'renpet.scheduler.v1']);
const MAX_BYTES = 5 * 1024 * 1024;

function validateEntry(value, key) {
  if (typeof value !== 'string' || value.length > MAX_BYTES) throw new Error('Invalid backup entry: ' + key);
  let decoded;
  try { decoded = JSON.parse(value); } catch { throw new Error('Corrupt backup entry: ' + key); }
  if (!decoded || typeof decoded !== 'object') throw new Error('Invalid backup data: ' + key);
  return value;
}
export function createBackup(storage, now = new Date()) {
  const entries = Object.create(null);
  for (const key of STORAGE_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) entries[key] = validateEntry(value, key);
  }
  if (!Object.keys(entries).length) throw new Error('No local Renpet data to back up');
  return JSON.stringify({ format: BACKUP_FORMAT, created_at: now.toISOString(), entries }, null, 2);
}
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('Backup file is too large or invalid');
  let file;
  try { file = JSON.parse(text); } catch { throw new Error('Not a valid JSON backup'); }
  if (!file || typeof file !== 'object' || Array.isArray(file) || file.format !== BACKUP_FORMAT)
    throw new Error('Not a supported Renpet backup');
  if (!file.entries || typeof file.entries !== 'object' || Array.isArray(file.entries))
    throw new Error('Backup entries are missing');
  const entries = Object.create(null);
  for (const key of STORAGE_KEYS) {
    if (Object.hasOwn(file.entries, key)) entries[key] = validateEntry(file.entries[key], key);
  }
  if (Object.keys(entries).length === 0 || Object.keys(file.entries).some(key => !STORAGE_KEYS.includes(key)))
    throw new Error('Backup contains missing or unknown storage entries');
  return { entries, created_at: typeof file.created_at === 'string' ? file.created_at : null };
}
export function restoreBackup(storage, backup) {
  const entries = backup?.entries;
  if (!entries || typeof entries !== 'object') throw new Error('Invalid backup');
  const keys = STORAGE_KEYS.filter(key => Object.hasOwn(entries, key));
  if (!keys.length) throw new Error('Empty backup');
  for (const key of keys) validateEntry(entries[key], key);
  const before = new Map(STORAGE_KEYS.map(key => [key, storage.getItem(key)]));
  try {
    for (const key of keys) storage.setItem(key, entries[key]);
  } catch (error) {
    for (const [key, value] of before) {
      try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); } catch {}
    }
    throw error;
  }
  return keys.length;
}
