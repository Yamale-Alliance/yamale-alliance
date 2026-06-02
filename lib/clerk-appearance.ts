import type { Appearance } from "@clerk/types";

const yamaleClerkVariables: Appearance["variables"] = {
  colorPrimary: "var(--primary)",
  colorDanger: "#b91c1c",
  colorSuccess: "#15803d",
  colorWarning: "#ca8a04",
  colorNeutral: "var(--muted-foreground)",
  colorForeground: "var(--foreground)",
  colorMuted: "var(--muted-foreground)",
  colorMutedForeground: "var(--muted-foreground)",
  colorBackground: "var(--background)",
  colorInput: "var(--background)",
  colorInputForeground: "var(--foreground)",
  colorBorder: "var(--border)",
  colorRing: "var(--primary)",
  borderRadius: "0.375rem",
  fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  fontFamilyButtons: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  fontSize: "0.875rem",
};

const yamaleClerkLayout: NonNullable<Appearance["layout"]> = {
  privacyPageUrl: "/privacy",
  termsPageUrl: "/terms",
  socialButtonsPlacement: "top",
  socialButtonsVariant: "blockButton",
  unsafe_disableDevelopmentModeWarnings: true,
};

const yamaleClerkFormElements: NonNullable<Appearance["elements"]> = {
  formFieldLabel: "text-sm font-medium text-foreground",
  formFieldInput:
    "w-full rounded-md border border-border bg-background text-foreground shadow-none focus:ring-2 focus:ring-primary/30",
  formFieldInputShowPasswordButton: "text-muted-foreground",
  formFieldRow: "grid grid-cols-1 gap-3 sm:grid-cols-2",
  formField: "bg-transparent shadow-none border-0 p-0 gap-1.5",
  formFieldLabelRow: "flex w-full items-baseline justify-between gap-2",
  formFieldHintText: "text-xs text-muted-foreground",
  formFields: "flex flex-col gap-4",
  form: "flex flex-col gap-4",
  formButtonPrimary:
    "w-full rounded-md bg-[#0D1B2A] text-sm font-semibold text-white hover:bg-[#162436] dark:bg-primary dark:text-[#0D1B2A] dark:hover:bg-primary/90",
  formButtonReset: "rounded-md text-sm font-medium text-muted-foreground hover:text-foreground",
  socialButtonsBlockButton:
    "relative w-full overflow-visible rounded-md border border-border bg-background text-foreground shadow-none hover:bg-muted",
  socialButtonsBlockButtonText: "font-medium text-foreground",
  socialButtons: "flex flex-col gap-3 overflow-visible pt-2",
  dividerLine: "bg-border",
  dividerText: "text-muted-foreground text-xs",
  dividerRow: "gap-3",
};

/** UserProfile forms — compact buttons, normal checkbox (not full-width gold bar). */
const yamaleProfileFormElements: NonNullable<Appearance["elements"]> = {
  formFieldLabel: "text-sm font-medium text-foreground",
  formFieldInput:
    "w-full rounded-md border border-border bg-background text-foreground shadow-none focus:ring-2 focus:ring-primary/30",
  formFieldInputShowPasswordButton: "text-muted-foreground",
  formFieldRow: "grid grid-cols-1 gap-3 sm:grid-cols-2",
  formField: "bg-transparent shadow-none border-0 p-0 gap-1.5",
  formFieldLabelRow: "flex w-full items-baseline justify-between gap-2",
  formFieldHintText: "text-xs text-muted-foreground",
  formFields: "flex flex-col gap-4",
  form: "flex flex-col gap-4",
  formButtons: "flex flex-row flex-wrap items-center justify-end gap-3 pt-2",
  formButtonPrimary:
    "inline-flex shrink-0 items-center justify-center rounded-md border-0 bg-[#0D1B2A] px-5 py-2 text-sm font-semibold text-white shadow-none hover:bg-[#162436] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary dark:text-[#0D1B2A] dark:hover:bg-primary/90",
  formButtonReset:
    "inline-flex shrink-0 items-center justify-center rounded-md border-0 bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground",
  formFieldCheckbox: "flex w-full items-start gap-3",
  formFieldCheckboxInput:
    "mt-0.5 h-4 w-4 min-h-4 min-w-4 max-h-4 max-w-4 shrink-0 grow-0 rounded border border-border bg-background accent-[var(--primary)] shadow-none",
  formFieldCheckboxLabel: "min-w-0 flex-1 text-left",
  formFieldSuccessText: "text-green-700 dark:text-green-400",
  formFieldErrorText: "text-red-600 dark:text-red-400",
};

