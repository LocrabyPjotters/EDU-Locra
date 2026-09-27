import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../utils/crypto';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    request.user = decoded;
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
  }
}
