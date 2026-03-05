/**
 * Export and import requirements by country for AfCFTA trade.
 * Product-specific requirements are merged when HS code/product category matches.
 * Data sources: trade.gov country guides, SADC/COMESA documentation, national customs.
 */

export const AFCFTA_REQUIREMENTS_COUNTRIES = [
  "Angola",
  "Botswana",
  "Comoros",
  "DRC",
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
] as const;

export type AfCFTARequirementsCountry = (typeof AFCFTA_REQUIREMENTS_COUNTRIES)[number];

export type ProductCategory = "fish" | "agricultural" | "pharmaceutical" | "general";

/** Source URLs for admin only — where export/import requirements were found. */
export interface RequirementSourceUrls {
  export?: string;
  import?: string;
}

export interface CountryRequirements {
  country: string;
  export: {
    documents: string[];
    regulatory: string[];
    complianceNotes: string[];
  };
  import: {
    documents: string[];
    regulatory: string[];
    complianceNotes: string[];
  };
  /** Admin only: links to official/source pages (e.g. trade.gov). */
  sourceUrls?: RequirementSourceUrls;
}

/** Product-specific additional requirements by category (apply to both export and import where relevant). */
export const PRODUCT_CATEGORY_REQUIREMENTS: Record<
  ProductCategory,
  { exportRegulatory: string[]; importRegulatory: string[]; complianceNotes: string[] }
> = {
  fish: {
    exportRegulatory: [
      "Fisheries export permit (where applicable)",
      "Health certificate / sanitary certificate for fish and fishery products",
    ],
    importRegulatory: [
      "Health certificate for fish and fishery products",
      "SPS clearance for marine/fishery products (where required by destination)",
    ],
    complianceNotes: [
      "Product must meet destination sanitary and phytosanitary (SPS) standards.",
      "Some countries require NRCS or equivalent approval for fishery product imports.",
    ],
  },
  agricultural: {
    exportRegulatory: [
      "Phytosanitary certificate (plant/plant products)",
      "Veterinary or health certificate (animal products)",
    ],
    importRegulatory: [
      "Phytosanitary certificate (if plant origin)",
      "Veterinary/health certificate (if animal origin)",
      "Import permit for controlled agricultural products (where required)",
    ],
    complianceNotes: [
      "Product must meet destination SPS requirements.",
      "Phytosanitary certificates are typically valid for a limited period (e.g. 2 weeks) and single entry.",
    ],
  },
  pharmaceutical: {
    exportRegulatory: [
      "Export authorization / permit for pharmaceuticals (where required)",
      "Certificate of analysis / GMP documentation (as required by destination)",
    ],
    importRegulatory: [
      "Import permit or registration for pharmaceuticals",
      "Certificate of analysis / quality documentation",
    ],
    complianceNotes: [
      "Pharmaceuticals are subject to strict regulatory controls; verify destination country registration requirements.",
    ],
  },
  general: {
    exportRegulatory: [],
    importRegulatory: [],
    complianceNotes: [
      "Ensure product meets destination country standards and any applicable technical regulations.",
    ],
  },
};

/** Infer product category from HS code (chapter) or product description. */
export function getProductCategory(hsCode: string, productDescription: string): ProductCategory {
  const code = (hsCode || "").trim();
  const desc = (productDescription || "").toLowerCase();
  const chapter = code.length >= 2 ? parseInt(code.slice(0, 2), 10) : NaN;

  if (chapter === 3 || chapter === 16 || /\bfish\b|\bfishery\b|\bseafood\b|\bmarine\s+product\b/.test(desc))
    return "fish";
  if (chapter >= 1 && chapter <= 24 || /\bagricultural\b|\bfood\b|\bplant\b|\banimal\b|\blive\b|\bcrop\b/.test(desc))
    return "agricultural";
  if (chapter === 30 || /\bpharmaceutical\b|\bmedicine\b|\bdrug\b/.test(desc))
    return "pharmaceutical";
  return "general";
}

