import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DB_NAME = "dillinger";

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB delete was blocked"));
  });
}

describe("fileHandles", () => {
  const originalIndexedDB = globalThis.indexedDB;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: originalIndexedDB,
      writable: true,
    });
    await deleteDatabase();
  });

  afterEach(async () => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: originalIndexedDB,
      writable: true,
    });
    await deleteDatabase();
  });

  async function loadFileHandles() {
    const mod = await import("@/lib/fileHandles");
    return mod;
  }

  it("round-trips a saved handle", async () => {
    const { getHandle, saveHandle } = await loadFileHandles();
    const fakeHandle = { kind: "file", name: "notes.md" } as FileSystemFileHandle;

    await saveHandle("handle-1", fakeHandle);

    await expect(getHandle("handle-1")).resolves.toEqual(fakeHandle);
  });

  it("returns null for an unknown handle id", async () => {
    const { getHandle } = await loadFileHandles();

    await expect(getHandle("missing")).resolves.toBeNull();
  });

  it("deletes a saved handle", async () => {
    const { deleteHandle, getHandle, saveHandle } = await loadFileHandles();
    const fakeHandle = { kind: "file", name: "draft.md" } as FileSystemFileHandle;

    await saveHandle("handle-2", fakeHandle);
    await deleteHandle("handle-2");

    await expect(getHandle("handle-2")).resolves.toBeNull();
  });

  it("lists all stored handle ids", async () => {
    const { listHandleIds, saveHandle } = await loadFileHandles();
    const firstHandle = { kind: "file", name: "first.md" } as FileSystemFileHandle;
    const secondHandle = { kind: "file", name: "second.md" } as FileSystemFileHandle;

    await saveHandle("first", firstHandle);
    await saveHandle("second", secondHandle);

    await expect(listHandleIds()).resolves.toEqual(expect.arrayContaining(["first", "second"]));
  });

  it("generates unique handle ids", async () => {
    const { newHandleId } = await loadFileHandles();

    const ids = new Set(Array.from({ length: 25 }, () => newHandleId()));

    expect(ids.size).toBe(25);
    ids.forEach((id) => expect(id).toEqual(expect.any(String)));
  });

  it("guards against SSR when indexedDB is unavailable", async () => {
    const { getHandle, saveHandle } = await loadFileHandles();
    const fakeHandle = { kind: "file", name: "ssr.md" } as FileSystemFileHandle;

    Reflect.deleteProperty(globalThis, "indexedDB");

    await expect(saveHandle("ssr", fakeHandle)).resolves.toBeUndefined();
    await expect(getHandle("ssr")).resolves.toBeNull();
  });
});
