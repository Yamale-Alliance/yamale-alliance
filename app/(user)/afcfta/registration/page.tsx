"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

const AFRICA_COUNTRIES = [
  "Ghana", "Nigeria", "Kenya", "South Africa", "Senegal", "Tanzania", "Rwanda",
  "Côte d'Ivoire", "Egypt", "Ethiopia", "Cameroon", "Morocco", "Algeria", "Angola",
  "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Chad", "Comoros",
  "Congo", "Djibouti", "Equatorial Guinea", "Eritrea", "Eswatini", "Gabon", "Gambia",
  "Guinea", "Guinea-Bissau", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi",
  "Mali", "Mauritania", "Mauritius", "Mozambique", "Namibia", "Niger",
  "São Tomé and Príncipe", "Seychelles", "Sierra Leone", "Somalia", "South Sudan",
  "Sudan", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe",
];

const SECTORS = [
  "Agriculture & Agro-processing",
  "Manufacturing",
  "Services",
  "Mining & Minerals",
  "Textiles & Garments",
  "Automotive",
  "Pharmaceuticals",
  "ICT & Digital",
  "Other",
];

const REGISTRATION_STORAGE_KEY = "afcfta_registration_completed";
const REGISTRATION_DATA_KEY = "afcfta_registration_data";

export default function AfCFTARegistrationPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("");
  const [sector, setSector] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem(REGISTRATION_STORAGE_KEY, "true");
      localStorage.setItem(
        REGISTRATION_DATA_KEY,
        JSON.stringify({ businessName, country, sector, email })
      );
    }
    setSubmitted(true);
    setTimeout(() => router.push("/afcfta/compliance-check"), 1500);
  };

  const isValid = businessName.trim() && country && sector && email.trim();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/afcfta/compliance-check"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AfCFTA Journey
        </Link>

        <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border/60">
            <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/20 flex items-center justify-center text-2xl">
              📋
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Registration</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Register your business and get started with AfCFTA compliance.
              </p>
            </div>
          </div>

          {submitted ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Registration complete</h2>
              <p className="text-muted-foreground">Taking you back to your AfCFTA journey…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Business name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Acme Trading Ltd"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Country of registration <span className="text-destructive">*</span>
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  required
                >
                  <option value="">Select country</option>
                  {AFRICA_COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Sector <span className="text-destructive">*</span>
                </label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  required
                >
                  <option value="">Select sector</option>
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Email <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  required
                />
              </div>
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={!isValid}
                  className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-6 py-3 text-sm font-semibold text-[#1a1a1a] transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
                >
                  Complete registration
                </button>
                <Link
                  href="/afcfta/compliance-check"
                  className="rounded-xl border border-border bg-background px-6 py-3 text-sm font-medium text-muted-foreground text-center transition-colors hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Step 1 of 6 · AfCFTA Compliance Tool — HS code → Production → Origin → NTB → Tariff → Checklist
        </p>
      </div>
    </div>
  );
}
