import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

import Editor from '@monaco-editor/react';

interface Repo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  updated_at: string;
  language: string;
  owner: { login: string };
  default_branch: string;
}

interface TreeItem {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

interface FileContent {
  name: string;
  path: string;
  sha: string;
  content: string;
}

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Map file extension to Monaco language
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', java: 'java', cs: 'csharp', cpp: 'cpp', c: 'c',
    go: 'go', rs: 'rust', php: 'php', html: 'html', css: 'css', scss: 'scss',
    json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', md: 'markdown',
    sql: 'sql', sh: 'shell', bash: 'shell', txt: 'plaintext',
    swift: 'swift', kt: 'kotlin', dart: 'dart', r: 'r',
  };
  return map[ext] || 'plaintext';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u geleden`;
  const days = Math.floor(hours / 24);
  return `${days}d geleden`;
}

export default function CodeMatchLayout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const setAuth = useAuthStore(state => state.setAuth);


  // Connection state
  const [isGithubConnected, setIsGithubConnected] = useState(!!user?.githubUsername);
  const [githubUsername, setGithubUsername] = useState<string | null>(user?.githubUsername || null);
  const [loading, setLoading] = useState(true);
  const [githubConfigured, setGithubConfigured] = useState(true);

  // Repos & files
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [fileTree, setFileTree] = useState<TreeItem[]>([]);
  const [openFile, setOpenFile] = useState<FileContent | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [unsaved, setUnsaved] = useState(false);

  // New repo modal
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [creatingRepo, setCreatingRepo] = useState(false);

  // AI Chat
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('default');
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Check access + connection on mount
  useEffect(() => {
    checkAccess();
  }, []);

  // Handle OAuth callback redirect
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      // User just came back from GitHub OAuth
      fetchGithubProfile();
    }
    const error = searchParams.get('error');
    if (error) {
      alert(decodeURIComponent(error));
    }
  }, [searchParams]);

  const checkAccess = async () => {
    try {
      const res = await fetch('/api/codematch/access', { headers });
      if (res.ok) {
        const data = await res.json();
        setGithubConfigured(data.githubConfigured);
      }
      
      const convRes = await fetch('/api/chat/conversations?folder=CodeMatch', { headers });
      if (convRes.ok) {
        const convs = await convRes.json();
        setConversations(convs);
      }
      
      const modelsRes = await fetch('/api/models', { headers });
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        // filter out inactive models. keep CodeMatchOnly AND non-codematch only
        const activeModels = modelsData.filter((m: any) => m.isActive);
        setModels(activeModels);
        const codeMatchDefault = activeModels.find((m: any) => m.isCodeMatchOnly) || activeModels.find((m: any) => m.isDefault);
        if (codeMatchDefault) setSelectedModel(codeMatchDefault.ollamaName);
        else if (activeModels.length > 0) setSelectedModel(activeModels[0].ollamaName);
      }

      // Check if user has GitHub linked
      await fetchGithubProfile();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchGithubProfile = async () => {
    try {
      const res = await fetch('/api/codematch/github/profile', { headers });
      if (res.ok) {
        const profile = await res.json();
        setIsGithubConnected(true);
        setGithubUsername(profile.login);
        if (token && user) {
          setAuth(token, { ...user, githubUsername: profile.login, githubToken: 'connected' });
        }
        // Fetch repos
        await fetchRepos();
      } else {
        setIsGithubConnected(false);
        setGithubUsername(null);
      }
    } catch {
      setIsGithubConnected(false);
    }
  };

  const fetchRepos = async () => {
    const res = await fetch('/api/codematch/github/repos?sort=updated&per_page=50', { headers });
    if (res.ok) {
      const data = await res.json();
      setRepos(data);
    }
  };

  const handleConnectGithub = async () => {
    try {
      const origin = encodeURIComponent(window.location.origin);
      const res = await fetch(`/api/codematch/github/login?origin=${origin}`, { headers });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Koppeling mislukt');
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      alert(e.message || 'Kon niet koppelen met GitHub.');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Weet je zeker dat je GitHub wilt ontkoppelen?')) return;
    try {
      const res = await fetch('/api/codematch/github/disconnect', { 
        method: 'POST', 
        headers,
        body: JSON.stringify({}) 
      });
      if (!res.ok) throw new Error('Ontkoppelen mislukt op server');
      
      setIsGithubConnected(false);
      setGithubUsername(null);
      setRepos([]);
      setSelectedRepo(null);
      setOpenFile(null);
      if (token && user) {
        setAuth(token, { ...user, githubUsername: null, githubToken: null });
      }
    } catch (e) {
      console.error(e);
      alert('Er ging iets mis bij het ontkoppelen.');
    }
  };

  const selectRepo = async (repo: Repo) => {
    setSelectedRepo(repo);
    setOpenFile(null);
    setUnsaved(false);
    // Fetch full file tree
    const res = await fetch(`/api/codematch/github/repos/${repo.owner.login}/${repo.name}/tree`, { headers });
    if (res.ok) {
      const data = await res.json();
      setFileTree(data.tree?.filter((t: TreeItem) => t.type === 'blob') || []);
    }
  };

  const openFileFromTree = async (item: TreeItem) => {
    if (!selectedRepo) return;
    const res = await fetch(
      `/api/codematch/github/repos/${selectedRepo.owner.login}/${selectedRepo.name}/file?path=${encodeURIComponent(item.path)}`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      setOpenFile(data);
      setEditorContent(data.content);
      setUnsaved(false);
    }
  };

  const handleSaveFile = async () => {
    if (!selectedRepo || !openFile) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/codematch/github/repos/${selectedRepo.owner.login}/${selectedRepo.name}/file`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            path: openFile.path,
            content: editorContent,
            sha: openFile.sha,
            message: `Update ${openFile.path} via Locra CodeMatch`
          })
        }
      );
      if (res.ok) {
        const data = await res.json();
        setOpenFile({ ...openFile, sha: data.content?.sha || openFile.sha, content: editorContent });
        setUnsaved(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Opslaan mislukt.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFile = () => {
    const filename = prompt('Geef de naam/het pad van het nieuwe bestand (bijv. src/test.ts):');
    if (!filename) return;
    setOpenFile({ path: filename, content: '', sha: '', name: filename.split('/').pop() || filename });
    setEditorContent('');
    setUnsaved(true);
  };

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) return;
    setCreatingRepo(true);
    try {
      const res = await fetch('/api/codematch/github/repos', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newRepoName, description: newRepoDesc, isPrivate: true })
      });
      if (res.ok) {
        const repo = await res.json();
        setShowNewRepo(false);
        setNewRepoName('');
        setNewRepoDesc('');
        await fetchRepos();
        selectRepo(repo);
      } else {
        const err = await res.json();
        alert(err.error || 'Aanmaken mislukt.');
      }
    } finally {
      setCreatingRepo(false);
    }
  };

  // AI Chat: send message to existing chat endpoint with code context
  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = aiInput;
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setAiLoading(true);

    try {
      // Build context with current file
      const context = openFile
        ? `\n\n--- Huidige bestand: ${openFile.path} ---\n\`\`\`${getLanguage(openFile.name)}\n${editorContent}\n\`\`\`\n`
        : '';

      const systemMsg = `Je bent een AI code assistent in Locra CodeMatch. Beantwoord vragen over code, help met schrijven, debuggen en optimaliseren.
Belangrijk over het bewerken van bestanden:
- Als de gebruiker vraagt om code te genereren of aan te passen in het huidige bestand, geef dan ALTIJD de VOLLEDIGE, bijgewerkte code van het bestand in één enkel markdown code block.
- De gebruiker kan dit block met 1 druk op de knop toepassen. Geef dus niet alleen een klein stukje (snippet), tenzij de gebruiker daar specifiek om vraagt.
- Gebruik markdown formattering voor code.
${context}`;

      const res = await fetch('/api/codematch/github/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversationId: activeConversationId || `codematch-${user?.id}-${Date.now()}`,
          content: userMsg,
          systemPrompt: systemMsg,
          model: selectedModel
        })
      });

      if (res.ok) {
        const data = await res.json();
        const aiReply = data.reply || data.content || data.message || 'Geen antwoord ontvangen.';
        setAiMessages(prev => [...prev, { role: 'assistant', content: aiReply }]);
        if (data.conversationId && data.conversationId !== activeConversationId) {
          setActiveConversationId(data.conversationId);
          // refresh conversations
          fetch('/api/chat/conversations?folder=CodeMatch', { headers }).then(r => r.json()).then(setConversations);
        }
      } else {
        setAiMessages(prev => [...prev, { role: 'assistant', content: '❌ Er ging iets mis. Probeer het opnieuw.' }]);
      }
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', content: '❌ Netwerkfout.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  const loadConversation = async (convId: string) => {
    setActiveConversationId(convId);
    setAiLoading(true);
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAiMessages(data.map((m: any) => ({ role: m.role, content: m.content })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setAiMessages([]);
  };

  // Apply AI code to editor
  const applyCodeFromAi = (code: string) => {
    setEditorContent(code);
    setUnsaved(true);
  };

  // Extract code blocks from AI message
  const renderAiMessage = (msg: AiMessage) => {
    if (msg.role === 'user') {
      return <div style={{ background: 'rgba(99,102,241,0.15)', padding: '10px 14px', borderRadius: '12px 12px 4px 12px', maxWidth: '85%', marginLeft: 'auto', fontSize: '0.9rem' }}>{msg.content}</div>;
    }

    // Parse code blocks
    const parts = msg.content.split(/(```[\s\S]*?```)/g);
    return (
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '12px 12px 12px 4px', maxWidth: '85%', fontSize: '0.9rem' }}>
        {parts.map((part, i) => {
          if (part.startsWith('```')) {
            const lines = part.slice(3, -3).split('\n');
            const lang = lines[0]?.trim() || '';
            const code = lines.slice(1).join('\n');
            return (
              <div key={i} style={{ margin: '8px 0' }}>
                <div style={{ background: '#0d1117', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', background: '#161b22', fontSize: '0.75rem', color: '#8b949e' }}>
                    <span>{lang}</span>
                    <button 
                      onClick={() => applyCodeFromAi(code)}
                      style={{ background: '#238636', border: 'none', color: '#fff', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}
                    >
                      ✨ Toepassen
                    </button>
                  </div>
                  <pre style={{ margin: 0, padding: '10px', overflow: 'auto', fontSize: '0.8rem', color: '#c9d1d9' }}>{code}</pre>
                </div>
              </div>
            );
          }
          return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>💻</div>
          <div>CodeMatch laden...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', background: '#0f172a', color: '#e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* ── Header ── */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '10px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={() => navigate('/chat')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>← Chat</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.3rem' }}>💻</span>
            <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, background: 'linear-gradient(135deg, #4ade80, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CodeMatch</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isGithubConnected && (
            <button
              onClick={() => setShowAiChat(!showAiChat)}
              style={{
                background: showAiChat ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#a5b4fc',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              🤖 AI Assistent
            </button>
          )}
          {isGithubConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', fontSize: '0.8rem' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }}></span>
                <strong>{githubUsername}</strong>
              </div>
              <button onClick={handleDisconnect} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}>Ontkoppelen</button>
            </div>
          ) : null}
        </div>
      </header>

      {/* ── Main Content ── */}
      {!isGithubConnected ? (
        /* ── Connect GitHub Screen ── */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '24px',
            padding: '60px 40px',
            textAlign: 'center',
            maxWidth: '600px',
            width: '100%'
          }}>
            <span style={{ fontSize: '4rem', display: 'block', marginBottom: '20px' }}>🔗</span>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '12px' }}>Koppel je GitHub Account</h2>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)', marginBottom: '32px' }}>
              Werk aan echte code-projecten met AI-ondersteuning. Je code wordt veilig opgeslagen op jouw GitHub.
            </p>
            
            {!githubConfigured ? (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '16px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.9rem', color: '#fca5a5' }}>
                ⚠️ GitHub is nog niet geconfigureerd door de beheerder. Vraag je beheerder om dit in te stellen via het CodeMatch instellingenpaneel.
              </div>
            ) : (
              <button onClick={handleConnectGithub} style={{
                background: '#24292e',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                padding: '14px 28px',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                Inloggen met GitHub
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ── IDE Layout ── */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* ── Sidebar: Repos + File Tree ── */}
          <div style={{ width: '260px', background: '#1e293b', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            
            {/* Repo selector */}
            <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Projecten</span>
                <button onClick={() => setShowNewRepo(true)} style={{ background: '#4ade80', border: 'none', color: '#000', width: '22px', height: '22px', borderRadius: '5px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '200px', overflowY: 'auto' }}>
                {repos.map(repo => (
                  <button
                    key={repo.id}
                    onClick={() => selectRepo(repo)}
                    style={{
                      background: selectedRepo?.id === repo.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                      border: selectedRepo?.id === repo.id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: '#e2e8f0',
                      width: '100%'
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {repo.private ? '🔒' : '🌐'} {repo.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                      {repo.language && <span style={{ marginRight: '8px' }}>{repo.language}</span>}
                      {timeAgo(repo.updated_at)}
                    </div>
                  </button>
                ))}
                {repos.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '12px', textAlign: 'center' }}>Geen repositories gevonden</div>
                )}
              </div>
            </div>

            {/* File tree */}
            {selectedRepo && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', marginBottom: '4px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Bestanden
                  </div>
                  <button onClick={handleCreateFile} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#e2e8f0', borderRadius: '4px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}>+ Nieuw</button>
                </div>
                {fileTree.map(item => (
                  <button
                    key={item.sha}
                    onClick={() => openFileFromTree(item)}
                    style={{
                      background: openFile?.path === item.path ? 'rgba(99,102,241,0.15)' : 'transparent',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: openFile?.path === item.path ? '#a5b4fc' : '#94a3b8',
                      width: '100%',
                      fontSize: '0.8rem',
                      display: 'block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    📄 {item.path}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Editor Area ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {openFile ? (
              <>
                {/* File tab bar */}
                <div style={{
                  background: '#161b22',
                  padding: '6px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>
                      {selectedRepo?.full_name} / <strong style={{ color: '#e6edf3' }}>{openFile.path}</strong>
                    </span>
                    {unsaved && <span style={{ color: '#f59e0b', fontSize: '0.7rem', fontWeight: 600 }}>● niet opgeslagen</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleSaveFile}
                      disabled={!unsaved || saving}
                      style={{
                        background: unsaved ? '#238636' : 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: '#fff',
                        padding: '5px 14px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: unsaved ? 'pointer' : 'default',
                        opacity: unsaved ? 1 : 0.5
                      }}
                    >
                      {saving ? 'Opslaan...' : '💾 Opslaan & Committen'}
                    </button>
                  </div>
                </div>

                {/* Monaco Editor */}
                <div style={{ flex: 1 }}>
                  <Editor
                    height="100%"
                    language={getLanguage(openFile.name)}
                    value={editorContent}
                    onChange={(val) => {
                      setEditorContent(val || '');
                      setUnsaved(val !== openFile.content);
                    }}
                    theme="vs-dark"
                    options={{
                      fontSize: 14,
                      minimap: { enabled: true },
                      wordWrap: 'on',
                      padding: { top: 12 },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
                      fontLigatures: true,
                      bracketPairColorization: { enabled: true },
                      cursorBlinking: 'smooth',
                      smoothScrolling: true
                    }}
                  />
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.5 }}>📂</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '6px' }}>
                    {selectedRepo ? 'Selecteer een bestand' : 'Selecteer een project'}
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    {selectedRepo ? 'Klik op een bestand in de zijbalk om het te openen' : 'Kies een repository uit de zijbalk om te beginnen'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── AI Chat Panel ── */}
          {showAiChat && (
            <div style={{ width: '360px', background: '#1e293b', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>🤖 AI Code Assistent</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {conversations.length > 0 && (
                    <select
                      value={activeConversationId || ''}
                      onChange={e => loadConversation(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '4px', padding: '2px 4px', fontSize: '0.75rem', maxWidth: '120px' }}
                    >
                      <option value="" disabled>Selecteer gesprek...</option>
                      {conversations.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  )}
                  <button onClick={startNewConversation} style={{ background: 'rgba(99,102,241,0.2)', border: 'none', color: '#c7d2fe', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>+ Nieuw</button>
                  <button onClick={() => setShowAiChat(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {aiMessages.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#475569', padding: '32px 12px', fontSize: '0.85rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💡</div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Hoe kan ik helpen?</div>
                    <div>Stel een vraag over je code of vraag me iets te schrijven.</div>
                    {openFile && <div style={{ marginTop: '8px', color: '#64748b', fontSize: '0.8rem' }}>Ik kan de inhoud van <strong>{openFile.name}</strong> lezen.</div>}
                  </div>
                )}
                {aiMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                    {renderAiMessage(msg)}
                  </div>
                ))}
                {aiLoading && (
                  <div style={{ padding: '10px', color: '#64748b', fontSize: '0.85rem' }}>🤔 Nadenken...</div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                {models.length > 0 && (
                  <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Typ je bericht... Shift+Enter voor nieuwe regel</div>
                    <select 
                      value={selectedModel} 
                      onChange={(e) => setSelectedModel(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '4px', padding: '2px 4px', fontSize: '0.7rem' }}
                    >
                      {models.map(m => (
                        <option key={m.id} value={m.ollamaName}>{m.displayName} {m.isCodeMatchOnly ? '(CodeMatch Only)' : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendAiMessage()}
                    placeholder="Vraag de AI iets..."
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#e2e8f0',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={sendAiMessage}
                    disabled={aiLoading || !aiInput.trim()}
                    style={{
                      background: 'var(--primary)',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.85rem'
                    }}
                  >
                    ↑
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── New Repo Modal ── */}
      {showNewRepo && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem' }}>📦 Nieuw Project Aanmaken</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem' }}>Projectnaam</label>
              <input
                value={newRepoName}
                onChange={e => setNewRepoName(e.target.value.replace(/\s/g, '-'))}
                placeholder="mijn-project"
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem' }}>Beschrijving (optioneel)</label>
              <input
                value={newRepoDesc}
                onChange={e => setNewRepoDesc(e.target.value)}
                placeholder="Korte beschrijving van het project..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewRepo(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>Annuleren</button>
              <button
                onClick={handleCreateRepo}
                disabled={creatingRepo || !newRepoName.trim()}
                style={{ background: '#4ade80', border: 'none', color: '#000', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
              >
                {creatingRepo ? 'Aanmaken...' : '🚀 Aanmaken op GitHub'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
