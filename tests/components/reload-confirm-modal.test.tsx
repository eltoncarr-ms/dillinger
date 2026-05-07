import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReloadConfirmModal } from "@/components/modals/ReloadConfirmModal";

function renderModal(overrides: Partial<Parameters<typeof ReloadConfirmModal>[0]> = {}) {
  const defaults = {
    isOpen: true,
    filename: "README.md",
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  const result = render(<ReloadConfirmModal {...props} />);
  return { ...result, props };
}

describe("ReloadConfirmModal", () => {
  it("renders when open", () => {
    renderModal();

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText(/You have unsaved changes/)).toBeVisible();
  });

  it("does not render when not open", () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("includes the filename in the title", () => {
    renderModal({ filename: "notes.md" });

    expect(screen.getByText('Reload "notes.md" from source?')).toBeVisible();
  });

  it("cancel button click calls onCancel", async () => {
    const user = userEvent.setup();
    const { props } = renderModal();

    await user.click(screen.getByRole("button", { name: "Keep my edits" }));

    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  it("confirm button click calls onConfirm", async () => {
    const user = userEvent.setup();
    const { props } = renderModal();

    await user.click(screen.getByRole("button", { name: "Reload from source" }));

    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it("escape key calls onCancel", async () => {
    const user = userEvent.setup();
    const { props } = renderModal();

    await user.keyboard("{Escape}");

    expect(props.onCancel).toHaveBeenCalledOnce();
  });
});
