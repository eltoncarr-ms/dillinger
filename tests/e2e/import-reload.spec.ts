import { test, expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __e2eFileContent: string;
    __e2eFileName: string;
  }
}

const defaultProfile = {
  enableAutoSave: true,
  enableWordsCount: true,
  enableCharactersCount: true,
  enableScrollSync: true,
  tabSize: 4,
  keybindings: "default",
  enableNightMode: false,
  enableGitHubComment: true,
};

function installFilePickerStub(page: Page) {
  return page.addInitScript((profile) => {
    window.localStorage.setItem("profileV3", JSON.stringify(profile));
    window.__e2eFileContent = "# Initial\n";
    window.__e2eFileName = "story.md";

    const storedHandles = new Map<string, unknown>();

    const makeRequest = (result: unknown, transaction?: { oncomplete: ((event: Event) => void) | null }) => {
      const request = {
        result,
        error: null,
        onsuccess: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
      };

      window.setTimeout(() => {
        request.onsuccess?.(new Event("success"));
        if (transaction) {
          window.setTimeout(() => transaction.oncomplete?.(new Event("complete")), 0);
        }
      }, 0);

      return request;
    };

    const makeTransaction = () => {
      const transaction = {
        error: null,
        oncomplete: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onabort: null as ((event: Event) => void) | null,
        objectStore() {
          return {
            put(value: unknown, key: IDBValidKey) {
              storedHandles.set(String(key), value);
              return makeRequest(key, transaction);
            },
            get(key: IDBValidKey) {
              return makeRequest(storedHandles.get(String(key)), transaction);
            },
            delete(key: IDBValidKey) {
              storedHandles.delete(String(key));
              return makeRequest(undefined, transaction);
            },
            getAllKeys() {
              return makeRequest(Array.from(storedHandles.keys()), transaction);
            },
          };
        },
      };

      return transaction;
    };

    const db = {
      objectStoreNames: {
        contains() {
          return true;
        },
      },
      createObjectStore() {
        return undefined;
      },
      transaction() {
        return makeTransaction();
      },
      close() {
        return undefined;
      },
    };

    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        open() {
          const request = {
            result: db,
            error: null,
            onsuccess: null as ((event: Event) => void) | null,
            onerror: null as ((event: Event) => void) | null,
            onupgradeneeded: null as ((event: Event) => void) | null,
          };

          window.setTimeout(() => {
            request.onupgradeneeded?.(new Event("upgradeneeded"));
            request.onsuccess?.(new Event("success"));
          }, 0);

          return request;
        },
      },
    });

    const makeHandle = () => ({
      name: window.__e2eFileName,
      kind: "file",
      async getFile() {
        const text = window.__e2eFileContent;
        return new File([text], window.__e2eFileName, { type: "text/markdown" });
      },
      async queryPermission() {
        return "granted" as PermissionState;
      },
      async requestPermission() {
        return "granted" as PermissionState;
      },
      async isSameEntry(other: unknown) {
        return other === this;
      },
    });

    window.showOpenFilePicker = async () => [makeHandle() as FileSystemFileHandle];
  }, defaultProfile);
}

function editorLines(page: Page) {
  return page.locator(".monaco-editor .view-lines");
}

async function expectEditorToContain(page: Page, text: string) {
  await expect(editorLines(page)).toContainText(text, { timeout: 10_000 });
}

async function importStubbedFile(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Import file" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "story.md" })).toBeVisible();
  await expectEditorToContain(page, "# Initial");
  await expect(page.getByRole("status", { name: "Notifications" })).toContainText(
    /Imported "story\.md"/
  );
}

async function typeDirtyEdit(page: Page) {
  await page.locator(".monaco-editor").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\nDirty edits");
  await expectEditorToContain(page, "Dirty edits");
}

test("import → reload reflects on-disk change", async ({ page }) => {
  await installFilePickerStub(page);
  await importStubbedFile(page);

  await page.evaluate(() => {
    window.__e2eFileContent = "# Updated content\n";
  });

  await page.getByRole("button", { name: "Reload from source" }).click();

  await expectEditorToContain(page, "# Updated content");
  await expect(page.getByRole("status", { name: "Notifications" })).toContainText(
    /Reloaded from "story\.md"/
  );
});

test("reload prompts confirm when dirty", async ({ page }) => {
  await installFilePickerStub(page);
  await importStubbedFile(page);
  await typeDirtyEdit(page);

  await page.evaluate(() => {
    window.__e2eFileContent = "# Disk version\n";
  });

  await page.getByRole("button", { name: "Reload from source" }).click();

  await expect(
    page.getByRole("dialog", { name: "Reload \"story.md\" from source?" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Keep my edits" }).click();
  await expect(
    page.getByRole("dialog", { name: "Reload \"story.md\" from source?" })
  ).toHaveCount(0);
  await expectEditorToContain(page, "# Initial");
  await expectEditorToContain(page, "Dirty edits");

  await page.getByRole("button", { name: "Reload from source" }).click();
  const dialog = page.getByRole("dialog", { name: "Reload \"story.md\" from source?" });
  await dialog.getByRole("button", { name: "Reload from source" }).click();

  await expectEditorToContain(page, "# Disk version");
  await expect(editorLines(page)).not.toContainText("Dirty edits");
});

test("unsupported browser disables reload button", async ({ page }) => {
  const doc = {
    id: "1",
    title: "story.md",
    body: "# Hi",
    createdAt: "2026-03-10T00:00:00.000Z",
    localFile: { handleId: "fake", filename: "story.md" },
  };

  await page.addInitScript(
    ({ documentState, profile }) => {
      delete window.showOpenFilePicker;
      window.localStorage.setItem("files", JSON.stringify([documentState]));
      window.localStorage.setItem("currentDocument", JSON.stringify(documentState));
      window.localStorage.setItem("profileV3", JSON.stringify(profile));
    },
    { documentState: doc, profile: defaultProfile }
  );

  await page.goto("/");

  const reloadButton = page.getByRole("button", { name: "Reload from source" });
  await expect(reloadButton).toBeVisible();
  await expect(reloadButton).toBeDisabled();
});
