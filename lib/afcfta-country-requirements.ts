/**
 * Export and import requirements by country for AfCFTA trade.
 * Product-specific requirements are merged when HS code/product category matches.
 * Source URLs point to each country's official customs/trade portal; requirements align with
 * AfCFTA (Certificate of Origin, rules of origin) and national documentation.
 */

export const AFCFTA_REQUIREMENTS_COUNTRIES = [
  "Algeria",
  "Angola",
  "Benin",
  "Botswana",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cameroon",
  "Central African Republic",
  "Comoros",
  "Côte d'Ivoire",
  "Djibouti",
  "DRC",
  "Egypt",
  "Equatorial Guinea",
  "Eswatini",
  "Ethiopia",
  "Gabon",
  "Gambia",
  "Ghana",
  "Guinea",
  "Guinea-Bissau",
  "Kenya",
  "Lesotho",
  "Liberia",
  "Madagascar",
  "Malawi",
  "Mali",
  "Mauritania",
  "Mauritius",
  "Morocco",
  "Mozambique",
  "Namibia",
  "Niger",
  "Nigeria",
  "Rwanda",
  "Sao Tome and Principe",
  "Senegal",
  "Seychelles",
  "Sierra Leone",
  "South Africa",
  "Tanzania",
  "Togo",
  "Tunisia",
  "Uganda",
  "Zambia",
  "Zimbabwe",
] as const;

export type AfCFTARequirementsCountry = (typeof AFCFTA_REQUIREMENTS_COUNTRIES)[number];

