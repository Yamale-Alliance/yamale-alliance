"use client";

import { useState, useEffect } from "react";
import { Loader2, FileText, ExternalLink, Download, X, Trash2 } from "lucide-react";

const DOC_TYPE_LABELS: Record<string, string> = {
  degree: "Degree / qualification",
  license: "Law license",
  id: "ID (national / passport)",
  bar_cert: "Bar certificate",
  practice_cert: "Practice certificate",
};

type Doc = {
  id: string;
  document_type: string;
  file_name: string;
  created_at: string;
};

export default function LawyerDocumentsUploadedPage() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfViewUrl, setPdfViewUrl] = useState<string | null>(null);
  const [loadingViewType, setLoadingViewType] = useState<string | null>(null);
  const [loadingDownloadType, setLoadingDownloadType] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/lawyer/documents", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setDocuments(Array.isArray(data.documents) ? data.documents : []);
      })
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, []);

  const openView = async (documentType: string) => {
    setLoadingViewType(documentType);
    setError(null);
    try {
      const res = await fetch(
        `/api/lawyer/documents/view?documentType=${encodeURIComponent(documentType)}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (res.ok && data.url) {
        setPdfViewUrl(data.url);
      } else {
        setError(data.error ?? "Could not open document");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoadingViewType(null);
    }
  };

  const handleDelete = async (documentType: string) => {
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
        setDocuments((prev) => prev.filter((d) => d.document_type !== documentType));
      } else {
        setError(data.error ?? "Could not delete");
      }
    } catch {
      setError("Network error");
    } finally {
      setDeletingType(null);
    }
  };

  const handleDownload = async (documentType: string, fileName: string) => {
    setLoadingDownloadType(documentType);
    setError(null);
    try {
      const res = await fetch(
        `/api/lawyer/documents/download?documentType=${encodeURIComponent(documentType)}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (res.ok && data.url) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = data.file_name ?? fileName;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        setError(data.error ?? "Could not download");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoadingDownloadType(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <FileText className="h-6 w-6" />
        Documents uploaded
      </h1>
      <p className="mt-1 text-muted-foreground">
        View and download the documents you have uploaded. Upload or replace files from Documents.
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <FileText className="mx-auto h-12 w-12 opacity-50" />
          <p className="mt-2 font-medium">No documents uploaded yet</p>
          <p className="mt-1 text-sm">
            Go to <a href="/lawyer-panel/documents" className="text-primary underline hover:no-underline">Documents</a> to upload your verification documents.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
          <ul className="divide-y divide-border">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/20"
              >
                <span className="font-medium text-foreground w-44 shrink-0">
                  {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                </span>
                <span className="text-sm text-muted-foreground">{doc.file_name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDate(doc.created_at)}
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => openView(doc.document_type)}
                  disabled={loadingViewType === doc.document_type}
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  {loadingViewType === doc.document_type ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  {loadingViewType === doc.document_type ? "Opening…" : "View"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(doc.document_type, doc.file_name)}
                  disabled={loadingDownloadType === doc.document_type}
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  {loadingDownloadType === doc.document_type ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {loadingDownloadType === doc.document_type ? "Downloading…" : "Download"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.document_type)}
                  disabled={deletingType === doc.document_type}
                  className="inline-flex items-center gap-1 rounded-md border border-red-600/50 bg-red-600/10 px-2.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-600/20 dark:text-red-400 disabled:opacity-50"
                  title="Delete document"
                >
                  {deletingType === doc.document_type ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {deletingType === doc.document_type ? "Deleting…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* PDF viewer modal (same pattern as admin) */}
      {pdfViewUrl && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60"
            aria-hidden
            onClick={() => setPdfViewUrl(null)}
          />
          <div className="fixed inset-4 z-50 flex flex-col rounded-xl border border-border bg-card shadow-xl sm:inset-8">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
              <span className="text-sm font-medium">PDF viewer</span>
              <button
                type="button"
                onClick={() => setPdfViewUrl(null)}
                className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <iframe
              src={pdfViewUrl}
              title="Document PDF"
              className="min-h-0 flex-1 w-full rounded-b-xl"
            />
          </div>
        </>
      )}
    </div>
  );
}
