import { unstable_rethrow } from "next/navigation";
import { z, ZodError } from "zod";
import { log, REQUEST_ID_HEADER } from "@/lib/log";
import {
  ConflictError,
  DomainError,
  InvalidTransitionError,
  NotFoundError,
  OrderLockedError,
} from "@/lib/orders/errors";

export class InvalidJsonError extends Error {
  constructor() {
    super("Nội dung request không phải JSON hợp lệ.");
  }
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

// A malformed body is the client's fault (400), not a server crash (500).
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidJsonError();
  }
}

function statusOf(error: DomainError): number {
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;
  if (error instanceof InvalidTransitionError || error instanceof OrderLockedError) return 422;
  return 400;
}

// The single place where errors become HTTP responses.
export function handleError(error: unknown, request?: Request): Response {
  // Next.js signals control flow (e.g. "stop prerendering, this route reads
  // request data") by throwing; those must reach Next, not become a 500.
  unstable_rethrow(error);
  if (error instanceof ZodError) {
    const { formErrors, fieldErrors } = z.flattenError(error);
    return json({ error: formErrors[0] ?? "Dữ liệu không hợp lệ.", fieldErrors }, 400);
  }
  if (error instanceof InvalidJsonError) {
    return json({ error: error.message }, 400);
  }
  if (error instanceof DomainError) {
    return json({ error: error.message }, statusOf(error));
  }
  // Unexpected: log everything for the operator, return only the request id
  // so a user report can be matched to the log line.
  const requestId = request?.headers.get(REQUEST_ID_HEADER) ?? undefined;
  log.error("Unhandled error in route handler", {
    requestId,
    method: request?.method,
    url: request?.url,
    error,
  });
  return json({ error: "Lỗi hệ thống, vui lòng thử lại sau.", requestId }, 500);
}