/** SADC member countries with export/import requirements (original set). */
export const SADC_REQUIREMENTS_COUNTRIES = [
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

/** ECOWAS member countries with export/import requirements. */
export const ECOWAS_REQUIREMENTS_COUNTRIES = [
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
] as const;

export type RequirementsRegionId = "SADC" | "ECOWAS" | "Others";

const SADC_SET = new Set<string>(SADC_REQUIREMENTS_COUNTRIES);
const ECOWAS_SET = new Set<string>(ECOWAS_REQUIREMENTS_COUNTRIES);

/** Region for grouping on admin requirements page. "Others" = yet to add / other blocs. */
export function getRequirementsRegion(country: string): RequirementsRegionId {
  const key = normalizeCountryKey(country);
  if (SADC_SET.has(key)) return "SADC";
  if (ECOWAS_SET.has(key)) return "ECOWAS";
  return "Others";
}

/** Display order for region sections on admin page. */
export const REQUIREMENTS_REGION_ORDER: RequirementsRegionId[] = ["SADC", "ECOWAS", "Others"];

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
      export: "https://agt.minfin.gov.ao/",
      import: "https://agt.minfin.gov.ao/",
    },
    export: {
      documents: [
        "Commercial invoice (with HS codes, value breakdown, incoterm)",
        "Packing list",
        "Export customs declaration (via AGT-approved systems)",
        "AfCFTA Certificate of Origin (for preferential treatment)",
        "Loading certificate (ARCCLA/CNCA) for maritime shipments",
      ],
      regulatory: [
        "Registration in Register of Exporters and Importers (REI) – valid 5 years",
        "Export permit or licence for controlled goods (MINCO where required)",
      ],
      complianceNotes: [
        "Only registered companies can apply for export/import licences. Customs brokers (Despachantes) approved by AGT must process customs documentation; broker fees regulated (max 2% CIF). Verify current procedures on the AGT portal.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Customs import declaration (Documento Único – DU)",
        "Declaration of Customs Value (ADV)",
        "Loading certificate (ARC / Waiver / CNCA)",
        "MINCO Import License for sensitive products",
        "Packing list",
        "Terminal handling receipts",
        "SOLAS certificate (where applicable)",
      ],
      regulatory: [
        "Importer registration with Ministry of Industry and Trade (MINCO) for product category",
        "Pre-shipment inspection optional; may enable green channel at customs",
        "Laboratory testing for foods and pharmaceuticals at port of entry",
      ],
      complianceNotes: [
        "Letters of credit preferred for transactions above 100,000 euros (Central Bank guidance). Import licensing and customs clearance can be managed via PICE (integrated external trade platform). Verify current requirements on the AGT portal.",
      ],
    },
  },
  Benin: {
    country: "Benin",
    sourceUrls: {
      export: "https://douanes.gouv.bj/en/",
      import: "https://guce.gouv.bj/",
    },
    export: {
      documents: [
        "Commercial invoice (with HS codes, value, incoterm)",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin (for preferential treatment)",
        "ETLS certificate (for ECOWAS trade liberalisation where applicable)",
        "Transport document (bill of lading or waybill)",
      ],
      regulatory: [
        "Phytosanitary certificate (plant/plant products)",
        "Veterinary or health certificate (animal products)",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. Community Customs Code applies. ETLS enables duty-free circulation for qualifying goods within ECOWAS. AfCFTA CoO supports preferential access to African markets. Verify procedures on ECOTIS and national customs.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import customs declaration",
        "Certificate of Origin (ECOWAS ETLS / AfCFTA for preferential rates)",
        "Transport and insurance documentation",
      ],
      regulatory: [
        "Import permit for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "Duty on CIF. ECOWAS Common External Tariff (CET) applies. Preferential rates with valid ETLS or AfCFTA Certificate of Origin. Verify current requirements on ECOTIS and ETLS.",
      ],
    },
  },
  Botswana: {
    country: "Botswana",
    sourceUrls: { export: "https://www.botswanatradeportal.org.bw/", import: "https://www.botswanatradeportal.org.bw/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Single Administrative Declaration (SAD 500) or export customs declaration",
        "AfCFTA Certificate of Origin",
        "Consignment note or bill of lading",
      ],
      regulatory: [
        "Phytosanitary certificate (plant/plant products)",
        "Veterinary certificate (animal products)",
        "Export permit for controlled products",
      ],
      complianceNotes: [
        "Botswana Trade Portal is the single source for procedures and tariffs. Certificate of Origin required for preferential treatment under SADC/COMESA/AfCFTA. VAT 14% may apply. Verify current requirements on the Trade Portal.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (SAD 500) / Bill of Entry",
        "Certificate of Origin (for preferential rates)",
        "Insurance and freight documentation",
      ],
      regulatory: [
        "Import permit for plant/plant products (phytosanitary conditions)",
        "SPS compliance for agricultural and food products",
      ],
      complianceNotes: [
        "Duty calculated on CIF. Preferential rates apply with valid Certificate of Origin. Check the Botswana Trade Portal for current procedures and tariff rates.",
      ],
    },
  },
  "Burkina Faso": {
    country: "Burkina Faso",
    sourceUrls: {
      export: "https://burkinatradeportal.bf/",
      import: "http://www.douanes.bf/",
    },
    export: {
      documents: [
        "Commercial invoice (documents in French preferred)",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (for ECOWAS preferential circulation where applicable)",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export authorisation for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. Customs procedures aligned with Community Customs Code. ETLS and AfCFTA CoO enable preferential treatment. Verify current requirements on ECOTIS and national customs (Direction Générale des Douanes).",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (ETLS / AfCFTA for preferential rates)",
        "Freight and insurance documentation",
      ],
      regulatory: [
        "Import permit for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "ECOWAS CET applies. Preferential rates with valid Certificate of Origin. Verify on ECOTIS and ETLS.",
      ],
    },
  },
  "Cabo Verde": {
    country: "Cabo Verde",
    sourceUrls: {
      export: "https://www.mf.gov.cv/web/dnre/direca-geral-das-alfandegas",
      import: "https://portaldocomercio.gov.cv/",
    },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (where applicable for ECOWAS)",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary/health certificates as required by destination",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. AfCFTA and ETLS Certificates of Origin support preferential access. Verify procedures on ECOTIS and national customs.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Customs import declaration",
        "Certificate of Origin (ETLS / AfCFTA for preferential treatment)",
      ],
      regulatory: [
        "Import permits for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "Preferential rates apply with valid CoO. Check ECOTIS and ETLS for current requirements.",
      ],
    },
  },
  Comoros: {
    country: "Comoros",
    sourceUrls: { export: "https://www.comesa.int/?page_id=1148", import: "https://www.comesa.int/?page_id=1148" },
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
        "COMESA member. AfCFTA Certificate of Origin enables preferential access to member states. For national procedures, refer to COMESA Trade & Customs and confirm with Comoros customs.",
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
        "Verify specific requirements with Comoros customs. COMESA Trade & Customs Division provides regional framework; national authorities may have additional requirements.",
      ],
    },
  },
  "Côte d'Ivoire": {
    country: "Côte d'Ivoire",
    sourceUrls: {
      export: "https://www.douanes.ci/",
      import: "https://guce.gouv.ci/",
    },
    export: {
      documents: [
        "Commercial invoice (French acceptable)",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (for ECOWAS where applicable)",
        "Bill of lading or waybill",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export authorisation for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. Port of Abidjan and national customs apply Community Customs Code. ETLS and AfCFTA CoO enable preferential treatment. Verify on ECOTIS and ETLS.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (ETLS / AfCFTA for preferential rates)",
        "Shipping and insurance documents",
      ],
      regulatory: [
        "Import permit for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "ECOWAS CET applies. Preferential rates with valid Certificate of Origin. Verify current requirements on ECOTIS and national customs.",
      ],
    },
  },
  DRC: {
    country: "DRC",
    sourceUrls: { export: "https://douane.gouv.cd/entreprises/commerce-international/import-export/", import: "https://douane.gouv.cd/entreprises/commerce-international/import-export/" },
    export: {
      documents: [
        "Commercial invoice (documents in French)",
        "Packing list",
        "Export customs declaration (via DGDA/Guichet Unique)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Export permit for minerals and controlled commodities",
        "Phytosanitary/veterinary certificates for agricultural products",
      ],
      complianceNotes: [
        "DGDA (Direction Générale des Douanes) oversees customs. Pre-customs clearance for imports/exports at pilot sites (e.g. Kinshasa, Lubumbashi, Matadi) is via Guichet Unique Intégral. Verify current procedures on the DGDA import-export page.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice (in French)",
        "Packing list",
        "Import declaration (via DGDA systems)",
        "Certificate of Origin (for preferential rates)",
        "Import licences where required",
      ],
      regulatory: [
        "Import licence for sensitive products; OCC/BIVAC pre-shipment inspection for imports ≥ USD 2,500 (exemptions apply)",
        "SPS and quality compliance for food and regulated goods",
      ],
      complianceNotes: [
        "All documents must be submitted in French. Confirm current requirements and Guichet Unique procedures on the DGDA import-export page.",
      ],
    },
  },
  Eswatini: {
    country: "Eswatini",
    sourceUrls: { export: "https://www.ers.org.sz/customs", import: "https://www.ers.org.sz/customs" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (via ERS e-Customs/ASYCUDA World)",
        "AfCFTA Certificate of Origin",
        "Bill of lading or waybill",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Health certificate (animal/food products where required)",
      ],
      complianceNotes: [
        "Eswatini Revenue Service (ERS) manages customs; ASYCUDA World used for declarations. SADC and SACU member. Verify current procedures and advance rulings on the ERS customs page.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (ERS/ASYCUDA World)",
        "Certificate of Origin (SADC/COMESA/AfCFTA)",
        "Shipping and insurance documents",
      ],
      regulatory: [
        "Import permits for controlled items",
        "SPS compliance for agricultural and food products",
      ],
      complianceNotes: [
        "Duty on CIF. Preferential rates apply with valid Certificate of Origin. Check ERS customs portal for tariff browse and document requirements.",
      ],
    },
  },
  Gambia: {
    country: "Gambia",
    sourceUrls: {
      export: "https://www.gra.gm/",
      import: "https://www.gra.gm/",
    },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (GRA Customs)",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (for ECOWAS where applicable)",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. Gambia Revenue Authority (GRA) manages customs. ETLS and AfCFTA CoO enable preferential access. Verify procedures on ECOTIS and ETLS.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (ETLS / AfCFTA for preferential treatment)",
        "Freight and insurance documentation",
      ],
      regulatory: [
        "Import permit for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "ECOWAS CET applies. Preferential rates with valid CoO. Verify on ECOTIS and GRA customs.",
      ],
    },
  },
  Ghana: {
    country: "Ghana",
    sourceUrls: {
      export: "https://gra.gov.gh/customs/",
      import: "https://gra.gov.gh/customs/",
    },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (GRA/GCMS)",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (for ECOWAS where applicable)",
        "Bill of lading or waybill",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. Ghana Revenue Authority (GRA) and Ghana Customs manage clearance. ETLS and AfCFTA CoO enable preferential treatment. Verify procedures on GRA and ECOTIS.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (GCMS)",
        "Certificate of Origin (ETLS / AfCFTA for preferential rates)",
        "Shipping and insurance documentation",
      ],
      regulatory: [
        "Import permit for regulated products (e.g. FDA for food and drugs)",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "ECOWAS CET applies. Preferential rates with valid Certificate of Origin. Check GRA and ECOTIS for current requirements.",
      ],
    },
  },
  Guinea: {
    country: "Guinea",
    sourceUrls: {
      export: "https://guceg.gov.gn/",
      import: "https://guceg.gov.gn/",
    },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (for ECOWAS where applicable)",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary/veterinary certificates as required",
        "Export authorisation for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. Community Customs Code applies. ETLS and AfCFTA CoO support preferential access. Verify on ECOTIS and national customs.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (ETLS / AfCFTA for preferential treatment)",
      ],
      regulatory: [
        "Import permit for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "Preferential rates with valid CoO. Verify current requirements on ECOTIS and ETLS.",
      ],
    },
  },
  "Guinea-Bissau": {
    country: "Guinea-Bissau",
    sourceUrls: {
      export: "https://alfandegas.mef.gw/",
      import: "https://dga.mef.gw/",
    },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (where applicable)",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary/health certificates as required by destination",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. ETLS and AfCFTA CoO enable preferential access. Verify procedures on ECOTIS and national customs.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Customs import declaration",
        "Certificate of Origin (ETLS / AfCFTA for preferential rates)",
      ],
      regulatory: [
        "Import permits for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "ECOWAS CET applies. Verify current requirements on ECOTIS and ETLS.",
      ],
    },
  },
  Lesotho: {
    country: "Lesotho",
    sourceUrls: { export: "https://www.rsl.org.ls/customs-procedures", import: "https://www.rsl.org.ls/customs-procedures" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export declaration (EX1/EX3 via ASYCUDA World – Revenue Services Lesotho)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary certificate, veterinary export health certificate, or sector permit (e.g. Kimberley Process for rough diamonds) as required",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "Revenue Services Lesotho (RSL) operates ASYCUDA World; e-Customs Tariff available. SACU member. Export certificates from Ministry of Trade. Verify current procedures on the RSL customs-procedures page.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (ASYCUDA World)",
        "Certificate of Origin (for preferential treatment)",
        "Freight and insurance documentation",
      ],
      regulatory: [
        "Import permits where applicable",
        "SPS compliance for food and agricultural products",
      ],
      complianceNotes: [
        "Preferential tariffs apply with valid Certificate of Origin. Confirm current requirements on the RSL customs-procedures page.",
      ],
    },
  },
  Liberia: {
    country: "Liberia",
    sourceUrls: {
      export: "https://www.lra.gov.lr/",
      import: "https://revenue.lra.gov.lr/",
    },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (LRA)",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (for ECOWAS where applicable)",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. Liberia Revenue Authority (LRA) manages customs. ETLS and AfCFTA CoO enable preferential treatment. Verify on ECOTIS and LRA.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (LRA)",
        "Certificate of Origin (ETLS / AfCFTA for preferential rates)",
        "Shipping and insurance documentation",
      ],
      regulatory: [
        "Import permit for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "ECOWAS CET applies. Preferential rates with valid CoO. Check LRA and ECOTIS for current requirements.",
      ],
    },
  },
  Madagascar: {
    country: "Madagascar",
    sourceUrls: { export: "https://www.douanes.gov.mg/", import: "https://www.douanes.gov.mg/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (Direction Générale des Douanes)",
        "AfCFTA Certificate of Origin",
        "Bill of lading",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export authorization for controlled products",
      ],
      complianceNotes: [
        "COMESA and IOC member. Customs portal (douanes.gov.mg) provides eTariff, customs code, and procedures. CoO enables preferential access to member states. Verify current requirements on the Douanes portal.",
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
        "IOC rules of origin apply for trade with Mauritius and other IOC members. Check the Douanes portal for tariff, tracking, and current document requirements.",
      ],
    },
  },
  Malawi: {
    country: "Malawi",
    sourceUrls: { export: "https://www.mra.mw/", import: "https://www.mra.mw/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (MRA – online or at customs offices)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Export permit for controlled goods",
        "Clearance via licensed Customs Clearing Agents where required",
      ],
      complianceNotes: [
        "Malawi Revenue Authority (MRA) handles customs. Export clearance can be submitted online or at Blantyre, Lilongwe, Mzuzu, and border stations. COMESA member. Verify procedures on the MRA site.",
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
        "COMESA member; Simplified Trade Regime may apply for low-value consignments at border. Confirm current requirements on the MRA portal.",
      ],
    },
  },
  Mali: {
    country: "Mali",
    sourceUrls: {
      export: "https://douanes.gouv.ml/",
      import: "https://douanes.gouv.ml/",
    },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (for ECOWAS where applicable)",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export authorisation for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. Community Customs Code applies. ETLS and AfCFTA CoO enable preferential access. Verify on ECOTIS and national customs.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (ETLS / AfCFTA for preferential treatment)",
      ],
      regulatory: [
        "Import permit for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "ECOWAS CET applies. Verify current requirements on ECOTIS and ETLS.",
      ],
    },
  },
  Mauritius: {
    country: "Mauritius",
    sourceUrls: { export: "https://mra.mu/index.php/customs", import: "https://mra.mu/index.php/customs" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (MRA Customs / TradeNet)",
        "AfCFTA Certificate of Origin",
        "Export invoice; certified costing documentation (for value-added / rules of origin where required)",
      ],
      regulatory: [
        "Export permit (if applicable)",
        "Phytosanitary/health certificates as required by destination",
      ],
      complianceNotes: [
        "COMESA and IOC member. CoO obtained via Mauritius Revenue Authority Customs or TradeNet through a freight forwarder. Verify current procedures and e-services on the MRA customs page.",
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
        "At least 35% value added or wholly produced for preferential treatment under regional agreements. Check MRA customs for tariff, quotas, and current requirements.",
      ],
    },
  },
  Mozambique: {
    country: "Mozambique",
    sourceUrls: { export: "https://portalcomercioexterno.gov.mz/en/commerce-guides/", import: "https://portalcomercioexterno.gov.mz/en/commerce-guides/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (AT / Foreign Trade Portal)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary/veterinary certificates for agricultural products",
        "Export licence for controlled products",
      ],
      complianceNotes: [
        "SADC member. Autoridade Tributária (AT) and Foreign Trade Portal (portalcomercioexterno.gov.mz) provide commerce guides and procedures. Ensure CoO meets AfCFTA/SADC requirements. Verify on the portal.",
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
        "Check the Mozambique Foreign Trade Portal commerce guides for current procedures and requirements.",
      ],
    },
  },
  Namibia: {
    country: "Namibia",
    sourceUrls: { export: "https://namibiatradeportal.gov.na/general-trade-information/general-export-import-and-transit-procedures", import: "https://www.namra.org.na/customs-excise/page/importation-of-goods/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (see Namibia Trade Portal procedures)",
        "AfCFTA Certificate of Origin",
        "Bill of lading or waybill",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "SACU and SADC member. Namibia Trade Portal covers general export/import/transit procedures; NamRA handles customs. CoO required for preferential access. Verify on the Trade Portal and NamRA.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (NamRA Customs & Excise)",
        "Certificate of Origin (SADC/SACU/AfCFTA)",
        "Shipping and insurance documents",
      ],
      regulatory: [
        "Import permits for controlled products",
        "SPS compliance for agricultural and food products",
      ],
      complianceNotes: [
        "Preferential rates apply with valid Certificate of Origin. Confirm classification, prohibited/restricted items, and procedures on NamRA importation-of-goods page.",
      ],
    },
  },
  Niger: {
    country: "Niger",
    sourceUrls: {
      export: "http://www.douanes.gouv.ne/",
      import: "http://www.douanes.gouv.ne/",
    },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (for ECOWAS where applicable)",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary/veterinary certificates as required",
        "Export authorisation for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. ETLS and AfCFTA CoO enable preferential treatment. Verify procedures on ECOTIS and national customs.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (ETLS / AfCFTA for preferential rates)",
      ],
      regulatory: [
        "Import permit for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "ECOWAS CET applies. Verify current requirements on ECOTIS and ETLS.",
      ],
    },
  },
  Nigeria: {
    country: "Nigeria",
    sourceUrls: {
      export: "https://customs.gov.ng/",
      import: "https://customs.gov.ng/",
    },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (Nigeria Customs Service / NCS)",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (for ECOWAS where applicable)",
        "Bill of lading or waybill",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export permit for controlled goods (e.g. NAFDAC for regulated products)",
      ],
      complianceNotes: [
        "ECOWAS member. Nigeria Customs Service (NCS) manages customs. ETLS and AfCFTA CoO enable preferential treatment. Verify on NCS and ECOTIS.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (Single Goods Declaration – SGD)",
        "Certificate of Origin (ETLS / AfCFTA for preferential rates)",
        "Shipping and insurance documentation",
      ],
      regulatory: [
        "Import permit or SONCAP (Standards Organisation of Nigeria) where applicable",
        "NAFDAC registration/approval for food, drugs, and cosmetics",
        "SPS compliance for agricultural goods",
      ],
      complianceNotes: [
        "ECOWAS CET applies. Preferential rates with valid Certificate of Origin. Verify current requirements on NCS and Trade.gov Nigeria customs guide.",
      ],
    },
  },
  Senegal: {
    country: "Senegal",
    sourceUrls: {
      export: "https://www.douanes.sn/",
      import: "https://www.douanes.sn/",
    },
    export: {
      documents: [
        "Commercial invoice (French acceptable)",
        "Packing list",
        "Export customs declaration (Direction Générale des Douanes – DGD)",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (for ECOWAS where applicable)",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export authorisation for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. DGD and Guichet Unique apply. ETLS and AfCFTA CoO enable preferential treatment. Verify on ECOTIS and Trade.gov Senegal customs guide.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (DGD / Guichet Unique)",
        "Certificate of Origin (ETLS / AfCFTA for preferential rates)",
        "Freight and insurance documentation",
      ],
      regulatory: [
        "Import permit for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "ECOWAS CET applies. Preferential rates with valid CoO. Verify current requirements on ECOTIS and national customs.",
      ],
    },
  },
  Seychelles: {
    country: "Seychelles",
    sourceUrls: { export: "https://www.tradeportal.sc/import-guide/", import: "https://www.tradeportal.sc/import-guide/" },
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
        "COMESA member. Seychelles Trade Portal (tradeportal.sc) provides import/export guides. AfCFTA CoO supports preferential access to African markets. Verify current requirements on the Trade Portal.",
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
        "Use the Trade Portal import guide for procedures and document lists. Confirm specific requirements with Seychelles customs or trade authority.",
      ],
    },
  },
  "Sierra Leone": {
    country: "Sierra Leone",
    sourceUrls: {
      export: "https://www.nra.gov.sl/",
      import: "https://portal.nra.gov.sl/",
    },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (for ECOWAS where applicable)",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary/veterinary certificates as required",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. National Revenue Authority (NRA) manages customs. ETLS and AfCFTA CoO enable preferential access. Verify on ECOTIS and ETLS.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (ETLS / AfCFTA for preferential treatment)",
      ],
      regulatory: [
        "Import permit for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "ECOWAS CET applies. Verify current requirements on ECOTIS and ETLS.",
      ],
    },
  },
  "South Africa": {
    country: "South Africa",
    sourceUrls: {
      export: "https://www.sars.gov.za/customs-and-excise/import-export-and-transit/",
      import: "https://www.sars.gov.za/customs-and-excise/goods-declaration/customs-endorsement-documents-requirements/",
    },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (SARS)",
        "AfCFTA Certificate of Origin",
        "Bill of lading or waybill",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal/fish products)",
        "Export permit for controlled products",
      ],
      complianceNotes: [
        "SACU/SADC member. SARS manages customs; see import-export-and-transit for procedures. NRCS and other bodies may apply to specific product categories. Verify on the SARS site.",
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
        "SARS customs endorsement documents page lists required documents. Product must meet destination sanitary standards. NRCS handles import approvals for regulated products; contact IMPORTSCT@nrcs.org.za for queries. Verify current requirements on SARS and NRCS.",
      ],
    },
  },
  Tanzania: {
    country: "Tanzania",
    sourceUrls: { export: "https://www.tra.go.tz/page/export-procedures", import: "https://www.tra.go.tz/page/import-procedures" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (TRA)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "EAC and SADC member. Tanzania Revenue Authority (TRA) publishes export and import procedures on tra.go.tz. CoO must comply with AfCFTA/EAC/SADC rules of origin. Verify on the TRA pages.",
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
        "Duty on CIF. Preferential rates apply with valid Certificate of Origin from FTA partners. Check TRA import-procedures page for current steps and documents.",
      ],
    },
  },
  Togo: {
    country: "Togo",
    sourceUrls: {
      export: "https://www.otr.tg/",
      import: "https://www.otr.tg/",
    },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (OTR – Office Togolais des Recettes)",
        "AfCFTA Certificate of Origin",
        "ETLS certificate (for ECOWAS where applicable)",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export authorisation for controlled goods",
      ],
      complianceNotes: [
        "ECOWAS member. OTR manages customs and tax. ETLS and AfCFTA CoO enable preferential treatment. Verify on ECOTIS and ETLS.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (ETLS / AfCFTA for preferential rates)",
        "Shipping and insurance documentation",
      ],
      regulatory: [
        "Import permit for regulated products",
        "SPS compliance for food and agricultural goods",
      ],
      complianceNotes: [
        "ECOWAS CET applies. Preferential rates with valid CoO. Verify current requirements on ECOTIS and national customs.",
      ],
    },
  },
  Zambia: {
    country: "Zambia",
    sourceUrls: { export: "https://www.zambiatradeportal.gov.zm/", import: "https://www.zambiatradeportal.gov.zm/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (Zambia Trade Portal / ZRA)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "COMESA member. Zambia Trade Portal (zambiatradeportal.gov.zm) and ZRA handle customs. Simplified Trade Regime (STR) allows simplified documentation for consignments up to USD 1,000 at border. Verify procedures on the Trade Portal.",
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
        "COMESA STR allows simplified declaration and CoO at border for low-value goods. Confirm current requirements and e-services on the Zambia Trade Portal.",
      ],
    },
  },
  Zimbabwe: {
    country: "Zimbabwe",
    sourceUrls: { export: "https://www.zimra.co.zw/customs/customs-clearance-procedures", import: "https://www.zimra.co.zw/customs/customs-clearance-procedures" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (ZIMRA)",
        "AfCFTA Certificate of Origin",
        "Bill of lading or waybill",
      ],
      regulatory: [
        "Phytosanitary certificate (plant products)",
        "Veterinary/health certificate (animal products)",
        "Export permit for controlled goods",
      ],
      complianceNotes: [
        "ZIMRA customs clearance procedures apply. Duty calculated on CIF. Preferential rates for SADC/COMESA/AfCFTA with valid Certificate of Origin. Verify on the ZIMRA customs-clearance-procedures page.",
      ],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Bill of Entry / Import declaration (ZIMRA)",
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
        "ZIMRA manages customs clearance; ensure all permits and licences for controlled goods are in place. Check ZIMRA customs-clearance-procedures for current steps and document requirements.",
      ],
    },
  },
  Algeria: {
    country: "Algeria",
    sourceUrls: { export: "https://www.douane.gov.dz/?lang=en", import: "https://www.douane.gov.dz/?lang=en" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (Direction Générale des Douanes)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export authorisation for controlled goods"],
      complianceNotes: ["DGD Algeria publishes exporter guide and procedures. Verify current requirements on douane.gov.dz."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (for preferential rates)",
        "Freight and insurance documentation",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Verify current procedures and tariff on the DGD portal (douane.gov.dz)."],
    },
  },
  Burundi: {
    country: "Burundi",
    sourceUrls: { export: "https://www.obr.bi/", import: "https://www.obr.bi/index.php/operations-douanieres" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (OBR)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export permit for controlled goods"],
      complianceNotes: ["Office Burundais des Recettes (OBR) manages customs. EAC member. Verify procedures on the OBR portal."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (EAC/AfCFTA for preferential rates)",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Verify current requirements on the OBR operations douanières page."],
    },
  },
  Cameroon: {
    country: "Cameroon",
    sourceUrls: { export: "https://www.douanes.cm/", import: "https://minfi.gov.cm/direction-generale-des-douanes/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (e-GUCE / CAMCIS)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export authorisation for controlled goods"],
      complianceNotes: ["CEMAC member. Direction Générale des Douanes (MINFI). Verify procedures on douanes.cm and minfi.gov.cm."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (e-GUCE)",
        "Certificate of Origin (CEMAC/AfCFTA for preferential rates)",
        "Shipping and insurance documentation",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["CEMAC Customs Code applies. Verify current requirements on the customs portal."],
    },
  },
  "Central African Republic": {
    country: "Central African Republic",
    sourceUrls: { export: "https://edouanes.cf/", import: "https://edouanes.cf/?lang=en" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Commercial export declaration (eDouanes)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export authorisation for controlled goods"],
      complianceNotes: ["CEMAC member. eDouanes portal for prior declarations and export/import. Verify on edouanes.cf."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Prior import declaration / Commercial import declaration (eDouanes)",
        "Certificate of Origin (CEMAC/AfCFTA for preferential rates)",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Verify tariff and procedures on the eDouanes portal."],
    },
  },
  Djibouti: {
    country: "Djibouti",
    sourceUrls: { export: "https://douanes.gouv.dj/", import: "https://douanes.gouv.dj/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (DGDDI / ASYCUDA)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export authorisation for controlled goods"],
      complianceNotes: ["Direction Générale des Douanes et Droits Indirects. Verify procedures and tariff on douanes.gouv.dj."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (for preferential rates)",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Verify current requirements on the DGDDI portal."],
    },
  },
  Egypt: {
    country: "Egypt",
    sourceUrls: { export: "https://www.nafeza.gov.eg/", import: "https://www.nafeza.gov.eg/en/pages/15" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export declaration (Nafeza single window)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export permit for controlled goods"],
      complianceNotes: ["Nafeza is the national single window. ACI may apply for cargo. Verify on nafeza.gov.eg."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (Nafeza)",
        "Certificate of Origin (for preferential rates)",
        "ACI/cargo information where required",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Advanced Cargo Information (ACI) required for maritime cargo. Verify on Nafeza portal."],
    },
  },
  "Equatorial Guinea": {
    country: "Equatorial Guinea",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/equatorial-guinea-market", import: "https://www.trade.gov/country-commercial-guides/equatorial-guinea-market" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export authorisation for controlled goods"],
      complianceNotes: ["CEMAC member. Customs & Tax Administration. Verify current procedures via trade authority or Trade.gov country guide."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (CEMAC/AfCFTA for preferential rates)",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Verify current requirements with customs or Trade.gov country commercial guide."],
    },
  },
  Ethiopia: {
    country: "Ethiopia",
    sourceUrls: { export: "https://www.esw.et/", import: "https://customs.erca.gov.et/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export declaration (ESW / ERCA Customs)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export permit for controlled goods"],
      complianceNotes: ["Ethiopian Electronic Single Window (ESW) and ERCA Customs Trade Portal. Verify on esw.et and customs.erca.gov.et."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (ESW)",
        "Certificate of Origin (for preferential rates)",
        "LPCO and other permits where required",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Traders guide and document finder on ERCA Customs portal. Verify current requirements."],
    },
  },
  Gabon: {
    country: "Gabon",
    sourceUrls: { export: "https://douanes.ga/", import: "https://douanes.ga/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (DGDDI)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export authorisation for controlled goods"],
      complianceNotes: ["CEMAC member. Direction Générale des Douanes. Verify procedures on douanes.ga."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (CEMAC/AfCFTA for preferential rates)",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Verify current requirements on the DGDDI portal."],
    },
  },
  Kenya: {
    country: "Kenya",
    sourceUrls: { export: "https://www.kra.go.ke/", import: "https://www.kra.go.ke/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export declaration (KRA / iTax / SIMBA)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export permit for controlled goods"],
      complianceNotes: ["EAC member. Kenya Revenue Authority (KRA) manages customs. Verify procedures on kra.go.ke."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (SIMBA/ASYCUDA)",
        "Certificate of Origin (EAC/AfCFTA for preferential rates)",
        "Shipping and insurance documentation",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Verify current requirements and e-services on the KRA portal."],
    },
  },
  Mauritania: {
    country: "Mauritania",
    sourceUrls: { export: "https://www.trade.gov/country-commercial-guides/mauritania-customs-regulations", import: "https://www.omdaoc.org/douane.php?pay=MR" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export authorisation for controlled goods"],
      complianceNotes: ["Direction Générale des Douanes; OMD-AOC regional framework. Verify procedures on Trade.gov and OMD-AOC."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (for preferential rates)",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Verify current requirements with customs or Trade.gov Mauritania customs guide."],
    },
  },
  Morocco: {
    country: "Morocco",
    sourceUrls: { export: "https://www.douane.gov.ma/", import: "https://www.douane.gov.ma/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (ADII)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export authorisation for controlled goods"],
      complianceNotes: ["Administration des Douanes et Impôts Indirects (ADII). Verify procedures on douane.gov.ma."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (for preferential rates)",
        "Freight and insurance documentation",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Verify current requirements on the ADII portal."],
    },
  },
  Rwanda: {
    country: "Rwanda",
    sourceUrls: { export: "https://www.rra.gov.rw/en/customs-services", import: "https://www.rra.gov.rw/en/customs-services/rwanda-electronic-single-window" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export declaration (ReSW / RRA)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export permit for controlled goods"],
      complianceNotes: ["EAC member. Rwanda Electronic Single Window (ReSW), ASYCUDA World. Verify on rra.gov.rw."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (ReSW)",
        "Certificate of Origin (EAC/AfCFTA for preferential rates)",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Verify current requirements on the RRA customs services page."],
    },
  },
  "Sao Tome and Principe": {
    country: "Sao Tome and Principe",
    sourceUrls: { export: "https://www.financas.gov.st/", import: "https://www.financas.gov.st/index.php/direccoes/direccao-das-alfandegas" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (Direcção das Alfândegas)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export authorisation for controlled goods"],
      complianceNotes: ["Ministry of Finance – Direcção das Alfândegas. Verify procedures on financas.gov.st."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (for preferential rates)",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Verify current requirements on the Direcção das Alfândegas page."],
    },
  },
  Tunisia: {
    country: "Tunisia",
    sourceUrls: { export: "https://www.douane.gov.tn/", import: "https://www.douane.gov.tn/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export customs declaration (Douane Tunisienne)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export authorisation for controlled goods"],
      complianceNotes: ["Douane Tunisienne portal: tariff, nomenclature, e-services. Verify on douane.gov.tn."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration",
        "Certificate of Origin (for preferential rates)",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Verify current requirements on the Douane Tunisienne portal."],
    },
  },
  Uganda: {
    country: "Uganda",
    sourceUrls: { export: "https://ura.go.ug/en/uesw/", import: "https://ura.go.ug/en/uesw/" },
    export: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Export declaration (UESW / URA ASYCUDA World)",
        "AfCFTA Certificate of Origin",
        "Transport document",
      ],
      regulatory: ["Phytosanitary/veterinary certificates as required", "Export permit for controlled goods"],
      complianceNotes: ["EAC member. Uganda Electronic Single Window (UESW), URA. Verify procedures on ura.go.ug."],
    },
    import: {
      documents: [
        "Commercial invoice",
        "Packing list",
        "Import declaration (UESW)",
        "Certificate of Origin (EAC/AfCFTA for preferential rates)",
        "Shipping and insurance documentation",
      ],
      regulatory: ["Import permit for regulated products", "SPS compliance for food and agricultural goods"],
      complianceNotes: ["Verify current requirements on the URA UESW portal."],
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
  "DR Congo": "DRC",
  "Democratic Republic of Congo": "DRC",
  "Democratic Republic of the Congo": "DRC",
  "DRC": "DRC",
  "Cote d'Ivoire": "Côte d'Ivoire",
  "Ivory Coast": "Côte d'Ivoire",
  "São Tomé and Príncipe": "Sao Tome and Principe",
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

/** Check if country has structured export/import requirements (is in the supported country list). */
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
