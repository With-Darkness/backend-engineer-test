import type { FastifyInstance } from "fastify";
import { rollback } from "src/api/controllers/rollback.controller";

export async function rollbackRoutes(fastify: FastifyInstance) {
  fastify.post("/rollback", rollback);
}
