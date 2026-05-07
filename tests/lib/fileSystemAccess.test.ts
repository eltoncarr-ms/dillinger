import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isFileSystemAccessSupported,
  pickMarkdownFile,
  readHandle,
  verifyPermission,
} from "@/lib/fileSystemAccess";

function setOpenFilePicker(mock?: ReturnType<typeof vi.fn>): void {
  if (mock) {
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: mock,
    });
    return;
  }

  Reflect.deleteProperty(window, "showOpenFilePicker");
}

function createHandle(
  file: File,
  permissionState: PermissionState = "granted",
  requestState: PermissionState = "granted",
): FileSystemFileHandle {
  return {
    getFile: vi.fn().mockResolvedValue(file),
    queryPermission: vi.fn().mockResolvedValue(permissionState),
    requestPermission: vi.fn().mockResolvedValue(requestState),
  } as unknown as FileSystemFileHandle;
}

describe("fileSystemAccess", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setOpenFilePicker();
  });

  it("reports support when showOpenFilePicker is present", () => {
    setOpenFilePicker(vi.fn());

    expect(isFileSystemAccessSupported()).toBe(true);
  });

  it("reports no support when showOpenFilePicker is absent", () => {
    setOpenFilePicker();

    expect(isFileSystemAccessSupported()).toBe(false);
  });

  it("picks a markdown file and returns its handle, filename, and content", async () => {
    const file = new File(["# Local"], "local.md", { type: "text/markdown" });
    const handle = createHandle(file);
    const picker = vi.fn().mockResolvedValue([handle]);
    setOpenFilePicker(picker);

    await expect(pickMarkdownFile()).resolves.toEqual({
      handle,
      filename: "local.md",
      content: "# Local",
    });
    expect(picker).toHaveBeenCalledWith({
      multiple: false,
      types: [
        {
          description: "Markdown / Text / HTML",
          accept: {
            "text/markdown": [".md", ".markdown"],
            "text/plain": [".txt"],
            "text/html": [".html", ".htm"],
          },
        },
      ],
      excludeAcceptAllOption: false,
    });
  });

  it("returns null when the picker is cancelled", async () => {
    setOpenFilePicker(vi.fn().mockRejectedValue({ name: "AbortError" }));

    await expect(pickMarkdownFile()).resolves.toBeNull();
  });

  it("rethrows non-abort picker errors", async () => {
    const error = new Error("picker failed");
    setOpenFilePicker(vi.fn().mockRejectedValue(error));

    await expect(pickMarkdownFile()).rejects.toThrow("picker failed");
  });

  it("returns true when permission is already granted", async () => {
    const handle = createHandle(new File(["# A"], "a.md"), "granted");

    await expect(verifyPermission(handle)).resolves.toBe(true);
    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: "read" });
    expect(handle.requestPermission).not.toHaveBeenCalled();
  });

  it("requests permission when prompted and returns true when granted", async () => {
    const handle = createHandle(new File(["# A"], "a.md"), "prompt", "granted");

    await expect(verifyPermission(handle, "readwrite")).resolves.toBe(true);
    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: "readwrite" });
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: "readwrite" });
  });

  it("returns false when requested permission is denied", async () => {
    const handle = createHandle(new File(["# A"], "a.md"), "prompt", "denied");

    await expect(verifyPermission(handle)).resolves.toBe(false);
  });

  it("reads markdown handles directly", async () => {
    const handle = createHandle(
      new File(["# Direct"], "direct.md", { type: "text/markdown" }),
    );

    await expect(readHandle(handle)).resolves.toEqual({
      filename: "direct.md",
      content: "# Direct",
    });
  });

  it("converts html handles through the import API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ markdown: "# Converted" }),
    });
    vi.stubGlobal("fetch", mockFetch);
    const handle = createHandle(
      new File(["<h1>Converted</h1>"], "page.html", { type: "text/html" }),
    );

    await expect(readHandle(handle)).resolves.toEqual({
      filename: "page.html",
      content: "# Converted",
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/import/html-to-markdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: "<h1>Converted</h1>" }),
    });
  });

  it("surfaces html conversion route errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "conversion failed" }),
      }),
    );
    const handle = createHandle(
      new File(["<h1>Bad</h1>"], "bad.html", { type: "text/html" }),
    );

    await expect(readHandle(handle)).rejects.toThrow("conversion failed");
  });

  it("throws for unsupported file extensions", async () => {
    const handle = createHandle(new File(["data"], "image.png", { type: "image/png" }));

    await expect(readHandle(handle)).rejects.toThrow("Unsupported file type for reload");
  });
});
