"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

type LawyerPracticeAreaMultiSelectProps = {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  selectedCountLabel: (count: number) => string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export function LawyerPracticeAreaMultiSelect({
  options,
  value,
  onChange,
  placeholder,
  selectedCountLabel,
}: LawyerPracticeAreaMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const updateMenuPosition = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = (area: string) => {
    if (value.includes(area)) {
      onChange(value.filter((item) => item !== area));
      return;
    }
    onChange([...value, area]);
  };

  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? value[0]
        : selectedCountLabel(value.length);

  const menu =
    open && menuPosition ? (
      <div
        ref={menuRef}
        id={listId}
        role="listbox"
        aria-multiselectable
        style={{
          position: "fixed",
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
          zIndex: 60,
        }}
        className="max-h-64 overflow-y-auto rounded-[6px] border border-white/20 bg-[#13263a] py-1 shadow-xl"
      >
        {options.map((area) => {
          const checked = value.includes(area);
          return (
            <label
              key={area}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(area)}
                className="rounded border-white/30"
              />
              <span>{area}</span>
            </label>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-2 rounded-[6px] border border-white/20 bg-[#13263a] px-3 py-2 text-left text-sm text-white outline-none"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
        >
          <span className={value.length === 0 ? "text-white/45" : "truncate"}>{summary}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
