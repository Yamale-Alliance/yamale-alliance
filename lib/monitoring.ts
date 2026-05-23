/**
 * Sentry helpers for launch-critical flows. No-ops when DSN is unset (local dev).
 */

import * as Sentry from "@sentry/nextjs";

export type MonitoringArea = "api" | "webhooks" | "payments" | "ai";

function monitoringEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim()
  );
}

function withMonitoringScope(
  scope: Sentry.Scope,
  context: {
    area: MonitoringArea;
    operation: string;
    level?: Sentry.SeverityLevel;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): void {
  scope.setTag("area", context.area);
  scope.setTag("operation", context.operation);
  if (context.level) scope.setLevel(context.level);
  if (context.tags) {
    for (const [key, value] of Object.entries(context.tags)) {
      scope.setTag(key, value);
    }
  }
  if (context.extra) scope.setExtras(context.extra);
}

export function captureMonitoredException(
  err: unknown,
  context: {
    area: MonitoringArea;
    operation: string;
    level?: Sentry.SeverityLevel;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): void {
  if (!monitoringEnabled()) return;
  const error = err instanceof Error ? err : new Error(typeof err === "string" ? err : "Unknown error");
  Sentry.withScope((scope) => {
    withMonitoringScope(scope, context);
    Sentry.captureException(error);
  });
}

export function captureWebhookError(
  provider: "lomi" | "pawapay",
  err: unknown,
  extra?: Record<string, unknown>
): void {
  captureMonitoredException(err, {
    area: "webhooks",
    operation: "payment_webhook",
    level: "error",
    tags: { provider },
    extra,
  });
}

export function capturePaymentConfirmError(
  route: string,
  err: unknown,
  extra?: Record<string, unknown>
): void {
  captureMonitoredException(err, {
    area: "payments",
    operation: "confirm_payment",
    level: "error",
    tags: { route },
    extra,
  });
}

export function captureClaudeApiError(params: {
  status: number;
  statusText: string;
  modelId?: string;
  errorData?: unknown;
  messagesCount?: number;
  systemPromptLength?: number;
}): void {
  if (!monitoringEnabled()) return;
  const level: Sentry.SeverityLevel = params.status >= 500 ? "error" : "warning";
  Sentry.withScope((scope) => {
    withMonitoringScope(scope, {
      area: "ai",
      operation: "claude_api",
      level,
      tags: { http_status: String(params.status) },
      extra: {
        statusText: params.statusText,
        modelId: params.modelId,
        error: params.errorData,
        messagesCount: params.messagesCount,
        systemPromptLength: params.systemPromptLength,
      },
    });
    Sentry.captureMessage(`Claude API HTTP ${params.status}`, level);
  });
}

export function captureAiChatError(err: unknown, extra?: Record<string, unknown>): void {
  captureMonitoredException(err, {
    area: "ai",
    operation: "ai_chat",
    level: "error",
    extra,
  });
}
