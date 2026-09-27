"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const static_1 = __importDefault(require("@fastify/static"));
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
exports.prisma = new client_1.PrismaClient();
const fastify = (0, fastify_1.default)({
    logger: {
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
        },
    },
});
const auth_1 = __importDefault(require("./api/routes/auth"));
const users_1 = __importDefault(require("./api/routes/users"));
const setup_1 = __importDefault(require("./api/routes/setup"));
const models_1 = __importDefault(require("./api/routes/models"));
const chat_1 = __importDefault(require("./api/routes/chat"));
const knowledge_1 = __importDefault(require("./api/routes/knowledge"));
const settings_1 = __importDefault(require("./api/routes/settings"));
const dashboard_1 = __importDefault(require("./api/routes/dashboard"));
const organization_1 = __importDefault(require("./api/routes/organization"));
const feedback_1 = __importDefault(require("./api/routes/feedback"));
const templates_1 = __importDefault(require("./api/routes/templates"));
const audit_1 = __importDefault(require("./api/routes/audit"));
const groups_1 = __importDefault(require("./api/routes/groups"));
const classes_1 = __importDefault(require("./api/routes/classes"));
const admin_1 = __importDefault(require("./api/routes/admin"));
const somtoday_1 = __importDefault(require("./api/routes/somtoday"));
const reactions_1 = __importDefault(require("./api/routes/reactions"));
const watermark_1 = __importDefault(require("./api/routes/watermark"));
const benchmark_1 = __importDefault(require("./api/routes/benchmark"));
const assignments_1 = __importDefault(require("./api/routes/assignments"));
const chatAddons_1 = __importDefault(require("./api/routes/chatAddons"));
const quickActions_1 = __importDefault(require("./api/routes/quickActions"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const license_1 = require("./services/license");
async function start() {
    try {
        await fastify.register(cors_1.default, {
            origin: '*', // TODO: configure based on settings
        });
        await fastify.register(require('@fastify/rate-limit'), {
            max: 100,
            timeWindow: '1 minute',
            allowList: ['127.0.0.1'] // Localhost bypass
        });
        await fastify.register(websocket_1.default);
        await fastify.register(multipart_1.default, {
            limits: {
                fileSize: 100 * 1024 * 1024, // 100MB limit for docs
            }
        });
        // Initialize License
        await (0, license_1.initializeLicenseCheck)();
        // Register API routes
        await fastify.register(setup_1.default, { prefix: '/api/setup' });
        await fastify.register(auth_1.default, { prefix: '/api/auth' });
        await fastify.register(users_1.default, { prefix: '/api/users' });
        await fastify.register(models_1.default, { prefix: '/api/models' });
        await fastify.register(chat_1.default, { prefix: '/api/chat' });
        await fastify.register(chatAddons_1.default, { prefix: '/api/chat' });
        await fastify.register(knowledge_1.default, { prefix: '/api/knowledge' });
        await fastify.register(settings_1.default, { prefix: '/api/settings' });
        await fastify.register(dashboard_1.default, { prefix: '/api/dashboard' });
        await fastify.register(organization_1.default, { prefix: '/api/organization' });
        await fastify.register(feedback_1.default, { prefix: '/api/feedback' });
        await fastify.register(templates_1.default, { prefix: '/api/templates' });
        await fastify.register(audit_1.default, { prefix: '/api/audit' });
        await fastify.register(groups_1.default, { prefix: '/api/groups' });
        await fastify.register(classes_1.default, { prefix: '/api/classes' });
        await fastify.register(admin_1.default, { prefix: '/api/admin' });
        await fastify.register(somtoday_1.default, { prefix: '/api/somtoday' });
        await fastify.register(reactions_1.default, { prefix: '/api/chat/messages' });
        await fastify.register(watermark_1.default, { prefix: '/api/watermark' });
        await fastify.register(benchmark_1.default, { prefix: '/api/admin/benchmark' });
        await fastify.register(assignments_1.default, { prefix: '/api/assignments' });
        await fastify.register(quickActions_1.default, { prefix: '/api/quick-actions' });
        // Health check
        fastify.get('/api/health', async (request, reply) => {
            return { status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() };
        });
        // Serve built frontend (SPA) — all non-API routes serve index.html
        const clientDist = path_1.default.join(__dirname, '..', '..', 'client', 'dist');
        await fastify.register(static_1.default, {
            root: clientDist,
            prefix: '/',
            wildcard: false,
        });
        // SPA catch-all: any unknown route returns index.html so React Router works
        fastify.get('/*', async (_req, reply) => {
            return reply.sendFile('index.html');
        });
        const port = parseInt(process.env.PORT || '4000', 10);
        await fastify.listen({ port, host: '0.0.0.0' });
        fastify.log.info(`Locra Server started on http://0.0.0.0:${port}`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}
// Ensure Prisma disconnects gracefully
process.on('SIGINT', async () => {
    await exports.prisma.$disconnect();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await exports.prisma.$disconnect();
    process.exit(0);
});
start();
