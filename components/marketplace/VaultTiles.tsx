"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VaultCoverImage } from "@/components/marketplace/VaultCoverImage";
import styles from "./VaultTiles.module.css";

export interface VaultTile {
  id: string;
  label: string;
  sub: string;
  iconClass: string;
  iconBg: string;
  iconColor: string;
  tag: string;
  tagBg: string;
  tagColor: string;
  title: string;
  description: string;
  meta: string;
  overlayGradient: string;
  image: string;
  href?: string;
  active?: boolean;
}

export interface VaultTilesProps {
  tiles: VaultTile[];
}

const DESCRIPTION_COLLAPSED_MAX = "5.5em";

function VaultTileCard({
  tile,
  isExpanded,
  onToggleExpand,
}: {
  tile: VaultTile;
  isExpanded: boolean;
  onToggleExpand: (id: string | null) => void;
}) {
  const router = useRouter();
  const tileRef = useRef<HTMLDivElement>(null);
  const descObserverCleanup = useRef<(() => void) | null>(null);
  const [overflows, setOverflows] = useState(false);
  const [collapsedMinHeight, setCollapsedMinHeight] = useState<number | null>(null);

  const descriptionRef = useCallback(
    (el: HTMLParagraphElement | null) => {
      descObserverCleanup.current?.();
      descObserverCleanup.current = null;
      if (!el) return;
      const check = () => {
        if (isExpanded) {
          setOverflows(false);
          return;
        }
        setOverflows(el.scrollHeight > el.clientHeight + 1);
      };
      const ro = new ResizeObserver(check);
      ro.observe(el);
      check();
      descObserverCleanup.current = () => ro.disconnect();
    },
    [isExpanded, tile.description]
  );

  useLayoutEffect(() => {
    const node = tileRef.current;
    if (!node) return;
    const sync = () => {
      if (!isExpanded) setCollapsedMinHeight(node.offsetHeight);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(node);
    return () => ro.disconnect();
  }, [isExpanded, tile.id]);

  const handleReadMore = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleExpand(isExpanded ? null : tile.id);
  };

  const showReadMore = !isExpanded && overflows;
  const showReadLess = isExpanded;

  const handleTileActivate = () => {
    if (!tile.href) return;
    const path = tile.href.split("?")[0]?.split("#")[0] ?? tile.href;
    const samePage = path === window.location.pathname;
    router.push(tile.href, { scroll: !samePage });
  };

  const handleTileClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (isExpanded) return;
    handleTileActivate();
  };

  const handleTileKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    if (!isExpanded) handleTileActivate();
  };

  const backGradient =
    tile.overlayGradient ||
    `linear-gradient(155deg, ${tile.iconBg} 0%, rgba(13,27,42,0.95) 100%)`;

  return (
    <div
      ref={tileRef}
      className={`${styles.tile} ${tile.active ? styles.tileActive : ""} ${isExpanded ? styles.tileExpanded : ""} ${isExpanded ? styles.tileFlipped : ""}`}
      style={
        isExpanded && collapsedMinHeight != null
          ? { minHeight: collapsedMinHeight }
          : undefined
      }
      onClick={tile.href ? handleTileClick : undefined}
      onKeyDown={tile.href ? handleTileKeyDown : undefined}
      role={tile.href ? "link" : undefined}
      tabIndex={tile.href ? 0 : undefined}
      aria-label={tile.label}
    >
      <div className={styles.flipStage}>
        <div className={styles.flipper}>
          <div className={`${styles.face} ${styles.faceFront}`}>
            <VaultCoverImage
              src={tile.image}
              className={styles.image}
              variant="tile"
              priority={tile.active}
            />
          </div>

          <div className={`${styles.face} ${styles.faceBack}`} style={{ background: backGradient }}>
          <span
            className={styles.tag}
            style={{
              backgroundColor: tile.tagBg,
              color: tile.tagColor,
            }}
          >
            {tile.tag}
          </span>
          <div className={styles.backContent}>
            <div
              className={styles.iconWrap}
              style={{ backgroundColor: tile.iconBg, color: tile.iconColor }}
            >
              <i className={tile.iconClass} aria-hidden />
            </div>
            <p className={styles.label}>{tile.label}</p>
            <div className={styles.descriptionWrap}>
              <p
                ref={descriptionRef}
                className={`${styles.description} ${isExpanded ? styles.descriptionExpanded : ""}`}
                style={
                  isExpanded
                    ? { maxHeight: "1200px" }
                    : { maxHeight: DESCRIPTION_COLLAPSED_MAX }
                }
              >
                {tile.description}
              </p>
              {(showReadMore || showReadLess) && (
                <button type="button" className={styles.readMore} onClick={handleReadMore}>
                  {isExpanded ? "Read less" : "Read more"}
                </button>
              )}
            </div>
            {tile.meta ? <p className={styles.meta}>{tile.meta}</p> : null}
          </div>
          </div>
        </div>
      </div>
      <p className={styles.frontCaption}>{tile.label}</p>
    </div>
  );
}

export default function VaultTiles({ tiles }: VaultTilesProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggleExpand = useCallback((id: string | null) => {
    setExpandedId(id);
  }, []);

  return (
    <div className={styles.grid} role="list">
      {tiles.map((tile) => (
        <div key={tile.id} className={styles.tileSlot} role="listitem">
          <VaultTileCard
            tile={tile}
            isExpanded={expandedId === tile.id}
            onToggleExpand={handleToggleExpand}
          />
        </div>
      ))}
    </div>
  );
}
