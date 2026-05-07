import { create } from "zustand";
import type * as Monaco from "monaco-editor";
import { Document, UserSettings, DEFAULT_SETTINGS, DEFAULT_DOCUMENT_BODY } from "@/lib/types";
import { DEFAULT_DOCUMENT_TITLE } from "@/lib/document";

export type PanelLayout = "split" | "editor-only" | "preview-only";

const MIN_SPLIT_RATIO = 0.15;
const MAX_SPLIT_RATIO = 0.85;
const DEFAULT_SPLIT_RATIO = 0.5;
const PANEL_LAYOUTS: readonly PanelLayout[] = ["split", "editor-only", "preview-only"];

const isPanelLayout = (value: unknown): value is PanelLayout =>
  typeof value === "string" && PANEL_LAYOUTS.includes(value as PanelLayout);

const clampSplitRatio = (ratio: unknown): number => {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) {
    return DEFAULT_SPLIT_RATIO;
  }

  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));
};

const previewVisibleForLayout = (layout: PanelLayout): boolean => layout !== "editor-only";

const parseStorageRecord = (json: string | null): Record<string, unknown> | null => {
  if (!json) return null;

  const parsed = JSON.parse(json) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
};

const settingsFromProfile = (profile: Record<string, unknown> | null): UserSettings => {
  if (!profile) return DEFAULT_SETTINGS;

  return {
    enableAutoSave: typeof profile.enableAutoSave === "boolean"
      ? profile.enableAutoSave
      : DEFAULT_SETTINGS.enableAutoSave,
    enableWordsCount: typeof profile.enableWordsCount === "boolean"
      ? profile.enableWordsCount
      : DEFAULT_SETTINGS.enableWordsCount,
    enableCharactersCount: typeof profile.enableCharactersCount === "boolean"
      ? profile.enableCharactersCount
      : DEFAULT_SETTINGS.enableCharactersCount,
    enableScrollSync: typeof profile.enableScrollSync === "boolean"
      ? profile.enableScrollSync
      : DEFAULT_SETTINGS.enableScrollSync,
    tabSize: typeof profile.tabSize === "number" && Number.isFinite(profile.tabSize)
      ? profile.tabSize
      : DEFAULT_SETTINGS.tabSize,
    keybindings: profile.keybindings === "default" || profile.keybindings === "vim" || profile.keybindings === "emacs"
      ? profile.keybindings
      : DEFAULT_SETTINGS.keybindings,
    enableNightMode: typeof profile.enableNightMode === "boolean"
      ? profile.enableNightMode
      : DEFAULT_SETTINGS.enableNightMode,
    enableGitHubComment: typeof profile.enableGitHubComment === "boolean"
      ? profile.enableGitHubComment
      : DEFAULT_SETTINGS.enableGitHubComment,
  };
};

interface AppState {
  // Documents
  documents: Document[];
  currentDocument: Document | null;
  editorInstance: Monaco.editor.IStandaloneCodeEditor | null;

  // Settings
  settings: UserSettings;

  // UI State
  sidebarOpen: boolean;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  panelLayout: PanelLayout;
  splitRatio: number;
  previewVisible: boolean;
  zenMode: boolean;
  isDirty: boolean;
  editorScrollPercent: number;
  editorTopLine: number;

  // Document Actions
  createDocument: () => void;
  createImportedDocument: (title: string, body: string) => void;
  selectDocument: (id: string) => void;
  deleteDocument: (id: string) => void;
  updateDocumentBody: (body: string) => void;
  updateDocumentTitle: (title: string) => void;
  setEditorInstance: (editor: Monaco.editor.IStandaloneCodeEditor | null) => void;
  insertMarkdownAtCursor: (markdown: string) => void;

  // Settings Actions
  updateSettings: (settings: Partial<UserSettings>) => void;

  // UI Actions
  toggleSidebar: () => void;
  toggleSettings: () => void;
  toggleShortcuts: () => void;
  setPanelLayout: (layout: PanelLayout) => void;
  setSplitRatio: (ratio: number) => void;
  cyclePanelLayout: () => void;
  togglePreview: () => void;
  setZenMode: (enabled: boolean) => void;
  setEditorScrollPercent: (percent: number) => void;
  setEditorTopLine: (line: number) => void;

  // Persistence
  hydrate: () => void;
  persist: () => void;
}

const createDefaultDocument = (): Document => ({
  id: Date.now().toString(),
  title: DEFAULT_DOCUMENT_TITLE,
  body: DEFAULT_DOCUMENT_BODY,
  createdAt: new Date().toISOString(),
});

