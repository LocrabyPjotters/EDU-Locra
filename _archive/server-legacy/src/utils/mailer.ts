import nodemailer from 'nodemailer';
import { prisma } from '../index';

export async function sendEmail(orgId: string, to: string, subject: string, html: string) {
  const orgSettings = await prisma.orgSettings.findUnique({
    where: { orgId }
  });

  if (!orgSettings || !orgSettings.smtpHost || !orgSettings.smtpPort || !orgSettings.smtpUser || !orgSettings.smtpPass || !orgSettings.smtpFromEmail) {
    throw new Error('SMTP instellingen zijn niet geconfigureerd voor deze organisatie.');
  }

  const transporter = nodemailer.createTransport({
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
