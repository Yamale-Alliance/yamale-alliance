"use client";

import { createContext, useContext, type ReactNode } from "react";
import styles from "./AIResearchShell.module.css";

const AIResearchShellStylesContext = createContext(styles);

/** Single CSS-module import for the AI Research shell (avoids strict cssChunking duplicate-chunk failures). */
export function AIResearchShellStylesProvider({ children }: { children: ReactNode }) {
  return <AIResearchShellStylesContext.Provider value={styles}>{children}</AIResearchShellStylesContext.Provider>;
}

export function useAIResearchShellStyles() {
  return useContext(AIResearchShellStylesContext);
}
