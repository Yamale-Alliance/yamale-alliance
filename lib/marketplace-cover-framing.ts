export type CoverFocal = {
  x: number;
  y: number;
};

export const DEFAULT_COVER_FOCAL: CoverFocal = { x: 50, y: 50 };

export const COVER_FRAMING_PRESETS: { id: string; focal: CoverFocal }[] = [
  { id: "top", focal: { x: 50, y: 18 } },
  { id: "center", focal: DEFAULT_COVER_FOCAL },
  { id: "bottom", focal: { x: 50, y: 82 } },
];

function clampFocal(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeCoverFocal(
  x?: number | null,
  y?: number | null
): CoverFocal {
  return {
    x: clampFocal(x ?? DEFAULT_COVER_FOCAL.x),
    y: clampFocal(y ?? DEFAULT_COVER_FOCAL.y),
  };
}

export function coverObjectPosition(focal: CoverFocal): string {
  return `${focal.x}% ${focal.y}%`;
}

export function parseCoverFocalInput(
  x: unknown,
  y: unknown
): CoverFocal | null {
  if (x === undefined && y === undefined) return null;
  const nx = typeof x === "number" ? x : typeof x === "string" ? Number(x) : null;
  const ny = typeof y === "number" ? y : typeof y === "string" ? Number(y) : null;
  if (nx === null && ny === null) return null;
  return normalizeCoverFocal(nx ?? DEFAULT_COVER_FOCAL.x, ny ?? DEFAULT_COVER_FOCAL.y);
}

export function readItemCoverFocal(item: {
  cover_focal_x?: number | null;
  cover_focal_y?: number | null;
}): CoverFocal {
  return normalizeCoverFocal(item.cover_focal_x, item.cover_focal_y);
}
