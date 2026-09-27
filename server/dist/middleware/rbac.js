"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
const ROLE_HIERARCHY = {
    superadmin: 50,
    admin: 40,
    teacher: 30,
    student: 20,
    guest: 10
};
function requireRole(minimumRole) {
    return async (request, reply) => {
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
