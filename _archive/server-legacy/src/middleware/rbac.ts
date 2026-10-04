import { FastifyRequest, FastifyReply } from 'fastify';

const ROLE_HIERARCHY: Record<string, number> = {
  superadmin: 50,
  admin: 40,
  teacher: 30,
  student: 20,
  guest: 10
};

export function requireRole(minimumRole: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized: User not found in request' });
    }

    const userRoleLevel = ROLE_HIERARCHY[request.user.role] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[minimumRole] || 999;

    if (userRoleLevel < requiredRoleLevel) {
      return reply.status(403).send({ error: 'Forbidden: Insufficient permissions' });
    }
  };
}
