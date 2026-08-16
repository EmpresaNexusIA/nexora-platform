import { pool } from "@nexora/database";
import { redis } from "./redis.js";
import { checkJwtReadiness } from "./jwt.js";

export type DependencyStatus = "ok" | "error";

export interface ReadinessResult {
  ready: boolean;
  checks: {
    postgres: DependencyStatus;
    redis: DependencyStatus;
    jwt: DependencyStatus;
  };
}

const CHECK_TIMEOUT_MS = 3_000;

async function withTimeout<T>(
  operation: () => Promise<T>,
  dependency: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout comprobando ${dependency}`));
    }, CHECK_TIMEOUT_MS);

    operation().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function statusOf(
  dependency: string,
  operation: () => Promise<void>,
): Promise<DependencyStatus> {
  try {
    await withTimeout(operation, dependency);
    return "ok";
  } catch {
    return "error";
  }
}

export async function checkReadiness(): Promise<ReadinessResult> {
  const [postgres, redisStatus, jwt] = await Promise.all([
    statusOf("postgres", async () => {
      const result = await pool.query<{ current_user: string }>(
        "SELECT current_user",
      );
      if (result.rows[0]?.current_user !== "api_user") {
        throw new Error("La API no esta conectada como api_user");
      }
    }),
    statusOf("redis", async () => {
      if ((await redis.ping()) !== "PONG") {
        throw new Error("Redis no respondio PONG");
      }
    }),
    statusOf("jwt", checkJwtReadiness),
  ]);

  const checks = { postgres, redis: redisStatus, jwt };
  return {
    ready: Object.values(checks).every((status) => status === "ok"),
    checks,
  };
}
