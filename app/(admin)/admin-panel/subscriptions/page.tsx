import { redirect } from "next/navigation";

export default function AdminSubscriptionsRedirectPage() {
  redirect("/admin-panel/revenue?tab=subscriptions");
}
