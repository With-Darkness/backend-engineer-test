import Fastify from 'fastify';
import { blockRoutes } from 'src/api/routes/block.routes';
import { balanceRoutes } from 'src/api/routes/balance.routes';
import { rollbackRoutes } from 'src/api/routes/rollback.routes';
import { initializeDatabase } from 'src/db/index';
import { errorHandler } from 'src/middleware/error-handler';

const fastify = Fastify({ logger: true });

// Register error handler
fastify.setErrorHandler(errorHandler);

fastify.get('/', async (request, reply) => {
  return { hello: 'world' };
});

async function bootstrap() {
  console.log('Bootstrapping...');
  await initializeDatabase();
  console.log('Database initialized');
}

try {
  await bootstrap();
  
  // Register routes
  await fastify.register(blockRoutes);
  await fastify.register(balanceRoutes);
  await fastify.register(rollbackRoutes);
  
  await fastify.listen({
    port: 3000,
    host: '0.0.0.0'
  })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
};