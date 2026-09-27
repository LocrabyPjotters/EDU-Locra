"use strict";
/**
 * SOMtoday API Service
 * Unofficial wrapper for the SOMtoday REST API.
 * Based on: https://github.com/elisaado/somtoday-api-docs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSchools = getSchools;
exports.authenticateSomtoday = authenticateSomtoday;
exports.refreshSomtodayToken = refreshSomtodayToken;
exports.getStudentInfo = getStudentInfo;
exports.getGrades = getGrades;
exports.getSchedule = getSchedule;
exports.getHomework = getHomework;
exports.formatSomtodayContext = formatSomtodayContext;
const SOMTODAY_AUTH_URL = 'https://production.somtoday.nl';
const SOMTODAY_CLIENT_ID = 'D50E0C06-32D1-4B41-A137-A9A850C892C2'; // Public mobile app client ID
/**
 * Get list of schools for autocomplete
 */
async function getSchools(search) {
    try {
        const res = await fetch(`https://servers.somtoday.nl/organisaties.json`);
        const data = await res.json();
        const results = [];
        for (const inst of data[0]?.instellingen || []) {
            if (inst.naam.toLowerCase().includes(search.toLowerCase())) {
                results.push({
                    uuid: inst.uuid,
                    naam: inst.naam,
                    plaats: inst.plaats
                });
            }
        }
        return results.slice(0, 10);
    }
    catch (err) {
        console.error('[SOMtoday] Failed to fetch schools:', err.message);
        return [];
    }
}
/**
 * Authenticate with SOMtoday using username and password
 */
async function authenticateSomtoday(username, password, schoolUuid) {
    try {
        const body = new URLSearchParams({
            grant_type: 'password',
            username: `${schoolUuid}\\${username}`,
            password: password,
            scope: 'openid',
            client_id: SOMTODAY_CLIENT_ID,
        });
        const res = await fetch(`${SOMTODAY_AUTH_URL}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });
        if (!res.ok) {
            const errText = await res.text();
            console.error('[SOMtoday] Auth failed:', res.status, errText);
            return null;
        }
        return await res.json();
    }
    catch (err) {
        console.error('[SOMtoday] Auth error:', err.message);
        return null;
    }
}
/**
 * Refresh the access token
 */
async function refreshSomtodayToken(refreshToken) {
    try {
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: SOMTODAY_CLIENT_ID,
        });
        const res = await fetch(`${SOMTODAY_AUTH_URL}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });
        if (!res.ok)
            return null;
        return await res.json();
    }
    catch (err) {
        console.error('[SOMtoday] Token refresh error:', err.message);
        return null;
    }
}
/**
 * Helper to make authenticated requests to SOMtoday API
 */
async function somtodayFetch(apiUrl, path, token, params) {
    const url = new URL(`${apiUrl}${path}`);
    if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const res = await fetch(url.toString(), {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
        }
    });
    if (!res.ok) {
        throw new Error(`SOMtoday API ${path} returned ${res.status}`);
    }
    return res.json();
}
/**
 * Get current student info
 */
async function getStudentInfo(token, apiUrl) {
    try {
        const data = await somtodayFetch(apiUrl, '/rest/v1/leerlingen', token);
        const items = data?.items || [];
        if (items.length === 0)
            return null;
        const s = items[0];
        return {
            id: s.links?.[0]?.id || s.id,
            leerlingnummer: s.leerlingnummer,
            roepnaam: s.roepnaam,
            achternaam: s.achternaam,
            email: s.email
        };
    }
    catch (err) {
        console.error('[SOMtoday] getStudentInfo error:', err.message);
        return null;
    }
}
/**
 * Get grades for student
 */
