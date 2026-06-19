// Health route. Auto-registered by convention (default-export a Fastify
// plugin; server.js scans src/routes/ and registers it). The k8s probes hit
// GET /api/health — keep this path in sync with deploy/deployment.yaml.
export default async function healthRoutes(fastify) {
  fastify.get('/api/health', async () => ({ status: 'ok' }));
}
