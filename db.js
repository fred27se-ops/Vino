// Stockage local (IndexedDB) : toutes les données restent sur le téléphone.
const DB = (() => {
  const NAME = 'ap-vino';
  const VERSION = 1;
  const STORES = ['vins', 'lots', 'mouvements', 'etageres', 'reglages'];
  // Réglages propres à ce téléphone : la clé Gemini ne doit jamais se retrouver dans un fichier de sauvegarde.
  const LOCAUX = ['cleGemini', 'modeleGemini', 'modelesEcartes'];
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) {
            const store = db.createObjectStore(s, { keyPath: 'id' });
            if (s === 'lots' || s === 'mouvements') store.createIndex('vinId', 'vinId');
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const result = fn(s);
      t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
      t.onerror = () => reject(t.error);
    });
  }

  const all = (store) => tx(store, 'readonly', (s) => s.getAll());
  const get = (store, id) => tx(store, 'readonly', (s) => s.get(id));
  const put = (store, obj) => tx(store, 'readwrite', (s) => { s.put(obj); return obj; });
  const del = (store, id) => tx(store, 'readwrite', (s) => s.delete(id));
  const byVin = (store, vinId) => tx(store, 'readonly', (s) => s.index('vinId').getAll(vinId));

  async function clearAll() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORES, 'readwrite');
      for (const s of STORES) t.objectStore(s).clear();
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  async function exportAll() {
    const data = { app: 'ap-vino', format: 1, date: new Date().toISOString() };
    for (const s of STORES) data[s] = await all(s);
    data.reglages = data.reglages.filter((r) => !LOCAUX.includes(r.id));
    return data;
  }

  async function importAll(data) {
    if (!data || data.app !== 'ap-vino') throw new Error("Ce fichier n'est pas une sauvegarde Ap Vino.");
    const garder = (await all('reglages')).filter((r) => LOCAUX.includes(r.id));
    await clearAll();
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORES, 'readwrite');
      for (const s of STORES) for (const obj of data[s] || []) t.objectStore(s).put(obj);
      for (const r of garder) t.objectStore('reglages').put(r);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  // Demande au navigateur de ne pas effacer les données en cas de manque de place.
  async function persist() {
    if (navigator.storage && navigator.storage.persist) {
      try { return await navigator.storage.persist(); } catch { return false; }
    }
    return false;
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  return { all, get, put, del, byVin, exportAll, importAll, persist, uid };
})();
