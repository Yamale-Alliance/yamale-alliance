"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle, Loader2 } from "lucide-react";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { LawyerLanguagesPicker } from "@/components/lawyers/LawyerLanguagesPicker";
import { AFRICAN_COUNTRIES } from "@/lib/african-countries";
import { useLawyerCatalog } from "@/lib/i18n/use-lawyer-catalog";
import { LAWYER_JOIN_MAX_MB } from "@/lib/lawyer-join";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif";
const INPUT_CLASS =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";
const LABEL_CLASS = "block text-sm font-medium text-foreground";

type DocKey = "bar_cert" | "law_degree" | "professional_id" | "cv" | "profile_photo";

function FileField({
  id,
  label,
  hint,
  required,
  value,
  onChange,
  error,
  chooseLabel,
  emptyLabel,
  removeLabel,
}: {
  id: DocKey;
  label: string;
  hint: string;
  required?: boolean;
  value: File | null;
  onChange: (file: File | null) => void;
  error?: string | null;
  chooseLabel: string;
  emptyLabel: string;
  removeLabel?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </label>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-2">
        <FileUploadField
          id={id}
          accept={ACCEPT}
          value={value}
          onChange={onChange}
          chooseLabel={chooseLabel}
          emptyLabel={emptyLabel}
          removeLabel={removeLabel}
          error={error}
        />
      </div>
    </div>
  );
}

