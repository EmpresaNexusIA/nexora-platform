import type { FastifyInstance, FastifyRequest, RouteHandlerMethod } from "fastify";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { withTenant } from "../lib/tenant.js";

declare module "fastify" {
  interface FastifyInstance {
    withTenant: <T>(
      request: FastifyRequest,
      callback: (db: NodePgDatabase) => Promise<T>,
    ) => Promise<T>;
  }

  interface FastifyRequest {
    db?: NodePgDatabase;
  }
}

export async function tenantPlugin(app: FastifyInstance) {
  app.decorate("withTenant", async function withTenantHandler<T>(
    request: FastifyRequest,
    callback: (db: NodePgDatabase) => Promise<T>,
  ): Promise<T> {
    if (!request.tenantId || !request.userId) {
      throw new Error("withTenant requiere autenticacion previa");
    }
    return withTenant(request.tenantId, request.userId, callback);
  });

  app.addHook("onRoute", (routeOptions) => {
    const config = routeOptions.config as { withTenant?: boolean; required?: boolean } | undefined;
    if (config?.withTenant && !config?.required) {
      throw new Error(
        `Ruta ${routeOptions.method} ${routeOptions.url}: config.withTenant requiere config.required = true`,
      );
    }
  });
}
