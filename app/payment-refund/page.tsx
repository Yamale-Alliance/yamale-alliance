import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { isLocale } from "@/i18n/config";
import { PolicyDocumentView } from "@/components/legal/PolicyDocumentView";
import { loadPolicyDocument } from "@/lib/legal-content/load";
import { createPageMetadata } from "@/lib/site-seo";

export async function generateMetadata() {
  const localeRaw = await getLocale();
  const locale: Locale = isLocale(localeRaw) ? localeRaw : "en";
  const document = loadPolicyDocument("paymentRefund", locale);
  return createPageMetadata({
    title: document.meta.title,
    description: document.meta.description,
    path: "/payment-refund",
  });
}

export default async function PaymentRefundPolicyPage() {
  const localeRaw = await getLocale();
  const locale: Locale = isLocale(localeRaw) ? localeRaw : "en";
  const document = loadPolicyDocument("paymentRefund", locale);
  return <PolicyDocumentView document={document} />;
}
