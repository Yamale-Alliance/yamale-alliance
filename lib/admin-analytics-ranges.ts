export type AnalyticsRangePreset =
  | "today"
  | "this_week"
  | "last_week"
  | "last_month"
  | "last_60_days"
  | "last_90_days"
  | "all_time";

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Monday 00:00 UTC of the ISO week containing `d`. */
function startOfIsoWeekUTC(d: Date): Date {
  const t = utcMidnight(d);
  const dow = t.getUTCDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  t.setUTCDate(t.getUTCDate() - daysFromMonday);
  return t;
}

export type AnalyticsRangeBounds = {
  preset: AnalyticsRangePreset;
  from: Date;
  to: Date;
  fromIso: string;
  toIso: string;
};

export function isAnalyticsRangePreset(s: string): s is AnalyticsRangePreset {
  return (
    s === "today" ||
    s === "this_week" ||
    s === "last_week" ||
    s === "last_month" ||
    s === "last_60_days" ||
    s === "last_90_days" ||
    s === "all_time"
  );
}

export function parseAnalyticsRangePreset(raw: string | null | undefined): AnalyticsRangePreset {
  const s = String(raw || "").trim();
  return isAnalyticsRangePreset(s) ? s : "last_90_days";
}

export function getAnalyticsRangeBounds(preset: AnalyticsRangePreset, now = new Date()): AnalyticsRangeBounds {
  const end = new Date(now.getTime());
  let from: Date;

  switch (preset) {
    case "today": {
      from = utcMidnight(now);
      break;
    }
    case "this_week": {
      from = startOfIsoWeekUTC(now);
      break;
    }
    case "last_week": {
      const thisMon = startOfIsoWeekUTC(now);
      const lastMon = new Date(thisMon.getTime());
      lastMon.setUTCDate(lastMon.getUTCDate() - 7);
      from = lastMon;
      const lastSun = new Date(lastMon.getTime());
      lastSun.setUTCDate(lastSun.getUTCDate() + 6);
      lastSun.setUTCHours(23, 59, 59, 999);
      return {
        preset,
        from,
        to: lastSun,
        fromIso: from.toISOString(),
        toIso: lastSun.toISOString(),
      };
    }
    case "last_month": {
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
      const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      return {
        preset,
        from,
        to,
        fromIso: from.toISOString(),
        toIso: to.toISOString(),
      };
    }
    case "last_60_days": {
      from = new Date(end.getTime());
      from.setUTCDate(from.getUTCDate() - 60);
      break;
    }
    case "last_90_days": {
      from = new Date(end.getTime());
      from.setUTCDate(from.getUTCDate() - 90);
      break;
    }
    case "all_time": {
      from = new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0));
      break;
    }
  }

  return {
    preset,
    from,
    to: end,
    fromIso: from.toISOString(),
    toIso: end.toISOString(),
  };
}