async function getGrades(token, apiUrl, studentId) {
    try {
        const data = await somtodayFetch(apiUrl, `/rest/v1/resultaten/huidigVoorLeerling/${studentId}`, token);
        const items = data?.items || [];
        return items.map((r) => ({
            vak: r.vak?.naam || 'Onbekend',
            resultaat: r.resultaat || r.resultaatLabelAfkorting || '-',
            weging: r.weging || 0,
            omschrijving: r.omschrijving || '',
            datumInvoer: r.datumInvoer || '',
            type: r.type || ''
        }));
    }
    catch (err) {
        console.error('[SOMtoday] getGrades error:', err.message);
        return [];
    }
}
/**
 * Get schedule/appointments
 */
async function getSchedule(token, apiUrl, studentId, startDate, // YYYY-MM-DD
endDate) {
    try {
        const data = await somtodayFetch(apiUrl, '/rest/v1/afspraken', token, {
            begindatum: startDate,
            einddatum: endDate,
            sort: 'asc-beginDatumTijd'
        });
        const items = data?.items || [];
        return items.map((a) => ({
            id: a.links?.[0]?.id || a.id,
            titel: a.titel || a.afspraakType?.naam || 'Onbekend',
            beginDatumTijd: a.beginDatumTijd,
            eindDatumTijd: a.eindDatumTijd,
            locatie: a.locatie,
            vakNamen: a.vakken?.map((v) => v.naam) || [],
            docentAfkortingen: a.docentAfkortingen || [],
            huiswerkType: a.bijpipilagen?.[0]?.type || null,
            inhoud: a.inhoud || null
        }));
    }
    catch (err) {
        console.error('[SOMtoday] getSchedule error:', err.message);
        return [];
    }
}
/**
 * Get homework
 */
async function getHomework(token, apiUrl, startDate, endDate) {
    try {
        const data = await somtodayFetch(apiUrl, '/rest/v1/studiewijzeritemafspraaktoekenningen', token, {
            begindatum: startDate,
            einddatum: endDate
        });
        const items = data?.items || [];
        return items.map((hw) => ({
            id: hw.links?.[0]?.id,
            titel: hw.studiewijzerItem?.onderwerp || 'Huiswerk',
            omschrijving: hw.studiewijzerItem?.omschrijving || '',
            afgerond: hw.gempiaakt || false,
            datumTijd: hw.datumTijd || hw.studiewijzerItem?.datumTijd,
            vak: hw.studiewijzerItem?.vak?.naam || ''
        }));
    }
    catch (err) {
        console.error('[SOMtoday] getHomework error:', err.message);
        return [];
    }
}
/**
 * Format SOMtoday data as context for the AI
 */
function formatSomtodayContext(schedule, grades, homework) {
    let context = '=== SOMTODAY LEERLINGGEGEVENS ===\n\n';
    if (schedule.length > 0) {
        context += '📅 ROOSTER:\n';
        schedule.forEach(a => {
            const start = new Date(a.beginDatumTijd).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
            const end = new Date(a.eindDatumTijd).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
            const dag = new Date(a.beginDatumTijd).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
            context += `  ${dag}: ${start}-${end} | ${a.titel} ${a.vakNamen?.join(', ') || ''} ${a.locatie ? `(${a.locatie})` : ''}\n`;
        });
        context += '\n';
    }
    if (grades.length > 0) {
        context += '📊 RECENTE CIJFERS:\n';
        grades.slice(0, 20).forEach(g => {
            context += `  ${g.vak}: ${g.resultaat} (${g.omschrijving || g.type}) ${g.datumInvoer ? `- ${new Date(g.datumInvoer).toLocaleDateString('nl-NL')}` : ''}\n`;
        });
        context += '\n';
    }
    if (homework.length > 0) {
        context += '📝 HUISWERK:\n';
        homework.forEach(hw => {
            const status = hw.afgerond ? '✅' : '⬜';
            context += `  ${status} ${hw.vak}: ${hw.titel} ${hw.omschrijving ? `- ${hw.omschrijving.substring(0, 100)}` : ''}\n`;
        });
        context += '\n';
    }
    context += '=== EINDE SOMTODAY ===';
    return context;
}
