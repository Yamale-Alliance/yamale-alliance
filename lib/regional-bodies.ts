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

/** User-requested regional bodies (plus standard member lists aligned to AU RECs). */
export const REGIONAL_BODY_DEFINITIONS: RegionalBodyDefinition[] = [
  {
    code: "AU",
    name: "African Union (AU)",
    memberCountries: ALL_AU_MEMBERS,
    defaultLevel: "International",
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
    code: "IGAD",
    name: "IGAD",
    memberCountries: [
      "Djibouti",
      "Eritrea",
      "Ethiopia",
      "Kenya",
      "Somalia",
      "South Sudan",
      "Sudan",
      "Uganda",
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
    code: "WAEMU",
    name: "WAEMU (UEMOA)",
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
    code: "SACU",
    name: "SACU",
    memberCountries: ["Botswana", "Eswatini", "Lesotho", "Namibia", "South Africa"],
    defaultLevel: "Regional",
  },
  {
    code: "AMU",
    name: "Arab Maghreb Union (AMU)",
    memberCountries: ["Algeria", "Libya", "Mauritania", "Morocco", "Tunisia"],
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
    code: "CEN_SAD",
    name: "CEN-SAD",
    memberCountries: [
      "Benin",
      "Burkina Faso",
      "Central African Republic",
      "Chad",
      "Comoros",
      "Côte d'Ivoire",
      "Djibouti",
      "Egypt",
      "Eritrea",
      "Gambia",
      "Ghana",
      "Guinea",
      "Kenya",
      "Liberia",
      "Libya",
      "Mali",
      "Mauritania",
      "Morocco",
      "Niger",
      "Nigeria",
      "Senegal",
      "Sierra Leone",
      "Somalia",
      "Sudan",
      "Togo",
      "Tunisia",
      "Uganda",
    ],
    defaultLevel: "Regional",
  },
];

export type CountryKind = "sovereign" | "regional_body";

export const REGIONAL_BODY_CODES = new Set(REGIONAL_BODY_DEFINITIONS.map((b) => b.code));

export function regionalBodyByCode(code: string | null | undefined): RegionalBodyDefinition | null {
  const key = code?.trim().toUpperCase().replace(/-/g, "_");
  if (!key) return null;
  return REGIONAL_BODY_DEFINITIONS.find((b) => b.code === key) ?? null;
}

export function regionalBodyByName(name: string | null | undefined): RegionalBodyDefinition | null {
  const n = name?.trim().toLowerCase();
  if (!n) return null;
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
  if (row.code && REGIONAL_BODY_CODES.has(row.code.toUpperCase())) return true;
  return regionalBodyByName(row.name) != null;
}