const COUNTRY_REQUIREMENTS: Record<string, CountryRequirements> = {
  Angola: {
    country: "Angola",
    sourceUrls: {
      export: "https://www.trade.gov/country-commercial-guides/angola-import-requirements-and-documentation",
      import: "https://www.trade.gov/country-commercial-guides/angola-import-requirements-and-documentation",
    },
    export: {
      documents: [
        "Commercial invoice (with HTS/HS codes, value breakdown, incoterm)",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin (for preferential treatment)",
        "Loading certificate (ARCCLA/CNCA) for maritime shipments",
      ],
      regulatory: [
        "Registration with Ministry of Industry and Trade for the product category (where required)",
        "Export permit or licence for controlled goods",
      ],
      complianceNotes: [
        "Only registered companies can apply for export/import licences where applicable.",
        "Customs brokers approved by the Angolan government must process customs documentation; broker rates are regulated (max 2% CIF).",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Customs import declaration (Documento Único)",
        "Declaration of Customs Value (ADV)",
        "Loading certificate (ARC / Waiver / CNCA)",
        "Ministry of Industry and Trade (MINCO) Import License (sensitive products)",
        "Packing list",
        "Terminal handling receipts",
        "SOLAS certificate",
      ],
      regulatory: [
        "Importer registration with Ministry of Industry and Trade for product category",
        "Pre-shipment inspection optional; may enable green channel at customs",
        "Laboratory testing for foods and pharmaceuticals at port of entry",
      ],
      complianceNotes: [
        "Letters of credit preferred for transactions above 100,000 euros (Angolan Central Bank guidance).",
        "Import procedures are time-consuming; maintain close contact with importer/distributor.",
      ],
    },
  },
  Botswana: {
    country: "Botswana",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/botswana", import: "https://www.trade.gov/country-commercial-guides/botswana" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Bill of lading or transport document",
      ],
      regulatory: [
        "Phytosanitary certificate (plant/plant products)",
        "Veterinary certificate (animal products)",
        "Export permit for controlled products",
      ],
      complianceNotes: [
        "Certificate of Origin required for preferential treatment under SADC/COMESA/AfCFTA.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration / Bill of Entry",
        "Certificate of Origin (for preferential rates)",
        "Insurance and freight documentation",
      ],
      regulatory: [
        "Import permit for plant/plant products (apply for phytosanitary conditions)",
        "SPS compliance for agricultural and food products",
      ],
      complianceNotes: [
        "Duty calculated on CIF. Preferential rates apply with valid Certificate of Origin from FTA partners.",
      ],
    },
  },
  Comoros: {
    country: "Comoros",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides", import: "https://www.trade.gov/country-commercial-guides" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Health/phytosanitary certificates as required by destination",
        "Export authorization for controlled goods",
      ],
      complianceNotes: [
        "COMESA member; AfCFTA Certificate of Origin enables preferential access to member states.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Customs declaration",
        "Certificate of Origin (for preferential treatment)",
      ],
      regulatory: [
        "Import permits for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "Verify specific requirements with Comoros customs or trade ministry.",
      ],
    },
  },
  DRC: {
    country: "DRC",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/democratic-republic-congo", import: "https://www.trade.gov/country-commercial-guides/democratic-republic-congo" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Export permit for minerals and controlled commodities",
        "Phytosanitary/veterinary certificates for agricultural products",
      ],
      complianceNotes: [
        "Export procedures may involve multiple agencies; use experienced customs brokers.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (for preferential rates)",
        "Proof of payment/letter of credit where required",
      ],
      regulatory: [
        "Import licence for sensitive products",
        "SPS and quality compliance for food and regulated goods",
      ],
      complianceNotes: [
        "Customs and trade regulations subject to change; confirm with DRC authorities.",
      ],
    },
  },
  Eswatini: {
    country: "Eswatini",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/eswatini-import-requirements-and-documentation", import: "https://www.trade.gov/country-commercial-guides/eswatini-import-requirements-and-documentation" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Bill of lading or waybill",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Health certificate (animal/food products where required)",
      ],
      complianceNotes: [
        "SADC and SACU member; AfCFTA CoO supports preferential access to African markets.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (SADC/COMESA/AfCFTA)",
        "Shipping and insurance documents",
      ],
      regulatory: [
        "Import permits for controlled items",
        "SPS compliance for agricultural and food products",
      ],
      complianceNotes: [
        "Duty on CIF. Preferential rates apply with valid Certificate of Origin.",
      ],
    },
  },
  Lesotho: {
    country: "Lesotho",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/lesotho-import-requirements-and-documentation", import: "https://www.trade.gov/country-commercial-guides/lesotho-import-requirements-and-documentation" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary/health certificates as required by destination",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "SACU member; ensure CoO meets AfCFTA/SADC requirements for partner countries.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (for preferential treatment)",
        "Freight and insurance documentation",
      ],
      regulatory: [
        "Import permits where applicable",
        "SPS compliance for food and agricultural products",
      ],
      complianceNotes: [
        "Preferential tariffs apply with valid Certificate of Origin from FTA partners.",
      ],
    },
  },
  Madagascar: {
    country: "Madagascar",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/madagascar", import: "https://www.trade.gov/country-commercial-guides/madagascar" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Bill of lading",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export authorization for controlled products",
      ],
      complianceNotes: [
        "COMESA and IOC member; CoO enables preferential access to member states.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Customs declaration",
        "Certificate of Origin (COMESA/IOC/AfCFTA)",
        "Certified costing documentation for value-added (where required)",
      ],
      regulatory: [
        "Import permit for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "IOC rules of origin apply for trade with Mauritius and other IOC members.",
      ],
    },
  },
  Malawi: {
    country: "Malawi",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/malawi", import: "https://www.trade.gov/country-commercial-guides/malawi" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Export permit for controlled goods",
        "Clearance via Customs Clearing Agents",
      ],
      complianceNotes: [
        "Export clearance can be submitted online or at customs offices (Blantyre, Lilongwe, Mzuzu, border stations).",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (for preferential rates)",
        "Shipping documents",
      ],
      regulatory: [
        "Import permits for controlled products",
        "SPS compliance for agricultural and food products",
      ],
      complianceNotes: [
        "COMESA member; Simplified Trade Regime may apply for low-value consignments at border.",
      ],
    },
  },
  Mauritius: {
    country: "Mauritius",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/mauritius-import-requirements-and-documentation", import: "https://www.trade.gov/country-commercial-guides/mauritius-import-requirements-and-documentation" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Export invoice",
        "Certified costing documentation (for value-added / rules of origin)",
      ],
      regulatory: [
        "Export permit (if applicable)",
        "Phytosanitary/health certificates as required by destination",
      ],
      complianceNotes: [
        "COMESA and IOC member. CoO obtained via Mauritius Revenue Authority Customs or TradeNet through a freight forwarder.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (COMESA/IOC/AfCFTA)",
        "Documentary evidence for raw materials (where required for origin)",
      ],
      regulatory: [
        "Import permits for controlled goods",
        "SPS compliance; use SPS portal for phytosanitary certificates where applicable",
      ],
      complianceNotes: [
        "At least 35% value added or wholly produced criteria for preferential treatment under regional agreements.",
      ],
    },
  },
  Mozambique: {
    country: "Mozambique",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/mozambique", import: "https://www.trade.gov/country-commercial-guides/mozambique" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary/veterinary certificates for agricultural products",
        "Export licence for controlled products",
      ],
      complianceNotes: [
        "SADC member; ensure CoO meets AfCFTA/SADC requirements.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (for preferential treatment)",
        "Freight and insurance documentation",
      ],
      regulatory: [
        "Import licence for sensitive products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "Verify current requirements with Mozambique customs or trade ministry.",
      ],
    },
  },
  Namibia: {
    country: "Namibia",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/namibia", import: "https://www.trade.gov/country-commercial-guides/namibia" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Bill of lading or waybill",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "SACU and SADC member; CoO required for preferential access to partner markets.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (SADC/SACU/AfCFTA)",
        "Shipping and insurance documents",
      ],
      regulatory: [
        "Import permits for controlled products",
        "SPS compliance for agricultural and food products",
      ],
      complianceNotes: [
        "Preferential rates apply with valid Certificate of Origin from FTA partners.",
      ],
    },
  },
  Seychelles: {
    country: "Seychelles",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides", import: "https://www.trade.gov/country-commercial-guides" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Health/phytosanitary certificates as required by destination",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "COMESA member; AfCFTA CoO supports preferential access to African markets.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Customs declaration",
        "Certificate of Origin (for preferential treatment)",
      ],
      regulatory: [
        "Import permits for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "Verify specific requirements with Seychelles customs or trade authority.",
      ],
    },
  },
  "South Africa": {
    country: "South Africa",
    sourceUrls: {
      export: "https://www.trade.gov/country-commercial-guides/south-africa-import-requirements-and-documentation",
      import: "https://www.trade.gov/country-commercial-guides/south-africa-import-requirements-and-documentation",
    },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Bill of lading or waybill",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal/fish products)",
        "Export permit for controlled products",
      ],
      complianceNotes: [
        "SACU/SADC member; NRCS and other bodies may apply to specific product categories.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Bill of Entry / Import declaration (e.g. SAD 500)",
        "Certificate of Origin (for preferential rates)",
        "Packing list and freight documentation",
      ],
      regulatory: [
        "NRCS approval for certain products (e.g. fishery products; allow ~10 working days)",
        "Health certificate for fish and fishery products",
        "SPS compliance for food and agricultural products",
      ],
      complianceNotes: [
        "Product must meet destination sanitary standards. NRCS handles import approvals for regulated products; contact IMPORTSCT@nrcs.org.za for queries.",
      ],
    },
  },
  Tanzania: {
    country: "Tanzania",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/tanzania-import-requirements-and-documentation", import: "https://www.trade.gov/country-commercial-guides/tanzania-import-requirements-and-documentation" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "EAC and SADC member; CoO must comply with AfCFTA/EAC/SADC rules of origin.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (EAC/SADC/AfCFTA)",
        "Insurance and freight documentation",
      ],
      regulatory: [
        "Import permit for controlled products",
        "SPS compliance for agricultural and food products",
      ],
      complianceNotes: [
        "Duty on CIF. Preferential rates apply with valid Certificate of Origin from FTA partners.",
      ],
    },
  },
  Zambia: {
    country: "Zambia",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/zambia-import-requirements-and-documentation", import: "https://www.trade.gov/country-commercial-guides/zambia-import-requirements-and-documentation" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "COMESA member; Simplified Trade Regime (STR) allows simplified documentation for consignments up to USD 1,000 at border.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (e.g. Form CE 20)",
        "Certificate of Origin (COMESA/AfCFTA)",
        "Shipping and insurance documents",
      ],
      regulatory: [
        "Import permit for controlled products",
        "SPS compliance for food and agricultural products",
      ],
      complianceNotes: [
        "COMESA STR allows simplified declaration and CoO at border for low-value goods.",
      ],
    },
  },
  Zimbabwe: {
    country: "Zimbabwe",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/zimbabwe-import-requirements-and-documentations", import: "https://www.trade.gov/country-commercial-guides/zimbabwe-import-requirements-and-documentations" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Bill of lading or waybill",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "Duty calculated on CIF. Preferential rates for SADC/COMESA/AfCFTA with valid Certificate of Origin.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Bill of Entry / Import declaration",
        "Certificate of Origin (SADC/COMESA/AfCFTA)",
        "Agent/importer worksheet",
        "Tax clearance (ITF 263 where required)",
        "Original permits for controlled goods",
      ],
      regulatory: [
        "Import permit for controlled products",
        "SPS compliance for agricultural and food products",
      ],
      complianceNotes: [
        "ZIMRA manages customs clearance; ensure all permits and licences for controlled goods are in place.",
      ],
    },
  },
};

