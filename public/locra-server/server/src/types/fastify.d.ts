import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      orgId: string;
      role: string;
    };
  }
}
