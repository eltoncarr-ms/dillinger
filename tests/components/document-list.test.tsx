import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentList } from "@/components/sidebar/DocumentList";
import { useStore } from "@/stores/store";
import { Document } from "@/lib/types";
import { isFileSystemAccessSupported } from "@/lib/fileSystemAccess";

const mockNotify = vi.fn();

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ notify: mockNotify }),
}));

vi.mock("@/lib/fileSystemAccess", () => ({
  isFileSystemAccessSupported: vi.fn(() => true),
}));

const initialState = useStore.getState();

function resetStore() {
  useStore.setState(
    {
      ...initialState,
      documents: [],
      currentDocument: null,
      editorInstance: null,
      settings: { ...initialState.settings },
      sidebarOpen: true,
      settingsOpen: false,
      previewVisible: true,
      zenMode: false,
      editorScrollPercent: 0,
      editorTopLine: 1,
    },
    true
  );
}

function createDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc-1",
    title: "First Document.md",
    body: "# Hello",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("DocumentList", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    vi.mocked(isFileSystemAccessSupported).mockReturnValue(true);
  });

  it("renders a list of documents", () => {
    const docs = [
      createDocument({ id: "1", title: "Alpha.md" }),
      createDocument({ id: "2", title: "Beta.md" }),
      createDocument({ id: "3", title: "Gamma.md" }),
    ];

    useStore.setState({ documents: docs, currentDocument: docs[0] });
    render(<DocumentList />);

    expect(screen.getByText("Alpha.md")).toBeVisible();
    expect(screen.getByText("Beta.md")).toBeVisible();
    expect(screen.getByText("Gamma.md")).toBeVisible();
  });

  it("shows document titles as button text", () => {
    const docs = [createDocument({ id: "1", title: "README.md" })];
    useStore.setState({ documents: docs, currentDocument: docs[0] });
    render(<DocumentList />);

    const button = screen.getByRole("button", { name: /README\.md/ });
    expect(button).toBeVisible();
  });

  it("highlights the currently selected document", () => {
    const docs = [
      createDocument({ id: "1", title: "Selected.md" }),
      createDocument({ id: "2", title: "Other.md" }),
    ];

    useStore.setState({ documents: docs, currentDocument: docs[0] });
    render(<DocumentList />);

    const selectedButton = screen.getByRole("button", { name: /Selected\.md/ });
    const otherButton = screen.getByRole("button", { name: /Other\.md/ });

    expect(selectedButton.className).toContain("bg-bg-highlight");
    expect(selectedButton.className).toContain("text-text-invert");
    expect(otherButton.className).not.toContain("text-text-invert");
  });

  it("selects a document when clicked", async () => {
    const user = userEvent.setup();

    const docs = [
      createDocument({ id: "1", title: "First.md" }),
      createDocument({ id: "2", title: "Second.md" }),
    ];

    useStore.setState({ documents: docs, currentDocument: docs[0] });
    render(<DocumentList />);

    await user.click(screen.getByRole("button", { name: /Second\.md/ }));

    expect(useStore.getState().currentDocument?.id).toBe("2");
  });

  it("renders an empty list when there are no documents", () => {
    render(<DocumentList />);

    const buttons = screen.queryAllByRole("button");
    expect(buttons).toHaveLength(0);
  });

  it("hides the reload icon for documents without a local file source", () => {
    const docs = [createDocument({ id: "1", title: "Remote.md" })];

    useStore.setState({ documents: docs, currentDocument: docs[0] });
    render(<DocumentList />);

    expect(screen.queryByRole("button", { name: /Reload "Remote\.md" from source/ })).not.toBeInTheDocument();
  });

  it("shows the reload icon for documents with a local file source", () => {
    const docs = [
      createDocument({
        id: "1",
        title: "Local.md",
        localFile: { handleId: "handle-1", filename: "Local.md" },
      }),
    ];

    useStore.setState({ documents: docs, currentDocument: docs[0] });
    render(<DocumentList />);

    const reloadButton = screen.getByRole("button", { name: /Reload "Local\.md" from source/ });
    expect(reloadButton).toBeEnabled();
    expect(reloadButton).toHaveAttribute("title", "Reload from source");
  });

  it("disables the reload icon when File System Access is unsupported", () => {
    vi.mocked(isFileSystemAccessSupported).mockReturnValue(false);
    const docs = [
      createDocument({
        id: "1",
        title: "Local.md",
        localFile: { handleId: "handle-1", filename: "Local.md" },
      }),
    ];

    useStore.setState({ documents: docs, currentDocument: docs[0] });
    render(<DocumentList />);

    const reloadButton = screen.getByRole("button", { name: /Reload "Local\.md" from source/ });
    expect(reloadButton).toBeDisabled();
    expect(reloadButton).toHaveAttribute("title", "Reload requires Chrome, Edge, or Opera");
  });

  it("selects a non-current document and reloads it when its reload icon is clicked", async () => {
    const user = userEvent.setup();
    const docs = [
      createDocument({ id: "1", title: "First.md" }),
      createDocument({
        id: "2",
        title: "Second.md",
        localFile: { handleId: "handle-2", filename: "Second.md" },
      }),
    ];
    const selectDocument = vi.fn();
    const reloadCurrentDocumentFromSource = vi.fn().mockResolvedValue({ status: "reloaded", filename: "Second.md" });

    useStore.setState({ documents: docs, currentDocument: docs[0], selectDocument, reloadCurrentDocumentFromSource });
    render(<DocumentList />);

    await user.click(screen.getByRole("button", { name: /Reload "Second\.md" from source/ }));

    expect(selectDocument).toHaveBeenCalledWith("2");
    await waitFor(() => expect(reloadCurrentDocumentFromSource).toHaveBeenCalledOnce());
    expect(mockNotify).toHaveBeenCalledWith('Reloaded from "Second.md"');
  });

  it("reloads the current document without selecting it again", async () => {
    const user = userEvent.setup();
    const docs = [
      createDocument({
        id: "1",
        title: "Current.md",
        localFile: { handleId: "handle-1", filename: "Current.md" },
      }),
    ];
    const selectDocument = vi.fn();
    const reloadCurrentDocumentFromSource = vi.fn().mockResolvedValue({ status: "reloaded", filename: "Current.md" });

    useStore.setState({ documents: docs, currentDocument: docs[0], selectDocument, reloadCurrentDocumentFromSource });
    render(<DocumentList />);

    await user.click(screen.getByRole("button", { name: /Reload "Current\.md" from source/ }));

    expect(selectDocument).not.toHaveBeenCalled();
    await waitFor(() => expect(reloadCurrentDocumentFromSource).toHaveBeenCalledOnce());
  });

  it("shows toolbar confirmation guidance when reload needs confirmation", async () => {
    const user = userEvent.setup();
    const docs = [
      createDocument({
        id: "1",
        title: "Dirty.md",
        localFile: { handleId: "handle-1", filename: "Dirty.md" },
      }),
    ];
    const reloadCurrentDocumentFromSource = vi.fn().mockResolvedValue({ status: "needs-confirm" });

    useStore.setState({ documents: docs, currentDocument: docs[0], reloadCurrentDocumentFromSource });
    render(<DocumentList />);

    await user.click(screen.getByRole("button", { name: /Reload "Dirty\.md" from source/ }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith("Unsaved changes — use the Reload button in the toolbar to confirm");
    });
  });

  it("does not bubble reload clicks to the row selection handler", async () => {
    const user = userEvent.setup();
    const docs = [
      createDocument({
        id: "1",
        title: "Current.md",
        localFile: { handleId: "handle-1", filename: "Current.md" },
      }),
    ];
    const selectDocument = vi.fn();
    const reloadCurrentDocumentFromSource = vi.fn().mockResolvedValue({ status: "no-source" });

    useStore.setState({ documents: docs, currentDocument: docs[0], selectDocument, reloadCurrentDocumentFromSource });
    render(<DocumentList />);

    await user.click(screen.getByRole("button", { name: /Reload "Current\.md" from source/ }));

    expect(selectDocument).not.toHaveBeenCalled();
    await waitFor(() => expect(reloadCurrentDocumentFromSource).toHaveBeenCalledOnce());
  });
});
