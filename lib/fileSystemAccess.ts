"use client";

import { isHtmlFilename, isMarkdownFilename } from "@/lib/document";

declare global {
  interface FileSystemPermissionDescriptor {
    mode?: PermissionMode;
  }

  interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
  }

  interface OpenFilePickerOptions {
    multiple?: boolean;
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
  }

  interface FileSystemFileHandle {
    queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  }

  interface Window {
    showOpenFilePicker?: (
      options?: OpenFilePickerOptions,
    ) => Promise<FileSystemFileHandle[]>;
  }
}

export type PermissionMode = "read" | "readwrite";

export interface PickedFile {
  handle: FileSystemFileHandle;
  filename: string;
  content: string;
}

export interface ReadResult {
  filename: string;
  content: string;
}

const MARKDOWN_PICKER_OPTIONS: OpenFilePickerOptions = {
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
};

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

async function convertHtmlToMarkdown(html: string): Promise<string> {
  const response = await fetch("/api/import/html-to-markdown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to convert HTML");
  }

  return data.markdown;
}

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.showOpenFilePicker === "function"
  );
}

export async function pickMarkdownFile(): Promise<PickedFile | null> {
  try {
    const [handle] = await window.showOpenFilePicker!(MARKDOWN_PICKER_OPTIONS);
    const { filename, content } = await readHandle(handle);

    return { handle, filename, content };
  } catch (error) {
    if (isAbortError(error)) {
      return null;
    }

    throw error;
  }
}

export async function verifyPermission(
  handle: FileSystemFileHandle,
  mode: PermissionMode = "read",
): Promise<boolean> {
  if ((await handle.queryPermission({ mode })) === "granted") {
    return true;
  }

  return (await handle.requestPermission({ mode })) === "granted";
}

export async function readHandle(handle: FileSystemFileHandle): Promise<ReadResult> {
  const file = await handle.getFile();

  if (isMarkdownFilename(file.name)) {
    return {
      filename: file.name,
      content: await file.text(),
    };
  }

  if (isHtmlFilename(file.name) || file.type === "text/html") {
    return {
      filename: file.name,
      content: await convertHtmlToMarkdown(await file.text()),
    };
  }

  throw new Error("Unsupported file type for reload");
}
