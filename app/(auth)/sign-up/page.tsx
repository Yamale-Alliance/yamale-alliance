import { permanentRedirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Clerk env may use /sign-up; permanent redirect to canonical /signup (not in sitemap). */
export default async function SignUpAliasPage({ searchParams }: Props) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  permanentRedirect(`/signup${suffix}`);
}
