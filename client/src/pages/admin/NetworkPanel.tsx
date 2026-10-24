import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { QRCodeSVG } from 'qrcode.react';

interface NetworkStats {
  total: number;
  lastHour: number;
  last24h: number;
  errors: number;
  errorRate: number;
  avgDurationMs: number;
  totalDataOutBytes: number;
  totalDataInBytes: number;
  byCategory: Record<string, number>;
  topHosts: { host: string; count: number; category: string }[];
}

interface ServerInfo {
  hostname: string;
  platform: string;
  arch: string;
  uptime: number;
  uptimeFormatted: string;
  nodeVersion: string;
  networkInterfaces: { name: string; address: string; family: string; internal: boolean }[];
  publicUrl: string | null;
  serverPort: number;
}

interface Connection {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'active' | 'connected' | 'not-configured' | 'error';
  details: string;
  type: string;
  host?: string;
}

interface OutgoingRequest {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  hostname: string;
  port: number | string;
  path: string;
  protocol: string;
  statusCode?: number;
  durationMs?: number;
  requestBodySize?: number;
  responseBodySize?: number;
  error?: string;
  category: string;
}

interface PairedDevice {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  deviceName: string;
  devicePlatform: string;
  appVersion: string;
  pairedAt: string;
  lastActiveAt: string;
  isActive: boolean;
}

interface HubStatus {
  upstreamUrl: string;
  online: boolean;
  latencyMs: number;
  status: 'active' | 'grace_period' | 'locked' | 'unlicensed';
  tier: string;
  schoolName: string;
  licenseKeyMasked: string;
  maxUsers: number;
  expiresAt: string | null;
  lastVerifiedAt: string | null;
  nextScheduledCheck: string | null;
  daysUntilNextCheck: number;
  graceDaysRemaining: number | null;
  autoCheckIntervalMonths: number;
  autoCheckIntervalDays: number;
  gracePeriodDays: number;
  lastError?: string;
  privacyNotice: {
    transmitted: string[];
    strictlyBlocked: string[];
    e2eSecurity: string;
  };
}

interface IpSecurityData {
  clientIp: string;
  ipWhitelistEnabled: boolean;
  allowedIps: string[];
  blockedIps: string[];
  serverIps: { name: string; address: string; family: string }[];
}

interface ConnectInfoData {
  orgName: string;
  slug: string;
  connectCode: string;
  detectedUrl: string;
  publicServerUrl: string;
  enableLocraConnect: boolean;
  primaryColor: string;
  logoUrl?: string;
  licenseKeyMasked?: string;
  isRegisteredInHub: boolean;
  hubRecord?: any;
}

