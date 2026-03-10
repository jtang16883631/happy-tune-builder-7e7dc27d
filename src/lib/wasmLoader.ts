/**
 * Shared WASM loader with IndexedDB caching for offline resilience.
 * Ensures sql-wasm.wasm is always available even without network or service worker.
 */
import initSqlJs from 'sql.js';

const WASM_CACHE_DB = 'sql_wasm_cache';
const WASM_CACHE_STORE = 'wasm_cache';
const WASM_CACHE_KEY = 'sql_wasm_binary';
const CDN_WASM_URL = 'https://sql.js.org/dist/sql-wasm.wasm';

const openWasmCacheDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WASM_CACHE_DB, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(WASM_CACHE_STORE)) {
        db.createObjectStore(WASM_CACHE_STORE);
      }
    };
  });
};

const saveWasmToCache = async (binary: ArrayBuffer): Promise<void> => {
  try {
    const db = await openWasmCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WASM_CACHE_STORE, 'readwrite');
      tx.objectStore(WASM_CACHE_STORE).put(binary, WASM_CACHE_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[WASM Cache] Failed to save:', err);
  }
};

const loadWasmFromCache = async (): Promise<ArrayBuffer | null> => {
  try {
    const db = await openWasmCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WASM_CACHE_STORE, 'readonly');
      const req = tx.objectStore(WASM_CACHE_STORE).get(WASM_CACHE_KEY);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {
    return null;
  }
};

/**
 * Initialize sql.js with a 3-tier fallback:
 * 1. Local WASM file (works with SW cache or local serve)
 * 2. IndexedDB cached WASM binary (works fully offline)
 * 3. CDN fallback (online only)
 * 
 * After successful load from tier 1 or 3, caches the binary in IndexedDB.
 */
export async function initSqlWithCache(tag = 'sql.js') {
  const localPath = `${import.meta.env.BASE_URL}sql-wasm.wasm`;

  // 1. Try local file
  try {
    const SQL = await initSqlJs({ locateFile: () => localPath });
    // Cache for future offline use (non-blocking)
    try {
      const resp = await fetch(localPath);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        await saveWasmToCache(buf);
        console.log(`[${tag}] WASM cached to IndexedDB`);
      }
    } catch { /* non-critical */ }
    return SQL;
  } catch (localErr) {
    console.warn(`[${tag}] Local WASM failed, trying IndexedDB cache…`, localErr);
  }

  // 2. Try IndexedDB cached binary
  try {
    const cached = await loadWasmFromCache();
    if (cached) {
      console.log(`[${tag}] Loading WASM from IndexedDB cache`);
      return await initSqlJs({ wasmBinary: new Uint8Array(cached) });
    }
  } catch (cacheErr) {
    console.warn(`[${tag}] IndexedDB WASM cache failed:`, cacheErr);
  }

  // 3. CDN fallback
  try {
    const SQL = await initSqlJs({ locateFile: () => CDN_WASM_URL });
    try {
      const resp = await fetch(CDN_WASM_URL);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        await saveWasmToCache(buf);
      }
    } catch { /* non-critical */ }
    return SQL;
  } catch (cdnErr) {
    console.error(`[${tag}] All WASM sources failed:`, cdnErr);
    throw cdnErr;
  }
}
