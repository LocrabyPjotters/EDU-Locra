"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = licenseRoutes;
const index_1 = require("../../index");
async function licenseRoutes(fastify) {
    // This route should ideally be protected by a SUPER_ADMIN role or API key.
    // For now, we'll keep it accessible but you can lock it down in production.
    fastify.post('/generate', async (request, reply) => {
        const { type = 'education', maxUsers = 50, count = 1, superSecretToken } = request.body;
        // VERY basic security check, you should change this secret!
        if (superSecretToken !== 'pjotters-admin-123!') {
            return reply.status(403).send({ error: 'Unauthorized to generate licenses' });
        }
        const generateKey = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = 'LOCRA-';
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                if (i < 3)
                    result += '-';
            }
            return result;
        };
        const licenses = [];
        for (let i = 0; i < count; i++) {
            let key = generateKey();
            // Ensure unique key
            while (await index_1.prisma.validLicense.findUnique({ where: { key } })) {
                key = generateKey();
            }
            licenses.push({
                key,
                type,
                maxUsers
            });
        }
        await index_1.prisma.validLicense.createMany({
            data: licenses
        });
        return {
            message: `Successfully generated ${count} license(s)`,
            licenses
        };
    });
}
