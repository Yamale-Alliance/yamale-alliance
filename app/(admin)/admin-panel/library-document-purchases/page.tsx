import { redirect } from "next/navigation";

export default function AdminLibraryDocumentPurchasesRedirectPage() {
  redirect("/admin-panel/revenue?tab=library_pdf");
}
