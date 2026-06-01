"use client";

import { useState } from "react";
import {
  AFRICA_CONTINENT_PATH,
  normalizeVaultFocusCountry,
  vaultCountryIso2,
  vaultCountryMapPath,
} from "@/lib/marketplace-vault-country";
import styles from "./VaultCountryMapIcon.module.css";

type VaultCountryMapIconProps = {
  /** Canonical `countries.name` (e.g. Kenya). Empty → Africa continent. */
  focusCountry?: string | null;
  className?: string;
  /** Fill color for the silhouette (matches vault card type theme). */
  color?: string;
};

export function VaultCountryMapIcon({
  focusCountry,
  className,
  color = "currentColor",
}: VaultCountryMapIconProps) {
  const country = normalizeVaultFocusCountry(focusCountry);
  const iso2 = vaultCountryIso2(country);
  const [mapFailed, setMapFailed] = useState(false);

  if (iso2 && !mapFailed) {
    const mapUrl = vaultCountryMapPath(iso2);
    return (
      <span
        className={`${styles.countryMapMask} ${className ?? ""}`}
        style={{
          backgroundColor: color,
          WebkitMaskImage: `url(${mapUrl})`,
          maskImage: `url(${mapUrl})`,
        }}
        role="img"
        aria-hidden
      >
        {/* Probe load so we can fall back if the asset is missing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mapUrl}
          alt=""
          className={styles.mapProbe}
          onError={() => setMapFailed(true)}
        />
      </span>
    );
  }

  return (
    <svg
      viewBox="0 0 300 360"
      className={`${styles.continent} ${className ?? ""}`}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d={AFRICA_CONTINENT_PATH} />
    </svg>
  );
}
