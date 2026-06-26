import { normalizeExpertiseField } from "@/lib/lawyer-expertise";
import { splitLawyerLanguagesForStorage } from "@/lib/lawyer-languages";

export const LAWYER_JOIN_DOC_TYPES = [
  "bar_cert",
  "law_degree",
  "professional_id",
  "cv",
  "profile_photo",
] as const;

export type LawyerJoinDocumentType = (typeof LAWYER_JOIN_DOC_TYPES)[number];

export const REQUIRED_LAWYER_JOIN_DOCS: LawyerJoinDocumentType[] = [
  "bar_cert",
  "law_degree",
  "professional_id",
];

export const OPTIONAL_LAWYER_JOIN_DOCS: LawyerJoinDocumentType[] = ["cv", "profile_photo"];

export const LAWYER_JOIN_MAX_MB = 10;

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function isAllowedJoinDocumentMime(mime: string): boolean {
  const normalized = mime.toLowerCase().trim();
  if (normalized === "image/jpg") return true;
  return ALLOWED_MIMES.has(normalized);
}

export type LawyerJoinPayload = {
  name: string;
  professionalTitle: string;
  firmName: string;
  email: string;
  phone: string;
  officeAddress: string;
  city: string;
  country: string;
  practiceCountry: string;
  practiceCity: string;
  yearsExperience: number;
  expertiseAreas: [string, string, string];
  languages: string[];
  barAdmissionDate: string;
  jurisdiction: string;
  primaryDegree: string;
  lawSchool: string;
  additionalDegree: string | null;
  additionalInstitution: string | null;
};

export function parseLawyerJoinFormData(formData: FormData): {
  payload: LawyerJoinPayload | null;
  error: string | null;
} {
  const str = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };

  const name = str("name");
  const professionalTitle = str("professional_title");
  const firmName = str("firm_name");
  const email = str("email");
  const phone = str("phone");
  const officeAddress = str("office_address");
  const city = str("city");
  const country = str("country");
  const practiceCountry = str("practice_country");
  const practiceCity = str("practice_city");
  const yearsRaw = str("years_experience");
  const expertise1 = str("expertise_1");
  const expertise2 = str("expertise_2");
  const expertise3 = str("expertise_3");
  const languagesRaw = str("languages");
  const barAdmissionDate = str("bar_admission_date");
  const jurisdiction = str("jurisdiction");
  const primaryDegree = str("primary_degree");
  const lawSchool = str("law_school");
  const additionalDegree = str("additional_degree") || null;
  const additionalInstitution = str("additional_institution") || null;
  const agreed = formData.get("agreed") === "true" || formData.get("agreed") === "on";

  if (!agreed) {
    return { payload: null, error: "You must agree to the declaration before submitting." };
  }
  if (!name || name.length > 200) {
    return { payload: null, error: "Full legal name is required (max 200 characters)." };
  }
  if (!professionalTitle || professionalTitle.length > 120) {
    return { payload: null, error: "Professional title is required." };
  }
  if (!firmName || firmName.length > 200) {
    return { payload: null, error: "Law firm name is required." };
  }
  if (!email || email.length > 255) {
    return { payload: null, error: "Business email is required." };
  }
  if (!phone || phone.length > 50) {
    return { payload: null, error: "Business phone number is required." };
  }
  if (!officeAddress || officeAddress.length > 300) {
    return { payload: null, error: "Office address is required." };
  }
  if (!city || city.length > 100) {
    return { payload: null, error: "City is required." };
  }
  if (!country || country.length > 100) {
    return { payload: null, error: "Country is required." };
  }
  if (!practiceCountry || practiceCountry.length > 100) {
    return { payload: null, error: "Primary country of practice is required." };
  }
  if (!practiceCity || practiceCity.length > 100) {
    return { payload: null, error: "Primary city of practice is required." };
  }
  const yearsExperience = Number.parseInt(yearsRaw, 10);
  if (!Number.isFinite(yearsExperience) || yearsExperience < 0 || yearsExperience > 80) {
    return { payload: null, error: "Years of legal experience must be a valid number." };
  }
  const expertiseAreas = [expertise1, expertise2, expertise3] as [string, string, string];
  if (expertiseAreas.some((area) => !area)) {
    return { payload: null, error: "All three areas of expertise are required." };
  }
  const uniqueAreas = new Set(expertiseAreas.map((area) => area.toLowerCase()));
  if (uniqueAreas.size !== 3) {
    return { payload: null, error: "Please choose three different areas of expertise." };
  }
  let languages: string[] = [];
  try {
    const parsed = JSON.parse(languagesRaw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { payload: null, error: "At least one language is required." };
    }
    languages = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return { payload: null, error: "Languages selection is invalid." };
  }
  if (languages.length === 0) {
    return { payload: null, error: "At least one language is required." };
  }
  if (!barAdmissionDate || barAdmissionDate.length > 50) {
    return { payload: null, error: "Bar admission date is required." };
  }
  if (!jurisdiction || jurisdiction.length > 200) {
    return { payload: null, error: "Jurisdiction is required." };
  }
  if (!primaryDegree || primaryDegree.length > 200) {
    return { payload: null, error: "Primary law degree is required." };
  }
  if (!lawSchool || lawSchool.length > 200) {
    return { payload: null, error: "Law school or university is required." };
  }

  return {
    payload: {
      name,
      professionalTitle,
      firmName,
      email,
      phone,
      officeAddress,
      city,
      country,
      practiceCountry,
      practiceCity,
      yearsExperience,
      expertiseAreas,
      languages,
      barAdmissionDate,
      jurisdiction,
      primaryDegree,
      lawSchool,
      additionalDegree: additionalDegree && additionalDegree.length <= 200 ? additionalDegree : null,
      additionalInstitution:
        additionalInstitution && additionalInstitution.length <= 200 ? additionalInstitution : null,
    },
    error: null,
  };
}

export function lawyerJoinRowFromPayload(payload: LawyerJoinPayload) {
  const expertise = normalizeExpertiseField(payload.expertiseAreas.join(", "));
  const { primary_language, other_languages } = splitLawyerLanguagesForStorage(payload.languages);
  return {
    name: payload.name,
    professional_title: payload.professionalTitle,
    firm_name: payload.firmName,
    email: payload.email,
    phone: payload.phone,
    office_address: payload.officeAddress,
    city: payload.city,
    country: payload.country,
    practice_country: payload.practiceCountry,
    practice_city: payload.practiceCity,
    years_experience: payload.yearsExperience,
    expertise,
    primary_language,
    other_languages,
    bar_admission_date: payload.barAdmissionDate,
    jurisdiction: payload.jurisdiction,
    primary_degree: payload.primaryDegree,
    law_school: payload.lawSchool,
    additional_degree: payload.additionalDegree,
    additional_institution: payload.additionalInstitution,
    contacts: payload.firmName,
    linkedin_url: null,
    image_url: null,
    source: "form",
    approved: false,
    declaration_accepted_at: new Date().toISOString(),
  };
}
