import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  APPROVED_ANTHROPIC_MODELS,
  filterToApprovedModels,
  isApprovedAnthropicModel,
} from "@/lib/ai-model-allowlist";

const MODEL_LABELS: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-opus-4-6": "Claude Opus 4.6",
};

type ModelInfo = { id: string; display_name: string };

function approvedCatalog(): ModelInfo[] {
  return APPROVED_ANTHROPIC_MODELS.map((id) => ({
    id,
    display_name: MODEL_LABELS[id] ?? id,
  }));
}

/** Basic: Haiku. Pro: Haiku + Sonnet. Team: approved allowlist only. */
function getAllowedModelIds(models: ModelInfo[], tier: string): string[] {
  const id = (m: ModelInfo) => m.id.toLowerCase();
  if (tier === "team") return models.map((m) => m.id);
  if (tier === "pro") {
    return models
      .filter((m) => id(m).includes("sonnet") || id(m).includes("haiku"))
      .map((m) => m.id);
  }
  return models.filter((m) => id(m).includes("haiku")).map((m) => m.id);
}

function getDefaultModelId(models: ModelInfo[], tier: string, allowedIds: string[]): string | null {
  const sonnet = models.find((m) => m.id.toLowerCase().includes("sonnet"));
  const haiku = models.find((m) => m.id.toLowerCase().includes("haiku"));
  if (tier === "team") return sonnet?.id ?? haiku?.id ?? models[0]?.id ?? null;
  if (tier === "pro") {
    return allowedIds.includes(sonnet?.id ?? "") ? (sonnet?.id ?? null) : (allowedIds[0] ?? null);
  }
  return allowedIds[0] ?? null;
}

/**
 * GET: List approved Claude models for the current user's tier (no dynamic Anthropic API fetch).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { getEffectiveTierForUser } = await import("@/lib/team");
  const tier = await getEffectiveTierForUser(userId);

  const models = approvedCatalog();
  const allowedModelIds = getAllowedModelIds(models, tier);
  const defaultModelId = getDefaultModelId(models, tier, allowedModelIds) ?? (allowedModelIds[0] ?? null);

  return NextResponse.json({
    models,
    defaultModelId,
    allowedModelIds,
  });
}
