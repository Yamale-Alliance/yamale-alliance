import { redirect } from "next/navigation";

/** Legacy /login URL — canonical sign-in is /sign-in. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const redirectUrl = params.redirect_url;
  const suffix =
    typeof redirectUrl === "string"
      ? `?redirect_url=${encodeURIComponent(redirectUrl)}`
      : Array.isArray(redirectUrl) && redirectUrl[0]
        ? `?redirect_url=${encodeURIComponent(redirectUrl[0])}`
        : "";
  redirect(`/sign-in${suffix}`);
}