export function getExportRequirements(
  country: string,
  productCategory: ProductCategory = "general"
): CountryRequirements["export"] | null {
  const key = normalizeCountryKey(country);
  const c = COUNTRY_REQUIREMENTS[key];
  if (!c) return null;
  const cat = PRODUCT_CATEGORY_REQUIREMENTS[productCategory];
  return {
    documents: [...c.export.documents],
    regulatory: [...c.export.regulatory, ...cat.exportRegulatory],
    complianceNotes: [...c.export.complianceNotes, ...cat.complianceNotes],
  };
}

export function getImportRequirements(
  country: string,
  productCategory: ProductCategory = "general"
): CountryRequirements["import"] | null {
  const key = normalizeCountryKey(country);
  const c = COUNTRY_REQUIREMENTS[key];
  if (!c) return null;
  const cat = PRODUCT_CATEGORY_REQUIREMENTS[productCategory];
  return {
    documents: [...c.import.documents],
    regulatory: [...c.import.regulatory, ...cat.importRegulatory],
    complianceNotes: [...c.import.complianceNotes, ...cat.complianceNotes],
  };
}

/** Map common UI names to data keys (e.g. Congo → DRC). */
const COUNTRY_KEY_ALIASES: Record<string, string> = {
  "Congo": "DRC",
  "Democratic Republic of the Congo": "DRC",
  "DRC": "DRC",
};

