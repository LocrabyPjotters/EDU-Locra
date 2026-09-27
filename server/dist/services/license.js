"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLicense = getLicense;
exports.validateLicense = validateLicense;
exports.initializeLicenseCheck = initializeLicenseCheck;
const index_1 = require("../index");
const node_fetch_1 = __importDefault(require("node-fetch"));
const DEFAULT_FREE_LICENSE = {
    valid: true,
    tier: 'free',
    features: {
        watermarkDetection: false,
        advancedRAG: false,
        somtodayIntegration: false,
        maxKnowledgeBases: 1,
    }
};
let currentLicense = DEFAULT_FREE_LICENSE;
function getLicense() {
    return currentLicense;
}
async function validateLicense(key) {
    if (!key) {
        currentLicense = DEFAULT_FREE_LICENSE;
        return currentLicense;
    }
    const cleanKey = key.trim().toUpperCase();
    const endpoints = [
        `https://api.rowmatch.nl/api/locra/validate/${cleanKey}`,
        `http://localhost:5001/api/locra/validate/${cleanKey}`
    ];
    for (const url of endpoints) {
        try {
            const res = await (0, node_fetch_1.default)(url, { signal: AbortSignal.timeout(3500) });
            if (res.ok) {
                const data = await res.json();
                if (data.valid) {
                    const isPlus = ['edu-plus', 'enterprise'].includes(data.tier);
                    currentLicense = {
                        valid: true,
                        tier: data.tier,
                        schoolName: data.schoolName,
                        maxUsers: data.maxUsers,
                        expiresAt: data.expiresAt,
                        features: {
                            watermarkDetection: isPlus,
                            advancedRAG: isPlus,
                            somtodayIntegration: true,
                            maxKnowledgeBases: data.tier === 'enterprise' ? 999 : (data.tier === 'edu-plus' ? 15 : 3),
                        }
                    };
                    return currentLicense;
                }
                else {
                    currentLicense = {
                        ...DEFAULT_FREE_LICENSE,
                        valid: false,
                        reason: data.reason || 'Licentie is niet geldig'
                    };
                    return currentLicense;
                }
            }
        }
        catch (err) {
            // Probeer fallback endpoint
        }
    }
    // Als beide endpoints niet bereikbaar zijn (offline)
    console.warn(`[License] Kon niet valideren voor sleutel ${cleanKey}, offline modus actief.`);
    currentLicense = {
        ...DEFAULT_FREE_LICENSE,
        reason: 'Offline of geen verbinding met Pjotters licentieserver'
    };
    return currentLicense;
}
async function initializeLicenseCheck() {
    try {
        const orgSettings = await index_1.prisma.orgSettings.findFirst();
        await validateLicense(orgSettings?.licenseKey || null);
        console.log(`[License] Geactiveerd: Tier = ${currentLicense.tier}${currentLicense.valid ? ' (Geldig)' : ' (Ongeldig: ' + currentLicense.reason + ')'}`);
    }
    catch (err) {
        console.error('[License] Database fout bij controleren van licentie:', err);
    }
}