export function LawyerJoinForm() {
  const t = useTranslations("lawyers.join");
  const { practiceAreas, languages: catalogLanguages, loading: catalogLoading } = useLawyerCatalog();

  const [name, setName] = useState("");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [firmName, setFirmName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [practiceCountry, setPracticeCountry] = useState("");
  const [practiceCity, setPracticeCity] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [expertise1, setExpertise1] = useState("");
  const [expertise2, setExpertise2] = useState("");
  const [expertise3, setExpertise3] = useState("");
  const [spokenLanguages, setSpokenLanguages] = useState<string[]>([]);
  const [barAdmissionDate, setBarAdmissionDate] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [primaryDegree, setPrimaryDegree] = useState("");
  const [lawSchool, setLawSchool] = useState("");
  const [additionalDegree, setAdditionalDegree] = useState("");
  const [additionalInstitution, setAdditionalInstitution] = useState("");
  const [documents, setDocuments] = useState<Record<DocKey, File | null>>({
    bar_cert: null,
    law_degree: null,
    professional_id: null,
    cv: null,
    profile_photo: null,
  });
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [docErrors, setDocErrors] = useState<Partial<Record<DocKey, string>>>({});

  const setDoc = (key: DocKey, file: File | null) => {
    if (file && file.size > LAWYER_JOIN_MAX_MB * 1024 * 1024) {
      setDocErrors((prev) => ({ ...prev, [key]: t("errors.fileTooLarge", { max: LAWYER_JOIN_MAX_MB }) }));
      return;
    }
    setDocuments((prev) => ({ ...prev, [key]: file }));
    setDocErrors((prev) => ({ ...prev, [key]: undefined }));
    setError(null);
  };

  const expertiseOptions = (exclude: string[]) =>
    practiceAreas.filter((area) => !exclude.includes(area));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      setError(t("errors.declarationRequired"));
      return;
    }
    if (!documents.bar_cert || !documents.law_degree || !documents.professional_id) {
      setError(t("errors.requiredDocuments"));
      return;
    }
    if (!expertise1 || !expertise2 || !expertise3) {
      setError(t("errors.expertiseRequired"));
      return;
    }
    if (new Set([expertise1, expertise2, expertise3]).size !== 3) {
      setError(t("errors.expertiseDistinct"));
      return;
    }
    if (spokenLanguages.length === 0) {
      setError(t("errors.languagesRequired"));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("professional_title", professionalTitle.trim());
      formData.set("firm_name", firmName.trim());
      formData.set("email", email.trim());
      formData.set("phone", phone.trim());
      formData.set("office_address", officeAddress.trim());
      formData.set("city", city.trim());
      formData.set("country", country.trim());
      formData.set("practice_country", practiceCountry.trim());
      formData.set("practice_city", practiceCity.trim());
      formData.set("years_experience", yearsExperience.trim());
      formData.set("expertise_1", expertise1);
      formData.set("expertise_2", expertise2);
      formData.set("expertise_3", expertise3);
      formData.set("languages", JSON.stringify(spokenLanguages));
      formData.set("bar_admission_date", barAdmissionDate.trim());
      formData.set("jurisdiction", jurisdiction.trim());
      formData.set("primary_degree", primaryDegree.trim());
      formData.set("law_school", lawSchool.trim());
      if (additionalDegree.trim()) formData.set("additional_degree", additionalDegree.trim());
      if (additionalInstitution.trim()) {
        formData.set("additional_institution", additionalInstitution.trim());
      }
      formData.set("agreed", "true");

      (Object.keys(documents) as DocKey[]).forEach((key) => {
        const file = documents[key];
        if (file) formData.set(key, file);
      });

      const res = await fetch("/api/lawyers/join", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("errors.submitFailed"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("errors.submitFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="mt-6 text-xl font-semibold">{t("success.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("success.body")}</p>
          <Link
            href="/lawyers"
            className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-2 hover:no-underline"
          >
            {t("success.backToDirectory")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-medium">{t("sections.profile")}</h2>

          <div>
            <label htmlFor="name" className={LABEL_CLASS}>
              {t("fields.fullLegalName")} <span className="text-destructive">*</span>
            </label>
            <input id="name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />
          </div>

          <div>
            <label htmlFor="professional-title" className={LABEL_CLASS}>
              {t("fields.professionalTitle")} <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground">{t("fields.professionalTitleHint")}</p>
            <input id="professional-title" required maxLength={120} value={professionalTitle} onChange={(e) => setProfessionalTitle(e.target.value)} className={INPUT_CLASS} />
          </div>

          <div>
            <label htmlFor="firm-name" className={LABEL_CLASS}>
              {t("fields.firmName")} <span className="text-destructive">*</span>
            </label>
            <input id="firm-name" required maxLength={200} value={firmName} onChange={(e) => setFirmName(e.target.value)} className={INPUT_CLASS} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className={LABEL_CLASS}>
                {t("fields.businessEmail")} <span className="text-destructive">*</span>
              </label>
              <input id="email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="phone" className={LABEL_CLASS}>
                {t("fields.businessPhone")} <span className="text-destructive">*</span>
              </label>
              <input id="phone" type="tel" required maxLength={50} value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT_CLASS} placeholder="+234 ..." />
            </div>
          </div>

          <div>
            <label htmlFor="office-address" className={LABEL_CLASS}>
              {t("fields.officeAddress")} <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground">{t("fields.officeAddressHint")}</p>
            <input id="office-address" required maxLength={300} value={officeAddress} onChange={(e) => setOfficeAddress(e.target.value)} className={INPUT_CLASS} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className={LABEL_CLASS}>
                {t("fields.city")} <span className="text-destructive">*</span>
              </label>
              <input id="city" required maxLength={100} value={city} onChange={(e) => setCity(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="country" className={LABEL_CLASS}>
                {t("fields.country")} <span className="text-destructive">*</span>
              </label>
              <select
                id="country"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">{t("fields.selectCountry")}</option>
                {AFRICAN_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="practice-country" className={LABEL_CLASS}>
                {t("fields.practiceCountry")} <span className="text-destructive">*</span>
              </label>
              <select
                id="practice-country"
                required
                value={practiceCountry}
                onChange={(e) => setPracticeCountry(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">{t("fields.selectCountry")}</option>
                {AFRICAN_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="practice-city" className={LABEL_CLASS}>
                {t("fields.practiceCity")} <span className="text-destructive">*</span>
              </label>
              <input id="practice-city" required maxLength={100} value={practiceCity} onChange={(e) => setPracticeCity(e.target.value)} className={INPUT_CLASS} />
            </div>
          </div>

          <div>
            <label htmlFor="years-experience" className={LABEL_CLASS}>
              {t("fields.yearsExperience")} <span className="text-destructive">*</span>
            </label>
            <input id="years-experience" type="number" min={0} max={80} required value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} className={INPUT_CLASS} />
          </div>

          <div className="grid gap-5 sm:grid-cols-1">
            {([1, 2, 3] as const).map((n) => {
              const value = n === 1 ? expertise1 : n === 2 ? expertise2 : expertise3;
              const setValue = n === 1 ? setExpertise1 : n === 2 ? setExpertise2 : setExpertise3;
              const exclude = [expertise1, expertise2, expertise3].filter((_, i) => i !== n - 1 && _);
              return (
                <div key={n}>
                  <label htmlFor={`expertise-${n}`} className={LABEL_CLASS}>
                    {t(`fields.expertise${n}`)} <span className="text-destructive">*</span>
                  </label>
                  <select
                    id={`expertise-${n}`}
                    required
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    disabled={catalogLoading}
                    className={INPUT_CLASS}
                  >
                    <option value="">{t("fields.selectExpertise")}</option>
                    {expertiseOptions(exclude).map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <LawyerLanguagesPicker
            label={`${t("fields.languages")} *`}
            value={spokenLanguages}
            onChange={setSpokenLanguages}
            options={catalogLanguages}
            idPrefix="join-language"
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="bar-date" className={LABEL_CLASS}>
                {t("fields.barAdmissionDate")} <span className="text-destructive">*</span>
              </label>
              <input id="bar-date" required maxLength={50} value={barAdmissionDate} onChange={(e) => setBarAdmissionDate(e.target.value)} className={INPUT_CLASS} placeholder="e.g. 2015" />
            </div>
            <div>
              <label htmlFor="jurisdiction" className={LABEL_CLASS}>
                {t("fields.jurisdiction")} <span className="text-destructive">*</span>
              </label>
              <input id="jurisdiction" required maxLength={200} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className={INPUT_CLASS} />
            </div>
          </div>

          <div>
            <label htmlFor="primary-degree" className={LABEL_CLASS}>
              {t("fields.primaryDegree")} <span className="text-destructive">*</span>
            </label>
            <input id="primary-degree" required maxLength={200} value={primaryDegree} onChange={(e) => setPrimaryDegree(e.target.value)} className={INPUT_CLASS} />
          </div>

          <div>
            <label htmlFor="law-school" className={LABEL_CLASS}>
              {t("fields.lawSchool")} <span className="text-destructive">*</span>
            </label>
            <input id="law-school" required maxLength={200} value={lawSchool} onChange={(e) => setLawSchool(e.target.value)} className={INPUT_CLASS} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="additional-degree" className={LABEL_CLASS}>
                {t("fields.additionalDegree")}
              </label>
              <input id="additional-degree" maxLength={200} value={additionalDegree} onChange={(e) => setAdditionalDegree(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="additional-institution" className={LABEL_CLASS}>
                {t("fields.additionalInstitution")}
              </label>
              <input id="additional-institution" maxLength={200} value={additionalInstitution} onChange={(e) => setAdditionalInstitution(e.target.value)} className={INPUT_CLASS} />
            </div>
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-medium">{t("sections.documents")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("sections.documentsHint")}</p>
          </div>

          <FileField id="bar_cert" label={t("documents.barCert")} hint={t("documents.uploadHint")} required value={documents.bar_cert} onChange={(f) => setDoc("bar_cert", f)} error={docErrors.bar_cert} chooseLabel={t("fileUpload.chooseFile")} emptyLabel={t("fileUpload.noFileChosen")} removeLabel={t("fileUpload.removeFile")} />
          <FileField id="law_degree" label={t("documents.lawDegree")} hint={t("documents.uploadHint")} required value={documents.law_degree} onChange={(f) => setDoc("law_degree", f)} error={docErrors.law_degree} chooseLabel={t("fileUpload.chooseFile")} emptyLabel={t("fileUpload.noFileChosen")} removeLabel={t("fileUpload.removeFile")} />
          <FileField id="professional_id" label={t("documents.professionalId")} hint={t("documents.uploadHint")} required value={documents.professional_id} onChange={(f) => setDoc("professional_id", f)} error={docErrors.professional_id} chooseLabel={t("fileUpload.chooseFile")} emptyLabel={t("fileUpload.noFileChosen")} removeLabel={t("fileUpload.removeFile")} />
          <FileField id="cv" label={t("documents.cv")} hint={t("documents.uploadHintOptional")} value={documents.cv} onChange={(f) => setDoc("cv", f)} error={docErrors.cv} chooseLabel={t("fileUpload.chooseFile")} emptyLabel={t("fileUpload.noFileChosen")} removeLabel={t("fileUpload.removeFile")} />
          <FileField id="profile_photo" label={t("documents.profilePhoto")} hint={t("documents.uploadHintOptional")} value={documents.profile_photo} onChange={(f) => setDoc("profile_photo", f)} error={docErrors.profile_photo} chooseLabel={t("fileUpload.chooseFile")} emptyLabel={t("fileUpload.noFileChosen")} removeLabel={t("fileUpload.removeFile")} />
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-medium">{t("sections.declaration")}</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {t.raw("declaration.bullets").map((bullet: string, i: number) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 hover:bg-muted/50">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                setError(null);
              }}
              className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-sm font-medium text-foreground">
              {t("declaration.agree")} <span className="text-destructive">*</span>
            </span>
          </label>
        </section>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <Link href="/lawyers" className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            {t("cancel")}
          </Link>
          <button
            type="submit"
            disabled={loading || !agreed || catalogLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
