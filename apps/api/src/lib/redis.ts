import { Redis } from "ioredis";
import { config } from "../config.js";

const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on("error", (err: Error) => {
  console.error("[redis] Error:", err.message);
});

redis.on("connect", () => {
  console.log("[redis] Conectado");
});

export { redis };
