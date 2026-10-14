import { AsyncLocalStorage } from "node:async_hooks";

export type RequestLogContext = {
  requestId: string;
  route: string;
  method: string;
};

const requestLogContext = new AsyncLocalStorage<RequestLogContext>();

export function withRequestLogContext<T>(context: RequestLogContext, operation: () => T): T {
  return requestLogContext.run(context, operation);
}

export function getRequestLogContext(): Partial<RequestLogContext> {
  return requestLogContext.getStore() ?? {};
}
