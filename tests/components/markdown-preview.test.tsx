import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import mermaid from "mermaid";
import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { useStore } from "@/stores/store";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/markdown", () => ({
  renderMarkdown: vi.fn(async (body: string) => {
    if (body.includes("```mermaid")) {
      return '<pre class="mermaid" data-line-start="1" data-line-end="4">flowchart TD\nA--&gt;B\n</pre>';
    }

    if (body.includes("<script>")) {
      return "<h1>Title</h1>\n<script>alert(1)</script>";
    }

    if (body.startsWith("# ")) {
      return `<h1>${body.slice(2)}</h1>`;
    }

    return `<p>${body}</p>`;
  }),
}));

const initialState = useStore.getState();
const mockedMermaid = vi.mocked(mermaid);

function resetStore(body: string, enableNightMode = false) {
  const currentDocument = {
    id: "doc-1",
    title: "doc.md",
    body,
    createdAt: new Date().toISOString(),
  };

  useStore.setState(
    {
      ...initialState,
      documents: [currentDocument],
      currentDocument,
      editorInstance: null,
      settings: { ...DEFAULT_SETTINGS, enableNightMode },
      sidebarOpen: false,
      settingsOpen: false,
      shortcutsOpen: false,
      panelLayout: "split",
      splitRatio: 0.5,
      previewVisible: true,
      zenMode: false,
      isDirty: false,
      editorScrollPercent: 0,
      editorTopLine: 1,
    },
    true
  );
}

describe("MarkdownPreview", () => {
  beforeEach(() => {
    resetStore("# Hello");
    vi.clearAllMocks();
  });

  it("renders sanitized HTML", async () => {
    render(<MarkdownPreview />);

    expect(await screen.findByRole("heading", { name: "Hello" })).toBeInTheDocument();
  });

  it("strips script from arbitrary HTML in markdown", async () => {
    resetStore("# Title\n\n<script>alert(1)</script>");

    const { container } = render(<MarkdownPreview />);

    expect(await screen.findByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(container.querySelector("script")).not.toBeInTheDocument();
  });

  it("calls mermaid.run when a mermaid block exists", async () => {
    resetStore("```mermaid\nflowchart TD\nA-->B\n```");

    render(<MarkdownPreview />);

    await waitFor(() => expect(mockedMermaid.run).toHaveBeenCalled());

    expect(mockedMermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        theme: "default",
        securityLevel: "strict",
      })
    );
    expect(mockedMermaid.run).toHaveBeenCalledWith({
      nodes: expect.any(Array),
    });
    const [{ nodes }] = mockedMermaid.run.mock.calls[0];
    expect(nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does not call mermaid when no mermaid block exists", async () => {
    resetStore("# No diagrams here");

    render(<MarkdownPreview />);

    await screen.findByRole("heading", { name: "No diagrams here" });
    expect(mockedMermaid.initialize).not.toHaveBeenCalled();
    expect(mockedMermaid.run).not.toHaveBeenCalled();
  });

  it("uses dark theme when nightMode is on", async () => {
    resetStore("```mermaid\nflowchart TD\nA-->B\n```", true);

    render(<MarkdownPreview />);

    await waitFor(() => expect(mockedMermaid.initialize).toHaveBeenCalled());
    expect(mockedMermaid.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: "dark" })
    );
  });

  it("re-initializes with new theme on nightMode toggle", async () => {
    resetStore("```mermaid\nflowchart TD\nA-->B\n```", false);

    render(<MarkdownPreview />);

    await waitFor(() => expect(mockedMermaid.initialize).toHaveBeenCalledTimes(1));

    useStore.setState({
      settings: { ...useStore.getState().settings, enableNightMode: true },
    });

    await waitFor(() => expect(mockedMermaid.initialize).toHaveBeenCalledTimes(2));
    expect(mockedMermaid.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: "dark" })
    );
  });
});
