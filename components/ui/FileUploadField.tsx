"use client";

import { useId, useRef } from "react";
import { X } from "lucide-react";

type FileUploadFieldProps = {
  id?: string;
  accept?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  chooseLabel: string;
  emptyLabel: string;
  removeLabel?: string;
  error?: string | null;
  disabled?: boolean;
};

export function FileUploadField({
  id: idProp,
  accept,
  value,
  onChange,
  chooseLabel,
  emptyLabel,
  removeLabel = "Remove file",
  error,
  disabled = false,
}: FileUploadFieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);

  const clear = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <div
        className={`flex items-center gap-3 rounded-lg border bg-background px-3 py-2 ${
          error ? "border-destructive" : "border-input"
        }`}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
        >
          {chooseLabel}
        </button>
        <span
          className={`min-w-0 flex-1 truncate text-sm ${
            value ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {value?.name ?? emptyLabel}
        </span>
        {value ? (
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label={removeLabel}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
