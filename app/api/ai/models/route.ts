import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const MODELS_URL = "https://api.anthropic.com/v1/models";

type ModelInfo = { id: string; display_name?: string };

/** Basic: Haiku and below. Pro: Sonnet and below. Team: all. */
function getAllowedModelIds(models: ModelInfo[], tier: string): string[] {
  const id = (m: ModelInfo) => m.id.toLowerCase();
  if (tier === "team") return models.map((m) => m.id);
  if (tier === "pro") return models.filter((m) => id(m).includes("sonnet") || id(m).includes("haiku")).map((m) => m.id);
  if (tier === "basic" || tier === "free") return models.filter((m) => id(m).includes("haiku")).map((m) => m.id);
  return models.filter((m) => id(m).includes("haiku")).map((m) => m.id);
}

function getDefaultModelId(models: ModelInfo[], tier: string, allowedIds: string[]): string | null {
  const sonnet = models.find((m) => m.id.toLowerCase().includes("sonnet"));
  const haiku = models.find((m) => m.id.toLowerCase().includes("haiku"));
  if (tier === "team") return sonnet?.id ?? haiku?.id ?? models[0]?.id ?? null;
  if (tier === "pro") return allowedIds.includes(sonnet?.id ?? "") ? (sonnet?.id ?? null) : (allowedIds[0] ?? null);
  return allowedIds[0] ?? null; // Basic/free: first allowed (Haiku)
}

/**
 * GET: List available Claude models and which are selectable for the current user's tier.
 * Basic: Haiku 4.5 and below. Pro: Sonnet 4.5 and below. Team: all models.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { getEffectiveTierForUser } = await import("@/lib/team");
  const tier = await getEffectiveTierForUser(userId);

  if (!CLAUDE_API_KEY || CLAUDE_API_KEY === "sk-ant-api03-..." || CLAUDE_API_KEY.includes("...")) {
    return NextResponse.json({
      models: [],
      defaultModelId: null,
      allowedModelIds: [],
      error: "AI not configured",
    });
  }

  try {
    const res = await fetch(MODELS_URL, {
      headers: {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!res.ok) {
      return NextResponse.json(
        { models: [], defaultModelId: null, allowedModelIds: [], error: "Failed to fetch models" },
        { status: 502 }
      );
    }
    const json = (await res.json()) as { data?: ModelInfo[] };
    const models = json.data ?? [];

    const allowedModelIds = getAllowedModelIds(models, tier);
    const defaultModelId = getDefaultModelId(models, tier, allowedModelIds) ?? (allowedModelIds[0] ?? null);

    return NextResponse.json({
      models: models.map((m) => ({ id: m.id, display_name: m.display_name ?? m.id })),
      defaultModelId,
      allowedModelIds,
    });
  } catch (e) {
    console.error("Models fetch error:", e);
    return NextResponse.json(
      { models: [], defaultModelId: null, allowedModelIds: [], error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}