function normalizeCountryKey(country: string): string {
  const t = (country || "").trim();
  if (!t) return "";
  return COUNTRY_KEY_ALIASES[t] ?? t;
}

export function getCountryRequirements(country: string): CountryRequirements | null {
  const key = normalizeCountryKey(country);
  return COUNTRY_REQUIREMENTS[key] ?? null;
}

export function getAllCountriesRequirements(): CountryRequirements[] {
  return AFCFTA_REQUIREMENTS_COUNTRIES.map((c) => COUNTRY_REQUIREMENTS[c]).filter(Boolean);
}

/** Check if country has structured export/import requirements (is in the 16-country list). */
export function isRequirementsCountry(country: string): boolean {
  const key = normalizeCountryKey(country);
  return key !== "" && key in COUNTRY_REQUIREMENTS;
}

/** Requirements list item (e.g. from API) without sourceUrls. */
export type CountryRequirementsPublic = Omit<CountryRequirements, "sourceUrls">;

/** Get export requirements from a pre-merged list (e.g. from API) with product category applied. */
export function getExportRequirementsFromList(
  list: CountryRequirementsPublic[],
  country: string,
  productCategory: ProductCategory = "general"
): CountryRequirements["export"] | null {
  const key = normalizeCountryKey(country);
  const c = list.find((r) => normalizeCountryKey(r.country) === key);
  if (!c) return null;
  const cat = PRODUCT_CATEGORY_REQUIREMENTS[productCategory];
  return {
    documents: [...c.export.documents],
    regulatory: [...c.export.regulatory, ...cat.exportRegulatory],
    complianceNotes: [...c.export.complianceNotes, ...cat.complianceNotes],
  };
}

