// Version the database when the payment parsing or cached record format changes.
const DATABASE = 'grape-grant-history-v1';
const STORE = 'histories';

async function database() {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Browser storage is blocked.'));
  });
}

export async function readGrantHistory(key) {
  let db;
  try {
    db = await database();
    if (!db) return null;
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () => {
        const value = request.result;
        resolve(value && Array.isArray(value.rows) &&
          value.rows.every(row => typeof row.id === 'string' && typeof row.recipient === 'string' && typeof row.amount === 'string' && Number.isFinite(row.timestamp)) &&
          (value.next === null || typeof value.next === 'string') &&
          Number.isFinite(value.scanned) && value.scanned >= 0 &&
          (value.oldest === null || Number.isFinite(value.oldest)) ? value : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch { return null; }
  finally { if (db) db.close(); }
}

export async function writeGrantHistory(key, value) {
  let db;
  try {
    db = await database();
    if (!db) return false;
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return true;
  } catch { return false; }
  finally { if (db) db.close(); }
}
