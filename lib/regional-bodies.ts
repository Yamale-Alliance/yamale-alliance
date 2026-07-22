import { AFRICAN_COUNTRY_DB_NAMES } from "@/lib/african-country-search-phrases";

/** Canonical regional economic communities and unions in the Yamalé library. */
export type RegionalBodyDefinition = {
  /** Stable slug stored in `countries.code`. */
  code: string;
  /** Display name stored in `countries.name`. */
  name: string;
  /** Sovereign `countries.name` values that should see this body's laws via scopes. */
  memberCountries: readonly string[];
  /** Default law level when ingesting under this body. */
  defaultLevel: "Regional" | "International";
};

const ALL_AU_MEMBERS = AFRICAN_COUNTRY_DB_NAMES;

/**
 * Platform regional bodies (order matches the product catalog):
 * AU, AfCFTA, OHADA, ECOWAS, EAC, SADC, COMESA, ECCAS, UEMOA, CEMAC, SACU.
 */
export const REGIONAL_BODY_DEFINITIONS: RegionalBodyDefinition[] = [
  {
    code: "AU",
    name: "African Union (AU)",
    memberCountries: ALL_AU_MEMBERS,
    defaultLevel: "International",
  },
  {
    code: "AFCFTA",
    name: "AfCFTA",
    memberCountries: ALL_AU_MEMBERS,
    defaultLevel: "International",
  },
  {
    code: "OHADA",
    name: "OHADA",
    memberCountries: [
      "Benin",
      "Burkina Faso",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Comoros",
      "Congo Republic",
      "Côte d'Ivoire",
      "DR Congo",
      "Equatorial Guinea",
      "Gabon",
      "Guinea",
      "Guinea-Bissau",
      "Mali",
      "Niger",
      "Senegal",
      "Togo",
    ],
    defaultLevel: "Regional",
  },
  {
    code: "ECOWAS",
    name: "ECOWAS",
    memberCountries: [
      "Benin",
      "Burkina Faso",
      "Cabo Verde",
      "Côte d'Ivoire",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Liberia",
      "Mali",
      "Niger",
      "Nigeria",
      "Senegal",
      "Sierra Leone",
      "Togo",
    ],
    defaultLevel: "Regional",
  },
  {
    code: "EAC",
    name: "East African Community (EAC)",
    memberCountries: [
      "Burundi",
      "DR Congo",
      "Kenya",
      "Rwanda",
      "Somalia",
      "South Sudan",
      "Tanzania",
      "Uganda",
    ],
    defaultLevel: "Regional",
  },
  {
    code: "SADC",
    name: "SADC",
    memberCountries: [
      "Angola",
      "Botswana",
      "Comoros",
      "DR Congo",
      "Eswatini",
      "Lesotho",
      "Madagascar",
      "Malawi",
      "Mauritius",
      "Mozambique",
      "Namibia",
      "Seychelles",
      "South Africa",
      "Tanzania",
      "Zambia",
      "Zimbabwe",
    ],
    defaultLevel: "Regional",
  },
  {
    code: "COMESA",
    name: "COMESA",
    memberCountries: [
      "Burundi",
      "Comoros",
      "DR Congo",
      "Djibouti",
      "Egypt",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Kenya",
      "Libya",
      "Madagascar",
      "Malawi",
      "Mauritius",
      "Rwanda",
      "Seychelles",
      "Somalia",
      "Sudan",
      "Tunisia",
      "Uganda",
      "Zambia",
      "Zimbabwe",
    ],
    defaultLevel: "Regional",
  },
  {
    code: "ECCAS",
    name: "ECCAS",
    memberCountries: [
      "Angola",
      "Burundi",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Congo Republic",
      "DR Congo",
      "Equatorial Guinea",
      "Gabon",
      "Rwanda",
      "São Tomé and Príncipe",
    ],
    defaultLevel: "Regional",
  },
  {
    code: "UEMOA",
    name: "UEMOA",
    memberCountries: [
      "Benin",
      "Burkina Faso",
      "Côte d'Ivoire",
      "Guinea-Bissau",
      "Mali",
      "Niger",
      "Senegal",
      "Togo",
    ],
    defaultLevel: "Regional",
  },
  {
    code: "CEMAC",
    name: "CEMAC",
    memberCountries: [
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Congo Republic",
      "Equatorial Guinea",
      "Gabon",
    ],
    defaultLevel: "Regional",
  },
  {
    code: "SACU",
    name: "SACU",
    memberCountries: ["Botswana", "Eswatini", "Lesotho", "Namibia", "South Africa"],
    defaultLevel: "Regional",
  },
];

/** Legacy codes that map onto a current catalog entry (DB may still store the old code). */
const CODE_ALIASES: Record<string, string> = {
  WAEMU: "UEMOA",
  AFCTA: "AFCFTA",
};

export type CountryKind = "sovereign" | "regional_body";

export const REGIONAL_BODY_CODES = new Set(REGIONAL_BODY_DEFINITIONS.map((b) => b.code));

/** Catalog display order (AU → … → SACU). Unknown codes sort after. */
export function regionalBodySortIndex(code: string | null | undefined): number {
  const body = regionalBodyByCode(code);
  if (!body) return REGIONAL_BODY_DEFINITIONS.length + 1;
  return REGIONAL_BODY_DEFINITIONS.findIndex((b) => b.code === body.code);
}

export function regionalBodyByCode(code: string | null | undefined): RegionalBodyDefinition | null {
  const raw = code?.trim().toUpperCase().replace(/-/g, "_");
  if (!raw) return null;
  const key = CODE_ALIASES[raw] ?? raw;
  return REGIONAL_BODY_DEFINITIONS.find((b) => b.code === key) ?? null;
}

export function regionalBodyByName(name: string | null | undefined): RegionalBodyDefinition | null {
  const n = name?.trim().toLowerCase();
  if (!n) return null;
  if (n === "waemu" || n === "waemu (uemoa)" || n.includes("uemoa")) {
    return regionalBodyByCode("UEMOA");
  }
  if (n === "afcfta" || n.includes("continental free trade")) {
    return regionalBodyByCode("AFCFTA");
  }
  if (n === "ohada" || n.includes("ohada")) {
    return regionalBodyByCode("OHADA");
  }
  return (
    REGIONAL_BODY_DEFINITIONS.find(
      (b) => b.name.toLowerCase() === n || b.code.toLowerCase() === n
    ) ?? null
  );
}

export function isRegionalBodyCountry(row: {
  kind?: string | null;
  code?: string | null;
  name?: string | null;
}): boolean {
  if (row.kind === "regional_body") return true;
  if (row.code && (REGIONAL_BODY_CODES.has(row.code.toUpperCase()) || regionalBodyByCode(row.code))) {
    return true;
  }
  return regionalBodyByName(row.name) != null;
}
