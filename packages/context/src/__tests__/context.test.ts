import { describe, expect, it } from "vitest";
import {
  getContext,
  getTenantId,
  runWithContext,
} from "../index.js";

const context = {
  tenantId: "tenant-a",
  traceId: "trace-001",
  correlationId: "correlation-001",
  executionType: "http" as const,
};

describe("Nexora Context", () => {
  it("returns the current context inside an execution scope", () => {
    runWithContext(context, () => {
      expect(getContext()).toEqual(context);
      expect(getTenantId()).toBe("tenant-a");
    });
  });

  it("throws when accessed outside an execution scope", () => {
    expect(() => getContext()).toThrow(
      "NexoraContext is not available in the current execution scope",
    );
  });

  it("propagates the context through asynchronous execution", async () => {
    await runWithContext(context, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(getTenantId()).toBe("tenant-a");
      expect(getContext().traceId).toBe("trace-001");
    });
  });

  it("isolates concurrent execution contexts", async () => {
    const tenantA = {
      ...context,
      tenantId: "tenant-a",
    };

    const tenantB = {
      ...context,
      tenantId: "tenant-b",
    };

    const [resultA, resultB] = await Promise.all([
      runWithContext(tenantA, async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return getTenantId();
      }),

      runWithContext(tenantB, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return getTenantId();
      }),
    ]);

    expect(resultA).toBe("tenant-a");
    expect(resultB).toBe("tenant-b");
  });

  it("does not allow mutation of the context at runtime", () => {
    runWithContext(context, () => {
      const currentContext = getContext();

      expect(() => {
        (currentContext as { tenantId: string }).tenantId = "tenant-b";
      }).toThrow();
    });
  });
});
