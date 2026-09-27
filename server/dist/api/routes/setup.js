"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = setupRoutes;
const index_1 = require("../../index");
const crypto_1 = require("../../utils/crypto");
async function setupRoutes(fastify) {
    fastify.get('/status', async (request, reply) => {
        const orgCount = await index_1.prisma.organization.count();
        return { isSetup: orgCount > 0 };
    });
    fastify.post('/', async (request, reply) => {
        // Check if already setup
        const orgCount = await index_1.prisma.organization.count();
        if (orgCount > 0) {
            return reply.status(400).send({ error: 'Locra has already been setup on this server.' });
        }
        const { orgName, licenseKey, adminUsername, adminEmail, adminPassword } = request.body;
        if (!orgName || !adminUsername || !adminEmail || !adminPassword) {
            return reply.status(400).send({ error: 'Missing required fields for setup' });
        }
        const hashedPassword = await (0, crypto_1.hashPassword)(adminPassword);
        try {
            // Transaction to ensure atomicity
            const setupData = await index_1.prisma.$transaction(async (tx) => {
                const org = await tx.organization.create({
                    data: {
                        name: orgName,
                        slug: orgName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                        licenseKey: licenseKey || 'FREE-EDU-LICENSE-' + Math.random().toString(36).substring(7),
                        licenseType: licenseKey ? 'business' : 'education',
                        settings: {
                            create: {} // Default settings from schema defaults
                        }
                    }
                });
                const adminUser = await tx.user.create({
                    data: {
                        orgId: org.id,
                        username: adminUsername,
                        email: adminEmail,
                        displayName: 'Administrator',
                        passwordHash: hashedPassword,
                        role: 'superadmin'
                    }
                });
                // Initialize default group
                await tx.group.create({
                    data: {
                        orgId: org.id,
                        name: 'Alle Gebruikers',
                        description: 'Standaard groep voor de organisatie',
                        members: {
                            create: {
                                userId: adminUser.id,
                                role: 'owner'
                            }
                        }
                    }
                });
                return { org, adminUser };
            });
            const token = (0, crypto_1.generateToken)({
                id: setupData.adminUser.id,
                orgId: setupData.org.id,
                role: setupData.adminUser.role
            });
            return reply.status(201).send({
                message: 'Locra setup successful',
                token,
                user: {
                    id: setupData.adminUser.id,
                    username: setupData.adminUser.username,
                    role: setupData.adminUser.role,
                    displayName: setupData.adminUser.displayName
                }
            });
        }
        catch (e) {
            return reply.status(500).send({ error: 'Failed to complete setup: ' + e.message });
        }
    });
}
