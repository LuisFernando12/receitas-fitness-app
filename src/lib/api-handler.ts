import { randomUUID } from "node:crypto";
import { AppError, errorResponse } from "@/lib/api-errors";
import { logger } from "@/lib/logger";
import { withRequestLogContext } from "@/lib/request-log-context";
import { z } from "zod";

type ApiHandlerOptions = {
  route: string;
  fallbackMessage: string;
};

type ApiOperation = () => Promise<Response>;

function getRequestId(request: Request): string {
  const incomingId = request.headers.get("x-request-id");

  if (incomingId && /^[A-Za-z0-9._:-]{1,128}$/.test(incomingId)) {
    return incomingId;
  }

  return randomUUID();
}

export async function withApiLogging(
  request: Request,
  options: ApiHandlerOptions,
  operation: ApiOperation,
): Promise<Response> {
  const requestId = getRequestId(request);
  const requestLogger = logger.child({
    requestId,
    route: options.route,
    method: request.method,
  });
  const startedAt = Date.now();

  return withRequestLogContext(
    { requestId, route: options.route, method: request.method },
    async () => {
      try {
        const response = await operation();
        requestLogger.info(
          {
            event: "api.request.completed",
            statusCode: response.status,
            durationMs: Date.now() - startedAt,
          },
          "API request completed",
        );
        response.headers.set("x-request-id", requestId);
        return response;
      } catch (error) {
        const statusCode =
          error instanceof AppError ? error.status : error instanceof z.ZodError ? 400 : 500;
        const errorCode =
          error instanceof AppError
            ? error.code
            : error instanceof z.ZodError
              ? "INVALID_INPUT"
              : "INTERNAL_ERROR";
        const errorType = error instanceof Error ? error.name : "UnknownError";
        const stackFrames =
          error instanceof Error && !(error instanceof AppError)
            ? error.stack?.split("\n").slice(1).join("\n")
            : undefined;
        const logContext = {
          event: statusCode >= 500 ? "api.request.failed" : "api.request.rejected",
          statusCode,
          errorCode,
          errorType,
          ...(error instanceof AppError && error.diagnostics ? error.diagnostics : {}),
          ...(stackFrames ? { stackFrames } : {}),
          durationMs: Date.now() - startedAt,
        };

        if (statusCode >= 500) {
          requestLogger.error(logContext, "API request failed");
        } else {
          requestLogger.warn(logContext, "API request rejected");
        }

        const response = errorResponse(error, options.fallbackMessage);
        response.headers.set("x-request-id", requestId);
        return response;
      }
    },
  );
}
