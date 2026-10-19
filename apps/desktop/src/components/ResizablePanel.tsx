import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

interface Props {
  children: ReactNode;
  edge: "left" | "right";
  width: number;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  onWidthChange: (width: number) => void;
  label: string;
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function ResizablePanel({
  children,
  edge,
  width,
  minWidth,
  maxWidth,
  defaultWidth,
  onWidthChange,
  label,
  className = "",
}: Props) {
  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const direction = edge === "right" ? 1 : -1;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add("horizontal-panel-resizing");

    const move = (moveEvent: PointerEvent) => {
      onWidthChange(clamp(startWidth + (moveEvent.clientX - startX) * direction, minWidth, maxWidth));
    };
    const stop = () => {
      document.body.classList.remove("horizontal-panel-resizing");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  return (
    <div className={`resizable-panel ${className}`} style={{ width }}>
      {children}
      <div
        className={`panel-resize-handle edge-${edge}`}
        role="separator"
        aria-label={`Resize ${label}`}
        aria-orientation="vertical"
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={startResize}
        onDoubleClick={() => onWidthChange(defaultWidth)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const direction = edge === "right" ? 1 : -1;
          const delta = (event.key === "ArrowRight" ? 12 : -12) * direction;
          onWidthChange(clamp(width + delta, minWidth, maxWidth));
        }}
      />
    </div>
  );
}
