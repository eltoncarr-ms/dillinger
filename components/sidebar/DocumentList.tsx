"use client";

import type { MouseEvent } from "react";
import { useStore } from "@/stores/store";
import { useToast } from "@/components/ui/Toast";
import { isFileSystemAccessSupported } from "@/lib/fileSystemAccess";
import { FileText, RefreshCw } from "lucide-react";

export function DocumentList() {
  const documents = useStore((state) => state.documents);
  const currentDocument = useStore((state) => state.currentDocument);
  const selectDocument = useStore((state) => state.selectDocument);
  const { notify } = useToast();
  const canReloadFromSource = isFileSystemAccessSupported();

  const handleReload = async (event: MouseEvent<HTMLButtonElement>, docId: string) => {
    event.stopPropagation();

    if (!canReloadFromSource) {
      return;
    }

    const store = useStore.getState();

    if (store.currentDocument?.id !== docId) {
      store.selectDocument(docId);
    }

    const result = await useStore.getState().reloadCurrentDocumentFromSource();

    switch (result.status) {
      case "reloaded":
        notify(`Reloaded from "${result.filename}"`);
        break;
      case "needs-confirm":
        notify("Unsaved changes — use the Reload button in the toolbar to confirm");
        break;
      case "denied":
        notify("Permission denied — could not reload");
        break;
      case "missing":
        notify("Source unavailable");
        break;
      case "unsupported":
        notify("Reload requires Chrome, Edge, or Opera");
        break;
      case "error":
        notify(result.message);
        break;
      case "no-source":
        break;
    }
  };

  return (
    <ul className="space-y-1">
      {documents.map((doc) => {
        const isCurrent = currentDocument?.id === doc.id;

        return (
          <li key={doc.id} className="flex items-center gap-1">
            <button
              onClick={() => selectDocument(doc.id)}
              className={`min-w-0 flex-1 text-left px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors ${
                isCurrent
                  ? "bg-bg-highlight text-text-invert"
                  : "text-dropdown-link hover:bg-bg-highlight/50"
              }`}
            >
              <FileText size={16} />
              <span className="truncate">{doc.title}</span>
            </button>
            {doc.localFile && (
              <button
                type="button"
                onClick={(event) => handleReload(event, doc.id)}
                disabled={!canReloadFromSource}
                aria-label={`Reload "${doc.title}" from source`}
                title={canReloadFromSource ? "Reload from source" : "Reload requires Chrome, Edge, or Opera"}
                className="shrink-0 rounded p-1 text-text-muted transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
