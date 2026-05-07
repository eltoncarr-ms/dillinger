"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PaneResizerProps {
  ratio: number;
  onRatioChange: (ratio: number) => void;
  onCollapsePreview?: () => void;
  min?: number;
  max?: number;
  containerRef: React.RefObject<HTMLElement | null>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function PaneResizer({
  ratio,
  onRatioChange,
  onCollapsePreview,
  min = 0.15,
  max = 0.85,
  containerRef,
}: PaneResizerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const previousUserSelectRef = useRef<string | null>(null);

  const cancelPendingFrame = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const updateRatioFromClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const nextRatio = clamp((clientX - rect.left) / rect.width, min, max);
      cancelPendingFrame();
      animationFrameRef.current = requestAnimationFrame(() => {
        animationFrameRef.current = null;
        onRatioChange(nextRatio);
      });
    },
    [cancelPendingFrame, containerRef, max, min, onRatioChange]
  );

  const restoreUserSelect = useCallback(() => {
    if (previousUserSelectRef.current !== null) {
      document.body.style.userSelect = previousUserSelectRef.current;
      previousUserSelectRef.current = null;
    }
  }, []);

  const endDrag = useCallback(
    (target: HTMLElement, pointerId: number) => {
      if (typeof target.releasePointerCapture === "function") {
        target.releasePointerCapture(pointerId);
      }

      pointerIdRef.current = null;
      setIsDragging(false);
      cancelPendingFrame();
      restoreUserSelect();
    },
    [cancelPendingFrame, restoreUserSelect]
  );

  useEffect(() => {
    return () => {
      cancelPendingFrame();
      restoreUserSelect();
    };
  }, [cancelPendingFrame, restoreUserSelect]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    pointerIdRef.current = event.pointerId;
    previousUserSelectRef.current = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    setIsDragging(true);
    updateRatioFromClientX(event.clientX);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || pointerIdRef.current !== event.pointerId) {
      return;
    }

    updateRatioFromClientX(event.clientX);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    endDrag(event.currentTarget, event.pointerId);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.02;

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        onRatioChange(clamp(ratio - step, min, max));
        break;
      case "ArrowRight":
        event.preventDefault();
        onRatioChange(clamp(ratio + step, min, max));
        break;
      case "Home":
        event.preventDefault();
        onRatioChange(clamp(0.5, min, max));
        break;
      case "Enter":
      case " ":
      case "Spacebar":
        event.preventDefault();
        onCollapsePreview?.();
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize editor and preview panes"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={Math.round(min * 100)}
      aria-valuemax={Math.round(max * 100)}
      tabIndex={0}
      className="group flex h-full w-3 shrink-0 cursor-col-resize items-stretch justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onRatioChange(clamp(0.5, min, max))}
    >
      <div
        className={cn(
          "h-full w-0.5 bg-border-light motion-safe:transition-colors motion-safe:duration-150 group-hover:bg-plum",
          isDragging && "bg-plum"
        )}
      />
    </div>
  );
}