export const useStore = create<AppState>((set, get) => ({
  // Initial State
  documents: [],
  currentDocument: null,
  editorInstance: null,
  settings: DEFAULT_SETTINGS,
  sidebarOpen: false,
  settingsOpen: false,
  shortcutsOpen: false,
  panelLayout: "split",
  splitRatio: DEFAULT_SPLIT_RATIO,
  previewVisible: true,
  zenMode: false,
  isDirty: false,
  editorScrollPercent: 0,
  editorTopLine: 1,

  // Document Actions
  createDocument: () => {
    const newDoc = createDefaultDocument();
    set((state) => ({
      documents: [...state.documents, newDoc],
      currentDocument: newDoc,
    }));
    get().persist();
  },

  createImportedDocument: (title: string, body: string) => {
    const newDoc = {
      ...createDefaultDocument(),
      title,
      body,
    };

    set((state) => ({
      documents: [...state.documents, newDoc],
      currentDocument: newDoc,
    }));
    get().persist();
  },

  selectDocument: (id: string) => {
    const doc = get().documents.find((d) => d.id === id);
    if (doc) {
      set({ currentDocument: doc });
      get().persist();
    }
  },

  deleteDocument: (id: string) => {
    const { documents, currentDocument } = get();
    const filtered = documents.filter((d) => d.id !== id);

    let newCurrent = currentDocument;
    if (currentDocument?.id === id) {
      newCurrent = filtered[0] || null;
    }

    set({ documents: filtered, currentDocument: newCurrent });
    get().persist();
  },

  updateDocumentBody: (body: string) => {
    const { currentDocument, documents } = get();
    if (!currentDocument) return;

    const updated = { ...currentDocument, body };
    const updatedDocs = documents.map((d) =>
      d.id === currentDocument.id ? updated : d
    );

    set({ currentDocument: updated, documents: updatedDocs, isDirty: true });
  },

  updateDocumentTitle: (title: string) => {
    const { currentDocument, documents } = get();
    if (!currentDocument) return;

    const updated = { ...currentDocument, title };
    const updatedDocs = documents.map((d) =>
      d.id === currentDocument.id ? updated : d
    );

    set({ currentDocument: updated, documents: updatedDocs });
    get().persist();
  },

  setEditorInstance: (editor) => set({ editorInstance: editor }),

  insertMarkdownAtCursor: (markdown: string) => {
    const { editorInstance, currentDocument, documents } = get();

    if (editorInstance) {
      const selection = editorInstance.getSelection();
      if (selection) {
        editorInstance.executeEdits("dillinger-inline-insert", [
          {
            range: selection,
            text: markdown,
            forceMoveMarkers: true,
          },
        ]);
        editorInstance.focus();
        return;
      }
    }

    if (!currentDocument) return;

    const updated = { ...currentDocument, body: `${currentDocument.body}${markdown}` };
    const updatedDocs = documents.map((doc) =>
      doc.id === currentDocument.id ? updated : doc
    );

    set({ currentDocument: updated, documents: updatedDocs });
    get().persist();
  },

  // Settings Actions
  updateSettings: (newSettings: Partial<UserSettings>) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
    get().persist();
  },

  // UI Actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  toggleShortcuts: () => set((state) => ({ shortcutsOpen: !state.shortcutsOpen })),
  setPanelLayout: (layout) => {
    set({ panelLayout: layout, previewVisible: previewVisibleForLayout(layout) });
    get().persist();
  },
  setSplitRatio: (ratio) => {
    set({ splitRatio: clampSplitRatio(ratio) });
    get().persist();
  },
  cyclePanelLayout: () => {
    const { panelLayout } = get();
    const nextLayout: PanelLayout = panelLayout === "split"
      ? "editor-only"
      : panelLayout === "editor-only"
        ? "preview-only"
        : "split";

    get().setPanelLayout(nextLayout);
  },
  togglePreview: () => {
    get().setPanelLayout(get().previewVisible ? "editor-only" : "split");
  },
  setZenMode: (enabled) => set({ zenMode: enabled }),
  setEditorScrollPercent: (percent) => set({ editorScrollPercent: percent }),
  setEditorTopLine: (line) => set({ editorTopLine: line }),

  // Persistence
  hydrate: () => {
    if (typeof window === "undefined") return;

    try {
      const filesJson = localStorage.getItem("files");
      const currentJson = localStorage.getItem("currentDocument");
      const settingsJson = localStorage.getItem("profileV3");
      const storedProfile = parseStorageRecord(settingsJson);

      const isFirstVisit = !filesJson;
      let documents: Document[] = filesJson ? JSON.parse(filesJson) as Document[] : [];
      let currentDocument: Document | null = currentJson
        ? JSON.parse(currentJson) as Document | null
        : null;
      const settings = settingsFromProfile(storedProfile);
      const panelLayout: PanelLayout = storedProfile && isPanelLayout(storedProfile.panelLayout)
        ? storedProfile.panelLayout
        : storedProfile && "panelLayout" in storedProfile
          ? "split"
          : storedProfile?.previewVisible === false
            ? "editor-only"
            : "split";
      const splitRatio = storedProfile && "splitRatio" in storedProfile
        ? clampSplitRatio(storedProfile.splitRatio)
        : DEFAULT_SPLIT_RATIO;

      // Ensure at least one document exists
      if (documents.length === 0) {
        const defaultDoc = createDefaultDocument();
        documents = [defaultDoc];
        currentDocument = defaultDoc;
      }

      // Ensure currentDocument is valid
      if (!currentDocument || !documents.find((d) => d.id === currentDocument!.id)) {
        currentDocument = documents[0];
      }

      set({
        documents,
        currentDocument,
        settings,
        panelLayout,
        splitRatio,
        previewVisible: previewVisibleForLayout(panelLayout),
        isDirty: false,
        sidebarOpen: isFirstVisit,
      });
    } catch (e) {
      console.error("Failed to hydrate state:", e);
    }
  },

  persist: () => {
    if (typeof window === "undefined") return;

    const { documents, currentDocument, settings, panelLayout, splitRatio, previewVisible } = get();

    try {
      localStorage.setItem("files", JSON.stringify(documents));
      localStorage.setItem("currentDocument", JSON.stringify(currentDocument));
      localStorage.setItem("profileV3", JSON.stringify({
        ...settings,
        panelLayout,
        splitRatio,
        previewVisible,
      }));
      set({ isDirty: false });
    } catch (e) {
      console.error("Failed to persist state:", e);
    }
  },
}));
