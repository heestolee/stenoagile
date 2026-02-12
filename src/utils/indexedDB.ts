const DB_NAME = 'StenoAgileDB';
const STORE_NAME = 'videos';

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

export const saveVideosToDB = async (files: { name: string; data: ArrayBuffer }[]) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  // 기존 데이터 삭제
  store.clear();

  // 새 데이터 저장
  files.forEach((file, index) => {
    store.add({ id: index, name: file.name, data: file.data });
  });

  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const loadVideosFromDB = async (): Promise<{ name: string; data: ArrayBuffer }[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result.map((r: { name: string; data: ArrayBuffer }) => ({ name: r.name, data: r.data })));
    request.onerror = () => reject(request.error);
  });
};

export const clearVideosDB = async () => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).clear();
};
