"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Briefcase, ChevronDown, ChevronRight, Check, X, FileText, ExternalLink, Download, Trash2, Mail, Phone } from "lucide-react";

type DocWithUrls = {
  id: string;
  document_type: string;
  file_name: string;
  created_at: string;
  viewUrl: string | null;
  downloadUrl: string | null;
};

type LawyerRow = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
  createdAt: number;
  profile: {
    email: string | null;
    phone: string | null;
    practice: string;
    country: string | null;
  } | null;
  submission: {
    submittedAt: string;
    specialty: string;
    experience: string;
    location: string;
    barNumber: string;
    bio: string;
    documents: Record<string, string>;
  } | null;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  degree: "Degree / qualification",
  license: "Law license",
  id: "ID",
  bar_cert: "Bar certificate",
  practice_cert: "Practice certificate",
};

export default function AdminLawyersPage() {
  const [lawyers, setLawyers] = useState<LawyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [documentsByUserId, setDocumentsByUserId] = useState<Record<string, DocWithUrls[]>>({});
  const [documentsLoading, setDocumentsLoading] = useState<string | null>(null);
  const [pdfViewUrl, setPdfViewUrl] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${window.location.origin}/api/admin/lawyers`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setLawyers(Array.isArray(data) ? data : []);
      })
      .catch(() => setLawyers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!expandedId) return;
    if (documentsByUserId[expandedId]) return;
    setDocumentsLoading(expandedId);
    fetch(`${window.location.origin}/api/admin/lawyers/${expandedId}/documents`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setDocumentsByUserId((prev) => ({ ...prev, [expandedId]: data.documents ?? [] }));
      })
      .catch(() => setDocumentsByUserId((prev) => ({ ...prev, [expandedId]: [] })))
      .finally(() => setDocumentsLoading(null));
  }, [expandedId, documentsByUserId]);

  const setStatus = async (userId: string, status: "approved" | "rejected") => {
    if (updating) return;
    setUpdating(userId);
    setError(null);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/lawyers/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update");
        setUpdating(userId);
        return;
      }
      setLawyers((prev) =>
        prev.map((l) => (l.id === userId ? { ...l, status } : l))
      );
    } catch {
      setError("Network error");
    }
    setUpdating(null);
  };

  const removeLawyer = async (userId: string) => {
    if (removingId) return;
    if (!confirm("Remove this lawyer from the directory? They will be rejected and their profile hidden from the public list.")) return;
    setRemovingId(userId);
    setError(null);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/lawyers/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to remove");
        setRemovingId(null);
        return;
      }
      setLawyers((prev) => prev.filter((l) => l.id !== userId));
      setExpandedId((id) => (id === userId ? null : id));
      setDocumentsByUserId((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch {
      setError("Network error");
    }
    setRemovingId(null);
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

  const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "approved")
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
          <Check className="h-3 w-3" /> Approved
        </span>
      );
    if (s === "rejected")
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
          <X className="h-3 w-3" /> Rejected
        </span>
      );
    return (
      <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        Pending
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Briefcase className="h-6 w-6" />
        Lawyer Verification
      </h1>
      <p className="mt-1 text-muted-foreground">
        Review lawyer applications: view details, documents, and approve or reject.
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
      ) : (
        <div className="mt-6 rounded-lg border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium w-8" aria-label="Expand" />
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Specialty</th>
                  <th className="text-left p-3 font-medium">Location</th>
                  <th className="text-left p-3 font-medium">Bar #</th>
                  <th className="text-left p-3 font-medium">Applied</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lawyers.map((l) => {
                  const sub = l.submission;
                  const expanded = expandedId === l.id;
                  return (
                    <React.Fragment key={l.id}>
                      <tr
                        className="border-b border-border hover:bg-muted/30 cursor-pointer"
                        onClick={() => setExpandedId(expanded ? null : l.id)}
                      >
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(expanded ? null : l.id)
                            }
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={expanded ? "Collapse" : "Expand to view contact and documents"}
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="p-3 font-medium">
                          {[l.firstName, l.lastName].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="p-3 text-muted-foreground">{l.email ?? "—"}</td>
                        <td className="p-3">{statusBadge(l.status)}</td>
                        <td className="p-3">{l.profile?.practice ?? sub?.specialty ?? "—"}</td>
                        <td className="p-3">{l.profile?.country ?? sub?.location ?? "—"}</td>
                        <td className="p-3">{sub?.barNumber ?? "—"}</td>
                        <td className="p-3 text-muted-foreground">
                          {sub ? formatDate(sub.submittedAt) : "—"}
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          {l.status === "pending" && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setStatus(l.id, "approved")}
                                disabled={updating === l.id}
                                className="rounded-md border border-green-600 bg-green-600/10 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-600/20 dark:text-green-400 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => setStatus(l.id, "rejected")}
                                disabled={updating === l.id}
                                className="rounded-md border border-red-600 bg-red-600/10 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-600/20 dark:text-red-400 disabled:opacity-50"
                              >
                                Reject
                              </button>
                              {updating === l.id && (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-border bg-muted/20">
                          <td colSpan={9} className="p-4">
                            <div className="grid gap-4 sm:grid-cols-2 text-sm">
                              {l.profile && (
                                <>
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-foreground">{l.profile.email || "—"}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-foreground">{l.profile.phone || "—"}</span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-muted-foreground mb-1">Practice</p>
                                    <p className="text-foreground">{l.profile.practice || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-muted-foreground mb-1">Country</p>
                                    <p className="text-foreground">{l.profile.country || "—"}</p>
                                  </div>
                                </>
                              )}
                              {sub && (
                                <>
                                  <div>
                                    <p className="font-medium text-muted-foreground mb-1">Experience</p>
                                    <p className="text-foreground">{sub.experience || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-muted-foreground mb-1">Bio</p>
                                    <p className="text-foreground whitespace-pre-wrap">{sub.bio || "—"}</p>
                                  </div>
                                </>
                              )}
                              <div className="sm:col-span-2">
                                <p className="font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                  <FileText className="h-4 w-4" /> Documents (view / download PDFs)
                                </p>
                                {documentsLoading === l.id ? (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                                  </div>
                                ) : (documentsByUserId[l.id]?.length ?? 0) > 0 ? (
                                  <ul className="space-y-2">
                                    {(documentsByUserId[l.id] ?? []).map((doc) => (
                                      <li key={doc.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                                        <span className="font-medium">{DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}</span>
                                        <span className="text-muted-foreground text-xs">{doc.file_name}</span>
                                        <span className="flex-1" />
                                        {doc.viewUrl && (
                                          <button
                                            type="button"
                                            onClick={() => setPdfViewUrl(doc.viewUrl)}
                                            className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
                                          >
                                            <ExternalLink className="h-3 w-3" /> View
                                          </button>
                                        )}
                                        {doc.downloadUrl && (
                                          <a
                                            href={doc.downloadUrl}
                                            download={doc.file_name}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
                                          >
                                            <Download className="h-3 w-3" /> Download
                                          </a>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-muted-foreground text-sm">No documents uploaded yet (lawyer may use panel Documents).</p>
                                )}
                              </div>
                              <div className="sm:col-span-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => removeLawyer(l.id)}
                                  disabled={removingId === l.id}
                                  className="inline-flex items-center gap-1 rounded-md border border-red-600 bg-red-600/10 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-600/20 dark:text-red-400 disabled:opacity-50"
                                >
                                  {removingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  {removingId === l.id ? "Removing…" : "Remove lawyer"}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {lawyers.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No lawyer applications yet.
            </div>
          )}
        </div>
      )}

      {/* PDF viewer modal */}
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
