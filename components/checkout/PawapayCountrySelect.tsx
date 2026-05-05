"use client";

import { PAWAPAY_SUPPORTED_PAYMENT_COUNTRIES } from "@/lib/pawapay-payment-countries";

type Props = {
  value: string;
  onChange: (countryLabel: string) => void;
  id?: string;
  className?: string;
  label?: string;
  selectClassName?: string;
};

export function PawapayCountrySelect({ value, onChange, id, className, label, selectClassName }: Props) {
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">
          {label}
        </label>
      ) : null}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          selectClassName ??
          "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        }
      >
        {PAWAPAY_SUPPORTED_PAYMENT_COUNTRIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
