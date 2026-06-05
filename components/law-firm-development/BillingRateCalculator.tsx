"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdvisoryProgress } from "@/hooks/useAdvisoryProgress";
import { AdvisoryBreadcrumbs } from "@/components/law-firm-development/AdvisoryBreadcrumbs";
import { advisoryToolsHref } from "@/lib/law-firm-development/routes";

const ROLES = [
  { id: "senior-partner", label: "Senior Partner", defaultSalary: 120000, defaultHours: 1500 },
  { id: "senior-associate", label: "Senior Associate", defaultSalary: 72000, defaultHours: 1700 },
  { id: "associate", label: "Associate", defaultSalary: 48000, defaultHours: 1700 },
  { id: "junior", label: "Junior Associate", defaultSalary: 36000, defaultHours: 1800 },
] as const;

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function BillingRateCalculator() {
  const { ready, statuses, setDocumentStatus } = useAdvisoryProgress();
  const [roleId, setRoleId] = useState<(typeof ROLES)[number]["id"]>("associate");

  useEffect(() => {
    if (!ready || statuses["bnc-06"] === "complete" || statuses["bnc-06"] === "in_progress") return;
    void setDocumentStatus("bnc-06", "in_progress");
  }, [ready, statuses, setDocumentStatus]);
  const [salary, setSalary] = useState(48000);
  const [overhead, setOverhead] = useState(2.5);
  const [billableHours, setBillableHours] = useState(1700);
  const [realisation, setRealisation] = useState(80);

  const role = ROLES.find((r) => r.id === roleId) ?? ROLES[2];

  const result = useMemo(() => {
    const loaded = salary * overhead;
    const effectiveHours = billableHours * (realisation / 100);
    const rate = effectiveHours > 0 ? loaded / effectiveHours : 0;
    return {
      base: salary,
      loaded,
      effectiveHours: Math.round(effectiveHours),
      rate: Math.round(rate),
    };
  }, [salary, overhead, billableHours, realisation]);

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-10">
      <AdvisoryBreadcrumbs
        crumbs={[{ label: "Tools & Templates", href: advisoryToolsHref() }, { label: "Billing Rate Calculator" }]}
      />
      <p className="text-[0.8rem] font-semibold uppercase tracking-wide text-[#C18C43]">
        Interactive Tool · BNC-06
      </p>
      <h1 className="mt-2 [font-family:var(--font-lfp-serif),Georgia,serif] text-3xl font-semibold text-white">
        Billing Rate Calculator
      </h1>
      <p className="mt-3 max-w-2xl text-white/55">
        Calculate target hourly billing rates by role. Fill in your firm&apos;s targets and the calculator
        returns recommended rates with a transparent breakdown.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-lg border border-[rgba(193,140,67,0.12)] bg-[#221913] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Inputs</h2>
          <p className="mt-1 text-xs text-white/40">Adjust any field and the result updates instantly.</p>

          <label className="mt-6 block text-xs font-semibold uppercase text-white/45">Role</label>
          <select
            value={roleId}
            onChange={(e) => {
              const id = e.target.value as (typeof ROLES)[number]["id"];
              setRoleId(id);
              const r = ROLES.find((x) => x.id === id);
              if (r) {
                setSalary(r.defaultSalary);
                setBillableHours(r.defaultHours);
              }
            }}
            className="mt-1 w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-3 py-2 text-sm text-white"
          >
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-xs font-semibold uppercase text-white/45">
            Annual salary (USD)
          </label>
          <input
            type="number"
            min={0}
            value={salary}
            onChange={(e) => setSalary(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-3 py-2 text-sm text-white"
          />
          <p className="mt-1 text-xs text-white/35">Annual gross compensation for {role.label.toLowerCase()}.</p>

          <label className="mt-4 block text-xs font-semibold uppercase text-white/45">
            Overhead multiplier
          </label>
          <input
            type="number"
            min={1}
            step={0.1}
            value={overhead}
            onChange={(e) => setOverhead(Number(e.target.value) || 1)}
            className="mt-1 w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-3 py-2 text-sm text-white"
          />
          <p className="mt-1 text-xs text-white/35">Typical range 2.0–3.0.</p>

          <label className="mt-4 block text-xs font-semibold uppercase text-white/45">
            Target billable hours per year
          </label>
          <input
            type="number"
            min={0}
            value={billableHours}
            onChange={(e) => setBillableHours(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-3 py-2 text-sm text-white"
          />

          <label className="mt-4 block text-xs font-semibold uppercase text-white/45">
            Realisation rate (%)
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={realisation}
            onChange={(e) => setRealisation(Number(e.target.value) || 1)}
            className="mt-1 w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-3 py-2 text-sm text-white"
          />

          <button
            type="button"
            disabled
            className="mt-6 w-full rounded-[2px] border border-[rgba(193,140,67,0.25)] py-2 text-sm text-white/40"
          >
            Save to firm records (soon)
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-[rgba(193,140,67,0.2)] bg-[rgba(193,140,67,0.08)] p-6 text-center">
            <p className="text-xs uppercase tracking-wide text-white/45">Recommended hourly rate</p>
            <p className="mt-2 [font-family:var(--font-lfp-serif),Georgia,serif] text-4xl font-bold text-[#E3BA65]">
              {formatUsd(result.rate)}/hr
            </p>
            <p className="mt-3 text-xs text-white/40">
              Round to the nearest $5 for client-facing rates.
            </p>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-white/55">
              <dt>Base annual cost</dt>
              <dd>{formatUsd(result.base)}</dd>
            </div>
            <div className="flex justify-between text-white/55">
              <dt>Fully-loaded cost</dt>
              <dd>{formatUsd(result.loaded)}</dd>
            </div>
            <div className="flex justify-between text-white/55">
              <dt>Effective billable hours</dt>
              <dd>{result.effectiveHours.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between font-medium text-[#C18C43]">
              <dt>Required rate</dt>
              <dd>{formatUsd(result.rate)}/hr</dd>
            </div>
          </dl>
          <p className="text-xs leading-relaxed text-white/40">
            This is your floor rate. Premium matters and specialist work should price above this level.
          </p>
        </div>
      </div>
    </div>
  );
}
