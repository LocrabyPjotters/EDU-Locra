import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

interface SomtodayPanelProps {
  onClose: () => void;
}

type SomtodayTab = 'rooster' | 'cijfers' | 'huiswerk';

function formatDate(value?: string, options?: Intl.DateTimeFormatOptions) {
  if (!value) return 'Datum onbekend';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Datum onbekend';
  return date.toLocaleDateString('nl-NL', options || { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(value?: string) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

function gradeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export default function SomtodayPanel({ onClose }: SomtodayPanelProps) {
  const { token } = useAuthStore();
  const [status, setStatus] = useState<{ connected: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  // Login form state
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Data state
  const [schedule, setSchedule] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<SomtodayTab>('rooster');

  useEffect(() => {
    checkStatus();
    // The panel represents one authenticated user's connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/somtoday/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('De verbindingsstatus kon niet worden opgehaald.');
      const data = await res.json();
      setStatus(data);
      if (data.connected) {
        await fetchData();
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setStatus({ connected: false });
      setLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schRes, grRes, hwRes] = await Promise.all([
        fetch('/api/somtoday/schedule', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/somtoday/grades', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/somtoday/homework', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (schRes.ok) {
        const data = await schRes.json();
        setSchedule(Array.isArray(data) ? data : []);
      }
      if (grRes.ok) {
        const data = await grRes.json();
        setGrades(Array.isArray(data) ? data : []);
      }
      if (hwRes.ok) {
        const data = await hwRes.json();
        setHomework(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const searchSchools = async (query: string) => {
    setSchoolSearch(query);
    if (query.trim().length < 2) {
      setSchools([]);
      return;
    }
    try {
      const res = await fetch(`/api/somtoday/schools?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSchools(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setSchools([]);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSchool) {
      setLoginError('Kies eerst een school.');
      return;
    }

    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/api/somtoday/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ username, password, schoolUuid: selectedSchool.uuid })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inloggen mislukt. Controleer je gegevens.');
      setPassword('');
      await checkStatus();
    } catch (err: any) {
      setLoginError(err?.message || 'Er ging iets mis bij het koppelen.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Weet je zeker dat je SOMtoday wilt ontkoppelen?')) return;
    try {
      const res = await fetch('/api/somtoday/disconnect', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Ontkoppelen is niet gelukt.');
      setStatus({ connected: false });
      setSchedule([]);
      setGrades([]);
      setHomework([]);
      setSelectedSchool(null);
      setUsername('');
      setPassword('');
    } catch (err) {
      console.error(err);
    }
  };

  const tabs: { id: SomtodayTab; icon: string; label: string; count: number }[] = [
    { id: 'rooster', icon: '▦', label: 'Rooster', count: schedule.length },
    { id: 'cijfers', icon: '▤', label: 'Cijfers', count: grades.length },
    { id: 'huiswerk', icon: '✓', label: 'Huiswerk', count: homework.length }
  ];

  return (
    <div
      className="somtoday-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
      role="presentation"
    >
      <style>{`
        .somtoday-overlay {
          --som-bg: #f6f8fc; --som-surface: #fff; --som-text: #1d2940; --som-muted: #68758d;
          --som-border: #e5eaf3; --som-soft: #f0f3fa; --som-accent: #6157e8;
          position:fixed; inset:0; z-index:1200; padding:24px; display:flex; align-items:center; justify-content:center;
          background:rgba(13,20,38,.54); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
          animation:somtoday-fade-in .18s ease-out;
        }
        .somtoday-overlay * { box-sizing:border-box; }
        .somtoday-modal {
          width:min(960px,100%); height:min(800px,calc(100vh - 48px)); display:flex; flex-direction:column; overflow:hidden;
          color:var(--som-text); background:var(--som-bg); border:1px solid rgba(255,255,255,.6); border-radius:26px;
          box-shadow:0 30px 90px rgba(8,15,35,.3); animation:somtoday-rise-in .22s ease-out;
        }
        .somtoday-header { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:22px 26px; border-bottom:1px solid var(--som-border); background:var(--som-surface); }
        .somtoday-brand { display:flex; gap:14px; align-items:center; min-width:0; }
        .somtoday-brand-icon { width:48px; height:48px; flex-shrink:0; display:grid; place-items:center; border-radius:16px; color:#fff; font-size:22px; background:linear-gradient(135deg,#635bdf,#4bb6cf); box-shadow:0 8px 20px rgba(99,91,223,.22); }
        .somtoday-title { margin:0; font-size:19px; letter-spacing:-.035em; font-weight:800; }
        .somtoday-subtitle { margin:4px 0 0; color:var(--som-muted); font-size:12px; }
        .somtoday-header-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .somtoday-status { display:inline-flex; align-items:center; gap:7px; border-radius:999px; padding:7px 10px; font-size:11px; font-weight:750; color:#16804a; background:#e9f9f0; }
        .somtoday-status-dot { width:7px; height:7px; background:#22b96f; border-radius:50%; box-shadow:0 0 0 3px rgba(34,185,111,.12); }
        .somtoday-icon-button { width:38px; height:38px; display:grid; place-items:center; border:1px solid var(--som-border); border-radius:12px; color:var(--som-muted); background:var(--som-surface); cursor:pointer; font-size:19px; }
        .somtoday-icon-button:hover { background:var(--som-soft); color:var(--som-text); }
        .somtoday-content { flex:1; min-height:0; overflow:auto; padding:24px 26px 28px; }
        .somtoday-connect-layout { min-height:100%; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.05fr); gap:22px; align-items:stretch; }
        .somtoday-connect-hero { display:flex; flex-direction:column; justify-content:space-between; min-height:440px; padding:28px; border-radius:22px; color:#fff; overflow:hidden; position:relative; background:radial-gradient(circle at 85% 10%,rgba(116,102,255,.7),transparent 37%),linear-gradient(145deg,#202d53,#111a32 78%); }
        .somtoday-connect-hero::after { content:""; position:absolute; width:240px; height:240px; right:-80px; bottom:-100px; border:1px solid rgba(255,255,255,.12); border-radius:50%; box-shadow:0 0 0 28px rgba(255,255,255,.035),0 0 0 58px rgba(255,255,255,.025); }
        .somtoday-hero-icon { width:54px; height:54px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.2); border-radius:17px; background:rgba(255,255,255,.1); font-size:25px; }
        .somtoday-connect-hero h2 { margin:28px 0 12px; max-width:330px; font-size:clamp(25px,3vw,34px); letter-spacing:-.045em; line-height:1.12; }
        .somtoday-connect-hero p { max-width:340px; margin:0; color:rgba(255,255,255,.72); font-size:13px; line-height:1.75; }
        .somtoday-benefits { display:grid; gap:11px; margin-top:25px; }
        .somtoday-benefit { display:flex; gap:10px; align-items:center; color:rgba(255,255,255,.88); font-size:12px; }
        .somtoday-benefit span:first-child { display:grid; place-items:center; width:25px; height:25px; border-radius:8px; background:rgba(255,255,255,.1); }
        .somtoday-connect-form { padding:26px; border:1px solid var(--som-border); border-radius:22px; background:var(--som-surface); }
        .somtoday-connect-form h3 { margin:0 0 7px; font-size:20px; letter-spacing:-.03em; }
        .somtoday-form-intro { margin:0 0 22px; color:var(--som-muted); font-size:12px; line-height:1.6; }
        .somtoday-field { margin-bottom:16px; position:relative; }
        .somtoday-field label { display:block; margin-bottom:7px; color:#34415a; font-size:12px; font-weight:750; }
        .somtoday-field input { width:100%; padding:12px 13px; color:var(--som-text); background:#fafbfe; border:1px solid #dfe5ef; border-radius:11px; outline:none; font:inherit; font-size:13px; transition:border-color .18s,box-shadow .18s; }
        .somtoday-field input:focus { border-color:#8b82f1; box-shadow:0 0 0 3px rgba(99,91,223,.12); }
        .somtoday-school-results { position:absolute; top:calc(100% + 5px); left:0; right:0; z-index:12; max-height:210px; overflow:auto; padding:5px; border:1px solid var(--som-border); border-radius:13px; background:var(--som-surface); box-shadow:0 12px 30px rgba(19,30,55,.15); }
        .somtoday-school-option { width:100%; display:flex; flex-direction:column; gap:3px; padding:10px 11px; text-align:left; border:0; border-radius:9px; background:transparent; cursor:pointer; }
        .somtoday-school-option:hover { background:var(--som-soft); }
        .somtoday-school-name { font-size:12px; color:var(--som-text); font-weight:700; }
        .somtoday-school-place { font-size:11px; color:var(--som-muted); }
        .somtoday-selected-school { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:7px; padding:9px 11px; border:1px solid #d9d6ff; border-radius:10px; color:#5045c4; background:#f1f0ff; font-size:12px; font-weight:700; }
        .somtoday-primary-button { width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:12px 15px; border:0; border-radius:12px; color:#fff; background:linear-gradient(135deg,#6a5cf0,#5147d2); box-shadow:0 7px 16px rgba(92,79,218,.2); font-size:13px; font-weight:750; cursor:pointer; }
        .somtoday-primary-button:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 10px 20px rgba(92,79,218,.25); }
        .somtoday-primary-button:disabled { opacity:.55; cursor:not-allowed; box-shadow:none; }
        .somtoday-error { display:flex; gap:8px; align-items:flex-start; padding:10px 12px; margin:0 0 13px; border:1px solid #fecaca; border-radius:10px; color:#b42332; background:#fff1f2; font-size:12px; line-height:1.5; }
        .somtoday-security-note { display:flex; gap:9px; align-items:flex-start; padding-top:15px; margin-top:16px; border-top:1px solid var(--som-border); color:var(--som-muted); font-size:11px; line-height:1.6; }
        .somtoday-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-bottom:22px; }
        .somtoday-summary-card { display:flex; align-items:center; gap:12px; min-width:0; padding:14px 16px; border:1px solid var(--som-border); border-radius:16px; background:var(--som-surface); }
        .somtoday-summary-icon { width:39px; height:39px; display:grid; place-items:center; flex-shrink:0; border-radius:12px; font-size:18px; background:#f0efff; color:#5c51d8; }
        .somtoday-summary-value { font-size:19px; font-weight:850; letter-spacing:-.04em; line-height:1.1; }
        .somtoday-summary-label { margin-top:4px; color:var(--som-muted); font-size:11px; }
        .somtoday-tabs { display:flex; gap:6px; padding:5px; border:1px solid var(--som-border); border-radius:14px; background:#eceff6; margin-bottom:18px; width:max-content; max-width:100%; }
        .somtoday-tab { display:inline-flex; align-items:center; gap:8px; padding:9px 13px; border:0; border-radius:10px; background:transparent; color:#69758b; font-size:12px; font-weight:750; cursor:pointer; white-space:nowrap; }
        .somtoday-tab-count { display:grid; place-items:center; min-width:20px; height:20px; padding:0 5px; border-radius:7px; background:rgba(103,116,140,.12); font-size:10px; }
        .somtoday-tab.active { color:#5045c4; background:#fff; box-shadow:0 2px 7px rgba(23,35,61,.09); }
        .somtoday-tab.active .somtoday-tab-count { color:#5449cb; background:#efedff; }
        .somtoday-data-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
        .somtoday-data-card { min-width:0; padding:17px; border:1px solid var(--som-border); border-radius:16px; background:var(--som-surface); transition:transform .16s,border-color .16s,box-shadow .16s; }
        .somtoday-data-card:hover { transform:translateY(-1px); border-color:#d6d9ef; box-shadow:0 7px 18px rgba(27,40,74,.045); }
        .somtoday-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .somtoday-date-badge { min-width:47px; padding:7px 8px; text-align:center; color:#584ed0; background:#f0efff; border-radius:11px; font-size:10px; font-weight:800; }
        .somtoday-date-badge strong { display:block; margin-bottom:2px; font-size:17px; line-height:1.1; }
        .somtoday-card-title { margin:0; color:var(--som-text); font-size:13px; font-weight:800; line-height:1.45; overflow-wrap:anywhere; }
        .somtoday-card-subtitle { margin-top:4px; color:var(--som-muted); font-size:11px; line-height:1.5; }
        .somtoday-time { margin-top:12px; padding-top:10px; border-top:1px solid #edf0f5; color:#526078; font-size:11px; font-weight:750; }
        .somtoday-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; }
        .somtoday-chip { display:inline-flex; align-items:center; gap:4px; padding:5px 8px; border-radius:8px; background:var(--som-soft); color:#5d6981; font-size:10px; font-weight:700; }
        .somtoday-grade { min-width:47px; text-align:center; padding:9px 8px; border-radius:12px; font-size:18px; font-weight:900; letter-spacing:-.035em; }
        .somtoday-grade.pass { color:#16804a; background:#e8f9ef; }
        .somtoday-grade.low { color:#c43146; background:#fff0f2; }
        .somtoday-grade.unknown { color:#64748b; background:#f0f3f8; }
        .somtoday-homework-status { display:inline-flex; gap:5px; align-items:center; padding:5px 8px; border-radius:999px; font-size:10px; font-weight:800; white-space:nowrap; }
        .somtoday-homework-status.done { color:#16804a; background:#e8f9ef; }
        .somtoday-homework-status.open { color:#6552c9; background:#f0efff; }
        .somtoday-homework-description { margin-top:13px; padding:11px 12px; border:1px solid #edf0f5; border-radius:11px; background:#fafbfe; color:#66728a; font-size:11px; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere; }
        .somtoday-empty { display:flex; flex-direction:column; align-items:center; text-align:center; padding:48px 20px; border:1px dashed #d6deeb; border-radius:18px; background:rgba(255,255,255,.55); }
        .somtoday-empty-icon { width:48px; height:48px; display:grid; place-items:center; border-radius:15px; color:#685de2; background:#eeedff; font-size:21px; }
        .somtoday-empty h3 { margin:13px 0 5px; font-size:14px; }
        .somtoday-empty p { max-width:290px; margin:0; color:var(--som-muted); font-size:12px; line-height:1.65; }
        .somtoday-loading { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; min-height:220px; color:var(--som-muted); font-size:12px; }
        .somtoday-spinner { width:30px; height:30px; border:3px solid #e2e7f0; border-top-color:var(--som-accent); border-radius:50%; animation:somtoday-spin .75s linear infinite; }
        .somtoday-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 26px; border-top:1px solid var(--som-border); color:var(--som-muted); background:var(--som-surface); font-size:10px; }
        @keyframes somtoday-spin { to { transform:rotate(360deg); } }
        @keyframes somtoday-fade-in { from { opacity:0; } to { opacity:1; } }
        @keyframes somtoday-rise-in { from { opacity:0; transform:translateY(8px) scale(.99); } to { opacity:1; transform:translateY(0) scale(1); } }
        @media(max-width:760px) {
          .somtoday-overlay { padding:9px; }
          .somtoday-modal { height:calc(100dvh - 18px); border-radius:20px; }
          .somtoday-header { padding:15px 16px; }
          .somtoday-brand-icon { width:41px; height:41px; border-radius:13px; }
          .somtoday-title { font-size:17px; }
          .somtoday-subtitle { font-size:10px; }
          .somtoday-status { display:none; }
          .somtoday-content { padding:15px; }
          .somtoday-connect-layout { grid-template-columns:1fr; gap:13px; }
          .somtoday-connect-hero { min-height:auto; padding:20px; }
          .somtoday-connect-hero h2 { margin:15px 0 8px; font-size:25px; }
          .somtoday-connect-hero p { font-size:12px; }
          .somtoday-benefits { grid-template-columns:1fr; gap:7px; margin-top:17px; }
          .somtoday-benefit { font-size:11px; }
          .somtoday-connect-form { padding:20px; }
          .somtoday-summary { gap:7px; margin-bottom:15px; }
          .somtoday-summary-card { display:block; padding:10px; }
          .somtoday-summary-icon { width:30px; height:30px; margin-bottom:8px; font-size:14px; }
          .somtoday-summary-value { font-size:17px; }
          .somtoday-summary-label { font-size:10px; }
          .somtoday-tabs { width:100%; justify-content:stretch; }
          .somtoday-tab { flex:1; justify-content:center; gap:5px; padding:9px 6px; font-size:11px; }
          .somtoday-tab-count { display:none; }
          .somtoday-data-list { grid-template-columns:1fr; }
          .somtoday-footer { padding:11px 15px; }
        }
        @media(max-width:390px) {
          .somtoday-header-actions { gap:5px; }
          .somtoday-connect-form { padding:16px; }
          .somtoday-summary-label { line-height:1.25; }
        }
        @media(prefers-reduced-motion:reduce) { .somtoday-overlay *, .somtoday-overlay *::before, .somtoday-overlay *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
      `}</style>

      <section className="somtoday-modal" role="dialog" aria-modal="true" aria-labelledby="somtoday-heading">
        <header className="somtoday-header">
          <div className="somtoday-brand">
            <div className="somtoday-brand-icon" aria-hidden="true">▦</div>
            <div style={{ minWidth: 0 }}>
              <h2 className="somtoday-title" id="somtoday-heading">SOMtoday</h2>
              <p className="somtoday-subtitle">Jouw schooldag, overzichtelijk bij elkaar</p>
            </div>
          </div>
          <div className="somtoday-header-actions">
            {status?.connected && (
              <>
                <span className="somtoday-status"><span className="somtoday-status-dot" /> Verbonden</span>
                <button type="button" className="somtoday-icon-button" onClick={handleDisconnect} title="SOMtoday ontkoppelen" aria-label="SOMtoday ontkoppelen">⤫</button>
              </>
            )}
            <button type="button" className="somtoday-icon-button" onClick={onClose} aria-label="Paneel sluiten" title="Sluiten">×</button>
          </div>
        </header>

        {loading && !status ? (
          <div className="somtoday-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="somtoday-loading" role="status">
              <div className="somtoday-spinner" />
              <span>Verbinding met SOMtoday controleren…</span>
            </div>
          </div>
        ) : !status?.connected ? (
          <div className="somtoday-content">
            <div className="somtoday-connect-layout">
              <section className="somtoday-connect-hero">
                <div>
                  <div className="somtoday-hero-icon" aria-hidden="true">🎓</div>
                  <h2>Je schoolwerk. Eén helder overzicht.</h2>
                  <p>Koppel je SOMtoday-account om je rooster, cijfers en huiswerk direct bij de hand te hebben terwijl je met Locra werkt.</p>
                </div>
                <div className="somtoday-benefits">
                  <div className="somtoday-benefit"><span>▦</span><span>Bekijk je lessen en tijden</span></div>
                  <div className="somtoday-benefit"><span>↗</span><span>Houd je cijfers overzichtelijk</span></div>
                  <div className="somtoday-benefit"><span>✓</span><span>Zie welk huiswerk nog openstaat</span></div>
                </div>
              </section>

              <form className="somtoday-connect-form" onSubmit={handleLogin}>
                <h3>Account koppelen</h3>
                <p className="somtoday-form-intro">Zoek je school en vul daarna je inloggegevens in.</p>

                <div className="somtoday-field">
                  <label htmlFor="somtoday-school">School</label>
                  <input
                    id="somtoday-school"
                    type="text"
                    placeholder="Zoek op schoolnaam of plaats…"
                    autoComplete="organization"
                    value={selectedSchool ? selectedSchool.naam : schoolSearch}
                    onChange={(event) => {
                      setSelectedSchool(null);
                      searchSchools(event.target.value);
                    }}
                    required
                    aria-autocomplete="list"
                    aria-expanded={!selectedSchool && schools.length > 0}
                  />
                  {!selectedSchool && schools.length > 0 && (
                    <div className="somtoday-school-results" role="listbox" aria-label="Gevonden scholen">
                      {schools.map(school => (
                        <button
                          key={school.uuid}
                          type="button"
                          className="somtoday-school-option"
                          role="option"
                          aria-selected={false}
                          onClick={() => {
                            setSelectedSchool(school);
                            setSchoolSearch(school.naam);
                            setSchools([]);
                          }}
                        >
                          <span className="somtoday-school-name">{school.naam}</span>
                          <span className="somtoday-school-place">{school.plaats || 'Plaats niet vermeld'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedSchool && (
                    <div className="somtoday-selected-school">
                      <span>✓ {selectedSchool.naam}{selectedSchool.plaats ? ` · ${selectedSchool.plaats}` : ''}</span>
                      <button type="button" onClick={() => { setSelectedSchool(null); setSchoolSearch(''); }} aria-label="Schoolkeuze wijzigen" style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>Wijzigen</button>
                    </div>
                  )}
                </div>

                <div className="somtoday-field">
                  <label htmlFor="somtoday-username">Gebruikersnaam</label>
                  <input id="somtoday-username" type="text" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required />
                </div>

                <div className="somtoday-field">
                  <label htmlFor="somtoday-password">Wachtwoord</label>
                  <input id="somtoday-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
                </div>

                {loginError && <div className="somtoday-error" role="alert"><span aria-hidden="true">⚠</span><span>{loginError}</span></div>}

                <button type="submit" className="somtoday-primary-button" disabled={loggingIn || !selectedSchool}>
                  {loggingIn ? <><span className="somtoday-spinner" style={{ width: 15, height: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,.35)', borderTopColor: '#fff' }} /> Bezig met koppelen…</> : <>Koppel SOMtoday <span aria-hidden="true">→</span></>}
                </button>

                <div className="somtoday-security-note">
                  <span aria-hidden="true">🔐</span>
                  <span>Gebruik je gebruikelijke SOMtoday-inloggegevens. Deel ze niet met anderen. Je kunt de koppeling later vanuit dit paneel weer verbreken.</span>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <>
            <div className="somtoday-content">
              <div className="somtoday-summary" aria-label="Aantal onderdelen">
                <div className="somtoday-summary-card"><div className="somtoday-summary-icon">▦</div><div><div className="somtoday-summary-value">{schedule.length}</div><div className="somtoday-summary-label">Roosteritems</div></div></div>
                <div className="somtoday-summary-card"><div className="somtoday-summary-icon">↗</div><div><div className="somtoday-summary-value">{grades.length}</div><div className="somtoday-summary-label">Cijfers</div></div></div>
                <div className="somtoday-summary-card"><div className="somtoday-summary-icon">✓</div><div><div className="somtoday-summary-value">{homework.filter(item => !item.afgerond).length}</div><div className="somtoday-summary-label">Open huiswerktaken</div></div></div>
              </div>

              <nav className="somtoday-tabs" aria-label="SOMtoday onderdelen" role="tablist">
                {tabs.map(tab => (
                  <button
                    type="button"
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={`somtoday-tab ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span aria-hidden="true">{tab.icon}</span><span>{tab.label}</span><span className="somtoday-tab-count">{tab.count}</span>
                  </button>
                ))}
              </nav>

              {loading ? (
                <div className="somtoday-loading" role="status"><div className="somtoday-spinner" /><span>Je schoolgegevens worden opgehaald…</span></div>
              ) : (
                <>
                  {activeTab === 'rooster' && (
                    schedule.length === 0 ? (
                      <div className="somtoday-empty"><div className="somtoday-empty-icon">▦</div><h3>Geen rooster gevonden</h3><p>Er zijn op dit moment geen roosteritems beschikbaar om te tonen.</p></div>
                    ) : (
                      <div className="somtoday-data-list">
                        {schedule.map((item, index) => {
                          const start = item.beginDatumTijd ? new Date(item.beginDatumTijd) : null;
                          const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
                          return (
                            <article className="somtoday-data-card" key={item.id || `${item.titel || 'les'}-${item.beginDatumTijd || index}`}>
                              <div className="somtoday-card-top">
                                <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                                  <div className="somtoday-date-badge">
                                    <strong>{validStart ? validStart.toLocaleDateString('nl-NL', { day: '2-digit' }) : '—'}</strong>
                                    {validStart ? validStart.toLocaleDateString('nl-NL', { month: 'short' }) : 'Datum'}
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <h3 className="somtoday-card-title">{item.titel || 'Les zonder titel'}</h3>
                                    <div className="somtoday-card-subtitle">{formatDate(item.beginDatumTijd)}</div>
                                  </div>
                                </div>
                              </div>
                              <div className="somtoday-time">◷ {formatTime(item.beginDatumTijd)} – {formatTime(item.eindDatumTijd)}</div>
                              {(item.vakNamen?.length > 0 || item.locatie) && (
                                <div className="somtoday-chips">
                                  {item.vakNamen?.map((subject: string) => <span key={subject} className="somtoday-chip">{subject}</span>)}
                                  {item.locatie && <span className="somtoday-chip">⌖ {item.locatie}</span>}
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )
                  )}

                  {activeTab === 'cijfers' && (
                    grades.length === 0 ? (
                      <div className="somtoday-empty"><div className="somtoday-empty-icon">↗</div><h3>Nog geen cijfers gevonden</h3><p>Als er cijfers beschikbaar zijn in SOMtoday, verschijnen ze hier.</p></div>
                    ) : (
                      <div className="somtoday-data-list">
                        {grades.map((item, index) => {
                          const numericGrade = gradeNumber(item.resultaat);
                          const gradeClass = numericGrade === null ? 'unknown' : numericGrade < 5.5 ? 'low' : 'pass';
                          return (
                            <article className="somtoday-data-card" key={item.id || `${item.vak || 'vak'}-${item.datumInvoer || index}`}>
                              <div className="somtoday-card-top">
                                <div style={{ minWidth: 0 }}>
                                  <h3 className="somtoday-card-title">{item.vak || 'Vak niet vermeld'}</h3>
                                  <div className="somtoday-card-subtitle">{item.omschrijving || item.type || 'Resultaat'}</div>
                                  {item.datumInvoer && <div className="somtoday-card-subtitle" style={{ marginTop: 8 }}>Ingevoerd op {formatDate(item.datumInvoer, { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                                </div>
                                <div className={`somtoday-grade ${gradeClass}`} aria-label={numericGrade === null ? 'Geen numeriek cijfer' : `Cijfer ${item.resultaat}`}>{item.resultaat ?? '—'}</div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )
                  )}

                  {activeTab === 'huiswerk' && (
                    homework.length === 0 ? (
                      <div className="somtoday-empty"><div className="somtoday-empty-icon">✓</div><h3>Geen huiswerk gevonden</h3><p>Er is geen huiswerk beschikbaar om in dit overzicht te tonen.</p></div>
                    ) : (
                      <div className="somtoday-data-list">
                        {homework.map((item, index) => (
                          <article className="somtoday-data-card" key={item.id || `${item.vak || 'vak'}-${item.titel || index}`}>
                            <div className="somtoday-card-top">
                              <div style={{ minWidth: 0 }}>
                                <div className="somtoday-card-subtitle" style={{ marginTop: 0, marginBottom: 5 }}>{item.vak || 'Vak niet vermeld'}</div>
                                <h3 className="somtoday-card-title">{item.titel || 'Huiswerk'}</h3>
                              </div>
                              <span className={`somtoday-homework-status ${item.afgerond ? 'done' : 'open'}`}>{item.afgerond ? '✓ Afgerond' : '○ Openstaand'}</span>
                            </div>
                            {item.omschrijving && <div className="somtoday-homework-description">{String(item.omschrijving).replace(/<[^>]*>?/gm, '')}</div>}
                          </article>
                        ))}
                      </div>
                    )
                  )}
                </>
              )}
            </div>
            <footer className="somtoday-footer">
              <span><span aria-hidden="true">🔒</span> Alleen jouw gekoppelde schoolgegevens</span>
              <button type="button" onClick={fetchData} style={{ padding: '5px 9px', border: '1px solid var(--som-border)', borderRadius: 8, background: 'var(--som-surface)', color: 'var(--som-muted)', fontSize: 10, fontWeight: 750, cursor: 'pointer' }}>↻ Vernieuwen</button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
