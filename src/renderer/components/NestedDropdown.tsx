import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type NestedCategory = {
  key: string;
  label: string;
  id: string;
  onRename?: (id: string, newName: string) => void;
};
// TypeScript: Global declaration for window.useUserCategoryStore
declare global {
  interface Window {
    useUserCategoryStore: any;
  }
}
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
  // 3-level support (optional)
  getSubCategories?: (categoryKey: string) => NestedCategory[];
  getItemsForSubCategory?: (categoryKey: string, subKey: string) => NestedItem[];
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
  getSubCategories,
  getItemsForSubCategory,
}) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(initialCategoryKey);
  const [selectedSubKey, setSelectedSubKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 240 });
  const isThreeLevel = !!getSubCategories && !!getItemsForSubCategory;

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
      setSelectedSubKey(null);
    }
    if (!open) {
      setSelectedSubKey(null);
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

  const subCategories = useMemo(() =>
    (isThreeLevel && selectedKey) ? getSubCategories!(selectedKey) : [],
    [isThreeLevel, selectedKey, getSubCategories]
  );

  // Auto-select first sub-category when level-1 changes
  useEffect(() => {
    if (isThreeLevel && subCategories.length > 0) {
      setSelectedSubKey(subCategories[0].key);
    }
  }, [isThreeLevel, subCategories]);

  const items = useMemo(() => {
    if (isThreeLevel) {
      return (selectedKey && selectedSubKey)
        ? getItemsForSubCategory!(selectedKey, selectedSubKey)
        : [];
    }
    return selectedKey ? getItemsForCategory(selectedKey) : [];
  }, [isThreeLevel, selectedKey, selectedSubKey, getItemsForCategory, getItemsForSubCategory]);

  if (!open) return null;

  return createPortal(
    <div
      ref={containerRef}
      style={{ position: "absolute", top: pos.top, left: pos.left, zIndex: 1000, minWidth: Math.max(isThreeLevel ? 620 : 280, pos.width) }}
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
        <div className={`grid gap-0 ${isThreeLevel ? "grid-cols-3" : "grid-cols-2"}`}>
          {/* Level 1: Stone Town hotel OR regular hotel */}
          <div className="max-h-80 overflow-auto p-2 min-w-[180px] border-r">
            {categories.map((c) => {
              const [editing, setEditing] = useState(false);
              const [editValue, setEditValue] = useState(c.label);
              const handleRename = (newName: string) => {
                if (c.id && window.useUserCategoryStore) {
                  window.useUserCategoryStore.getState().updateCategory(c.id, newName);
                }
                if (typeof c.onRename === "function") c.onRename(c.id, newName);
              };
              return (
                <div
                  key={c.key}
                  className={`flex items-center px-2 py-1 rounded cursor-pointer hover:bg-muted-foreground/5 ${selectedKey === c.key ? "bg-accent" : ""}`}
                  onPointerDown={(e) => {
                    if (!editing) {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedKey(c.key);
                      setSelectedSubKey(null);
                    }
                  }}
                >
                  {editing ? (
                    <input
                      type="text"
                      className="text-sm px-1 py-0.5 rounded border"
                      value={editValue}
                      autoFocus
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => {
                        setEditing(false);
                        if (editValue !== c.label && window.confirm("Lagre nytt navn på kategori?")) {
                          handleRename(editValue);
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          setEditing(false);
                          if (editValue !== c.label && window.confirm("Lagre nytt navn på kategori?")) {
                            handleRename(editValue);
                          }
                        }
                        if (e.key === "Escape") setEditing(false);
                      }}
                    />
                  ) : (
                    <>
                      <span className="flex-1">{c.label}</span>
                      {!isThreeLevel && (
                        <button
                          className="ml-2 text-xs text-muted-foreground hover:text-primary"
                          title="Endre navn"
                          onPointerDown={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditing(true);
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer" }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Level 2: Beach hotel combos (only in 3-level mode) */}
          {isThreeLevel && (
            <div className="max-h-80 overflow-auto p-2 min-w-[200px] border-r">
              {subCategories.length === 0 ? (
                <div className="text-sm text-muted-foreground px-2 py-1">Ingen kombinasjoner</div>
              ) : (
                subCategories.map((sc) => (
                  <div
                    key={sc.key}
                    className={`px-2 py-1 rounded cursor-pointer hover:bg-muted-foreground/5 ${selectedSubKey === sc.key ? "bg-accent" : ""}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedSubKey(sc.key);
                    }}
                  >
                    {sc.label}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Level 3 (or Level 2 in 2-level mode): Items */}
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
