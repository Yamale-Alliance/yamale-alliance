import { STANDARD_PRACTICE_AREAS } from "@/lib/lawyer-expertise";
import { STANDARD_LAWYER_LANGUAGES } from "@/lib/lawyer-languages";

export type LawyerCatalogSnapshot = {
  practiceAreas: string[];
  languages: string[];
};

export function fallbackLawyerCatalog(): LawyerCatalogSnapshot {
  return {
    practiceAreas: [...STANDARD_PRACTICE_AREAS],
    languages: [...STANDARD_LAWYER_LANGUAGES],
  };
}
