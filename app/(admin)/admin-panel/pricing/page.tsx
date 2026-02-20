"use client";

import { useState, useEffect } from "react";
import { Loader2, Pencil, X, DollarSign, Sparkles } from "lucide-react";

type Plan = {
  id: string;
  slug: string;
  name: string;
  price_monthly: number;
  price_annual_per_month: number;
  price_annual_total: number;
  description: string | null;
  subtitle: string | null;
  features: string[];
  cta: string;
  highlighted: boolean;
  sort_order: number;
};

export default function AdminPricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = () => {
    setLoading(true);
    fetch(`${window.location.origin}/api/admin/pricing`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setPlans(Array.isArray(data) ? data : []);
      })
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    if (!editing) return;
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = e.currentTarget as HTMLFormElement;
    const featuresText = (form.elements.namedItem("features") as HTMLTextAreaElement)?.value ?? "";
    const features = featuresText.split("\n").map((s) => s.trim()).filter(Boolean);

    try {
      const res = await fetch(`${window.location.origin}/api/admin/pricing/${editing.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: (form.elements.namedItem("name") as HTMLInputElement)?.value ?? editing.name,
          price_monthly: parseInt((form.elements.namedItem("price_monthly") as HTMLInputElement)?.value ?? "0", 10),
          price_annual_per_month: parseInt((form.elements.namedItem("price_annual_per_month") as HTMLInputElement)?.value ?? "0", 10),
          price_annual_total: parseInt((form.elements.namedItem("price_annual_total") as HTMLInputElement)?.value ?? "0", 10),
          description: (form.elements.namedItem("description") as HTMLInputElement)?.value ?? null,
          subtitle: (form.elements.namedItem("subtitle") as HTMLInputElement)?.value || null,
          features,
          cta: (form.elements.namedItem("cta") as HTMLInputElement)?.value ?? editing.cta,
          highlighted: (form.elements.namedItem("highlighted") as HTMLInputElement)?.checked ?? false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update");
        setSaving(false);
        return;
      }
      // Refresh all plans to reflect the highlighted change (in case another plan was unhighlighted)
      fetchPlans();
      setEditing(null);
    } catch {
      setError("Network error");
    }
    setSaving(false);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <DollarSign className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pricing</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Edit plan names, prices, and features. Changes appear on the public pricing page.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md ${
                plan.highlighted
                  ? "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20"
                  : "border-border"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-2.5 right-4 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm">
                  <Sparkles className="h-3 w-3" />
                  Popular
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">{plan.name}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">({plan.slug})</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(plan)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:border-primary/30"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">${plan.price_monthly}</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                <li>${plan.price_annual_per_month}/mo billed annually</li>
                <li>${plan.price_annual_total}/yr total</li>
                <li className="pt-1 font-medium text-foreground">{plan.cta}</li>
              </ul>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            aria-hidden
            onClick={() => setEditing(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit {editing.name}</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSave} className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  name="name"
                  defaultValue={editing.name}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Price (monthly) $</label>
                  <input
                    type="number"
                    name="price_monthly"
                    min={0}
                    defaultValue={editing.price_monthly}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Annual per month $</label>
                  <input
                    type="number"
                    name="price_annual_per_month"
                    min={0}
                    defaultValue={editing.price_annual_per_month}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Annual total $</label>
                  <input
                    type="number"
                    name="price_annual_total"
                    min={0}
                    defaultValue={editing.price_annual_total}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  name="description"
                  defaultValue={editing.description ?? ""}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subtitle (e.g. or $50/year)</label>
                <input
                  name="subtitle"
                  defaultValue={editing.subtitle ?? ""}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Features (one per line, HTML allowed)</label>
                <textarea
                  name="features"
                  rows={6}
                  defaultValue={(editing.features ?? []).join("\n")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Button text (CTA)</label>
                <input
                  name="cta"
                  defaultValue={editing.cta}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="highlighted"
                  id="highlighted"
                  defaultChecked={editing.highlighted}
                  className="rounded border-input"
                />
                <label htmlFor="highlighted" className="text-sm">Highlight as &quot;Most Popular&quot;</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
