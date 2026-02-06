"use client";

import { useState, useEffect } from "react";
import { Loader2, Pencil, X } from "lucide-react";

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
      setPlans((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...data } : p)));
      setEditing(null);
    } catch {
      setError("Network error");
    }
    setSaving(false);
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Pricing</h1>
      <p className="mt-1 text-muted-foreground">
        Edit plan names, prices, and features. Changes appear on the public pricing page.
      </p>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{plan.name}</span>
                  <span className="ml-2 text-muted-foreground text-sm">({plan.slug})</span>
                  {plan.highlighted && (
                    <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary">
                      Highlighted
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(plan)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground md:grid-cols-4">
                <span>${plan.price_monthly}/mo</span>
                <span>${plan.price_annual_per_month}/mo annual</span>
                <span>${plan.price_annual_total}/yr</span>
                <span>{plan.cta}</span>
              </div>
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
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-6 shadow-xl">
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
