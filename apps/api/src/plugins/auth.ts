import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyToken, type NexoraJWTPayload } from "../lib/jwt.js";

declare module "fastify" {
  interface FastifyInstance {
    auth: {
      verify: (token: string) => Promise<NexoraJWTPayload>;
    };
  }

  interface FastifyRequest {
    userId?: string;
    tenantId?: string;
  }
}

export interface AuthOptions {
  required: boolean;
}

export async function authPlugin(app: FastifyInstance) {
  app.decorate("auth", {
    verify: verifyToken,
  });

  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const routeOptions = request.routeOptions;
    const authOpts = routeOptions?.config as unknown as AuthOptions | undefined;

    if (!authOpts?.required) {
      return;
    }

    const token =
      request.cookies?.access_token ??
      request.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return reply.code(401).send({ error: "No autenticado" });
    }

    try {
      const payload = await verifyToken(token);

      if (payload.type !== "access") {
        return reply.code(401).send({ error: "Token inválido" });
      }

      request.userId = payload.sub;
      request.tenantId = payload.tenantId;
    } catch {
      return reply.code(401).send({ error: "Token inválido o expirado" });
    }
  });
}
