import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "@/components/navbar/Navbar";
import { useStore } from "@/stores/store";

const mockNotify = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ notify: mockNotify }),
}));

const mockUpload = vi.fn();
vi.mock("@/hooks/useImageUpload", () => ({
  useImageUpload: () => ({ upload: mockUpload, isUploading: false }),
}));

const mockImportDocumentFile = vi.fn();
vi.mock("@/lib/import", () => ({
  importDocumentFile: (...args: unknown[]) => mockImportDocumentFile(...args),
}));

const mockIsFileSystemAccessSupported = vi.fn();
const mockPickMarkdownFile = vi.fn();
vi.mock("@/lib/fileSystemAccess", () => ({
  isFileSystemAccessSupported: () => mockIsFileSystemAccessSupported(),
  pickMarkdownFile: (...args: unknown[]) => mockPickMarkdownFile(...args),
}));

const mockSaveHandle = vi.fn();
const mockNewHandleId = vi.fn();
vi.mock("@/lib/fileHandles", () => ({
  saveHandle: (...args: unknown[]) => mockSaveHandle(...args),
  newHandleId: () => mockNewHandleId(),
}));

vi.mock("@/components/modals/ReloadConfirmModal", () => ({
  ReloadConfirmModal: ({
    isOpen,
    filename,
    onCancel,
    onConfirm,
  }: {
    isOpen: boolean;
    filename: string;
    onCancel: () => void;
    onConfirm: () => void | Promise<void>;
  }) => isOpen ? (
    <div role="dialog" aria-label="Reload confirmation">
      <p>Reload {filename}</p>
      <button type="button" onClick={onCancel}>Cancel</button>
      <button type="button" onClick={onConfirm}>Reload anyway</button>
    </div>
  ) : null,
}));

const initialState = useStore.getState();

function resetStore() {
  useStore.setState(
    {
      ...initialState,
      documents: [],
      currentDocument: {
        id: "test-doc-1",
        title: "Test Document",
        body: "# Hello World",
        createdAt: new Date().toISOString(),
      },
      editorInstance: null,
      settings: { ...initialState.settings },
      sidebarOpen: false,
      settingsOpen: false,
      panelLayout: "split",
      splitRatio: 0.5,
      previewVisible: true,
      zenMode: false,
      editorScrollPercent: 0,
      editorTopLine: 1,
    },
    true
  );
}

function setCurrentDocumentSource() {
  const currentDocument = useStore.getState().currentDocument;

  useStore.setState({
    currentDocument: currentDocument
      ? {
          ...currentDocument,
          localFile: { handleId: "handle-1", filename: "source.md" },
        }
      : null,
  }, false);
}

