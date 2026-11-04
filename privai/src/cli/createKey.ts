import crypto from 'crypto';

/**
 * Locra PrivAI™ CLI Key Generator
 * Usage: node dist/cli/createKey.js "School Name" [monthlyTokens]
 */

const orgName = process.argv[2] || 'Default School Node';
const monthlyTokens = parseInt(process.argv[3] || '50000000', 10);

const randomHex = crypto.randomBytes(16).toString('hex');
const apiKey = `privai_live_${randomHex}`;

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║   🔒 Locra PrivAI™ — Nieuwe API Key Gegenereerd                 ║');
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log(`║   Organisatie:     ${orgName.padEnd(44)} ║`);
console.log(`║   Maandlimiet:     ${monthlyTokens.toLocaleString()} tokens`.padEnd(67) + '║');
console.log(`║   API Sleutel:     ${apiKey}`.padEnd(67) + '║');
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log('║   Voeg deze sleutel toe aan je .env of stuur naar de school.     ║');
console.log('║   PRIVAI_API_KEY=' + apiKey);
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');
