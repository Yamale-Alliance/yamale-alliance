import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const id = "99b40c94-0e55-44ff-b956-aa25cbb30c97";
const { data, error } = await supabase
  .from("laws")
  .select("id,title,year,status,countries(name),categories!laws_category_id_fkey(name),content_plain")
  .eq("id", id)
  .maybeSingle();
if (error || !data) {
  console.error(error?.message ?? "not found");
  process.exit(1);
}

const text = (data.content_plain ?? "").toLowerCase();
const probes = [
  "directors",
  "duty of care",
  "memorandum of association",
  "share capital",
  "annual return",
  "winding-up",
  "private company",
  "public company",
  "register of companies",
  "section 55",
  "section 220",
  "section 221",
];
const hits = probes.map((p) => ({ p, hit: text.includes(p), idx: text.indexOf(p) }));
console.log({
  id: data.id,
  title: data.title,
  country: data.countries?.name,
  category: data.categories?.name,
  contentPlainLength: text.length,
});
for (const h of hits) console.log(`${h.hit ? "OK " : "MISS"} ${h.p}${h.hit ? `  @${h.idx}` : ""}`);
