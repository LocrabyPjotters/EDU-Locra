"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const index_1 = require("../index");
async function sendEmail(orgId, to, subject, html) {
    const orgSettings = await index_1.prisma.orgSettings.findUnique({
        where: { orgId }
    });
    if (!orgSettings || !orgSettings.smtpHost || !orgSettings.smtpPort || !orgSettings.smtpUser || !orgSettings.smtpPass || !orgSettings.smtpFromEmail) {
        throw new Error('SMTP instellingen zijn niet geconfigureerd voor deze organisatie.');
    }
    const transporter = nodemailer_1.default.createTransport({
        host: orgSettings.smtpHost,
        port: orgSettings.smtpPort,
        secure: orgSettings.smtpPort === 465, // true for 465, false for other ports
        auth: {
            user: orgSettings.smtpUser,
            pass: orgSettings.smtpPass
        }
    });
    await transporter.sendMail({
        from: orgSettings.smtpFromEmail,
        to,
        subject,
        html
    });
}
