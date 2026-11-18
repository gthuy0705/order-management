import type { Instrumentation } from "next";

// Runs once when the server starts, before it accepts requests.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}

// Every error Next.js catches (page render, Server Action, route handler that
// threw) becomes one structured log line. The digest is what app/error.tsx
// shows the user, so a support ticket can be matched to this line.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { log } = await import("@/lib/log");
  const requestId = request.headers["x-request-id"];
  log.error("Unhandled error", {
    requestId: Array.isArray(requestId) ? requestId[0] : requestId,
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    error,
  });
};
