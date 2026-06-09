import type { Locale } from "@/i18n/config";
import type { LegalDocumentId, PolicyDocument } from "@/lib/legal-content/types";

import paymentRefundEn from "@/content/legal/payment-refund/en.json";
import paymentRefundFr from "@/content/legal/payment-refund/fr.json";
import paymentRefundPt from "@/content/legal/payment-refund/pt.json";
import privacyEn from "@/content/legal/privacy/en.json";
import privacyFr from "@/content/legal/privacy/fr.json";
import privacyPt from "@/content/legal/privacy/pt.json";
import termsEn from "@/content/legal/terms/en.json";
import termsFr from "@/content/legal/terms/fr.json";
import termsPt from "@/content/legal/terms/pt.json";

const POLICY_DOCUMENTS: Record<LegalDocumentId, Record<Locale, PolicyDocument>> = {
  terms: {
    en: termsEn as PolicyDocument,
    fr: termsFr as PolicyDocument,
    pt: termsPt as PolicyDocument,
  },
  privacy: {
    en: privacyEn as PolicyDocument,
    fr: privacyFr as PolicyDocument,
    pt: privacyPt as PolicyDocument,
  },
  paymentRefund: {
    en: paymentRefundEn as PolicyDocument,
    fr: paymentRefundFr as PolicyDocument,
    pt: paymentRefundPt as PolicyDocument,
  },
};

export function loadPolicyDocument(id: LegalDocumentId, locale: Locale): PolicyDocument {
  const byLocale = POLICY_DOCUMENTS[id];
  return byLocale[locale] ?? byLocale.en;
}
