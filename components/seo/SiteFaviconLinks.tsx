/** Static favicon links for Google Search Console (≥48×48) and Apple devices. */
export function SiteFaviconLinks() {
  return (
    <>
      <link rel="icon" href="/favicon.ico" sizes="48x48" />
      <link rel="icon" type="image/png" href="/favicon-192.png" sizes="192x192" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
    </>
  );
}
