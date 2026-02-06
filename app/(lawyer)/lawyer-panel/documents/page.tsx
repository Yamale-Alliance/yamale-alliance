"use client";

import { useState, useEffect } from "react";
import { Loader2, FileText, Upload, Check, ExternalLink, Trash2 } from "lucide-react";

const DOC_TYPES = [
  { key: "degree", label: "Degree / qualification" },
  { key: "license", label: "Law license" },
  { key: "id", label: "ID (national / passport)" },
  { key: "bar_cert", label: "Bar certificate" },
  { key: "practice_cert", label: "Practice certificate" },
] as const;

type DocKey = (typeof DOC_TYPES)[number]["key"];

export default function LawyerDocumentsPage() {
  const [uploading, setUploading] = useState<DocKey | null>(null);
  const [documents, setDocuments] = useState<Array<{ id: string; document_type: string; file_name: string; created_at: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<Partial<Record<DocKey, File>>>({});

  useEffect(() => {
    fetch("/api/lawyer/me", { credentials: "include" })
      .then((r) => r.json())
      .then((me) => {
        if (Array.isArray(me.documents)) setDocuments(me.documents);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const handleFileChange = (key: DocKey, file: File | null) => {
    if (file && file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }
    setFiles((prev) => ({ ...prev, [key]: file ?? undefined }));
    setError(null);
  };

  const refetchDocuments = () => {
    fetch("/api/lawyer/me", { credentials: "include" })
      .then((r) => r.json())
      .then((me) => {
        if (Array.isArray(me.documents)) setDocuments(me.documents);
      })
      .catch(() => {});
  };

  const handleUpload = async (key: DocKey) => {
    const file = files[key];
    if (!file) {
      setError(`Please select a PDF for ${DOC_TYPES.find((d) => d.key === key)?.label ?? key}`);
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }
    setUploading(key);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("documentType", key);
      formData.set("file", file);
      const res = await fetch("/api/lawyer/documents", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setFiles((prev) => ({ ...prev, [key]: undefined }));
      refetchDocuments();
    } catch {
      setError("Network error");
    } finally {
      setUploading(null);
    }
  };

  const docByType = new Map(documents.map((d) => [d.document_type, d]));
  const [viewingDocType, setViewingDocType] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<string | null>(null);

  const handleDeleteDocument = async (documentType: string) => {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    setDeletingType(documentType);
    setError(null);
    try {
      const res = await fetch(
        `/api/lawyer/documents?documentType=${encodeURIComponent(documentType)}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json();
      if (res.ok) {
        refetchDocuments();
      } else {
        setError(data.error ?? "Could not delete");
      }
    } catch {
      setError("Network error");
    } finally {
      setDeletingType(null);
    }
  };

  const viewDocument = async (documentType: string) => {
    setViewingDocType(documentType);
    try {
      const res = await fetch(
        `/api/lawyer/documents/view?documentType=${encodeURIComponent(documentType)}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        setError(data.error ?? "Could not open document");
      }
    } catch {
      setError("Network error");
    } finally {
      setViewingDocType(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 flex justify-center items-center min-h-[280px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-8 md:px-8 md:py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <FileText className="h-7 w-7" />
          Documents
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Upload your verification documents as PDF only.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Document uploads (PDF only) – saved uploads shown with Saved badge */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Documents (PDF only)</h2>
        <p className="mt-1 text-sm text-muted-foreground">Upload your verification documents. They are saved automatically. Max 10 MB per file.</p>
        <ul className="mt-4 space-y-4">
          {DOC_TYPES.map(({ key, label }) => {
            const doc = docByType.get(key);
            const file = files[key];
            const isUploading = uploading === key;
            const isSaved = !!doc;
            return (
              <li key={key} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <span className="font-medium text-foreground w-40 shrink-0">{label}</span>
                {isSaved && (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                      <Check className="h-3 w-3" /> Saved: {doc.file_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => viewDocument(key)}
                      disabled={viewingDocType === key}
                      className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {viewingDocType === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                      {viewingDocType === key ? "Opening…" : "View PDF"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(key)}
                      disabled={deletingType === key}
                      className="inline-flex items-center gap-1 rounded border border-red-600/50 bg-red-600/10 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-600/20 dark:text-red-400 disabled:opacity-50"
                      title="Delete document"
                    >
                      {deletingType === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      {deletingType === key ? "Deleting…" : "Delete"}
                    </button>
                  </>
                )}
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handleFileChange(key, e.target.files?.[0] ?? null)}
                  className="text-sm file:mr-2 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-primary-foreground"
                />
                <button
                  type="button"
                  onClick={() => handleUpload(key)}
                  disabled={!file || isUploading}
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isUploading ? "Saving…" : file ? "Upload & save" : "Choose file"}
                </button>
              </li>
            );
          })}
        </ul>
        {documents.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {documents.length} document(s) saved. Upload a new file for any type to replace it.
          </p>
        )}
      </div>
    </div>
  );
}
