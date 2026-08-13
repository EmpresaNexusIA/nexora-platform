import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Falta la variable de entorno: ${key}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDev: (process.env.NODE_ENV ?? "development") === "development",

  database: {
    url: required("DATABASE_URL"),
  },

  redis: {
    url: required("REDIS_URL"),
  },

  jwt: {
    privateKey: readFileSync(resolve(required("JWT_PRIVATE_KEY_PATH")), "utf8"),
    publicKey: readFileSync(resolve(required("JWT_PUBLIC_KEY_PATH")), "utf8"),
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
  },

  cookie: {
    secure: process.env.COOKIE_SECURE === "true",
    domain: process.env.COOKIE_DOMAIN ?? "localhost",
  },
} as const;