/** Yamalé navy / gold — global ClerkProvider defaults. */
export const yamaleClerkAppearance: Appearance = {
  variables: yamaleClerkVariables,
  layout: yamaleClerkLayout,
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "bg-transparent shadow-none border-0 p-0 gap-4",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    logoBox: "hidden",
    logoImage: "hidden",
    footer: "bg-transparent pt-2",
    footerAction: "text-muted-foreground",
    footerActionLink: "text-primary font-medium hover:underline",
    ...yamaleClerkFormElements,
    identityPreview: "border border-border bg-muted/50",
    identityPreviewText: "text-foreground",
    identityPreviewEditButton: "text-primary",
    profileSection: "border-border",
    profileSectionTitle: "text-foreground font-semibold",
    profileSectionContent: "text-muted-foreground",
    accordionTriggerButton: "text-foreground hover:bg-muted",
    badge: "bg-primary/15 text-primary border-0",
    formResendCodeLink: "text-primary",
    footerPagesLink: "text-primary hover:underline",
    alertText: "text-foreground",
    otpCodeFieldInput: "border-border bg-background text-foreground",
    formFieldSuccessText: "text-green-700 dark:text-green-400",
    formFieldErrorText: "text-red-600 dark:text-red-400",
    userButtonPopoverCard: "border border-border bg-card shadow-lg",
    userPreviewMainIdentifier: "text-foreground font-medium",
    userPreviewSecondaryIdentifier: "text-muted-foreground",
  },
};

/**
 * Sign-in / sign-up inside AuthShell — no nested Clerk card or dev stripe footer.
 * Use with `.yamale-auth-clerk` in globals.css for any leftover Clerk chrome.
 */
export const yamaleEmbeddedAuthAppearance: Appearance = {
  variables: {
    ...yamaleClerkVariables,
    colorBackground: "transparent",
  },
  layout: yamaleClerkLayout,
  elements: {
    ...yamaleClerkFormElements,
    rootBox: "w-full max-w-none",
    cardBox: "w-full max-w-none shadow-none bg-transparent border-0 p-0 m-0",
    card: "w-full max-w-none bg-transparent shadow-none border-0 p-0 m-0 gap-4 overflow-visible",
    main: "bg-transparent shadow-none border-0 p-0 m-0 gap-4",
    scrollBox: "bg-transparent shadow-none border-0 p-0 m-0",
    page: "bg-transparent shadow-none border-0 p-0 m-0",
    pageScrollBox: "bg-transparent shadow-none border-0 p-0 m-0",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    logoBox: "hidden",
    logoImage: "hidden",
    navbar: "hidden",
    navbarButton: "hidden",
    footer: "hidden",
    footerAction: "hidden",
    footerActionLink: "hidden",
    footerPages: "hidden",
    footerPagesLink: "hidden",
    identityPreview: "border border-border bg-muted/50 rounded-md",
    identityPreviewText: "text-foreground",
    identityPreviewEditButton: "text-primary",
    alertText: "text-foreground",
    formFieldSuccessText: "text-green-700 dark:text-green-400",
    formFieldErrorText: "text-red-600 dark:text-red-400",
    formResendCodeLink: "text-primary",
    otpCodeFieldInput: "border-border bg-background text-foreground",
  },
};

/** Embedded UserProfile on /account/profile — Profile + Security sidenav (path routing). */
export const yamaleUserProfileAppearance: Appearance = {
  variables: {
    ...yamaleClerkVariables,
    colorBackground: "var(--card)",
    colorInput: "var(--background)",
  },
  layout: yamaleClerkLayout,
  elements: {
    ...yamaleProfileFormElements,
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm",
    navbar: "flex flex-col gap-1 border-r border-border bg-transparent py-4 pr-4",
    navbarButtons: "flex flex-col gap-1",
    navbarButton:
      "w-full justify-start rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
    navbarButtonIcon: "text-muted-foreground",
    navbarButtonActive: "bg-muted font-semibold text-foreground",
    navbarMobileMenuRow: "hidden",
    pageScrollBox: "bg-transparent p-4 sm:p-6 md:p-8",
    page: "bg-transparent",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    logoBox: "hidden",
    modalBackdrop: "hidden",
    modalContent: "shadow-none",
    modalCloseButton: "hidden",
    footer: "hidden",
    profileSection: "border-border",
    profileSectionTitle: "text-lg font-semibold text-foreground",
    profileSectionContent: "text-muted-foreground",
    profileSectionPrimaryButton: "text-primary font-medium hover:underline",
    accordionTriggerButton: "text-foreground hover:bg-muted rounded-md",
    badge: "bg-primary/15 text-primary border-0",
    scrollBox: "bg-transparent",
    activeDevice: "rounded-none border-0 bg-transparent shadow-none",
    activeDeviceList: "flex flex-col gap-3",
  },
};
