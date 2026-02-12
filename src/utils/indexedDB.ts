const DB_NAME = 'StenoAgileDB';
const STORE_NAME = 'videos';
const PROFICIENCY_STORE = 'wordProficiency';
const TODAY_PROFICIENCY_STORE = 'wordProficiencyToday';

export interface WordProficiency {
  word: string;
  correctCount: number;
  incorrectCount: number;
  lastPracticed: number;
}

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(PROFICIENCY_STORE)) {
        db.createObjectStore(PROFICIENCY_STORE, { keyPath: 'word' });
      }
      if (!db.objectStoreNames.contains(TODAY_PROFICIENCY_STORE)) {
        db.createObjectStore(TODAY_PROFICIENCY_STORE, { keyPath: 'word' });
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

// --- 오늘의 숙련도 ---

export const updateTodayProficiency = async (word: string, isCorrect: boolean): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(TODAY_PROFICIENCY_STORE, 'readwrite');
  const store = tx.objectStore(TODAY_PROFICIENCY_STORE);

  return new Promise((resolve, reject) => {
    const getReq = store.get(word);
    getReq.onsuccess = () => {
      const existing: WordProficiency | undefined = getReq.result;
      const updated: WordProficiency = existing
        ? {
            word,
            correctCount: existing.correctCount + (isCorrect ? 1 : 0),
            incorrectCount: existing.incorrectCount + (isCorrect ? 0 : 1),
            lastPracticed: Date.now(),
          }
        : {
            word,
            correctCount: isCorrect ? 1 : 0,
            incorrectCount: isCorrect ? 0 : 1,
            lastPracticed: Date.now(),
          };
      store.put(updated);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getAllTodayProficiencies = async (): Promise<WordProficiency[]> => {
  const db = await openDB();
  const tx = db.transaction(TODAY_PROFICIENCY_STORE, 'readonly');
  const store = tx.objectStore(TODAY_PROFICIENCY_STORE);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const clearTodayProficiencies = async (): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(TODAY_PROFICIENCY_STORE, 'readwrite');
  tx.objectStore(TODAY_PROFICIENCY_STORE).clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// --- 전체 숙련도 ---

export const getAllWordProficiencies = async (): Promise<WordProficiency[]> => {
  const db = await openDB();
  const tx = db.transaction(PROFICIENCY_STORE, 'readonly');
  const store = tx.objectStore(PROFICIENCY_STORE);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const clearWordProficiencies = async (): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(PROFICIENCY_STORE, 'readwrite');
  tx.objectStore(PROFICIENCY_STORE).clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// --- 오늘 → 전체 병합 ---

export const mergeTodayToOverall = async (): Promise<void> => {
  const db = await openDB();

  // 오늘 데이터 읽기
  const todayData: WordProficiency[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(TODAY_PROFICIENCY_STORE, 'readonly');
    const req = tx.objectStore(TODAY_PROFICIENCY_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (todayData.length === 0) return;

  // 전체 스토어에 병합 (하나의 트랜잭션)
  const tx = db.transaction(PROFICIENCY_STORE, 'readwrite');
  const overallStore = tx.objectStore(PROFICIENCY_STORE);

  for (const today of todayData) {
    await new Promise<void>((resolve) => {
      const getReq = overallStore.get(today.word);
      getReq.onsuccess = () => {
        const existing: WordProficiency | undefined = getReq.result;
        const merged: WordProficiency = existing
          ? {
              word: today.word,
              correctCount: existing.correctCount + today.correctCount,
              incorrectCount: existing.incorrectCount + today.incorrectCount,
              lastPracticed: Math.max(existing.lastPracticed, today.lastPracticed),
            }
          : { ...today };
        overallStore.put(merged);
        resolve();
      };
    });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};