describe("Navbar", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockIsFileSystemAccessSupported.mockReturnValue(false);
    mockNewHandleId.mockReturnValue("handle-1");
    mockSaveHandle.mockResolvedValue(undefined);
  });

  it("renders menu icon, logo, and action buttons", () => {
    render(<Navbar />);

    expect(screen.getByRole("button", { name: "Toggle sidebar" })).toBeInTheDocument();
    expect(screen.getByText("DILLINGER")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export document" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show both panes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter zen mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import file" })).toBeInTheDocument();
  });

  it("calls toggleSidebar when menu button is clicked", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    expect(useStore.getState().sidebarOpen).toBe(false);

    await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));

    expect(useStore.getState().sidebarOpen).toBe(true);
  });

  it("marks the split layout button as active by default", () => {
    render(<Navbar />);

    expect(screen.getByRole("button", { name: "Focus editor" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Show both panes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Focus preview" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls toggleSettings when settings button is clicked", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    expect(useStore.getState().settingsOpen).toBe(false);

    await user.click(screen.getByRole("button", { name: "Open settings" }));

    expect(useStore.getState().settingsOpen).toBe(true);
  });

  it("opens export dropdown on click", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    expect(screen.queryByRole("menu", { name: "Export formats" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export document" }));

    expect(screen.getByRole("menu", { name: "Export formats" })).toBeInTheDocument();
  });

  it("shows all format options in the export dropdown", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: "Export document" }));

    const items = screen.getAllByRole("menuitem");

    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Markdown");
    expect(items[1]).toHaveTextContent("HTML");
    expect(items[2]).toHaveTextContent("Styled HTML");
    expect(items[3]).toHaveTextContent("PDF");
  });

  it("renders a hidden file input for document import", () => {
    render(<Navbar />);

    const input = screen.getByTestId("document-import-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute(
      "accept",
      ".md,.markdown,.txt,.html,.htm,text/plain,text/markdown,text/html"
    );
  });

  it("has a zen mode button that sets zen mode", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    expect(useStore.getState().zenMode).toBe(false);

    await user.click(screen.getByRole("button", { name: "Enter zen mode" }));

    expect(useStore.getState().zenMode).toBe(true);
  });

  it("closes export dropdown when clicking outside", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: "Export document" }));
    expect(screen.getByRole("menu", { name: "Export formats" })).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole("menu", { name: "Export formats" })).not.toBeInTheDocument();
  });

  it("closes export dropdown when Escape key is pressed", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: "Export document" }));
    expect(screen.getByRole("menu", { name: "Export formats" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu", { name: "Export formats" })).not.toBeInTheDocument();
  });

  it("clicking Import button triggers the hidden file input", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    const fileInput = screen.getByTestId("document-import-input");
    const clickSpy = vi.spyOn(fileInput, "click");

    await user.click(screen.getByRole("button", { name: "Import file" }));

    expect(clickSpy).toHaveBeenCalled();
  });

  it("clicking Image button triggers the hidden image input", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    const imageInput = screen.getByTestId("image-import-input");
    const clickSpy = vi.spyOn(imageInput, "click");

    await user.click(screen.getByRole("button", { name: "Insert image" }));

    expect(clickSpy).toHaveBeenCalled();
  });

  it("hides the reload button when the current document has no local source", () => {
    render(<Navbar />);

    expect(screen.queryByRole("button", { name: "Reload from source" })).not.toBeInTheDocument();
  });

  it("renders the reload button when the current document has a local source", () => {
    mockIsFileSystemAccessSupported.mockReturnValue(true);
    setCurrentDocumentSource();

    render(<Navbar />);

    expect(screen.getByRole("button", { name: "Reload from source" })).toBeInTheDocument();
  });

  it("disables the reload button when File System Access is unsupported", () => {
    setCurrentDocumentSource();

    render(<Navbar />);

    const reloadButton = screen.getByRole("button", { name: "Reload from source" });
    expect(reloadButton).toBeDisabled();
    expect(reloadButton).toHaveAttribute("title", "Reload requires Chrome, Edge, or Opera");
  });

  it("reloads from source and shows a success toast", async () => {
    const user = userEvent.setup();
    const reloadCurrentDocumentFromSource = vi.fn().mockResolvedValue({
      status: "reloaded",
      filename: "source.md",
    });
    mockIsFileSystemAccessSupported.mockReturnValue(true);
    setCurrentDocumentSource();
    useStore.setState({ reloadCurrentDocumentFromSource }, false);

    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: "Reload from source" }));

    await waitFor(() => {
      expect(reloadCurrentDocumentFromSource).toHaveBeenCalledWith();
    });
    expect(mockNotify).toHaveBeenCalledWith('Reloaded from "source.md"');
  });

  it("opens confirm modal for dirty reload and force reloads on confirm", async () => {
    const user = userEvent.setup();
    const reloadCurrentDocumentFromSource = vi.fn()
      .mockResolvedValueOnce({ status: "needs-confirm" })
      .mockResolvedValueOnce({ status: "reloaded", filename: "source.md" });
    mockIsFileSystemAccessSupported.mockReturnValue(true);
    setCurrentDocumentSource();
    useStore.setState({ reloadCurrentDocumentFromSource }, false);

    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: "Reload from source" }));
    expect(await screen.findByRole("dialog", { name: "Reload confirmation" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reload anyway" }));

    await waitFor(() => {
      expect(reloadCurrentDocumentFromSource).toHaveBeenLastCalledWith({ force: true });
    });
    expect(mockNotify).toHaveBeenCalledWith('Reloaded from "source.md"');
  });

  it("shows a permission denied toast when reload is denied", async () => {
    const user = userEvent.setup();
    const reloadCurrentDocumentFromSource = vi.fn().mockResolvedValue({ status: "denied" });
    mockIsFileSystemAccessSupported.mockReturnValue(true);
    setCurrentDocumentSource();
    useStore.setState({ reloadCurrentDocumentFromSource }, false);

    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: "Reload from source" }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith("Permission denied — could not reload");
    });
  });

  it("shows a missing source toast when reload source is gone", async () => {
    const user = userEvent.setup();
    const reloadCurrentDocumentFromSource = vi.fn().mockResolvedValue({ status: "missing" });
    mockIsFileSystemAccessSupported.mockReturnValue(true);
    setCurrentDocumentSource();
    useStore.setState({ reloadCurrentDocumentFromSource }, false);

    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: "Reload from source" }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith("Source file not found — Reload disabled");
    });
  });

  it("renders a hidden file input for image import", () => {
    render(<Navbar />);

    const input = screen.getByTestId("image-import-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", "image/*");
  });

  describe("panel layout switcher", () => {
    it("renders three layout buttons with correct labels", () => {
      render(<Navbar />);

      expect(screen.getByRole("button", { name: "Focus editor" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show both panes" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Focus preview" })).toBeInTheDocument();
    });

    it("reflects the current panel layout in aria-pressed", () => {
      useStore.setState({ panelLayout: "preview-only", previewVisible: true }, false);

      render(<Navbar />);

      expect(screen.getByRole("button", { name: "Focus editor" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: "Show both panes" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: "Focus preview" })).toHaveAttribute("aria-pressed", "true");
    });

    it("sets editor-only layout when Focus editor is clicked", async () => {
      const user = userEvent.setup();
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Focus editor" }));

      expect(useStore.getState().panelLayout).toBe("editor-only");
      expect(useStore.getState().previewVisible).toBe(false);
    });

    it("returns to split layout when Show both panes is clicked", async () => {
      const user = userEvent.setup();
      useStore.setState({ panelLayout: "editor-only", previewVisible: false }, false);
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Show both panes" }));

      expect(useStore.getState().panelLayout).toBe("split");
      expect(useStore.getState().previewVisible).toBe(true);
    });

    it("sets preview-only layout when Focus preview is clicked", async () => {
      const user = userEvent.setup();
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Focus preview" }));

      expect(useStore.getState().panelLayout).toBe("preview-only");
      expect(useStore.getState().previewVisible).toBe(true);
    });
  });

  describe("handleExport", () => {
    function mockFetchSuccess(contentType = "application/octet-stream", filename?: string) {
      const blob = new Blob(["content"], { type: contentType });
      const headers = new Headers({ "Content-Type": contentType });
      if (filename) {
        headers.set("Content-Disposition", `attachment; filename="${filename}"`);
      }
      const response = new Response(blob, { status: 200, headers });
      vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
      return response;
    }

    function mockFetchFailure() {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    }

    let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };
    const originalCreateElement = document.createElement.bind(document);

    beforeEach(() => {
      mockAnchor = { href: "", download: "", click: vi.fn() };
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "a") return mockAnchor as unknown as HTMLElement;
        return originalCreateElement(tag);
      });
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-url");
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    });

    it("exports as markdown and triggers download", async () => {
      const user = userEvent.setup();
      mockFetchSuccess("text/markdown");
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Export document" }));
      await user.click(screen.getByRole("menuitem", { name: /^Markdown$/ }));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith("/api/export/markdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown: "# Hello World",
            title: "Test Document",
            styled: undefined,
          }),
        });
      });

      await waitFor(() => {
        expect(mockAnchor.click).toHaveBeenCalled();
      });
      expect(mockAnchor.href).toBe("blob:test-url");
      expect(mockAnchor.download).toBe("Test Document.md");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
      expect(mockNotify).toHaveBeenCalledWith("Exported as MARKDOWN");
    });

    it("exports as HTML and triggers download", async () => {
      const user = userEvent.setup();
      mockFetchSuccess("text/html");
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Export document" }));
      await user.click(screen.getByRole("menuitem", { name: /^HTML$/ }));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith("/api/export/html", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown: "# Hello World",
            title: "Test Document",
            styled: false,
          }),
        });
      });

      await waitFor(() => {
        expect(mockAnchor.click).toHaveBeenCalled();
      });
      expect(mockAnchor.download).toBe("Test Document.html");
      expect(mockNotify).toHaveBeenCalledWith("Exported as HTML");
    });

    it("exports as styled HTML and shows styled notification", async () => {
      const user = userEvent.setup();
      mockFetchSuccess("text/html");
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Export document" }));
      await user.click(screen.getByRole("menuitem", { name: /Styled HTML/ }));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith("/api/export/html", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown: "# Hello World",
            title: "Test Document",
            styled: true,
          }),
        });
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith("Exported as styled HTML");
      });
    });

    it("exports as PDF and triggers download", async () => {
      const user = userEvent.setup();
      mockFetchSuccess("application/pdf");
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Export document" }));
      await user.click(screen.getByRole("menuitem", { name: /PDF/ }));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith("/api/export/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown: "# Hello World",
            title: "Test Document",
            styled: undefined,
          }),
        });
      });

      await waitFor(() => {
        expect(mockAnchor.click).toHaveBeenCalled();
      });
      expect(mockAnchor.download).toBe("Test Document.pdf");
      expect(mockNotify).toHaveBeenCalledWith("Exported as PDF");
    });

    it("uses filename from Content-Disposition header when available", async () => {
      const user = userEvent.setup();
      mockFetchSuccess("text/markdown", "custom-name.md");
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Export document" }));
      await user.click(screen.getByRole("menuitem", { name: /^Markdown$/ }));

      await waitFor(() => {
        expect(mockAnchor.download).toBe("custom-name.md");
      });
    });

    it("shows error toast when export fetch fails", async () => {
      const user = userEvent.setup();
      mockFetchFailure();
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Export document" }));
      await user.click(screen.getByRole("menuitem", { name: /^Markdown$/ }));

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith("MARKDOWN export failed — check your connection");
      });
    });

    it("shows error toast when response is not ok", async () => {
      const user = userEvent.setup();
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("error", { status: 500 })
      );
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Export document" }));
      await user.click(screen.getByRole("menuitem", { name: /^Markdown$/ }));

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith("MARKDOWN export failed — please try again");
      });
    });

    it("does nothing when currentDocument is null", async () => {
      useStore.setState({ currentDocument: null }, false);
      const user = userEvent.setup();
      vi.spyOn(globalThis, "fetch");
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Export document" }));
      await user.click(screen.getByRole("menuitem", { name: /^Markdown$/ }));

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("closes the dropdown after clicking an export option", async () => {
      const user = userEvent.setup();
      mockFetchSuccess();
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Export document" }));
      expect(screen.getByRole("menu", { name: "Export formats" })).toBeInTheDocument();

      await user.click(screen.getByRole("menuitem", { name: /^Markdown$/ }));

      expect(screen.queryByRole("menu", { name: "Export formats" })).not.toBeInTheDocument();
    });
  });

  describe("handleImportSelection", () => {
    it("imports with File System Access and stores the handle source", async () => {
      const user = userEvent.setup();
      const handle = { kind: "file", name: "picked.md" };
      const createImportedDocument = vi.fn();
      mockIsFileSystemAccessSupported.mockReturnValue(true);
      mockPickMarkdownFile.mockResolvedValue({
        handle,
        filename: "picked.md",
        content: "# Picked",
      });
      useStore.setState({ createImportedDocument }, false);

      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Import file" }));

      await waitFor(() => {
        expect(mockPickMarkdownFile).toHaveBeenCalled();
      });
      expect(mockSaveHandle).toHaveBeenCalledWith("handle-1", handle);
      expect(createImportedDocument).toHaveBeenCalledWith("picked.md", "# Picked", {
        handleId: "handle-1",
        filename: "picked.md",
      });
      expect(mockNotify).toHaveBeenCalledWith('Imported "picked.md" — Reload available');
    });

    it("falls back to the hidden input when File System Access is unsupported", async () => {
      const user = userEvent.setup();
      render(<Navbar />);

      const fileInput = screen.getByTestId("document-import-input");
      const clickSpy = vi.spyOn(fileInput, "click");

      await user.click(screen.getByRole("button", { name: "Import file" }));

      expect(clickSpy).toHaveBeenCalled();
      expect(mockPickMarkdownFile).not.toHaveBeenCalled();
    });

    it("does not create a document or toast when File System Access picking is canceled", async () => {
      const user = userEvent.setup();
      const createImportedDocument = vi.fn();
      mockIsFileSystemAccessSupported.mockReturnValue(true);
      mockPickMarkdownFile.mockResolvedValue(null);
      useStore.setState({ createImportedDocument }, false);

      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Import file" }));

      await waitFor(() => {
        expect(mockPickMarkdownFile).toHaveBeenCalled();
      });
      expect(mockSaveHandle).not.toHaveBeenCalled();
      expect(createImportedDocument).not.toHaveBeenCalled();
      expect(mockNotify).not.toHaveBeenCalled();
    });

    it("imports a markdown file and creates a document", async () => {
      mockImportDocumentFile.mockResolvedValue({
        body: "# Imported Content",
        title: "imported",
      });

      render(<Navbar />);

      const input = screen.getByTestId("document-import-input");
      const file = new File(["# Imported Content"], "imported.md", { type: "text/markdown" });

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockImportDocumentFile).toHaveBeenCalledWith(file);
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith('Imported "imported.md"');
      });
    });

    it("shows error toast when import fails with Error", async () => {
      mockImportDocumentFile.mockRejectedValue(new Error("Unsupported file type"));

      render(<Navbar />);

      const input = screen.getByTestId("document-import-input");
      const file = new File(["stuff"], "bad.xyz", { type: "application/octet-stream" });

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith("Unsupported file type");
      });
    });

    it("shows generic error toast when import fails with non-Error", async () => {
      mockImportDocumentFile.mockRejectedValue("unknown error");

      render(<Navbar />);

      const input = screen.getByTestId("document-import-input");
      const file = new File(["stuff"], "bad.xyz", { type: "application/octet-stream" });

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith("Failed to import file");
      });
    });

    it("does nothing when no file is selected", () => {
      render(<Navbar />);

      const input = screen.getByTestId("document-import-input");

      fireEvent.change(input, { target: { files: [] } });

      expect(mockImportDocumentFile).not.toHaveBeenCalled();
      expect(mockNotify).not.toHaveBeenCalled();
    });

    it("resets input value after file selection", async () => {
      mockImportDocumentFile.mockResolvedValue({
        body: "content",
        title: "test",
      });

      render(<Navbar />);

      const input = screen.getByTestId("document-import-input") as HTMLInputElement;
      const file = new File(["content"], "test.md", { type: "text/markdown" });

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockImportDocumentFile).toHaveBeenCalled();
      });

      expect(input.value).toBe("");
    });
  });

  describe("handleImageSelection", () => {
    it("uploads an image and inserts markdown at cursor", async () => {
      const insertMarkdownAtCursor = vi.fn();
      useStore.setState({ insertMarkdownAtCursor }, false);

      mockUpload.mockResolvedValue({
        url: "https://example.com/image.png",
        markdown: "![image](https://example.com/image.png)",
        filename: "image.png",
        size: 1024,
        type: "image/png",
      });

      render(<Navbar />);

      const input = screen.getByTestId("image-import-input");
      const file = new File(["png-data"], "image.png", { type: "image/png" });

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledWith(file);
      });

      await waitFor(() => {
        expect(insertMarkdownAtCursor).toHaveBeenCalledWith(
          "\n![image](https://example.com/image.png)\n"
        );
      });
    });

    it("does nothing when upload returns null", async () => {
      const insertMarkdownAtCursor = vi.fn();
      useStore.setState({ insertMarkdownAtCursor }, false);

      mockUpload.mockResolvedValue(null);

      render(<Navbar />);

      const input = screen.getByTestId("image-import-input");
      const file = new File(["png-data"], "image.png", { type: "image/png" });

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledWith(file);
      });

      expect(insertMarkdownAtCursor).not.toHaveBeenCalled();
    });

    it("does nothing when no file is selected", () => {
      render(<Navbar />);

      const input = screen.getByTestId("image-import-input");

      fireEvent.change(input, { target: { files: [] } });

      expect(mockUpload).not.toHaveBeenCalled();
    });

    it("resets input value after image selection", async () => {
      mockUpload.mockResolvedValue(null);

      render(<Navbar />);

      const input = screen.getByTestId("image-import-input") as HTMLInputElement;
      const file = new File(["png-data"], "image.png", { type: "image/png" });

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalled();
      });

      expect(input.value).toBe("");
    });
  });
});
