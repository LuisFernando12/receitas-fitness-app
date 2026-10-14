import { z } from "zod";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    field?: string;
  };
};

export type AppErrorDiagnostics = {
  provider?: "gemini";
  providerHttpStatus?: number;
  providerStatus?: string;
  providerMessage?: string;
  providerErrorType?: string;
};

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly field?: string,
    public readonly diagnostics?: AppErrorDiagnostics,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(error: unknown, fallback = "Não foi possível concluir a operação."): Response {
  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.field ? { field: error.field } : {}),
        },
      } satisfies ApiErrorBody,
      { status: error.status },
    );
  }

  if (error instanceof z.ZodError) {
    return Response.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "Confira os dados enviados e tente novamente.",
        },
      } satisfies ApiErrorBody,
      { status: 400 },
    );
  }

  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: fallback,
      },
    } satisfies ApiErrorBody,
    { status: 500 },
  );
}
