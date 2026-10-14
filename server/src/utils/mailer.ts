import nodemailer from 'nodemailer';
import { prisma } from '../index';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export async function getSmtpConfig(orgId?: string): Promise<SmtpConfig | null> {
  let host = process.env.SMTP_HOST;
  let port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;
  let from = process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL || 'Locra <no-reply@locra.local>';

  if (orgId) {
    const orgSettings = await prisma.orgSettings.findUnique({
      where: { orgId }
    });
    if (orgSettings?.smtpHost) host = orgSettings.smtpHost;
    if (orgSettings?.smtpPort) port = Number(orgSettings.smtpPort);
    if (orgSettings?.smtpUser) user = orgSettings.smtpUser;
    if (orgSettings?.smtpPass) pass = orgSettings.smtpPass;
    if (orgSettings?.smtpFromEmail) from = orgSettings.smtpFromEmail;
  }

  if (!host || !user || !pass) {
    return null;
  }

  return { host, port: port || 587, user, pass, from };
}

export async function sendEmail(orgId: string, to: string, subject: string, html: string) {
  const config = await getSmtpConfig(orgId);

  if (!config) {
    throw new Error('SMTP instellingen zijn nog niet geconfigureerd in het beheerpaneel of in de server-omgeving (.env).');
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465, // SSL op 465, STARTTLS op 587 of 25
    auth: {
      user: config.user,
      pass: config.pass
    },
    tls: {
      rejectUnauthorized: false // Voorkomt storingen bij interne school-certificaten
    }
  });

  await transporter.sendMail({
    from: config.from,
    to,
    subject,
    html
  });
}

export function buildPasswordResetEmail(displayName: string, resetLink: string) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
      .container { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; }
      .header { padding: 32px 32px 20px; background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2)); border-bottom: 1px solid rgba(255,255,255,0.08); text-align: center; }
      .header h1 { margin: 0; font-size: 24px; color: #ffffff; font-weight: 700; letter-spacing: -0.5px; }
      .header p { margin: 8px 0 0; color: #94a3b8; font-size: 14px; }
      .content { padding: 32px; font-size: 15px; line-height: 1.6; color: #cbd5e1; }
      .btn-container { text-align: center; margin: 32px 0; }
      .btn { display: inline-block; padding: 14px 32px; background: #6366f1; color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 14px rgba(99,102,241,0.4); }
      .link-box { background: rgba(0,0,0,0.25); padding: 12px; border-radius: 8px; word-break: break-all; font-size: 13px; color: #94a3b8; margin-top: 20px; }
      .footer { padding: 20px 32px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Wachtwoord Herstellen</h1>
        <p>Locra AI Onderwijsplatform</p>
      </div>
      <div class="content">
        <p>Beste <strong>${displayName}</strong>,</p>
        <p>Er is een aanvraag ingediend om het wachtwoord van je Locra-account te herstellen. Klik op de onderstaande knop om een nieuw wachtwoord in te stellen:</p>
        
        <div class="btn-container">
          <a href="${resetLink}" class="btn" target="_blank">Nieuw Wachtwoord Instellen →</a>
        </div>

        <p style="font-size: 13px; color: #94a3b8;">
          ⏰ Deze herstellink is <strong>1 uur</strong> geldig vanaf het moment van aanvragen.
        </p>

        <p style="font-size: 13px; color: #94a3b8;">
          Werkt de knop niet? Kopieer en plak dan deze link in je browser:
        </p>
        <div class="link-box">
          ${resetLink}
        </div>
      </div>
      <div class="footer">
        Heb je deze aanvraag niet zelf gedaan? Dan kun je deze e-mail veilig negeren. Je huidige wachtwoord blijft ongewijzigd.
      </div>
    </div>
  </body>
  </html>
  `;
}

