import { AsyncLocalStorage } from "node:async_hooks";
import type { NexoraContext } from "./types.js";

const storage = new AsyncLocalStorage<NexoraContext>();

export function runWithContext<T>(
  context: NexoraContext,
  callback: () => T,
): T {
  const immutableContext = Object.freeze({ ...context });

  return storage.run(immutableContext, callback);
}

export function getContext(): NexoraContext {
  const context = storage.getStore();

  if (!context) {
    throw new Error(
      "NexoraContext is not available in the current execution scope",
    );
  }

  return context;
}

export function getTenantId(): string {
  return getContext().tenantId;
}
