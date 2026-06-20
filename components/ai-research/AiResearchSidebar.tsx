"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  PanelLeftClose,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAIResearchShellStyles } from "./AIResearchShellStylesContext";

export type AiResearchSidebarSession = {
  id: string;
  title: string;
  starred?: boolean;
  updatedAt: number;
};

type AiResearchSidebarProps = {
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  onNewChat: () => void;
  searchChats: string;
  onSearchChatsChange: (value: string) => void;
  starredSessions: AiResearchSidebarSession[];
  recentSessions: AiResearchSidebarSession[];
  currentId: string | null;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  tier: "free" | "basic" | "pro" | "team";
  planUsageLabel: string;
  limit: number | null;
  used: number;
};

function SessionRow({
  session,
  currentId,
  onSelect,
  onDelete,
  onToggleStar,
  t,
}: {
  session: AiResearchSidebarSession;
  currentId: string | null;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onToggleStar: (e: React.MouseEvent) => void;
  t: ReturnType<typeof useTranslations<"aiResearch">>;
}) {
  const shellStyles = useAIResearchShellStyles();
  const active = currentId === session.id;
  return (
    <div className={`${shellStyles.sidebarSessionRow} group mb-0.5 flex items-stretch gap-0.5`}>
      <button
        type="button"
        onClick={onSelect}
        className={`min-w-0 flex-1 truncate rounded-[10px] px-2.5 py-2 text-left text-[13px] transition ${
          active
            ? `${shellStyles.sidebarSessionActive} font-semibold text-[#0D1B2A] dark:text-white`
            : "font-medium text-[#0D1B2A]/80 hover:bg-[#0D1B2A]/[0.06] hover:text-[#0D1B2A] dark:font-medium dark:text-white/80 dark:hover:bg-white/[0.07] dark:hover:text-white"
        }`}
      >
        {session.title || t("newChat")}
      </button>
      <button
        type="button"
        onClick={onToggleStar}
        className={`shrink-0 rounded p-1.5 transition hover:bg-[#0D1B2A]/5 dark:hover:bg-white/10 ${
          session.starred
            ? "text-[#C8922A] opacity-100 dark:text-[#E8B84B]"
            : "text-[#0D1B2A]/35 opacity-0 group-hover:opacity-100 dark:text-white/40"
        }`}
        aria-label={session.starred ? t("unstarChat") : t("starChat")}
        title={session.starred ? t("unstarChat") : t("starChat")}
      >
        <Star className={`h-3.5 w-3.5 ${session.starred ? "fill-current" : ""}`} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded p-1.5 text-[#0D1B2A]/40 opacity-0 transition hover:bg-red-500/10 hover:text-red-600 group-hover:opacity-100 dark:text-white/40 dark:hover:bg-red-500/20 dark:hover:text-red-200"
        aria-label={t("deleteChat")}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AiResearchSidebar({
  sidebarOpen,
  onCloseSidebar,
  onNewChat,
  searchChats,
  onSearchChatsChange,
  starredSessions,
  recentSessions,
  currentId,
  onSelectChat,
  onDeleteChat,
  onToggleStar,
  tier,
  planUsageLabel,
  limit,
  used,
}: AiResearchSidebarProps) {
  const t = useTranslations("aiResearch");
  const shellStyles = useAIResearchShellStyles();
  const totalVisible = starredSessions.length + recentSessions.length;

  const handleSelect = (id: string) => {
    onSelectChat(id);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      onCloseSidebar();
    }
  };

  return (
    <aside
      className={`${shellStyles.sidebar} absolute inset-y-0 left-0 z-20 flex h-full min-h-0 w-[min(100%,280px)] flex-col border-r border-border text-foreground shadow-2xl transition-transform duration-200 dark:border-white/[0.08] dark:text-white md:w-[280px] md:max-w-none md:shadow-none ${
        sidebarOpen ? "translate-x-0 md:relative md:z-auto" : "-translate-x-full md:hidden"
      }`}
    >
      <div className={`${shellStyles.sidebarBrandRow} hidden items-center justify-between border-b border-[#E8E4DC] px-4 py-3 dark:border-white/[0.08] md:flex`}>
        <span className="text-[13px] font-semibold tracking-tight text-[#0D1B2A] dark:text-white/95">
          {t("sidebarBrand")}
        </span>
        <button
          type="button"
          onClick={onCloseSidebar}
          className="rounded-lg p-1.5 text-[#0D1B2A]/50 transition hover:bg-[#0D1B2A]/5 hover:text-[#0D1B2A] dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label={t("closeSidebar")}
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center justify-between border-b border-[#E8E4DC] px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] dark:border-white/[0.08] md:hidden">
        <span className="text-[13px] font-semibold text-[#0D1B2A]/90 dark:text-white/90">{t("researchHistory")}</span>
        <button
          type="button"
          onClick={onCloseSidebar}
          className="rounded-lg p-1.5 text-[#0D1B2A]/60 hover:bg-[#0D1B2A]/5 hover:text-[#0D1B2A] dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label={t("closeChatList")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-[#E8E4DC] px-4 py-4 dark:border-white/[0.08]">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            if (typeof window !== "undefined" && window.innerWidth < 768) onCloseSidebar();
          }}
          className={`${shellStyles.sidebarNewChatOutline} flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-[13px] font-medium transition`}
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
          {t("newQuery")}
        </button>
        {tier === "team" && (
          <Link
            href="/ai-research/team"
            className="mt-2 flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] font-medium text-[#0D1B2A]/75 transition hover:bg-[#0D1B2A]/5 dark:text-white/75 dark:hover:bg-white/10"
          >
            <Users className="h-4 w-4" />
            {t("manageTeam")}
          </Link>
        )}
      </div>

      <div className="border-b border-[#E8E4DC] px-4 pb-3 pt-1 dark:border-white/[0.08]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D1B2A]/35 dark:text-white/35" />
          <input
            type="text"
            value={searchChats}
            onChange={(e) => onSearchChatsChange(e.target.value)}
            placeholder={t("searchPrevious")}
            className="w-full rounded-[10px] border border-[#E8E4DC] bg-white py-2 pl-9 pr-3 text-[13px] text-[#0D1B2A]/80 outline-none ring-0 placeholder:text-[#0D1B2A]/35 focus:border-[#C8922A]/50 dark:border-white/10 dark:bg-white/[0.07] dark:text-white/80 dark:placeholder:text-white/35 dark:focus:border-white/20"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
          {starredSessions.length > 0 ? (
            <div className="mb-3">
              <p className={shellStyles.sidebarSectionLabel}>{t("starred")}</p>
              {starredSessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  currentId={currentId}
                  t={t}
                  onSelect={() => handleSelect(s.id)}
                  onDelete={(e) => onDeleteChat(s.id, e)}
                  onToggleStar={(e) => onToggleStar(s.id, e)}
                />
              ))}
            </div>
          ) : null}

          <p className={shellStyles.sidebarSectionLabel}>{t("recent")}</p>
          {recentSessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              currentId={currentId}
              t={t}
              onSelect={() => handleSelect(s.id)}
              onDelete={(e) => onDeleteChat(s.id, e)}
              onToggleStar={(e) => onToggleStar(s.id, e)}
            />
          ))}

          {totalVisible === 0 ? (
            <p className="px-2 py-4 text-[13px] font-medium text-[#0D1B2A]/60 dark:text-white/55">
              {searchChats.trim() ? t("noMatchingQueries") : t("noQueriesYet")}
            </p>
          ) : null}
        </nav>
      </div>

      <div className="border-t border-[#E8E4DC] px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/[0.08]">
        <div className="flex items-center justify-between gap-2 rounded-[10px] bg-[#0D1B2A]/[0.04] px-3 py-2.5 dark:bg-white/[0.06]">
          <span className="text-[12px] text-[#0D1B2A]/55 dark:text-white/50">{t("aiQueries")}</span>
          <span className="text-right text-[12px] font-bold text-[#9a7020] dark:text-[#E8B84B]">{planUsageLabel}</span>
        </div>
        {limit !== null ? (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#0D1B2A]/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[#C8922A] transition-all duration-500"
              style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