/** Get import requirements from a pre-merged list (e.g. from API) with product category applied. */
export function getImportRequirementsFromList(
  list: CountryRequirementsPublic[],
  country: string,
  productCategory: ProductCategory = "general"
): CountryRequirements["import"] | null {
  const key = normalizeCountryKey(country);
  const c = list.find((r) => normalizeCountryKey(r.country) === key);
  if (!c) return null;
  const cat = PRODUCT_CATEGORY_REQUIREMENTS[productCategory];
  return {
    documents: [...c.import.documents],
    regulatory: [...c.import.regulatory, ...cat.importRegulatory],
    complianceNotes: [...c.import.complianceNotes, ...cat.complianceNotes],
  };
}

/** Override shape stored in DB (admin edits). */
export interface RequirementsOverride {
  export_documents: string[];
  export_regulatory: string[];
  export_compliance_notes: string[];
  import_documents: string[];
  import_regulatory: string[];
  import_compliance_notes: string[];
}

/** Merge base requirements with admin override. If override is null, return base (with optional strip of sourceUrls). */
export function mergeRequirementsWithOverride(
  base: CountryRequirements | null,
  override: RequirementsOverride | null,
  options?: { includeSourceUrls: boolean }
): CountryRequirements | null {
  if (!base) return null;
  const includeSourceUrls = options?.includeSourceUrls ?? true;
  if (!override) {
    return includeSourceUrls ? base : { ...base, sourceUrls: undefined };
  }
  const merged: CountryRequirements = {
    country: base.country,
    export: {
      documents: override.export_documents?.length ? override.export_documents : base.export.documents,
      regulatory: override.export_regulatory?.length ? override.export_regulatory : base.export.regulatory,
      complianceNotes: override.export_compliance_notes?.length ? override.export_compliance_notes : base.export.complianceNotes,
    },
    import: {
      documents: override.import_documents?.length ? override.import_documents : base.import.documents,
      regulatory: override.import_regulatory?.length ? override.import_regulatory : base.import.regulatory,
      complianceNotes: override.import_compliance_notes?.length ? override.import_compliance_notes : base.import.complianceNotes,
    },
  };
  if (includeSourceUrls && base.sourceUrls) merged.sourceUrls = base.sourceUrls;
  return merged;
}
