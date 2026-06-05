"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  initial: {
    firmName?: string;
    firmLocation?: string;
    subscriptionLabel?: string;
  };
  onSave: (profile: {
    firmName?: string;
    firmLocation?: string;
    subscriptionLabel?: string;
  }) => Promise<void>;
  saving?: boolean;
};

export function AdvisoryFirmSettingsDialog({
  open,
  onClose,
  initial,
  onSave,
  saving,
}: Props) {
  const [firmName, setFirmName] = useState("");
  const [firmLocation, setFirmLocation] = useState("");
  const [subscriptionLabel, setSubscriptionLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    setFirmName(initial.firmName ?? "");
    setFirmLocation(initial.firmLocation ?? "");
    setSubscriptionLabel(initial.subscriptionLabel ?? "");
  }, [open, initial.firmName, initial.firmLocation, initial.subscriptionLabel]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/60"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[rgba(193,140,67,0.2)] bg-[#221913] p-6 shadow-2xl"
        role="dialog"
        aria-labelledby="advisory-firm-settings-title"
      >
        <div className="flex items-center justify-between">
          <h2 id="advisory-firm-settings-title" className="text-lg font-semibold text-white">
            Firm profile
          </h2>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-white/45">Shown in your workspace header. Only your team sees this.</p>
        <label className="mt-5 block text-xs font-semibold uppercase text-white/45">Firm name</label>
        <input
          value={firmName}
          onChange={(e) => setFirmName(e.target.value)}
          className="mt-1 w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-3 py-2 text-sm text-white"
          placeholder="e.g. Adeyemi & Okonkwo LLP"
        />
        <label className="mt-4 block text-xs font-semibold uppercase text-white/45">Location</label>
        <input
          value={firmLocation}
          onChange={(e) => setFirmLocation(e.target.value)}
          className="mt-1 w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-3 py-2 text-sm text-white"
          placeholder="e.g. Lagos"
        />
        <label className="mt-4 block text-xs font-semibold uppercase text-white/45">Subscription label</label>
        <input
          value={subscriptionLabel}
          onChange={(e) => setSubscriptionLabel(e.target.value)}
          className="mt-1 w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-3 py-2 text-sm text-white"
          placeholder="e.g. Tier 1 — Self-guided"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void onSave({
              firmName: firmName.trim() || undefined,
              firmLocation: firmLocation.trim() || undefined,
              subscriptionLabel: subscriptionLabel.trim() || undefined,
            }).then(onClose)
          }
          className="mt-6 w-full rounded-[2px] bg-[#C18C43] py-2.5 text-sm font-semibold text-[#221913] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}
