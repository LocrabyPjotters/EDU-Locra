import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import UpgradePrompt from '../../components/UpgradePrompt';

interface QuotaRow {
  id: string;
  name: string;
  role?: string;
  customQuotaEnabled: boolean;
  maxPromptsPerDay: number | null;
  maxPromptsPerMonth: number | null;
  creditsUsed?: number;
}

interface ModelRow {
  id: string;
  displayName: string;
  provider: string;
  isActive: boolean;
  accessMode: 'all' | 'teachers-only' | 'restricted';
  allowedClassIds: string[];
  allowedGroupIds: string[];
}

interface ListItem { id: string; name: string; }
type Tab = 'klassen' | 'personen' | 'modeltoegang';

const PROVIDER_COLOR: Record<string, string> = {
  ollama: '#6366f1', openrouter: '#f59e0b', openai: '#10b981',
  anthropic: '#8b5cf6', gemini: '#3b82f6', google: '#3b82f6',
};

function usePct(used: number, limit: number | null) {
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export default function QuotasPanel() {
  const token = useAuthStore(s => (s as any).token);
  const [tab, setTab] = useState<Tab>('klassen');
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  const [classes, setClasses] = useState<QuotaRow[]>([]);
  const [users, setUsers] = useState<QuotaRow[]>([]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [classList, setClassList] = useState<ListItem[]>([]);
  const [groupList, setGroupList] = useState<ListItem[]>([]);

  const [edits, setEdits] = useState<Record<string, Partial<QuotaRow>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedSet, setSavedSet] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const [mEdits, setMEdits] = useState<Record<string, Partial<ModelRow>>>({});
  const [mSaving, setMSaving] = useState<Record<string, boolean>>({});
  const [mSavedSet, setMSavedSet] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const h = { Authorization: `Bearer ${token}` };
    try {
      const [qRes, mRes, clRes, grRes] = await Promise.all([
        fetch('/api/admin/quotas', { headers: h }),
        fetch('/api/models', { headers: h }),
        fetch('/api/admin/classes', { headers: h }),
        fetch('/api/admin/groups', { headers: h }),
      ]);
      if (qRes.status === 403) {
        setIsLocked(true);
        setLoading(false);
        return;
      }
      if (qRes.ok) {
        const d = await qRes.json();
        setClasses((d.classes || []).map((c: any) => ({
          id: c.id, name: c.name,
          customQuotaEnabled: c.customQuotaEnabled,
          maxPromptsPerDay: c.daily || null,
          maxPromptsPerMonth: c.monthly || null,
        })));
        setUsers((d.users || []).map((u: any) => ({
          id: u.id, name: u.name, role: u.role,
          customQuotaEnabled: u.customQuotaEnabled,
          maxPromptsPerDay: u.daily || null,
          maxPromptsPerMonth: u.monthly || null,
          creditsUsed: u.creditsUsed || 0,
        })));
      }
      if (mRes.ok) {
        const d: any[] = await mRes.json();
        setModels(d.filter(m => m.isActive).map(m => ({
          id: m.id, displayName: m.displayName, provider: m.provider || 'ollama',
          isActive: m.isActive, accessMode: m.accessMode || 'all',
          allowedClassIds: m.allowedClassIds ? (typeof m.allowedClassIds === 'string' ? JSON.parse(m.allowedClassIds) : m.allowedClassIds) : [],
          allowedGroupIds: m.allowedGroupIds ? (typeof m.allowedGroupIds === 'string' ? JSON.parse(m.allowedGroupIds) : m.allowedGroupIds) : [],
        })));
      }
      if (clRes.ok) { const d = await clRes.json(); setClassList(Array.isArray(d) ? d : []); }
      if (grRes.ok) { const d = await grRes.json(); setGroupList(Array.isArray(d) ? d : []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getRow = (base: QuotaRow): QuotaRow => ({ ...base, ...edits[base.id] });
  const isDirty = (id: string) => Object.keys(edits[id] || {}).length > 0;

  const setField = (id: string, field: keyof QuotaRow, val: any) => {
    setEdits(p => ({ ...p, [id]: { ...p[id], [field]: val } }));
    setSavedSet(p => { const n = { ...p }; delete n[id]; return n; });
    setRowErrors(p => { const n = { ...p }; delete n[id]; return n; });
  };

  const saveRow = async (base: QuotaRow, type: 'class' | 'user') => {
    const r = getRow(base);
    setSaving(p => ({ ...p, [base.id]: true }));
    try {
      const res = await fetch(`/api/admin/quotas/${type}/${base.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customQuotaEnabled: r.customQuotaEnabled,
          maxPromptsPerDay: r.maxPromptsPerDay,
          maxPromptsPerMonth: r.maxPromptsPerMonth,
        }),
      });
      if (res.ok) {
        setSavedSet(p => ({ ...p, [base.id]: true }));
        if (type === 'class') setClasses(p => p.map(x => x.id === base.id ? { ...x, ...edits[base.id] } as QuotaRow : x));
        else setUsers(p => p.map(x => x.id === base.id ? { ...x, ...edits[base.id] } as QuotaRow : x));
        setEdits(p => { const n = { ...p }; delete n[base.id]; return n; });
        setTimeout(() => setSavedSet(p => { const n = { ...p }; delete n[base.id]; return n; }), 2500);
      } else {
        const e = await res.json().catch(() => ({}));
        setRowErrors(p => ({ ...p, [base.id]: e.error || 'Opslaan mislukt' }));
      }
    } catch { setRowErrors(p => ({ ...p, [base.id]: 'Netwerkfout' })); }
    setSaving(p => ({ ...p, [base.id]: false }));
  };

  const getMRow = (base: ModelRow): ModelRow => ({ ...base, ...mEdits[base.id] });
  const mDirty = (id: string) => Object.keys(mEdits[id] || {}).length > 0;

  const setMField = (id: string, field: keyof ModelRow, val: any) => {
    setMEdits(p => ({ ...p, [id]: { ...p[id], [field]: val } }));
    setMSavedSet(p => { const n = { ...p }; delete n[id]; return n; });
  };

  const toggleId = (modelId: string, field: 'allowedClassIds' | 'allowedGroupIds', itemId: string, base: ModelRow) => {
    const cur = getMRow(base)[field];
    const next = cur.includes(itemId) ? cur.filter(x => x !== itemId) : [...cur, itemId];
    setMField(modelId, field, next);
  };

  const saveModel = async (base: ModelRow) => {
    const r = getMRow(base);
    setMSaving(p => ({ ...p, [base.id]: true }));
    try {
      const res = await fetch(`/api/admin/models/${base.id}/access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accessMode: r.accessMode, allowedClassIds: r.allowedClassIds, allowedGroupIds: r.allowedGroupIds }),
      });
      if (res.ok) {
        setMSavedSet(p => ({ ...p, [base.id]: true }));
        setModels(p => p.map(x => x.id === base.id ? { ...x, ...mEdits[base.id] } as ModelRow : x));
        setMEdits(p => { const n = { ...p }; delete n[base.id]; return n; });
        setTimeout(() => setMSavedSet(p => { const n = { ...p }; delete n[base.id]; return n; }), 2500);
      }
    } catch { /* silent */ }
    setMSaving(p => ({ ...p, [base.id]: false }));
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(99,102,241,0.25)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Limieten laden...</span>
    </div>
  );

  if (isLocked) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
        <UpgradePrompt
          featureName="Limieten, Quota & Modeltoegang"
          icon="⚖️"
          requiredTier="edu-plus"
          description="Beheer token- en promptquota's per leerling, klas of rol. Beperk toegang tot zware modellen en behoud volledige controle over de hardwarebelasting."
          benefits={[
            'Stel dagelijkse en maandelijkse promptlimieten in per leerling, klas of docent',
            'Voorkom overbelasting van de lokale GPU of hardware servers',
            'Differentieer modeltoegang (bijv. 70B modellen alleen voor docenten)',
            'Inzicht in realtime verbruikte credits en activiteit per klas'
          ]}
        />
      </div>
    );
  }

  const QuotaCard = ({ base, type }: { base: QuotaRow; type: 'class' | 'user' }) => {
    const r = getRow(base);
    const dirty = isDirty(base.id);
    const isSaving = saving[base.id];
    const isSaved = savedSet[base.id];
    const err = rowErrors[base.id];
    const creditUsed = r.creditsUsed || 0;
    const creditPct = usePct(creditUsed, r.maxPromptsPerMonth);

    return (
      <div style={{
        background: 'rgba(255,255,255,0.025)',
        border: dirty ? '1.5px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px', padding: '1rem 1.25rem', transition: 'border-color 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>

          {/* Name */}
          <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)' }}>{r.name}</div>
            {r.role === 'teacher' && (
              <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', fontWeight: 700, display: 'inline-block', marginTop: '0.2rem' }}>DOCENT</span>
            )}
          </div>

          {/* Toggle */}
          <div onClick={() => setField(base.id, 'customQuotaEnabled', !r.customQuotaEnabled)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ width: 40, height: 22, borderRadius: 99, position: 'relative', transition: 'background 0.2s', background: r.customQuotaEnabled ? 'var(--primary)' : 'rgba(255,255,255,0.12)' }}>
              <div style={{ position: 'absolute', top: 3, left: r.customQuotaEnabled ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: '0.78rem', color: r.customQuotaEnabled ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)', userSelect: 'none' }}>
              {r.customQuotaEnabled ? 'Aangepast' : 'Standaard (org)'}
            </span>
          </div>

          {/* Inputs */}
          {r.customQuotaEnabled ? (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.28rem' }}>⚡ Credits / maand</div>
                <input type="number" min={0} placeholder="bijv. 500"
                  value={r.maxPromptsPerMonth ?? ''}
                  onChange={e => setField(base.id, 'maxPromptsPerMonth', e.target.value === '' ? null : parseInt(e.target.value))}
                  style={{ width: '115px', padding: '0.35rem 0.6rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', color: 'white', borderRadius: '8px', fontSize: '0.88rem' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.28rem' }}>📅 Max. chats / dag</div>
                <input type="number" min={0} placeholder="bijv. 30"
                  value={r.maxPromptsPerDay ?? ''}
                  onChange={e => setField(base.id, 'maxPromptsPerDay', e.target.value === '' ? null : parseInt(e.target.value))}
                  style={{ width: '100px', padding: '0.35rem 0.6rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', color: 'white', borderRadius: '8px', fontSize: '0.88rem' }}
                />
              </div>
            </div>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.28)', fontStyle: 'italic' }}>Gebruikt org-standaard</span>
          )}

          {/* Save */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {err && <span style={{ fontSize: '0.72rem', color: '#f87171' }}>⚠️ {err}</span>}
            {isSaved && !dirty && <span style={{ fontSize: '0.72rem', color: '#34d399' }}>✅ Opgeslagen</span>}
            <button onClick={() => saveRow(base, type)} disabled={!dirty || isSaving} style={{ padding: '0.38rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: dirty ? 'pointer' : 'not-allowed', transition: 'all 0.2s', background: dirty ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: dirty ? 'white' : 'rgba(255,255,255,0.25)' }}>
              {isSaving ? '⏳' : '💾 Opslaan'}
            </button>
          </div>
        </div>

        {/* Credit bar (users only) */}
        {type === 'user' && r.customQuotaEnabled && (r.maxPromptsPerMonth || 0) > 0 && (
          <div style={{ marginTop: '0.7rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.22rem' }}>
              <span>Credits gebruikt</span>
              <span style={{ color: creditPct > 85 ? '#f87171' : 'var(--text-secondary)' }}>{creditUsed} / {r.maxPromptsPerMonth} ({creditPct}%)</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${creditPct}%`, height: '100%', borderRadius: 99, transition: 'width 0.5s', background: creditPct > 85 ? '#ef4444' : creditPct > 65 ? '#f59e0b' : '#6366f1' }} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()));

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'klassen', label: '🏫 Klassen', count: classes.length },
    { key: 'personen', label: '👤 Personen', count: users.length },
    { key: 'modeltoegang', label: '🔒 Modeltoegang', count: models.length },
  ];

  return (
    <div className="panel-content">
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>⚡ Limieten & Modeltoegang</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.3rem', fontSize: '0.85rem' }}>
          Stel per klas of persoon in hoeveel credits ze mogen gebruiken.{' '}
          <strong style={{ color: 'rgba(165,180,252,0.8)' }}>De hoogste limiet wint altijd</strong>{' '}
          — organisatie → klas → persoon.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.15rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '0.55rem 1.05rem', fontSize: '0.86rem', fontWeight: tab === t.key ? 700 : 500, border: 'none', borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent', background: 'transparent', color: tab === t.key ? 'white' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s', marginBottom: '-1px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {t.label}
            {t.count !== undefined && <span style={{ fontSize: '0.67rem', padding: '0.1rem 0.38rem', borderRadius: '99px', background: tab === t.key ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)', color: tab === t.key ? '#a5b4fc' : 'var(--text-secondary)', fontWeight: 700 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ─── Klassen ──────────────────────────────────────────────────────────── */}
      {tab === 'klassen' && (
        <div>
          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '0.7rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'rgba(165,180,252,0.85)', lineHeight: 1.6 }}>
            💡 Zet <strong>"Aangepast"</strong> aan om een hogere of lagere credit-limiet voor een hele klas in te stellen. Laat uit voor de organisatie-standaard.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {classes.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Geen klassen aangemaakt.</div>}
            {classes.map(c => <QuotaCard key={c.id} base={c} type="class" />)}
          </div>
        </div>
      )}

      {/* ─── Personen ────────────────────────────────────────────────────────── */}
      {tab === 'personen' && (
        <div>
          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '0.7rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'rgba(165,180,252,0.85)', lineHeight: 1.6 }}>
            💡 Individuele overschrijving per persoon. Zet <strong>"Aangepast"</strong> uit om terug te vallen op de klas- of org-standaard.
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
            <input type="text" placeholder="🔍 Zoek persoon..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="input-field" style={{ maxWidth: '280px', padding: '0.45rem 0.8rem', fontSize: '0.85rem' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{filteredUsers.length} persoon{filteredUsers.length !== 1 ? 'en' : ''}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {filteredUsers.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Geen personen gevonden.</div>}
            {filteredUsers.map(u => <QuotaCard key={u.id} base={u} type="user" />)}
          </div>
        </div>
      )}

      {/* ─── Modeltoegang ────────────────────────────────────────────────────── */}
      {tab === 'modeltoegang' && (
        <div>
          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '0.7rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'rgba(165,180,252,0.85)', lineHeight: 1.6 }}>
            🔒 Bepaal per model wie toegang heeft. Docenten hebben altijd toegang bij "Beperkte groepen".
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {models.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Geen actieve modellen.</div>}
            {models.map(baseModel => {
              const m = getMRow(baseModel);
              const dirty = mDirty(baseModel.id);
              const isSaving = mSaving[baseModel.id];
              const isSaved = mSavedSet[baseModel.id];
              const isOpen = expanded === baseModel.id;
              const col = PROVIDER_COLOR[m.provider] || '#6366f1';
              const modeColors: Record<string, { bg: string; text: string; border: string }> = {
                all:            { bg: 'rgba(52,211,153,0.1)',  text: '#34d399', border: 'rgba(52,211,153,0.25)' },
                'teachers-only':{ bg: 'rgba(245,158,11,0.1)', text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
                restricted:     { bg: 'rgba(248,113,113,0.1)',text: '#f87171', border: 'rgba(248,113,113,0.25)' },
              };
              const mc = modeColors[m.accessMode] || modeColors.all;
              const restrictedCount = m.allowedClassIds.length + m.allowedGroupIds.length;

              return (
                <div key={baseModel.id} style={{ background: 'rgba(255,255,255,0.025)', border: dirty ? '1.5px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                  <div onClick={() => setExpanded(isOpen ? null : baseModel.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1.25rem', cursor: 'pointer' }}>
                    <span style={{ padding: '0.15rem 0.45rem', borderRadius: '5px', fontSize: '0.65rem', fontWeight: 800, background: `${col}22`, color: col, border: `1px solid ${col}40`, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{m.provider}</span>
                    <span style={{ fontWeight: 600, flex: 1, fontSize: '0.9rem' }}>{m.displayName}</span>
                    <span style={{ fontSize: '0.73rem', padding: '0.2rem 0.65rem', borderRadius: '99px', background: mc.bg, color: mc.text, border: `1px solid ${mc.border}`, fontWeight: 600, flexShrink: 0 }}>
                      {m.accessMode === 'all' ? '🌍 Iedereen' : m.accessMode === 'teachers-only' ? '👩‍🏫 Alleen docenten' : `🔒 Beperkt (${restrictedCount})`}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {isOpen && (
                    <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>Toegangsmodus</div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {[
                            { value: 'all',           label: '🌍 Iedereen',         color: '#34d399' },
                            { value: 'teachers-only', label: '👩‍🏫 Alleen docenten', color: '#f59e0b' },
                            { value: 'restricted',    label: '🔒 Beperkte groepen', color: '#f87171' },
                          ].map(opt => (
                            <button key={opt.value} onClick={() => setMField(baseModel.id, 'accessMode', opt.value)} style={{ padding: '0.42rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', border: m.accessMode === opt.value ? `1px solid ${opt.color}60` : '1px solid rgba(255,255,255,0.09)', background: m.accessMode === opt.value ? `${opt.color}18` : 'rgba(255,255,255,0.04)', color: m.accessMode === opt.value ? opt.color : 'var(--text-secondary)' }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {m.accessMode === 'restricted' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>🏫 Klassen</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '200px', overflowY: 'auto' }}>
                              {classList.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Geen klassen aangemaakt</span>}
                              {classList.map(cls => {
                                const checked = m.allowedClassIds.includes(cls.id);
                                return (
                                  <label key={cls.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.84rem', padding: '0.28rem 0.5rem', borderRadius: '7px', background: checked ? 'rgba(99,102,241,0.12)' : 'transparent', transition: 'background 0.15s' }}>
                                    <input type="checkbox" checked={checked} onChange={() => toggleId(baseModel.id, 'allowedClassIds', cls.id, baseModel)} style={{ accentColor: 'var(--primary)', width: 14, height: 14 }} />
                                    {cls.name}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>🧑‍🤝‍🧑 Groepen</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '200px', overflowY: 'auto' }}>
                              {groupList.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Geen groepen aangemaakt</span>}
                              {groupList.map(grp => {
                                const checked = m.allowedGroupIds.includes(grp.id);
                                return (
                                  <label key={grp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.84rem', padding: '0.28rem 0.5rem', borderRadius: '7px', background: checked ? 'rgba(99,102,241,0.12)' : 'transparent', transition: 'background 0.15s' }}>
                                    <input type="checkbox" checked={checked} onChange={() => toggleId(baseModel.id, 'allowedGroupIds', grp.id, baseModel)} style={{ accentColor: 'var(--primary)', width: 14, height: 14 }} />
                                    {grp.name}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem' }}>
                        {isSaved && !dirty && <span style={{ fontSize: '0.72rem', color: '#34d399' }}>✅ Opgeslagen</span>}
                        <button onClick={() => saveModel(baseModel)} disabled={!dirty || isSaving} style={{ padding: '0.42rem 1.1rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: dirty ? 'pointer' : 'not-allowed', transition: 'all 0.2s', background: dirty ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: dirty ? 'white' : 'rgba(255,255,255,0.25)' }}>
                          {isSaving ? '⏳ Opslaan...' : '💾 Toegang Opslaan'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
