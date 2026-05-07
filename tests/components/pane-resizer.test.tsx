import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PaneResizer } from "@/components/editor/PaneResizer";

function TestPaneResizer({
  ratio = 0.5,
  onRatioChange = vi.fn(),
  onCollapsePreview,
  min = 0.15,
  max = 0.85,
}: {
  ratio?: number;
  onRatioChange?: (ratio: number) => void;
  onCollapsePreview?: () => void;
  min?: number;
  max?: number;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <div ref={containerRef} data-testid="split-container">
      <PaneResizer
        ratio={ratio}
        onRatioChange={onRatioChange}
        onCollapsePreview={onCollapsePreview}
        min={min}
        max={max}
        containerRef={containerRef}
      />
    </div>
  );
}

function renderResizer(props: React.ComponentProps<typeof TestPaneResizer> = {}) {
  const onRatioChange = props.onRatioChange ?? vi.fn();
  const view = render(<TestPaneResizer {...props} onRatioChange={onRatioChange} />);
  const separator = screen.getByRole("separator", {
    name: "Resize editor and preview panes",
  });
  const container = screen.getByTestId("split-container");

  vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
    x: 100,
    y: 0,
    left: 100,
    top: 0,
    right: 1100,
    bottom: 400,
    width: 1000,
    height: 400,
    toJSON: () => ({}),
  });

  return { ...view, container, onRatioChange, separator };
}

describe("PaneResizer", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    if (typeof HTMLElement.prototype.setPointerCapture !== "function") {
      Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
        configurable: true,
        value: vi.fn(),
      });
    }
    if (typeof HTMLElement.prototype.releasePointerCapture !== "function") {
      Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
        configurable: true,
        value: vi.fn(),
      });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders with correct ARIA attributes", () => {
    renderResizer({ ratio: 0.5, min: 0.15, max: 0.85 });

    const separator = screen.getByRole("separator", {
      name: "Resize editor and preview panes",
    });
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator).toHaveAttribute("aria-valuenow", "50");
    expect(separator).toHaveAttribute("aria-valuemin", "15");
    expect(separator).toHaveAttribute("aria-valuemax", "85");
  });

  it("updates the ratio during pointer drag", () => {
    const { onRatioChange, separator } = renderResizer();

    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 600 });
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 800 });
    fireEvent.pointerUp(separator, { pointerId: 1 });

    expect(onRatioChange).toHaveBeenCalledWith(expect.closeTo(0.7, 0.001));
  });

  it("clamps pointer drag updates to the maximum ratio", () => {
    const { onRatioChange, separator } = renderResizer();

    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 600 });
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 1090 });

    expect(onRatioChange).toHaveBeenCalledWith(0.85);
  });

  it("clamps pointer drag updates to the minimum ratio", () => {
    const { onRatioChange, separator } = renderResizer();

    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 600 });
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 110 });

    expect(onRatioChange).toHaveBeenCalledWith(0.15);
  });

  it("changes the ratio with ArrowRight and ArrowLeft", () => {
    const onRatioChange = vi.fn();
    const { separator, rerender } = renderResizer({ ratio: 0.5, onRatioChange });

    separator.focus();
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(onRatioChange).toHaveBeenCalledWith(expect.closeTo(0.52, 0.001));

    rerender(<TestPaneResizer ratio={0.5} onRatioChange={onRatioChange} />);
    const updatedSeparator = screen.getByRole("separator", {
      name: "Resize editor and preview panes",
    });
    fireEvent.keyDown(updatedSeparator, { key: "ArrowLeft" });
    expect(onRatioChange).toHaveBeenCalledWith(expect.closeTo(0.48, 0.001));
  });

  it("changes the ratio by 0.10 with Shift+ArrowRight", () => {
    const { onRatioChange, separator } = renderResizer({ ratio: 0.5 });

    fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });

    expect(onRatioChange).toHaveBeenCalledWith(expect.closeTo(0.6, 0.001));
  });

  it("resets the ratio to 0.5 with Home", () => {
    const { onRatioChange, separator } = renderResizer({ ratio: 0.7 });

    fireEvent.keyDown(separator, { key: "Home" });

    expect(onRatioChange).toHaveBeenCalledWith(0.5);
  });

  it("calls onCollapsePreview with Enter when provided", () => {
    const onCollapsePreview = vi.fn();
    const { separator } = renderResizer({ onCollapsePreview });

    fireEvent.keyDown(separator, { key: "Enter" });

    expect(onCollapsePreview).toHaveBeenCalledTimes(1);
  });

  it("resets the ratio to 0.5 on double-click", () => {
    const { onRatioChange, separator } = renderResizer({ ratio: 0.7 });

    fireEvent.doubleClick(separator);

    expect(onRatioChange).toHaveBeenCalledWith(0.5);
  });

  it("clamps keyboard updates at the minimum ratio", () => {
    const onRatioChange = vi.fn();
    const { separator } = renderResizer({ ratio: 0.15, min: 0.15, onRatioChange });

    fireEvent.keyDown(separator, { key: "ArrowLeft" });

    expect(onRatioChange).toHaveBeenCalledWith(0.15);
    expect(onRatioChange.mock.calls.every(([nextRatio]) => nextRatio >= 0.15)).toBe(true);
  });

  it("includes the existing plum focus ring class", () => {
    const { separator } = renderResizer();

    expect(separator).toHaveClass("focus-visible:ring-plum");
  });
});
