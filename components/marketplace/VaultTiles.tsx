"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
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
}

export interface VaultTilesProps {
  tiles: VaultTile[];
}

const DESCRIPTION_COLLAPSED_MAX = "4.35em";

function VaultTileCard({
  tile,
  isExpanded,
  onToggleExpand,
}: {
  tile: VaultTile;
  isExpanded: boolean;
  onToggleExpand: (id: string | null) => void;
}) {
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

  return (
    <div
      ref={tileRef}
      className={`${styles.tile} ${isExpanded ? styles.tileExpanded : ""} ${isExpanded ? styles.tileFlipped : ""}`}
      style={
        isExpanded && collapsedMinHeight != null
          ? { minHeight: collapsedMinHeight }
          : undefined
      }
    >
      <div className={styles.flipper}>
        <div className={`${styles.face} ${styles.faceFront}`}>
          <div
            className={styles.iconWrap}
            style={{ backgroundColor: tile.iconBg, color: tile.iconColor }}
          >
            <i className={tile.iconClass} aria-hidden />
          </div>
          <p className={styles.label}>{tile.label}</p>
          <p className={styles.sub}>{tile.sub}</p>
        </div>

        <div className={`${styles.face} ${styles.faceBack}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.image} src={tile.image} alt="" />
          <div className={styles.overlay} style={{ background: tile.overlayGradient }} aria-hidden />
          <div className={styles.backContent}>
            <span
              className={styles.tag}
              style={{
                backgroundColor: tile.tagBg,
                color: tile.tagColor,
              }}
            >
              {tile.tag}
            </span>
            <h3 className={styles.title}>{tile.title}</h3>
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
        <div key={tile.id} role="listitem">
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
