import Fastify from 'fastify';
import { blockRoutes } from './api/routes/block.routes';
import { balanceRoutes } from './api/routes/balance.routes';
import { initializeDatabase } from './db/index';

const fastify = Fastify({ logger: true });

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
  
  await fastify.listen({
    port: 3000,
    host: '0.0.0.0'
  })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
};