type TabId = 'overview' | 'hub' | 'ip-security' | 'locra-connect' | 'connections' | 'requests' | 'devices';

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  'ai-provider': { label: 'AI Provider', color: '#a78bfa', icon: '🤖' },
  'federation': { label: 'Federatie', color: '#06b6d4', icon: '🌐' },
  'external': { label: 'Extern', color: '#f97316', icon: '🔗' },
  'internal': { label: 'Intern', color: '#64748b', icon: '🏠' },
  'webhook': { label: 'Webhook', color: '#22c55e', icon: '🔔' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'active': { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', dot: '#22c55e' },
  'connected': { bg: 'rgba(99,102,241,0.12)', text: '#818cf8', dot: '#818cf8' },
  'not-configured': { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', dot: '#64748b' },
  'error': { bg: 'rgba(239,68,68,0.12)', text: '#f87171', dot: '#ef4444' },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getStatusCodeColor(code?: number): string {
  if (!code) return '#64748b';
  if (code < 300) return '#22c55e';
  if (code < 400) return '#f59e0b';
  return '#ef4444';
}

function getMethodColor(method: string): string {
  const m: Record<string, string> = {
    GET: '#22c55e', POST: '#6366f1', PUT: '#f59e0b',
    DELETE: '#ef4444', PATCH: '#8b5cf6', HEAD: '#64748b'
  };
  return m[method] || '#94a3b8';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Nog niet uitgevoerd';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('nl-NL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

export default function NetworkPanel() {
  const token = useAuthStore(state => state.token);
  const [tab, setTab] = useState<TabId>('overview');
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [requests, setRequests] = useState<OutgoingRequest[]>([]);
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [hubStatus, setHubStatus] = useState<HubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingLicense, setVerifyingLicense] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const [reqFilter, setReqFilter] = useState<{ category: string; search: string; status: string }>({ category: 'all', search: '', status: 'all' });
  const [reqPage, setReqPage] = useState(1);
  const [reqTotal, setReqTotal] = useState(0);
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);

  // IP Security & Schoolnetwerk Restrictie
  const [ipSecData, setIpSecData] = useState<IpSecurityData | null>(null);
  const [ipWhitelistEnabled, setIpWhitelistEnabled] = useState(false);
  const [allowedIps, setAllowedIps] = useState<string[]>([]);
  const [blockedIps, setBlockedIps] = useState<string[]>([]);
  const [newAllowedIp, setNewAllowedIp] = useState('');
  const [newBlockedIp, setNewBlockedIp] = useState('');
  const [savingIpSec, setSavingIpSec] = useState(false);
  const [ipSecMsg, setIpSecMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testSimIp, setTestSimIp] = useState('');
  const [testSimResult, setTestSimResult] = useState<{ allowed: boolean; reason?: string } | null>(null);

  // Locra Connect Discovery & Directory
  const [connectData, setConnectData] = useState<ConnectInfoData | null>(null);
  const [connectCodeInput, setConnectCodeInput] = useState('');
  const [publicUrlInput, setPublicUrlInput] = useState('');
  const [enableConnectToggle, setEnableConnectToggle] = useState(true);
  const [savingConnect, setSavingConnect] = useState(false);
  const [connectMsg, setConnectMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [testSearching, setTestSearching] = useState(false);
  const [testSearchResults, setTestSearchResults] = useState<any[] | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/network/stats', { headers });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setServerInfo(data.server);
      }
    } catch (e) { console.error('Stats fetch error:', e); }
  }, [token]);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/network/connections', { headers });
      const data = await res.json();
      if (data.success) setConnections(data.connections);
    } catch (e) { console.error('Connections error:', e); }
  }, [token]);

  const fetchHubStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/network/license/hub-info', { headers });
      const data = await res.json();
      if (data.success) setHubStatus(data.hub);
    } catch (e) { console.error('Hub info error:', e); }
  }, [token]);

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(reqPage),
        limit: '30',
        ...(reqFilter.category !== 'all' && { category: reqFilter.category }),
        ...(reqFilter.search && { search: reqFilter.search }),
        ...(reqFilter.status !== 'all' && { status: reqFilter.status }),
      });
      const res = await fetch(`/api/network/requests?${params}`, { headers });
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests);
        setReqTotal(data.pagination.total);
      }
    } catch (e) { console.error('Requests error:', e); }
  }, [token, reqPage, reqFilter]);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/network/devices', { headers });
      const data = await res.json();
      if (data.success) setDevices(data.devices);
    } catch (e) { console.error('Devices error:', e); }
  }, [token]);

  const handleVerifyNow = async () => {
    setVerifyingLicense(true);
    setVerifyMsg(null);
    try {
      const res = await fetch('/api/network/license/verify', {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (data.success) {
        setVerifyMsg({ type: 'success', text: data.message || 'Licentie succesvol geverifieerd via api.rowmatch.nl!' });
        if (data.hub) setHubStatus(data.hub);
        else fetchHubStatus();
      } else {
        setVerifyMsg({ type: 'error', text: data.error || data.message || 'Verificatie mislukt.' });
      }
    } catch (e: any) {
      setVerifyMsg({ type: 'error', text: 'Netwerkfout bij verbinden met server: ' + e.message });
    } finally {
      setVerifyingLicense(false);
      setTimeout(() => setVerifyMsg(null), 6000);
    }
  };

  const fetchIpSecurity = useCallback(async () => {
    try {
      const res = await fetch('/api/network/ip-security', { headers });
      const data = await res.json();
      if (data.success) {
        setIpSecData(data);
        setIpWhitelistEnabled(data.ipWhitelistEnabled);
        setAllowedIps(data.allowedIps || []);
        setBlockedIps(data.blockedIps || []);
        if (!testSimIp && data.clientIp) setTestSimIp(data.clientIp);
      }
    } catch (e) { console.error('IP security fetch error:', e); }
  }, [token]);

  const handleSaveIpSecurity = async () => {
    setSavingIpSec(true);
    setIpSecMsg(null);
    try {
      const res = await fetch('/api/network/ip-security', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipWhitelistEnabled,
          allowedIps,
          blockedIps
        })
      });
      const data = await res.json();
      if (data.success) {
        setIpSecMsg({ type: 'success', text: '✓ IP-toegangsregels succesvol opgeslagen en direct geactiveerd!' });
        fetchIpSecurity();
      } else {
        setIpSecMsg({ type: 'error', text: data.error || 'Fout bij opslaan van IP-regels.' });
      }
    } catch (e: any) {
      setIpSecMsg({ type: 'error', text: 'Netwerkfout: ' + e.message });
    } finally {
      setSavingIpSec(false);
      setTimeout(() => setIpSecMsg(null), 5000);
    }
  };

  const handleAddAllowedIp = (ipToAdd?: string) => {
    const val = (ipToAdd || newAllowedIp).trim();
    if (!val) return;
    if (!allowedIps.includes(val)) {
      setAllowedIps([...allowedIps, val]);
    }
    setNewAllowedIp('');
  };

  const handleRemoveAllowedIp = (ip: string) => {
    if (ip === '127.0.0.1' || ip === '::1') {
      alert('Localhost (127.0.0.1 / ::1) kan niet worden verwijderd om zelf-buitensluiting van de server te voorkomen.');
      return;
    }
    setAllowedIps(allowedIps.filter(i => i !== ip));
  };

  const handleAddBlockedIp = () => {
    const val = newBlockedIp.trim();
    if (!val) return;
    if (val === '127.0.0.1' || val === '::1') {
      alert('Localhost kan niet worden geblokkeerd.');
      return;
    }
    if (!blockedIps.includes(val)) {
      setBlockedIps([...blockedIps, val]);
    }
    setNewBlockedIp('');
  };

  const handleRemoveBlockedIp = (ip: string) => {
    setBlockedIps(blockedIps.filter(i => i !== ip));
  };

  const handleAddCurrentIp = () => {
    if (ipSecData?.clientIp) {
      handleAddAllowedIp(ipSecData.clientIp);
    }
  };

  const handleSimulateIpCheck = () => {
    const ip = testSimIp.trim();
    if (!ip) return;

    // Check blacklist first
    const isBlocked = blockedIps.some(b => b === ip || (b.includes('/') && ip.startsWith(b.split('/')[0].slice(0, 7))));
    if (isBlocked) {
      setTestSimResult({ allowed: false, reason: `IP ${ip} staat op de zwarte lijst (geblokkeerd).` });
      return;
    }

    if (!ipWhitelistEnabled) {
      setTestSimResult({ allowed: true, reason: `IP ${ip} heeft toegang (whitelist-modus staat uit).` });
      return;
    }

    if (ip === '127.0.0.1' || ip === '::1') {
      setTestSimResult({ allowed: true, reason: `IP ${ip} heeft toegang (Localhost bypass).` });
      return;
    }

    const isWhitelisted = allowedIps.some(a => a === ip || (a.includes('/') && ip.startsWith(a.split('/')[0].slice(0, 7))));
    if (isWhitelisted) {
      setTestSimResult({ allowed: true, reason: `IP ${ip} heeft toegang (Whitelisted schoolnetwerk).` });
    } else {
      setTestSimResult({ allowed: false, reason: `IP ${ip} wordt GEWEIGERD (niet in whitelist).` });
    }
  };

  const fetchConnectInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/network/connect-info', { headers });
      const data = await res.json();
      if (data.success) {
        setConnectData(data);
        setConnectCodeInput(data.connectCode || '');
        setPublicUrlInput(data.publicServerUrl || data.detectedUrl || '');
        setEnableConnectToggle(data.enableLocraConnect ?? true);
        if (!testSearchQuery) setTestSearchQuery(data.connectCode || '');
      }
    } catch (e) { console.error('Connect info fetch error:', e); }
  }, [token]);

  const handleSaveConnect = async () => {
    setSavingConnect(true);
    setConnectMsg(null);
    try {
      const res = await fetch('/api/network/connect-register', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectCode: connectCodeInput,
          publicServerUrl: publicUrlInput,
          enableLocraConnect: enableConnectToggle
        })
      });
      const data = await res.json();
      if (data.success) {
        setConnectMsg({
          type: 'success',
          text: `✓ Locra Connect bijgewerkt! ${data.hubSyncMessage || ''}`
        });
        fetchConnectInfo();
      } else {
        setConnectMsg({ type: 'error', text: data.error || 'Fout bij opslaan Locra Connect.' });
      }
    } catch (e: any) {
      setConnectMsg({ type: 'error', text: 'Netwerkfout: ' + e.message });
    } finally {
      setSavingConnect(false);
      setTimeout(() => setConnectMsg(null), 6000);
    }
  };

  const handleTestSearchConnect = async () => {
    const q = testSearchQuery.trim();
    if (!q) return;
    setTestSearching(true);
    setTestSearchResults(null);
    try {
      const res = await fetch('/api/network/connect-test', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      const data = await res.json();
      if (res.ok) {
        setTestSearchResults(data.results || []);
      } else {
        alert(data.error || 'Zoektest mislukt');
      }
    } catch (e: any) {
      alert('Fout bij zoeken: ' + e.message);
    } finally {
      setTestSearching(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchConnections(), fetchDevices(), fetchHubStatus(), fetchIpSecurity(), fetchConnectInfo()])
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'requests') fetchRequests();
    if (tab === 'hub') fetchHubStatus();
    if (tab === 'ip-security') fetchIpSecurity();
    if (tab === 'locra-connect') fetchConnectInfo();
  }, [tab, reqPage, reqFilter]);

  // Auto-refresh stats every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (tab === 'overview') {
        fetchStats();
        fetchHubStatus();
      }
      if (tab === 'requests') fetchRequests();
      if (tab === 'hub') fetchHubStatus();
      if (tab === 'ip-security') fetchIpSecurity();
      if (tab === 'locra-connect') fetchConnectInfo();
    }, 15000);
    return () => clearInterval(interval);
  }, [tab]);

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Weet je zeker dat je dit apparaat wilt ontkoppelen?')) return;
    try {
      await fetch(`/api/network/devices/${deviceId}`, { method: 'DELETE', headers });
      fetchDevices();
    } catch (e) { console.error(e); }
  };

  const copyLicenseKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const tabItems: { id: TabId; label: string; icon: string; badge?: string }[] = [
    { id: 'overview', label: 'Overzicht', icon: '📊' },
    { id: 'hub', label: 'RowMatch Hub & Licentie', icon: '⚡', badge: hubStatus?.status === 'grace_period' ? 'Waarschuwing' : undefined },
    { id: 'ip-security', label: 'IP & Schoolnetwerk', icon: '🛡️', badge: ipSecData?.ipWhitelistEnabled ? 'Beveiligd' : undefined },
    { id: 'locra-connect', label: 'Locra Connect', icon: '📱', badge: connectData?.isRegisteredInHub ? 'Vindbaar' : undefined },
    { id: 'connections', label: 'Verbindingen', icon: '🔗' },
    { id: 'requests', label: 'Uitgaande Verzoeken', icon: '📡' },
    { id: 'devices', label: 'Apparaten', icon: '💻' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'pulse 2s ease-in-out infinite' }}>🌐</div>
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>Netwerkgegevens laden...</div>
        </div>
      </div>
    );
  }

  // Calculate 90-day progress
  const daysProgressPct = hubStatus ? Math.min(100, Math.max(0, Math.round(((90 - hubStatus.daysUntilNextCheck) / 90) * 100))) : 0;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 30px rgba(99,102,241,0.3)', fontSize: '1.5rem'
          }}>🌐</div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', margin: 0 }}>Netwerk & Systeembeheer</h1>
            <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0, fontSize: '0.9rem' }}>
              api.rowmatch.nl verbinding, 3-maandelijkse licentiecontrole, uitgaand dataverkeer en mobiele apparaten
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '1.5rem',
        background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '4px',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        {tabItems.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '0.65rem 1rem', borderRadius: '10px',
              border: 'none', cursor: 'pointer',
              background: tab === t.id ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(6,182,212,0.1))' : 'transparent',
              color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.45)',
              fontWeight: tab === t.id ? 700 : 500, fontSize: '0.85rem',
              transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              position: 'relative',
              ...(tab === t.id && { boxShadow: '0 0 20px rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' })
            }}
          >
            <span>{t.icon}</span> {t.label}
            {t.badge && (
              <span style={{
                background: '#f59e0b', color: '#000', fontSize: '0.65rem',
                fontWeight: 800, padding: '1px 6px', borderRadius: '10px'
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && stats && (
        <div>
          {/* RowMatch Hub Banner Card */}
          {hubStatus && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(6,182,212,0.08))',
              borderRadius: '16px', padding: '1.25rem 1.5rem',
              border: '1px solid rgba(99,102,241,0.25)', marginBottom: '1.5rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: 'rgba(99,102,241,0.2)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem'
                }}>⚡</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontWeight: 800, color: '#fff', fontSize: '1.05rem' }}>api.rowmatch.nl Centrale Server</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                      background: hubStatus.online ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: hubStatus.online ? '#22c55e' : '#f87171'
                    }}>
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: hubStatus.online ? '#22c55e' : '#ef4444',
                        boxShadow: hubStatus.online ? '0 0 6px #22c55e' : 'none'
                      }} />
                      {hubStatus.online ? `Verbonden (${hubStatus.latencyMs}ms)` : 'Offline'}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                      background: 'rgba(99,102,241,0.2)', color: '#818cf8', textTransform: 'uppercase'
                    }}>
                      {hubStatus.tier}
                    </span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                    Volgende automatische 3-maandelijkse controle over <strong style={{ color: '#06b6d4' }}>{hubStatus.daysUntilNextCheck} dagen</strong> ({formatDate(hubStatus.nextScheduledCheck)})
                  </div>
                </div>
              </div>
              <button
                onClick={() => setTab('hub')}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', padding: '0.55rem 1rem', borderRadius: '10px',
                  cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              >
                Hub & Licentie Details ➔
              </button>
            </div>
          )}

          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { label: 'Totaal Verzoeken', value: stats.total, sub: `${stats.lastHour} afgelopen uur`, icon: '📡', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))' },
              { label: 'Gemiddelde Duur', value: formatDuration(stats.avgDurationMs), sub: `${stats.last24h} verzoeken vandaag`, icon: '⚡', gradient: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(6,182,212,0.05))' },
              { label: 'Foutpercentage', value: `${stats.errorRate}%`, sub: `${stats.errors} fouten`, icon: '⚠️', gradient: stats.errorRate > 10 ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))' : 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))' },
              { label: 'Data Verstuurd', value: formatBytes(stats.totalDataOutBytes), sub: `${formatBytes(stats.totalDataInBytes)} ontvangen`, icon: '📤', gradient: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(167,139,250,0.05))' },
            ].map((card, i) => (
              <div key={i} style={{
                background: card.gradient, borderRadius: '16px', padding: '1.25rem',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: '1rem'
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.08)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem'
                }}>{card.icon}</div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', fontWeight: 500 }}>{card.label}</div>
                  <div style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800 }}>{card.value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' }}>{card.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Server Info & Traffic Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {/* Server Specs */}
            {serverInfo && (
              <div style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '1.5rem',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🖥️ Server Informatie
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    { label: 'Hostnaam', value: serverInfo.hostname },
                    { label: 'Platform', value: `${serverInfo.platform} (${serverInfo.arch})` },
                    { label: 'Node.js Versie', value: serverInfo.nodeVersion },
                    { label: 'Uptime', value: serverInfo.uptimeFormatted },
                    { label: 'Server Poort', value: String(serverInfo.serverPort) },
                    { label: 'Publieke URL', value: serverInfo.publicUrl || 'Niet ingesteld (gebruikt lokaal IP)' },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>{row.label}</span>
                      <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Traffic Categories */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '1.5rem',
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📊 Verkeer per Categorie
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(CATEGORY_LABELS).map(([catKey, info]) => {
                  const count = stats.byCategory[catKey] || 0;
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={catKey}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                          {info.icon} {info.label}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '3px',
                          background: `linear-gradient(90deg, ${info.color}, ${info.color}80)`,
                          width: `${pct}%`, transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top Hosts */}
              {stats.topHosts.length > 0 && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Bestemmingen</span>
                  {stats.topHosts.slice(0, 5).map((h, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', alignItems: 'center' }}>
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontFamily: 'monospace' }}>{h.host}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                        color: (CATEGORY_LABELS[h.category] || { color: '#94a3b8' }).color,
                        background: `${(CATEGORY_LABELS[h.category] || { color: '#94a3b8' }).color}18`
                      }}>{h.count}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── RowMatch Hub & Licentie Tab (NEW!) ── */}
      {tab === 'hub' && hubStatus && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Feedback banner */}
          {verifyMsg && (
            <div style={{
              padding: '1rem 1.25rem', borderRadius: '12px',
              background: verifyMsg.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${verifyMsg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: verifyMsg.type === 'success' ? '#4ade80' : '#f87171',
              fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem'
            }}>
              <span>{verifyMsg.type === 'success' ? '✅' : '❌'}</span>
              <span>{verifyMsg.text}</span>
            </div>
          )}

          {/* Grace period warning if active */}
          {hubStatus.status === 'grace_period' && (
            <div style={{
              padding: '1.25rem', borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.15))',
              border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24',
              display: 'flex', alignItems: 'flex-start', gap: '1rem'
            }}>
              <span style={{ fontSize: '1.75rem' }}>⚠️</span>
              <div>
                <h4 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 800, color: '#fef3c7' }}>
                  Licentiecontrole Vereist (Grace Period Actief)
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#fde68a', lineHeight: 1.5 }}>
                  De automatische 3-maandelijkse controle is verstreken. Er zijn nog <strong>{hubStatus.graceDaysRemaining} dagen</strong> resterend voordat het systeem automatisch overschakelt naar <strong>Lock-down modus</strong>. Klik op de knop hieronder om direct online te valideren.
                </p>
              </div>
            </div>
          )}

          {/* Hero RowMatch Hub Connection Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.08))',
            borderRadius: '20px', padding: '1.75rem',
            border: '1px solid rgba(99,102,241,0.3)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: 'rgba(99,102,241,0.25)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
                  }}>🌐</div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', margin: 0 }}>api.rowmatch.nl</h2>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                    background: hubStatus.online ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)',
                    color: hubStatus.online ? '#4ade80' : '#f87171',
                    border: `1px solid ${hubStatus.online ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: hubStatus.online ? '#22c55e' : '#ef4444',
                      boxShadow: hubStatus.online ? '0 0 10px #22c55e' : 'none'
                    }} />
                    {hubStatus.online ? `Online (${hubStatus.latencyMs}ms latency)` : 'Niet bereikbaar'}
                  </span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: '0.88rem', maxWidth: '650px', lineHeight: 1.5 }}>
                  Officiële centrale server van Locra & RowMatch. Deze server valideert de schoollicenties, host de school-directory voor de mobiele app en zorgt voor federatie en veilige updates.
                </p>
              </div>

              {/* Action Button */}
              <button
                onClick={handleVerifyNow}
                disabled={verifyingLicense}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff', border: 'none', padding: '0.75rem 1.4rem',
                  borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem',
                  cursor: verifyingLicense ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  boxShadow: '0 0 20px rgba(99,102,241,0.35)',
                  transition: 'all 0.2s ease', opacity: verifyingLicense ? 0.7 : 1
                }}
              >
                <span>{verifyingLicense ? '⏳' : '⚡'}</span>
                {verifyingLicense ? 'Bezig met verifiëren...' : 'Nu controleren bij api.rowmatch.nl'}
              </button>
            </div>
          </div>

          {/* 3-Maandelijkse Cyclus & Lockdown Monitor Card */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.75rem',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '1.4rem' }}>🕒</div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Automatische 3-Maandelijkse Licentiecontrole
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0, fontSize: '0.82rem' }}>
                  Elke 90 dagen controleert de Locra server op de achtergrond de geldigheid van de licentie.
                </p>
              </div>
            </div>

            {/* Step Timeline */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Laatste Controle</div>
                <div style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  {formatDate(hubStatus.lastVerifiedAt)}
                </div>
                <div style={{ color: '#22c55e', fontSize: '0.75rem', marginTop: '0.2rem' }}>✅ Succesvol geverifieerd</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Controle Cyclus</div>
                <div style={{ color: '#06b6d4', fontSize: '1.05rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  Elke 3 Maanden
                </div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', marginTop: '0.2rem' }}>90 kalenderdagen cyclus</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Volgende Automatische Check</div>
                <div style={{ color: '#818cf8', fontSize: '1.05rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  Over {hubStatus.daysUntilNextCheck} dagen
                </div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{formatDate(hubStatus.nextScheduledCheck)}</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Lock-down Beveiliging</div>
                <div style={{
                  color: hubStatus.status === 'active' ? '#22c55e' : (hubStatus.status === 'grace_period' ? '#fbbf24' : '#f87171'),
                  fontSize: '1.05rem', fontWeight: 700, marginTop: '0.25rem'
                }}>
                  {hubStatus.status === 'active' ? 'Normaal Bedrijf' : (hubStatus.status === 'grace_period' ? 'Grace Period Actief' : 'Lock-down Actief')}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', marginTop: '0.2rem' }}>14 dagen buffer bij offline</div>
              </div>
            </div>

            {/* Progress Bar of 90 Days */}
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.35rem' }}>
                <span>Voortgang huidige 3-maanden verificatieperiode</span>
                <span>{daysProgressPct}% ({90 - hubStatus.daysUntilNextCheck} / 90 dagen)</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '4px',
                  background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
                  width: `${daysProgressPct}%`, transition: 'width 0.5s ease'
                }} />
              </div>
            </div>
          </div>

          {/* License & School Profile + Security Transparency (2 columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
            {/* School Licentie Profiel */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.5rem',
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🎓 Gekoppelde Schoollicentie
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>Schoolorganisatie</span>
                  <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>{hubStatus.schoolName}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>Licentie Tier</span>
                  <span style={{
                    padding: '3px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800,
                    background: 'rgba(99,102,241,0.2)', color: '#818cf8', textTransform: 'uppercase'
                  }}>
                    {hubStatus.tier}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>Licentiesleutel</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#06b6d4', fontWeight: 600 }}>
                      {hubStatus.licenseKeyMasked}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>Capaciteit</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>Max. {hubStatus.maxUsers} leerlingen & docenten</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>Geldig Tot</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{formatDate(hubStatus.expiresAt)}</span>
                </div>

                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Inbegrepen Functionaliteiten</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>✓ AI Chat & Docent Assistent</span>
                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>✓ Watermerkdetectie</span>
                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>✓ RAG Kennisbanken</span>
                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>✓ SOMtoday Integratie</span>
                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>✓ Locra Connect QR-pairing</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AVG & Privacy Transparantie (Wat sturen we naar buiten?) */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.5rem',
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🛡️ AVG & Privacy Transparantie
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.45)', margin: '0 0 1rem', fontSize: '0.8rem', lineHeight: 1.4 }}>
                100% on-premise isolatie. Bekijk exact welke data deze Locra server uitwisselt met api.rowmatch.nl.
              </p>

              {/* Transmitted list */}
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>✓</span> Verzonden naar api.rowmatch.nl (Uitsluitend Metadata):
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.4rem' }}>
                  {hubStatus.privacyNotice.transmitted.map((item, i) => (
                    <div key={i} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                      <span style={{ color: '#22c55e' }}>•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blocked list */}
              <div style={{ marginBottom: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: '#f87171', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>🔒</span> Pertinent NOOIT Verzonden (Blijft 100% Binnen School):
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.4rem' }}>
                  {hubStatus.privacyNotice.strictlyBlocked.map((item, i) => (
                    <div key={i} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                      <span style={{ color: '#f87171' }}>✕</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                background: 'rgba(6,182,212,0.06)', borderRadius: '10px', padding: '0.75rem',
                border: '1px solid rgba(6,182,212,0.15)', color: 'rgba(255,255,255,0.5)',
                fontSize: '0.73rem', lineHeight: 1.4
              }}>
                {hubStatus.privacyNotice.e2eSecurity}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── IP & Schoolnetwerk Tab ── */}
      {tab === 'ip-security' && (
        <div>
          {ipSecMsg && (
            <div style={{
              padding: '1rem 1.25rem', borderRadius: '12px', marginBottom: '1.5rem',
              background: ipSecMsg.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${ipSecMsg.type === 'success' ? '#22c55e' : '#ef4444'}`,
              color: ipSecMsg.type === 'success' ? '#86efac' : '#fca5a5',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span>{ipSecMsg.text}</span>
              <button onClick={() => setIpSecMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
            </div>
          )}

          {/* Warning if whitelist is enabled and current IP not in whitelist */}
          {ipWhitelistEnabled && ipSecData?.clientIp && !allowedIps.includes(ipSecData.clientIp) && !allowedIps.some(a => a.includes('/') && ipSecData.clientIp.startsWith(a.split('/')[0].slice(0, 7))) && (
            <div style={{
              padding: '1.25rem', borderRadius: '16px', marginBottom: '1.5rem',
              background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <div>
                  <strong>Let op: Jouw huidige IP ({ipSecData.clientIp}) staat nog niet in de whitelist!</strong>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.2rem' }}>
                    Voeg jouw IP toe voordat je opslaat om te voorkomen dat je jezelf buitensluit van het beheerpaneel.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddCurrentIp}
                style={{
                  background: '#f59e0b', color: '#000', border: 'none',
                  padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 700,
                  fontSize: '0.85rem', cursor: 'pointer'
                }}
              >
                + Voeg Mijn IP Toe ({ipSecData.clientIp})
              </button>
            </div>
          )}

          {/* Master Switch Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
            borderRadius: '20px', padding: '1.75rem', border: '1px solid rgba(255,255,255,0.08)',
            marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.75rem' }}>🛡️</span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#fff' }}>
                  Schoolnetwerk Restrictie (IP Whitelist Modus)
                </h2>
                <span style={{
                  padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800,
                  background: ipWhitelistEnabled ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)',
                  color: ipWhitelistEnabled ? '#4ade80' : '#94a3b8'
                }}>
                  {ipWhitelistEnabled ? 'ACTIEF BEVEILIGD' : 'UITGESCHAKELD (OPEN)'}
                </span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: '0.9rem', maxWidth: '700px', lineHeight: 1.5 }}>
                Wanneer ingeschakeld hebben uitsluitend apparaten die verbonden zijn met het officiële school-Wi-Fi, school-LAN of goedgekeurde IP-adressen toegang tot Locra. Verbindingen vanaf thuis of 4G/5G worden geweigerd.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <span style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 600 }}>Alleen Schoolnetwerk</span>
                <input
                  type="checkbox"
                  checked={ipWhitelistEnabled}
                  onChange={e => setIpWhitelistEnabled(e.target.checked)}
                  style={{ width: '22px', height: '22px', accentColor: '#6366f1', cursor: 'pointer' }}
                />
              </label>
            </div>
          </div>

          {/* Current IP & Quick Add Banner */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)', borderRadius: '16px', padding: '1.25rem 1.5rem',
            border: '1px solid rgba(99, 102, 241, 0.25)', marginBottom: '1.5rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                📍
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jouw Huidige Verbindings-IP</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'monospace', color: '#818cf8' }}>
                  {ipSecData?.clientIp || '127.0.0.1'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleAddCurrentIp}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                  color: '#fff', border: 'none', padding: '0.55rem 1.25rem', borderRadius: '10px',
                  fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer'
                }}
              >
                + Voeg Mijn Huidige IP Toe aan Whitelist
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Whitelist Panel */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.75rem',
              border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#4ade80', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>✓</span> Toegestane Netwerken (Whitelist)
                  </h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.825rem', margin: '0.25rem 0 0 0' }}>
                    Ondersteunt afzonderlijke IP's en CIDR subnets (bijv. 192.168.1.0/24)
                  </p>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: 700 }}>{allowedIps.length} regels</span>
              </div>

              {/* Tag List */}
              <div style={{
                minHeight: '140px', maxHeight: '220px', overflowY: 'auto',
                background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '0.75rem',
                border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1rem',
                display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignContent: 'flex-start'
              }}>
                {allowedIps.map(ip => (
                  <span
                    key={ip}
                    style={{
                      background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)',
                      color: '#86efac', padding: '4px 10px', borderRadius: '8px', fontSize: '0.85rem',
                      fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
                    }}
                  >
                    <span>{ip}</span>
                    {ip !== '127.0.0.1' && ip !== '::1' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAllowedIp(ip)}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}
                        title="Verwijder regel"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
                {allowedIps.length === 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', padding: '1rem' }}>
                    Nog geen IP-regels geconfigureerd.
                  </div>
                )}
              </div>

              {/* Add Input */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Bijv. 192.168.1.0/24 of 82.161.45.10"
                  value={newAllowedIp}
                  onChange={e => setNewAllowedIp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddAllowedIp())}
                  style={{
                    flex: 1, padding: '0.65rem 0.85rem', borderRadius: '10px',
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: '0.875rem', fontFamily: 'monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddAllowedIp()}
                  style={{
                    background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)',
                    color: '#4ade80', padding: '0.65rem 1rem', borderRadius: '10px',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem'
                  }}
                >
                  + Toevoegen
                </button>
              </div>

              {/* Presets Chips */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>Snelle presets:</span>
                <button
                  type="button"
                  onClick={() => handleAddAllowedIp('192.168.0.0/16')}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: '6px', fontSize: '0.75rem', padding: '3px 8px', cursor: 'pointer' }}
                >
                  + Lokaal Wi-Fi (192.168.0.0/16)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddAllowedIp('10.0.0.0/8')}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: '6px', fontSize: '0.75rem', padding: '3px 8px', cursor: 'pointer' }}
                >
                  + School LAN (10.0.0.0/8)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddAllowedIp('172.16.0.0/12')}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: '6px', fontSize: '0.75rem', padding: '3px 8px', cursor: 'pointer' }}
                >
                  + Campus LAN (172.16.0.0/12)
                </button>
              </div>
            </div>

            {/* Blacklist Panel */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.75rem',
              border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f87171', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🚫</span> Geblokkeerde IP's (Blacklist)
                  </h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.825rem', margin: '0.25rem 0 0 0' }}>
                    Deze IP's worden direct geweigerd, zelfs wanneer whitelist-modus uit staat
                  </p>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 700 }}>{blockedIps.length} regels</span>
              </div>

              {/* Tag List */}
              <div style={{
                minHeight: '140px', maxHeight: '220px', overflowY: 'auto',
                background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '0.75rem',
                border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1rem',
                display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignContent: 'flex-start'
              }}>
                {blockedIps.map(ip => (
                  <span
                    key={ip}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#fca5a5', padding: '4px 10px', borderRadius: '8px', fontSize: '0.85rem',
                      fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
                    }}
                  >
                    <span>{ip}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveBlockedIp(ip)}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}
                      title="Deblokkeer"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {blockedIps.length === 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', padding: '1rem' }}>
                    Geen geblokkeerde IP's actief.
                  </div>
                )}
              </div>

              {/* Add Input */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Bijv. 203.0.113.45 of verdacht subnet"
                  value={newBlockedIp}
                  onChange={e => setNewBlockedIp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddBlockedIp())}
                  style={{
                    flex: 1, padding: '0.65rem 0.85rem', borderRadius: '10px',
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: '0.875rem', fontFamily: 'monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddBlockedIp}
                  style={{
                    background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)',
                    color: '#f87171', padding: '0.65rem 1rem', borderRadius: '10px',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem'
                  }}
                >
                  + Blokkeren
                </button>
              </div>
            </div>
          </div>

          {/* Simulator & Server Interfaces Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Live IP Simulator */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.5rem',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🔬</span> Live IP Toegangs-Simulator
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.825rem', margin: '0 0 1rem 0' }}>
                Controleer of een specifiek IP-adres van een leerling of medewerker toegang zou krijgen met de huidige regels.
              </p>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Test IP adres (bijv. 192.168.1.55)"
                  value={testSimIp}
                  onChange={e => setTestSimIp(e.target.value)}
                  style={{
                    flex: 1, padding: '0.65rem 0.85rem', borderRadius: '10px',
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: '0.875rem', fontFamily: 'monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={handleSimulateIpCheck}
                  style={{
                    background: 'rgba(56, 189, 248, 0.2)', border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#38bdf8', padding: '0.65rem 1.25rem', borderRadius: '10px',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem'
                  }}
                >
                  Test IP
                </button>
              </div>

              {testSimResult && (
                <div style={{
                  padding: '0.85rem 1rem', borderRadius: '10px',
                  background: testSimResult.allowed ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  border: `1px solid ${testSimResult.allowed ? '#22c55e' : '#ef4444'}`,
                  color: testSimResult.allowed ? '#86efac' : '#fca5a5',
                  fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                  <span>{testSimResult.allowed ? '✓' : '✕'}</span>
                  <span>{testSimResult.reason}</span>
                </div>
              )}
            </div>

            {/* Server Interfaces */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.5rem',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#a78bfa', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🖧</span> Server Netwerk Interfaces
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.825rem', margin: '0 0 1rem 0' }}>
                Fysieke en virtuele IP-adressen van deze machine op het schoolnetwerk.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(ipSecData?.serverIps || []).map((iface, idx) => (
                  <div key={idx} style={{
                    padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.85rem' }}>{iface.name}</span>
                    <span style={{ fontFamily: 'monospace', color: '#818cf8', fontSize: '0.85rem' }}>{iface.address}</span>
                  </div>
                ))}
                {(ipSecData?.serverIps || []).length === 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>Geen interfaces gevonden.</div>
                )}
              </div>
            </div>
          </div>

          {/* Save Action Bar */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem',
            padding: '1.5rem 0', borderTop: '1px solid rgba(255,255,255,0.06)'
          }}>
            <button
              type="button"
              onClick={handleSaveIpSecurity}
              disabled={savingIpSec}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                color: '#fff', border: 'none', padding: '0.85rem 2rem', borderRadius: '12px',
                fontWeight: 700, fontSize: '0.95rem', cursor: savingIpSec ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 25px rgba(99,102,241,0.3)'
              }}
            >
              {savingIpSec ? 'Opslaan...' : '💾 IP-beveiliging Opslaan & Activeren'}
            </button>
          </div>
        </div>
      )}

      {/* ── Locra Connect Tab ── */}
      {tab === 'locra-connect' && (
        <div>
          {connectMsg && (
            <div style={{
              padding: '1rem 1.25rem', borderRadius: '12px', marginBottom: '1.5rem',
              background: connectMsg.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${connectMsg.type === 'success' ? '#22c55e' : '#ef4444'}`,
              color: connectMsg.type === 'success' ? '#86efac' : '#fca5a5',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span>{connectMsg.text}</span>
              <button onClick={() => setConnectMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
            </div>
          )}

          {/* Directory Status Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.7), rgba(15, 23, 42, 0.9))',
            borderRadius: '20px', padding: '2rem', border: '1px solid rgba(99, 102, 241, 0.3)',
            marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '2rem' }}>📱</span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#fff' }}>
                  Locra Connect School Directory
                </h2>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800,
                  background: connectData?.isRegisteredInHub ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)',
                  color: connectData?.isRegisteredInHub ? '#4ade80' : '#fde68a'
                }}>
                  {connectData?.isRegisteredInHub ? '● GEREGISTREERD & VINDBAAR' : '○ NIET GEREGISTREERD'}
                </span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.65)', margin: 0, fontSize: '0.925rem', maxWidth: '750px', lineHeight: 1.5 }}>
                Meld deze schoolserver aan in de centrale <strong>api.rowmatch.nl</strong> directory. Leerlingen en docenten kunnen vervolgens simpelweg de schoolnaam of koppelcode intypen in de mobiele app om direct te verbinden.
              </p>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 600 }}>Vindbaarheid Inschakelen</span>
              <input
                type="checkbox"
                checked={enableConnectToggle}
                onChange={e => setEnableConnectToggle(e.target.checked)}
                style={{ width: '22px', height: '22px', accentColor: '#6366f1', cursor: 'pointer' }}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Configuration Form Card */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.75rem',
              border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '1.25rem'
            }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⚙️</span> Koppelcode & Server Webadres
              </h3>

              {/* Connect Code */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginBottom: '0.4rem' }}>
                  School Koppelcode (Unieke code voor leerlingen)
                </label>
                <input
                  type="text"
                  value={connectCodeInput}
                  onChange={e => setConnectCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  placeholder="Bijv. LOCRA-AI"
                  style={{
                    width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#818cf8', fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace'
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.3rem' }}>
                  Deze code typen leerlingen in de app. Mag letters, cijfers en streepjes bevatten.
                </div>
              </div>

              {/* Public Server URL */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.825rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                    Server Webadres (URL)
                  </label>
                  {connectData?.detectedUrl && (
                    <button
                      type="button"
                      onClick={() => setPublicUrlInput(connectData.detectedUrl)}
                      style={{ background: 'none', border: 'none', color: '#06b6d4', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                    >
                      ⚡ Gebruik gedetecteerd ({connectData.detectedUrl})
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={publicUrlInput}
                  onChange={e => setPublicUrlInput(e.target.value)}
                  placeholder="https://locra.school.nl of http://192.168.1.100:4000"
                  style={{
                    width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: '0.9rem', fontFamily: 'monospace'
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.3rem' }}>
                  Het webadres of IP-adres waarop telefoons binnen het schoolnetwerk deze server bereiken.
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleSaveConnect}
                disabled={savingConnect || !connectCodeInput.trim() || !publicUrlInput.trim()}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                  color: '#fff', border: 'none', padding: '0.85rem 1.5rem', borderRadius: '12px',
                  fontWeight: 700, fontSize: '0.95rem', cursor: savingConnect ? 'not-allowed' : 'pointer',
                  marginTop: '0.5rem', boxShadow: '0 8px 25px rgba(99,102,241,0.3)'
                }}
              >
                {savingConnect ? 'Aanmelden bij centrale directory...' : '🚀 Opslaan & Registreren in Locra Connect'}
              </button>
            </div>

            {/* QR Code & Mobile Connection Card */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.75rem',
              border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
            }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: '0 0 0.5rem 0' }}>
                Mobiele Koppel-QR & Koppelcode
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.825rem', margin: '0 0 1.25rem 0', maxWidth: '300px' }}>
                Laat docenten of leerlingen deze QR-code scannen in de Locra app om direct de schoolserver in te stellen.
              </p>

              <div style={{
                padding: '1rem', background: '#fff', borderRadius: '16px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)', marginBottom: '1rem'
              }}>
                <QRCodeSVG
                  value={JSON.stringify({
                    type: 'locra-school',
                    version: 1,
                    serverUrl: publicUrlInput || connectData?.detectedUrl || 'http://localhost:4000',
                    connectCode: connectCodeInput || connectData?.connectCode || 'LOCRA',
                    orgName: connectData?.orgName || 'Locra School'
                  })}
                  size={150}
                  level="M"
                />
              </div>

              <div style={{
                background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)',
                padding: '6px 16px', borderRadius: '20px', color: '#818cf8', fontWeight: 800,
                fontSize: '1rem', fontFamily: 'monospace', letterSpacing: '0.05em'
              }}>
                {connectCodeInput || 'LOCRA'}
              </div>
            </div>
          </div>

          {/* Search Simulator Card */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.75rem',
            border: '1px solid rgba(255,255,255,0.08)', marginBottom: '2rem'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#06b6d4', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔍</span> Live Vindbaarheidstest (Simulator voor de Mobiele App)
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
              Test hoe jouw school verschijnt wanneer een leerling zoekt op <strong>api.rowmatch.nl</strong> in de Locra Mobile app.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', maxWidth: '600px', marginBottom: '1.25rem' }}>
              <input
                type="text"
                placeholder="Zoek op schoolnaam of code (bijv. Locra-AI)"
                value={testSearchQuery}
                onChange={e => setTestSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleTestSearchConnect())}
                style={{
                  flex: 1, padding: '0.75rem 1rem', borderRadius: '10px',
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: '0.9rem'
                }}
              />
              <button
                type="button"
                onClick={handleTestSearchConnect}
                disabled={testSearching || !testSearchQuery.trim()}
                style={{
                  background: 'rgba(6, 182, 212, 0.2)', border: '1px solid rgba(6, 182, 212, 0.4)',
                  color: '#06b6d4', padding: '0.75rem 1.5rem', borderRadius: '10px',
                  fontWeight: 700, cursor: testSearching ? 'not-allowed' : 'pointer', fontSize: '0.9rem'
                }}
              >
                {testSearching ? 'Zoeken...' : 'Zoeken'}
              </button>
            </div>

            {testSearchResults && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                  Gevonden scholen op api.rowmatch.nl: <strong>{testSearchResults.length}</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
                  {testSearchResults.map((school, i) => (
                    <div key={i} style={{
                      padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: '0.75rem'
                    }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                        🎓
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{school.name}</div>
                        <div style={{ color: '#4ade80', fontSize: '0.8rem', fontFamily: 'monospace' }}>{school.connectCode}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {school.serverUrl}
                        </div>
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(34,197,94,0.15)', color: '#4ade80', fontSize: '0.7rem', fontWeight: 700 }}>
                        ONLINE
                      </span>
                    </div>
                  ))}

                  {testSearchResults.length === 0 && (
                    <div style={{ padding: '1rem', color: '#f87171', fontSize: '0.85rem' }}>
                      Geen school gevonden voor "{testSearchQuery}". Klik op "Opslaan & Registreren" hierboven om de school aan te melden.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Connections Tab ── */}
      {tab === 'connections' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {connections.map(conn => {
              const statusStyle = STATUS_COLORS[conn.status] || STATUS_COLORS['not-configured'];
              return (
                <div key={conn.id} style={{
                  background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '1.25rem',
                  border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '14px',
                      background: 'rgba(255,255,255,0.05)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0
                    }}>
                      {conn.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{conn.name}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600,
                          background: statusStyle.bg, color: statusStyle.text,
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusStyle.dot, display: 'inline-block' }} />
                          {conn.status === 'active' ? 'Actief' : conn.status === 'connected' ? 'Verbonden' : conn.status === 'error' ? 'Fout' : 'Niet ingesteld'}
                        </span>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>{conn.description}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontFamily: 'monospace' }}>{conn.details}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Requests Tab ── */}
      {tab === 'requests' && (
        <div>
          {/* Filters */}
          <div style={{
            display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder="Zoek op URL, hostname..."
              value={reqFilter.search}
              onChange={e => { setReqFilter({ ...reqFilter, search: e.target.value }); setReqPage(1); }}
              style={{
                flex: 1, minWidth: '200px', padding: '0.6rem 1rem',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px', color: '#fff', fontSize: '0.85rem', outline: 'none'
              }}
            />
            <select
              value={reqFilter.category}
              onChange={e => { setReqFilter({ ...reqFilter, category: e.target.value }); setReqPage(1); }}
              style={{
                padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
                color: '#fff', fontSize: '0.85rem', outline: 'none'
              }}
            >
              <option value="all">Alle categorieën</option>
              <option value="ai-provider">AI Provider</option>
              <option value="federation">Federatie (api.rowmatch.nl)</option>
              <option value="external">Extern</option>
              <option value="internal">Intern</option>
              <option value="webhook">Webhook</option>
            </select>
            <select
              value={reqFilter.status}
              onChange={e => { setReqFilter({ ...reqFilter, status: e.target.value }); setReqPage(1); }}
              style={{
                padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
                color: '#fff', fontSize: '0.85rem', outline: 'none'
              }}
            >
              <option value="all">Alle statussen</option>
              <option value="success">Succesvol (&lt;400)</option>
              <option value="error">Fouten (≥400)</option>
            </select>
            <button
              onClick={() => fetchRequests()}
              style={{
                padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
                color: '#fff', cursor: 'pointer', fontSize: '0.85rem'
              }}
            >🔄 Ververs</button>
          </div>

          {/* Request Count */}
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            {reqTotal} verzoeken gelogd {reqFilter.category !== 'all' ? `(gefilterd op ${reqFilter.category})` : ''}
          </div>

          {/* Request Table */}
          <div style={{
            background: 'rgba(255,255,255,0.02)', borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden'
          }}>
            {requests.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📡</div>
                <div>Geen uitgaande verzoeken gevonden</div>
              </div>
            ) : (
              requests.map(req => {
                const isExpanded = expandedReqId === req.id;
                const catInfo = CATEGORY_LABELS[req.category] || { label: req.category, color: '#94a3b8', icon: '🔗' };
                return (
                  <div key={req.id}>
                    <div
                      onClick={() => setExpandedReqId(isExpanded ? null : req.id)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 70px 1fr 140px 90px 90px 100px',
                        padding: '0.75rem 1rem', alignItems: 'center', gap: '0.5rem',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer', transition: 'background 0.15s ease',
                        background: isExpanded ? 'rgba(99,102,241,0.08)' : 'transparent',
                        fontSize: '0.85rem'
                      }}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Status */}
                      <div>
                        <span style={{
                          padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                          color: getStatusCodeColor(req.statusCode),
                          background: `${getStatusCodeColor(req.statusCode)}15`
                        }}>
                          {req.statusCode || (req.error ? 'ERR' : '...')}
                        </span>
                      </div>

                      {/* Method */}
                      <div>
                        <span style={{
                          fontWeight: 700, fontSize: '0.75rem', fontFamily: 'monospace',
                          color: getMethodColor(req.method)
                        }}>
                          {req.method}
                        </span>
                      </div>

                      {/* URL */}
                      <div style={{
                        color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', fontSize: '0.78rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {req.hostname}<span style={{ color: 'rgba(255,255,255,0.3)' }}>{req.path}</span>
                      </div>

                      {/* Category */}
                      <div>
                        <span style={{
                          padding: '2px 6px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600,
                          color: catInfo.color, background: `${catInfo.color}15`
                        }}>
                          {catInfo.icon} {catInfo.label}
                        </span>
                      </div>

                      {/* Duration */}
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        {req.durationMs ? formatDuration(req.durationMs) : '—'}
                      </div>

                      {/* Size */}
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>
                        {req.responseBodySize ? formatBytes(req.responseBodySize) : '—'}
                      </div>

                      {/* Timestamp */}
                      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' }}>
                        {new Date(req.timestamp).toLocaleTimeString('nl-NL')}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div style={{
                        padding: '1rem 1.5rem', background: 'rgba(99,102,241,0.04)',
                        borderBottom: '1px solid rgba(255,255,255,0.06)'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <h4 style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Verzoek Details</h4>
                            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                              <div><strong>Volledige URL:</strong> <code style={{ color: '#06b6d4' }}>{req.url}</code></div>
                              <div><strong>Protocol:</strong> {req.protocol.toUpperCase()}</div>
                              <div><strong>Poort:</strong> {req.port}</div>
                              {req.requestBodySize != null && <div><strong>Request grootte:</strong> {formatBytes(req.requestBodySize)}</div>}
                              {req.responseBodySize != null && <div><strong>Response grootte:</strong> {formatBytes(req.responseBodySize)}</div>}
                              {req.error && <div style={{ color: '#f87171' }}><strong>Fout:</strong> {req.error}</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {reqTotal > 30 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                disabled={reqPage === 1}
                onClick={() => setReqPage(reqPage - 1)}
                style={{
                  padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)', color: reqPage === 1 ? 'rgba(255,255,255,0.2)' : '#fff',
                  cursor: reqPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.85rem'
                }}
              >← Vorige</button>
              <span style={{ padding: '0.5rem 1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                Pagina {reqPage} van {Math.ceil(reqTotal / 30)}
              </span>
              <button
                disabled={reqPage >= Math.ceil(reqTotal / 30)}
                onClick={() => setReqPage(reqPage + 1)}
                style={{
                  padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)', color: reqPage >= Math.ceil(reqTotal / 30) ? 'rgba(255,255,255,0.2)' : '#fff',
                  cursor: reqPage >= Math.ceil(reqTotal / 30) ? 'not-allowed' : 'pointer', fontSize: '0.85rem'
                }}
              >Volgende →</button>
            </div>
          )}
        </div>
      )}

      {/* ── Devices Tab ── */}
      {tab === 'devices' && (
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
              {devices.length} gekoppelde apparaten
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {devices.map(device => (
              <div key={device.id} style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '1.25rem',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '14px',
                    background: device.devicePlatform === 'ios'
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.08))'
                      : 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.08))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.3rem', flexShrink: 0
                  }}>
                    {device.devicePlatform === 'ios' ? '🍎' : '🤖'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{device.deviceName}</span>
                      {device.isActive && (
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: '#22c55e', display: 'inline-block',
                          boxShadow: '0 0 8px rgba(34,197,94,0.5)'
                        }} />
                      )}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                      {device.userName} ({device.userRole})
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' }}>
                      <span>v{device.appVersion}</span>
                      <span>Gekoppeld {new Date(device.pairedAt).toLocaleDateString('nl-NL')}</span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      Laatst actief: {new Date(device.lastActiveAt).toLocaleString('nl-NL')}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeDevice(device.id)}
                    title="Apparaat ontkoppelen"
                    style={{
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: '10px', padding: '0.4rem 0.75rem', cursor: 'pointer',
                      color: '#f87171', fontSize: '0.75rem', fontWeight: 600,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                  >
                    Ontkoppel
                  </button>
                </div>
              </div>
            ))}

            {devices.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📱</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Geen gekoppelde apparaten</div>
                <div style={{ fontSize: '0.85rem' }}>Leerlingen kunnen via Locra Connect hun telefoon koppelen</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
