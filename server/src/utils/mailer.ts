import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { prisma } from '../index';

export function computeSmtpHash(config: { host?: string | null; port?: number | null; user?: string | null; fromEmail?: string | null }): string {
  const str = `${config.host || ''}:${config.port || ''}:${config.user || ''}:${config.fromEmail || ''}`;
  return crypto.createHash('sha256').update(str).digest('hex');
}

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

export function buildSmtpVerificationEmail(code: string) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
      .container { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; }
      .header { padding: 32px 32px 20px; background: linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.2)); border-bottom: 1px solid rgba(255,255,255,0.08); text-align: center; }
      .header h1 { margin: 0; font-size: 22px; color: #ffffff; font-weight: 700; }
      .header p { margin: 6px 0 0; color: #94a3b8; font-size: 13px; }
      .content { padding: 32px; font-size: 15px; line-height: 1.6; color: #cbd5e1; }
      .code-box { background: rgba(0,0,0,0.35); border: 2px dashed #10b981; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #34d399; font-family: monospace; }
      .footer { padding: 18px 32px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🔐 SMTP Server Verificatie</h1>
        <p>Locra Beheer & Moderatie Beveiliging</p>
      </div>
      <div class="content">
        <p>Beste beheerder,</p>
        <p>Gebruik de onderstaande 6-cijferige verificatiecode om de uitgaande e-mailserver in Locra te activeren:</p>
        <div class="code-box">${code}</div>
        <p style="font-size: 13px; color: #94a3b8;">
          ⏰ Deze code is <strong>15 minuten</strong> geldig. Pas zodra deze code is geverifieerd, kunnen administratieve notificaties en chatmoderatie-functies veilig worden uitgevoerd.
        </p>
      </div>
      <div class="footer">
        Locra AI Platform • Vertrouwelijkheid & Privacy Gegarandeerd
      </div>
    </div>
  </body>
  </html>
  `;
}

export function buildAccessRequestEmail(studentName: string, requestedByName: string, roleName: string, conversationTitle: string, consentLink: string) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
      .container { max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; }
      .header { padding: 30px; background: linear-gradient(135deg, rgba(99,102,241,0.25), rgba(56,189,248,0.2)); border-bottom: 1px solid rgba(255,255,255,0.08); text-align: center; }
      .header h1 { margin: 0; font-size: 22px; color: #ffffff; }
      .content { padding: 30px; font-size: 15px; line-height: 1.6; color: #cbd5e1; }
      .info-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin: 20px 0; }
      .btn { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #6366f1, #38bdf8); color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; }
      .footer { padding: 18px 30px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🔒 Verzoek tot Inzage in Gesprek</h1>
        <p>Locra Privacy & Toegangsbeheer</p>
      </div>
      <div class="content">
        <p>Beste <strong>${studentName}</strong>,</p>
        <p>Er is een verzoek ingediend om inzage te krijgen in een van jouw AI-gesprekken binnen Locra:</p>
        
        <div class="info-card">
          <div style="margin-bottom: 6px;"><strong>Aanvrager:</strong> ${requestedByName} (${roleName})</div>
          <div><strong>Betreft gesprek:</strong> 💬 ${conversationTitle}</div>
        </div>

        <p><strong>Jij hebt zelf de regie:</strong> Je kunt kiezen om het hele gesprek te delen, alleen de titel en opdrachten, óf slechts specifieke berichten aan te vinken die relevant zijn.</p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${consentLink}" class="btn" target="_blank">Toestemming Beheren & Delen →</a>
        </div>

        <p style="font-size: 13px; color: #94a3b8;">
          ⏰ Deze link is 7 dagen geldig. Zonder jouw expliciete toestemming blijft de inhoud van je gesprek strikt versleuteld en kan niemand behalve jij de chats inzien.
        </p>
      </div>
      <div class="footer">
        Locra AI • Privacy by Design conform AVG / GDPR Onderwijsrichtlijnen
      </div>
    </div>
  </body>
  </html>
  `;
}

export function buildEmergencyUnlockNotificationEmail(studentName: string, confidantName: string, conversationTitle: string, reason: string) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
      .container { max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; }
      .header { padding: 30px; background: linear-gradient(135deg, rgba(234,179,8,0.2), rgba(245,158,11,0.2)); border-bottom: 1px solid rgba(255,255,255,0.08); text-align: center; }
      .header h1 { margin: 0; font-size: 22px; color: #fbbf24; }
      .content { padding: 30px; font-size: 15px; line-height: 1.6; color: #cbd5e1; }
      .info-card { background: rgba(0,0,0,0.3); border: 1px solid rgba(234,179,8,0.3); border-radius: 12px; padding: 18px; margin: 20px 0; }
      .footer { padding: 18px 30px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🛡️ Inzage door Vertrouwenspersoon</h1>
        <p>Transparantierapportage voor Leerlingen</p>
      </div>
      <div class="content">
        <p>Beste <strong>${studentName}</strong>,</p>
        <p>Conform de schoolveiligheids- en AVG-afspraken informeren wij je dat een gecertificeerde Vertrouwenspersoon een gesprek heeft ingezien:</p>
        
        <div class="info-card">
          <div style="margin-bottom: 6px;"><strong>Vertrouwenspersoon:</strong> ${confidantName}</div>
          <div style="margin-bottom: 6px;"><strong>Betreft gesprek:</strong> 💬 ${conversationTitle}</div>
          <div style="margin-bottom: 6px;"><strong>Tijdstip:</strong> ${new Date().toLocaleString('nl-NL')}</div>
          <div><strong>Opgegeven zorgreden:</strong> ${reason}</div>
        </div>

        <p>Deze inzage is geregistreerd in het beveiligde auditlogboek. Heb je vragen over deze inzage of wil je hierover in gesprek? Neem dan contact op met de vertrouwenspersoon van jouw school.</p>
      </div>
      <div class="footer">
        Locra AI • Veiligheid, Zorg en Transparantie
      </div>
    </div>
  </body>
  </html>
  `;
}

export function buildAccessApprovedNotificationEmail(requesterName: string, studentName: string, conversationTitle: string, scopeLabel: string) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
      .container { max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; }
      .header { padding: 30px; background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.2)); border-bottom: 1px solid rgba(255,255,255,0.08); text-align: center; }
      .header h1 { margin: 0; font-size: 22px; color: #4ade80; }
      .content { padding: 30px; font-size: 15px; line-height: 1.6; color: #cbd5e1; }
      .info-card { background: rgba(0,0,0,0.3); border: 1px solid rgba(34,197,94,0.3); border-radius: 12px; padding: 18px; margin: 20px 0; }
      .footer { padding: 18px 30px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>✅ Inzageverzoek Toegestaan</h1>
        <p>Locra Privacy & Toegangsbewaking</p>
      </div>
      <div class="content">
        <p>Beste <strong>${requesterName}</strong>,</p>
        <p>De leerling heeft gereageerd op jouw verzoek tot inzage in een AI-gesprek en toestemming verleend:</p>
        
        <div class="info-card">
          <div style="margin-bottom: 6px;"><strong>Leerling:</strong> ${studentName}</div>
          <div style="margin-bottom: 6px;"><strong>Gesprek:</strong> 💬 ${conversationTitle}</div>
          <div style="margin-bottom: 6px;"><strong>Vrijgegeven omvang:</strong> ${scopeLabel}</div>
          <div><strong>Datum & Tijd:</strong> ${new Date().toLocaleString('nl-NL')}</div>
        </div>

        <p>Je kunt de toegestane inhoud nu inzien via het Moderatie & Gesprekken paneel in Locra.</p>
      </div>
      <div class="footer">
        Locra AI • Privacy by Design & Beveiligde Moderatie
      </div>
    </div>
  </body>
  </html>
  `;
}

