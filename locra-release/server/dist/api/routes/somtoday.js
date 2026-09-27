"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = somtodayRoutes;
const index_1 = require("../../index");
const auth_1 = require("../../middleware/auth");
const somtoday_1 = require("../../services/somtoday");
async function somtodayRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.requireAuth);
    // Search schools for autocomplete
    fastify.get('/schools', async (request, reply) => {
        const { q } = request.query;
        if (!q || q.length < 2)
            return [];
        return (0, somtoday_1.getSchools)(q);
    });
    // Connect SOMtoday account
    fastify.post('/connect', async (request, reply) => {
        const { username, password, schoolUuid } = request.body;
        if (!username || !password || !schoolUuid) {
            return reply.code(400).send({ error: 'Gebruikersnaam, wachtwoord en school zijn verplicht' });
        }
        const tokenData = await (0, somtoday_1.authenticateSomtoday)(username, password, schoolUuid);
        if (!tokenData) {
            return reply.code(401).send({ error: 'SOMtoday inloggen mislukt. Controleer je gegevens.' });
        }
        // Get student info
        const student = await (0, somtoday_1.getStudentInfo)(tokenData.access_token, tokenData.somtoday_api_url);
        // Save tokens to user
        await index_1.prisma.user.update({
            where: { id: request.user.id },
            data: {
                somtodayToken: tokenData.access_token,
                somtodayRefreshToken: tokenData.refresh_token,
                somtodayApiUrl: tokenData.somtoday_api_url,
                somtodayStudentId: student?.id?.toString() || null
            }
        });
        return {
            success: true,
            student: student ? {
                naam: `${student.roepnaam} ${student.achternaam}`,
                leerlingnummer: student.leerlingnummer
            } : null
        };
    });
    // Disconnect SOMtoday
    fastify.delete('/disconnect', async (request, reply) => {
        await index_1.prisma.user.update({
            where: { id: request.user.id },
            data: {
                somtodayToken: null,
                somtodayRefreshToken: null,
                somtodayApiUrl: null,
                somtodayStudentId: null
            }
        });
        return { success: true };
    });
    // Check connection status
    fastify.get('/status', async (request, reply) => {
        const user = await index_1.prisma.user.findUnique({
            where: { id: request.user.id },
            select: { somtodayToken: true, somtodayStudentId: true }
        });
        return { connected: !!user?.somtodayToken };
    });
    // Get schedule
    fastify.get('/schedule', async (request, reply) => {
        const { from, to } = request.query;
        const user = await index_1.prisma.user.findUnique({ where: { id: request.user.id } });
        if (!user?.somtodayToken || !user?.somtodayApiUrl || !user?.somtodayStudentId) {
            return reply.code(400).send({ error: 'SOMtoday niet gekoppeld' });
        }
        // Default: this week
        const startDate = from || new Date().toISOString().split('T')[0];
        const endDate = to || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        try {
            const schedule = await (0, somtoday_1.getSchedule)(user.somtodayToken, user.somtodayApiUrl, user.somtodayStudentId, startDate, endDate);
            return schedule;
        }
        catch (err) {
            // Try refreshing token
            if (user.somtodayRefreshToken) {
                const newToken = await (0, somtoday_1.refreshSomtodayToken)(user.somtodayRefreshToken);
                if (newToken) {
                    await index_1.prisma.user.update({
                        where: { id: user.id },
                        data: {
                            somtodayToken: newToken.access_token,
                            somtodayRefreshToken: newToken.refresh_token
                        }
                    });
                    const schedule = await (0, somtoday_1.getSchedule)(newToken.access_token, newToken.somtoday_api_url, user.somtodayStudentId, startDate, endDate);
                    return schedule;
                }
            }
            return reply.code(401).send({ error: 'SOMtoday sessie verlopen. Log opnieuw in.' });
        }
    });
    // Get grades
    fastify.get('/grades', async (request, reply) => {
        const user = await index_1.prisma.user.findUnique({ where: { id: request.user.id } });
        if (!user?.somtodayToken || !user?.somtodayApiUrl || !user?.somtodayStudentId) {
            return reply.code(400).send({ error: 'SOMtoday niet gekoppeld' });
        }
        try {
            return await (0, somtoday_1.getGrades)(user.somtodayToken, user.somtodayApiUrl, user.somtodayStudentId);
        }
        catch (err) {
            if (user.somtodayRefreshToken) {
                const newToken = await (0, somtoday_1.refreshSomtodayToken)(user.somtodayRefreshToken);
                if (newToken) {
                    await index_1.prisma.user.update({
                        where: { id: user.id },
                        data: { somtodayToken: newToken.access_token, somtodayRefreshToken: newToken.refresh_token }
                    });
                    return await (0, somtoday_1.getGrades)(newToken.access_token, newToken.somtoday_api_url, user.somtodayStudentId);
                }
            }
            return reply.code(401).send({ error: 'SOMtoday sessie verlopen' });
        }
    });
    // Get homework
    fastify.get('/homework', async (request, reply) => {
        const { from, to } = request.query;
        const user = await index_1.prisma.user.findUnique({ where: { id: request.user.id } });
        if (!user?.somtodayToken || !user?.somtodayApiUrl) {
            return reply.code(400).send({ error: 'SOMtoday niet gekoppeld' });
        }
        const startDate = from || new Date().toISOString().split('T')[0];
        const endDate = to || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        try {
            return await (0, somtoday_1.getHomework)(user.somtodayToken, user.somtodayApiUrl, startDate, endDate);
        }
        catch (err) {
            if (user.somtodayRefreshToken) {
                const newToken = await (0, somtoday_1.refreshSomtodayToken)(user.somtodayRefreshToken);
                if (newToken) {
                    await index_1.prisma.user.update({
                        where: { id: user.id },
                        data: { somtodayToken: newToken.access_token, somtodayRefreshToken: newToken.refresh_token }
                    });
                    return await (0, somtoday_1.getHomework)(newToken.access_token, newToken.somtoday_api_url, startDate, endDate);
                }
            }
            return reply.code(401).send({ error: 'SOMtoday sessie verlopen' });
        }
    });
}
