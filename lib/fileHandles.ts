"use client";

const DB_NAME = "dillinger";
const DB_VERSION = 1;
const STORE_NAME = "file-handles";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

export function newHandleId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function saveHandle(id: string, handle: FileSystemFileHandle): Promise<void> {
  if (!hasIndexedDb()) {
    return;
  }

  const db = await openDb();
  const transaction = db.transaction(STORE_NAME, "readwrite");

  try {
    await requestToPromise(transaction.objectStore(STORE_NAME).put(handle, id));
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function getHandle(id: string): Promise<FileSystemFileHandle | null> {
  if (!hasIndexedDb()) {
    return null;
  }

  const db = await openDb();

  try {
    const handle = await requestToPromise<FileSystemFileHandle | undefined>(
      db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id),
    );

    return handle ?? null;
  } finally {
    db.close();
  }
}

export async function deleteHandle(id: string): Promise<void> {
  if (!hasIndexedDb()) {
    return;
  }

  const db = await openDb();
  const transaction = db.transaction(STORE_NAME, "readwrite");

  try {
    await requestToPromise(transaction.objectStore(STORE_NAME).delete(id));
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function listHandleIds(): Promise<string[]> {
  if (!hasIndexedDb()) {
    return [];
  }

  const db = await openDb();

  try {
    const keys = await requestToPromise<IDBValidKey[]>(
      db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAllKeys(),
    );

    return keys.filter((key): key is string => typeof key === "string");
  } finally {
    db.close();
  }
}
