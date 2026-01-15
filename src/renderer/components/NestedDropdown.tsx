import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type NestedCategory = { key: string; label: string };
export type NestedItem = { id: string; label: string };

type NestedDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement>;
  categories: NestedCategory[];
  getItemsForCategory: (key: string) => NestedItem[];
  onSelectItem: (item: NestedItem, categoryKey: string) => void;
  initialCategoryKey?: string | null;
  title?: string;
};

export const NestedDropdown: React.FC<NestedDropdownProps> = ({
  open,
  onOpenChange,
  anchorRef,
  categories,
  getItemsForCategory,
  onSelectItem,
  initialCategoryKey = null,
  title,
}) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(initialCategoryKey);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 240 });

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = anchorRef.current as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (open && !selectedKey && categories.length > 0) {
      setSelectedKey(categories[0].key);
    }
  }, [open, selectedKey, categories]);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const c = containerRef.current;
      if (!c) return;
      const target = e.target as Node | null;
      if (target && (c === target || c.contains(target))) {
        return; // inside
      }
      const anchor = anchorRef.current as HTMLElement | null;
      if (anchor && (target && (anchor === target || anchor.contains(target as Node)))) {
        return; // allow anchor to toggle
      }
      onOpenChange(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open, onOpenChange, anchorRef]);

  const items = useMemo(() => (selectedKey ? getItemsForCategory(selectedKey) : []), [selectedKey, getItemsForCategory]);

  if (!open) return null;

  return createPortal(
    <div
      ref={containerRef}
      style={{ position: "absolute", top: pos.top, left: pos.left, zIndex: 1000, minWidth: Math.max(280, pos.width) }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="rounded border bg-popover text-popover-foreground shadow-md">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm font-medium">{title ?? "Velg"}</div>
          <button
            className="text-sm px-2 py-1 rounded hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
            }}
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-0">
          <div className="max-h-80 overflow-auto p-2 min-w-[180px]">
            {categories.map((c) => (
              <div
                key={c.key}
                className={`px-2 py-1 rounded cursor-pointer hover:bg-muted-foreground/5 ${selectedKey === c.key ? "bg-accent" : ""}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedKey(c.key);
                }}
              >
                {c.label}
              </div>
            ))}
          </div>
          <div className="max-h-80 overflow-auto p-2 min-w-[220px]">
            {items.length === 0 ? (
              <div className="text-sm text-muted-foreground px-2 py-1">Ingen filer</div>
            ) : (
              items.map((it) => (
                <div
                  key={it.id}
                  className="px-2 py-1 rounded cursor-pointer hover:bg-muted-foreground/5"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (selectedKey) onSelectItem(it, selectedKey);
                  }}
                >
                  {it.label}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default React.memo(NestedDropdown);
