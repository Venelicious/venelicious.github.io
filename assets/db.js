const DB_NAME = 'provisionDB_v1';
const DB_VERSION = 2;
let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains('tours')) db.createObjectStore('tours', { keyPath: 'idAuto', autoIncrement: true });
      if (!db.objectStoreNames.contains('conf')) db.createObjectStore('conf', { keyPath: 'k' });
      if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups', { keyPath: 'ts' });
      if (!db.objectStoreNames.contains('customerAgreements')) db.createObjectStore('customerAgreements', { keyPath: 'idAuto', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function idbPut(store, val) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(val);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

export async function idbAdd(store, val) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const r = tx.objectStore(store).add(val);
    r.onsuccess = () => res(r.result);
    tx.onerror = () => rej(tx.error);
  });
}

export async function idbGetAll(store) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const r = tx.objectStore(store).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function idbClear(store) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const r = tx.objectStore(store).clear();
    r.onsuccess = () => res(true);
    r.onerror = () => rej(r.error);
  });
}

export async function idbDelete(store, key) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const r = tx.objectStore(store).delete(key);
    r.onsuccess = () => res(true);
    r.onerror = () => rej(r.error);
  });
}
