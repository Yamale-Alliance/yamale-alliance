"use client";

import { useEffect, useState } from "react";
import { fallbackLawyerCatalog, type LawyerCatalogSnapshot } from "@/lib/lawyer-catalog";

export function useLawyerCatalog(): LawyerCatalogSnapshot & { loading: boolean } {
  const [catalog, setCatalog] = useState<LawyerCatalogSnapshot>(fallbackLawyerCatalog());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lawyers/catalog")
      .then((r) => r.json())
      .then((data: LawyerCatalogSnapshot) => {
        if (cancelled) return;
        if (Array.isArray(data?.practiceAreas) && Array.isArray(data?.languages)) {
          setCatalog({
            practiceAreas: data.practiceAreas,
            languages: data.languages,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...catalog, loading };
}
