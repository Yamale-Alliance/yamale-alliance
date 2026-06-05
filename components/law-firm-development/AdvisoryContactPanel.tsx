"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { PLATFORM_BUSINESS_EMAIL } from "@/lib/platform-emails";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AdvisoryContactPanel({ open, onClose }: Props) {
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [topic, setTopic] = useState("document");
  const [priority, setPriority] = useState("standard");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const mailSubject = encodeURIComponent(
    topic === "tier2"
      ? "Law Firm Development — Tier 2 enquiry"
      : topic === "call"
        ? "Law Firm Development — Schedule a call"
        : "Law Firm Development — Workspace question"
  );
  const mailBody = encodeURIComponent(
    `Priority: ${priority}\n\n${message || "(No message entered)"}`
  );

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/60"
        aria-label="Close contact panel"
        onClick={onClose}
      />
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[rgba(193,140,67,0.2)] bg-[#221913] shadow-2xl"
        role="dialog"
        aria-labelledby="advisory-contact-title"
      >
        <div className="flex items-center justify-between border-b border-[rgba(193,140,67,0.12)] px-5 py-4">
          <div>
            <h2 id="advisory-contact-title" className="text-lg font-semibold text-white">
              Yamalé Advisory
            </h2>
            <p className="text-sm text-white/50">How can we help?</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/50 hover:bg-white/5"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {sent ? (
            <p className="text-sm leading-relaxed text-white/70">
              Your message has been prepared. Send it from your email client and the advisory team will respond
              within one business day at the address on your account. A copy can be saved under your firm&apos;s
              communications when that feature is enabled.
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-white/55">
                A member of the advisory team replies within one business day.
              </p>
              <fieldset className="mb-4 space-y-2">
                <legend className="sr-only">Enquiry type</legend>
                {[
                  { id: "document", label: "Document question" },
                  { id: "custom", label: "Customisation help" },
                  { id: "call", label: "Schedule a call" },
                  { id: "tier2", label: "Tier 2 enquiry" },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-start gap-2 rounded-md border border-[rgba(193,140,67,0.15)] px-3 py-2 text-sm text-white/75 has-[:checked]:border-[#C18C43]/50 has-[:checked]:bg-[rgba(193,140,67,0.08)]"
                  >
                    <input
                      type="radio"
                      name="topic"
                      value={opt.id}
                      checked={topic === opt.id}
                      onChange={() => setTopic(opt.id)}
                      className="mt-0.5"
                    />
                    {opt.label}
                  </label>
                ))}
              </fieldset>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/45">
                Your message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="mb-4 w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-3 py-2 text-sm text-white placeholder:text-white/30"
                placeholder="Describe your question or request…"
              />
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/45">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mb-4 w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-3 py-2 text-sm text-white"
              >
                <option value="standard">Standard · 1 business day</option>
                <option value="priority">Priority · Same business day</option>
                <option value="urgent">Urgent · Within 4 hours (Premium)</option>
              </select>
            </>
          )}
        </div>

        <div className="border-t border-[rgba(193,140,67,0.12)] px-5 py-4">
          {sent ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-[2px] bg-[#C18C43] py-2.5 text-sm font-semibold text-[#221913]"
            >
              Close
            </button>
          ) : (
            <a
              href={`mailto:${PLATFORM_BUSINESS_EMAIL}?subject=${mailSubject}&body=${mailBody}`}
              onClick={() => setSent(true)}
              className="flex w-full items-center justify-center rounded-[2px] bg-[#C18C43] py-2.5 text-sm font-semibold text-[#221913] transition hover:bg-[#E3BA65]"
            >
              Send message
            </a>
          )}
          <p className="mt-3 text-center text-[0.7rem] text-white/40">
            {PLATFORM_BUSINESS_EMAIL} · Dakar, Senegal
          </p>
        </div>
      </div>
    </>
  );
}
