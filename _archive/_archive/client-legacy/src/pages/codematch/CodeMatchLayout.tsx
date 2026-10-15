import { useState, useEffect, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';

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
  const [loadingPhase, setLoadingPhase] = useState('Workspace starten…');
  const [loadingProgress, setLoadingProgress] = useState(8);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [startupWarning, setStartupWarning] = useState<string | null>(null);
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
  const [aiChatWidth, setAiChatWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('codematch_ai_chat_width'));
      return Number.isFinite(saved) && saved >= 320 && saved <= 680 ? saved : 420;
    } catch {
      return 420;
    }
  });
  const [isResizingChat, setIsResizingChat] = useState(false);
  const chatResizeRef = useRef({ startX: 0, startWidth: 420 });
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('default');
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    try {
      localStorage.setItem('codematch_ai_chat_width', String(Math.round(aiChatWidth)));
    } catch {
      // Local storage can be unavailable in privacy-restricted browsers.
    }
  }, [aiChatWidth]);

  useEffect(() => {
    if (!isResizingChat) return;

    const handleMouseMove = (event: MouseEvent) => {
      const delta = chatResizeRef.current.startX - event.clientX;
      const nextWidth = Math.min(680, Math.max(320, chatResizeRef.current.startWidth + delta));
      setAiChatWidth(nextWidth);
    };

    const handleMouseUp = () => setIsResizingChat(false);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingChat]);

  const startAiChatResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    chatResizeRef.current = { startX: event.clientX, startWidth: aiChatWidth };
    setIsResizingChat(true);
  };

  const resetAiChatWidth = () => setAiChatWidth(420);

  // Check access + connection on mount
  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (!loading) return;
    const slowTimer = window.setTimeout(() => setLoadingSlow(true), 6500);
    const safetyTimer = window.setTimeout(() => {
      setLoading(false);
      setStartupWarning('De basisomgeving reageert traag. Je kunt alvast verder; GitHub-gegevens worden opnieuw opgehaald zodra ze beschikbaar zijn.');
    }, 14000);
    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [loading]);

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
      setStartupWarning(null);
      setLoadingPhase('Toegang en instellingen controleren…');
      setLoadingProgress(18);

      const res = await fetch('/api/codematch/access', { headers });
      if (res.ok) {
        const data = await res.json();
        setGithubConfigured(data.githubConfigured);
      }

      setLoadingPhase('Projectgeschiedenis voorbereiden…');
      setLoadingProgress(36);
      const convRes = await fetch('/api/chat/conversations?folder=CodeMatch', { headers });
      if (convRes.ok) {
        const convs = await convRes.json();
        setConversations(convs);
      }

      setLoadingPhase('AI-assistent en modellen klaarzetten…');
      setLoadingProgress(56);
      const modelsRes = await fetch('/api/models', { headers });
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        const activeModels = modelsData.filter((m: any) => m.isActive);
        setModels(activeModels);
        const codeMatchDefault = activeModels.find((m: any) => m.isCodeMatchOnly) || activeModels.find((m: any) => m.isDefault);
        if (codeMatchDefault) setSelectedModel(codeMatchDefault.ollamaName);
        else if (activeModels.length > 0) setSelectedModel(activeModels[0].ollamaName);
      }

      setLoadingPhase('GitHub-projecten ophalen…');
      setLoadingProgress(76);
      await fetchGithubProfile();

      setLoadingPhase('Workspace openen…');
      setLoadingProgress(100);
    } catch (e) {
      console.error(e);
      setStartupWarning('Een onderdeel kon niet worden geladen. De rest van CodeMatch blijft beschikbaar.');
    } finally {
      window.setTimeout(() => setLoading(false), 220);
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

  const renderAiMessage = (msg: AiMessage) => {
    if (msg.role === 'user') {
      return <div className="cm-ai-message cm-ai-message-user">{msg.content}</div>;
    }

    return (
      <div className="cm-ai-message cm-ai-message-assistant">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h1>{children}</h1>,
            h2: ({ children }) => <h2>{children}</h2>,
            h3: ({ children }) => <h3>{children}</h3>,
            p: ({ children }) => <p>{children}</p>,
            ul: ({ children }) => <ul>{children}</ul>,
            ol: ({ children }) => <ol>{children}</ol>,
            li: ({ children }) => <li>{children}</li>,
            blockquote: ({ children }) => <blockquote>{children}</blockquote>,
            hr: () => <hr />,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
            table: ({ children }) => (
              <div className="cm-md-table-wrap">
                <table>{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead>{children}</thead>,
            tbody: ({ children }) => <tbody>{children}</tbody>,
            tr: ({ children }) => <tr>{children}</tr>,
            th: ({ children }) => <th>{children}</th>,
            td: ({ children }) => <td>{children}</td>,
            code: ({ className, children }) => {
              const rawCode = String(children).replace(/\n$/, '');
              const language = className?.match(/language-([\w+-]+)/)?.[1] || 'code';
              const isBlock = Boolean(className) || rawCode.includes('\n');

              if (!isBlock) {
                return <code className="cm-md-inline-code">{children}</code>;
              }

              const lineCount = rawCode ? rawCode.split('\n').length : 0;
              return (
                <details className="cm-ai-code-dropdown">
                  <summary>
                    <span className="cm-ai-code-summary-left">
                      <span className="cm-ai-code-chevron">›</span>
                      <span className="cm-ai-code-label">Code</span>
                      <span className="cm-ai-code-language">{language}</span>
                      <span className="cm-ai-code-lines">{lineCount} {lineCount === 1 ? 'regel' : 'regels'}</span>
                    </span>
                    <span className="cm-ai-code-open-hint">Bekijken</span>
                  </summary>
                  <div className="cm-ai-code-body">
                    <div className="cm-ai-code-toolbar">
                      <span>Gegenereerde code</span>
                      <button
                        type="button"
                        className="cm-ai-code-apply"
                        onClick={() => applyCodeFromAi(rawCode)}
                      >
                        ✦ Toepassen
                      </button>
                    </div>
                    <pre><code className={className || ''}>{rawCode}</code></pre>
                  </div>
                </details>
              );
            },
          }}
        >
          {msg.content}
        </ReactMarkdown>
      </div>
    );
  };

  if (loading) {
    const loadingSteps = [
      { label: 'Toegang & instellingen', threshold: 18 },
      { label: 'Projectgeschiedenis', threshold: 36 },
      { label: 'AI-assistent', threshold: 56 },
      { label: 'GitHub-projecten', threshold: 76 },
      { label: 'Workspace', threshold: 100 },
    ];

    return (
      <div className="cm-loading" role="status" aria-live="polite">
        <style>{`
          .cm-loading{
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            position:relative;
            overflow:hidden;
            background:
              radial-gradient(circle at 18% 12%, rgba(99,102,241,.24), transparent 30%),
              radial-gradient(circle at 82% 85%, rgba(34,197,94,.16), transparent 28%),
              linear-gradient(145deg,#07101d,#0b1628 48%,#07111f);
            color:#e7eef8;
            font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          }
          .cm-loading-grid{
            position:absolute; inset:0; opacity:.16;
            background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
            background-size:32px 32px;
            mask-image:linear-gradient(to bottom,rgba(0,0,0,.7),transparent);
          }
          .cm-loading-card{
            position:relative; z-index:1; width:min(520px,calc(100vw - 36px));
            padding:34px; border:1px solid rgba(255,255,255,.1); border-radius:26px;
            background:linear-gradient(180deg,rgba(12,24,42,.92),rgba(7,17,31,.9));
            box-shadow:0 30px 100px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.04);
            backdrop-filter:blur(20px);
          }
          .cm-loading-brand{display:flex;align-items:center;gap:12px;margin-bottom:26px}
          .cm-loading-logo{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#818cf8,#6366f1);box-shadow:0 12px 35px rgba(99,102,241,.35);font-size:1.35rem}
          .cm-loading-title{font-size:1.15rem;font-weight:800;letter-spacing:-.02em}
          .cm-loading-sub{margin-top:3px;color:#7890ab;font-size:.78rem}
          .cm-loading-progress{height:8px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;margin:18px 0 22px}
          .cm-loading-progress > div{height:100%;border-radius:inherit;background:linear-gradient(90deg,#818cf8,#60a5fa,#4ade80);transition:width .45s ease}
          .cm-loading-meta{display:flex;justify-content:space-between;gap:12px;font-size:.78rem;color:#91a4bd;margin-bottom:14px}
          .cm-loading-steps{display:grid;gap:9px}
          .cm-loading-step{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05);color:#6f829b;font-size:.8rem}
          .cm-loading-step.done{color:#c7d6e7}
          .cm-loading-step.active{color:#eef5ff;border-color:rgba(129,140,248,.22);background:rgba(99,102,241,.07)}
          .cm-loading-dot{width:9px;height:9px;border-radius:50%;background:#334155;box-shadow:0 0 0 4px rgba(51,65,85,.18);flex:0 0 auto}
          .cm-loading-step.done .cm-loading-dot{background:#4ade80;box-shadow:0 0 0 4px rgba(74,222,128,.1)}
          .cm-loading-step.active .cm-loading-dot{background:#818cf8;box-shadow:0 0 0 4px rgba(129,140,248,.12);animation:cm-pulse 1.4s ease-in-out infinite}
          .cm-loading-note{margin-top:18px;padding:11px 12px;border-radius:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.18);color:#f6c66a;font-size:.76rem;line-height:1.5}
          .cm-loading-hint{margin-top:16px;text-align:center;color:#5f7188;font-size:.72rem}
          @keyframes cm-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.82);opacity:.6}}
        `}</style>
        <div className="cm-loading-grid" aria-hidden="true" />
        <div className="cm-loading-card">
          <div className="cm-loading-brand">
            <div className="cm-loading-logo">⌘</div>
            <div>
              <div className="cm-loading-title">CodeMatch voorbereiden</div>
              <div className="cm-loading-sub">Je development workspace wordt klaargezet</div>
            </div>
          </div>

          <div className="cm-loading-meta">
            <span>{loadingPhase}</span>
            <strong>{loadingProgress}%</strong>
          </div>
          <div className="cm-loading-progress" aria-hidden="true"><div style={{width:`${loadingProgress}%`}} /></div>

          <div className="cm-loading-steps">
            {loadingSteps.map((step) => {
              const done = loadingProgress >= step.threshold;
              const active = !done && loadingProgress < step.threshold && loadingPhase.toLowerCase().includes(step.label.split(' ')[0].toLowerCase());
              return (
                <div key={step.label} className={`cm-loading-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
                  <span className="cm-loading-dot" />
                  <span style={{flex:1}}>{step.label}</span>
                  <span aria-hidden="true">{done ? '✓' : active ? '…' : ''}</span>
                </div>
              );
            })}
          </div>

          {(loadingSlow || startupWarning) && (
            <div className="cm-loading-note">
              {startupWarning || 'Dit duurt iets langer dan normaal. De verbinding wordt nog gecontroleerd…'}
            </div>
          )}
          <div className="cm-loading-hint">CodeMatch blijft veilig laden — je hoeft niets opnieuw te starten.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="cm-shell">
      <style>{`
        :root{
          --cm-bg:#07111f;
          --cm-panel:#0b1728;
          --cm-panel-2:#0e1b2f;
          --cm-panel-3:#101f34;
          --cm-border:rgba(148,163,184,.13);
          --cm-border-strong:rgba(148,163,184,.2);
          --cm-text:#eef5ff;
          --cm-text-2:#b8c7da;
          --cm-muted:#71839a;
          --cm-green:#4ade80;
          --cm-blue:#60a5fa;
          --cm-indigo:#818cf8;
          --cm-shadow:0 24px 80px rgba(0,0,0,.32);
        }
        .cm-shell{
          --cm-radius:18px;
          height:100vh;
          overflow:hidden;
          display:flex;
          flex-direction:column;
          color:var(--cm-text);
          background:
            radial-gradient(circle at 15% -10%, rgba(99,102,241,.15), transparent 30%),
            radial-gradient(circle at 100% 100%, rgba(34,197,94,.08), transparent 26%),
            linear-gradient(180deg,#07111f 0%,#081322 100%);
          font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          letter-spacing:.002em;
        }
        .cm-shell *{box-sizing:border-box}
        .cm-topbar{
          height:68px;
          flex:none;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:18px;
          padding:0 18px;
          border-bottom:1px solid var(--cm-border);
          background:rgba(6,15,27,.84);
          backdrop-filter:blur(18px);
          box-shadow:0 1px 0 rgba(255,255,255,.02);
        }
        .cm-brand{
          display:flex;
          align-items:center;
          gap:12px;
          min-width:220px;
        }
        .cm-brand-mark{
          width:38px;height:38px;
          display:grid;place-items:center;
          border-radius:12px;
          background:linear-gradient(135deg,#151f38,#0f2630);
          border:1px solid rgba(96,165,250,.22);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 10px 30px rgba(0,0,0,.22);
          font-size:1.1rem;
        }
        .cm-brand-title{font-weight:900;font-size:1rem;letter-spacing:-.02em}
        .cm-brand-sub{font-size:.72rem;color:var(--cm-muted);margin-top:2px}
        .cm-top-center{
          flex:1;
          min-width:0;
          display:flex;
          justify-content:center;
        }
        .cm-breadcrumb{
          max-width:min(48vw,720px);
          display:flex;align-items:center;gap:9px;
          padding:9px 13px;
          border:1px solid var(--cm-border);
          border-radius:12px;
          background:rgba(255,255,255,.025);
          color:var(--cm-text-2);
          font-size:.78rem;
          min-width:180px;
        }
        .cm-breadcrumb .dot{opacity:.35}
        .cm-breadcrumb strong{
          color:var(--cm-text);
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .cm-top-actions{display:flex;align-items:center;gap:9px}
        .cm-icon-btn,.cm-top-btn{
          border:1px solid var(--cm-border);
          color:var(--cm-text-2);
          background:rgba(255,255,255,.035);
          border-radius:11px;
          cursor:pointer;
          transition:transform .16s ease,background .16s ease,border-color .16s ease,color .16s ease;
        }
        .cm-icon-btn{width:38px;height:38px;display:grid;place-items:center;font-size:.98rem}
        .cm-top-btn{padding:9px 12px;font-size:.78rem;font-weight:800}
        .cm-icon-btn:hover,.cm-top-btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.07);border-color:var(--cm-border-strong);color:#fff}
        .cm-top-btn.ai{
          color:#d6d8ff;
          border-color:rgba(129,140,248,.28);
          background:linear-gradient(135deg,rgba(99,102,241,.17),rgba(56,189,248,.08));
        }
        .cm-account{
          display:flex;align-items:center;gap:9px;
          padding:5px 8px 5px 6px;
          border:1px solid var(--cm-border);
          border-radius:999px;
          background:rgba(255,255,255,.028);
        }
        .cm-account-dot{width:8px;height:8px;border-radius:50%;background:var(--cm-green);box-shadow:0 0 0 4px rgba(74,222,128,.1)}
        .cm-account-name{font-size:.77rem;font-weight:800}
        .cm-disconnect{
          border:0;background:transparent;color:#fda4af;cursor:pointer;
          padding:3px 6px;border-radius:7px;font-size:.7rem;font-weight:700;
        }
        .cm-disconnect:hover{background:rgba(244,63,94,.08)}
        .cm-workspace{
          min-height:0;
          flex:1;
          display:grid;
          grid-template-columns:290px minmax(0,1fr) var(--cm-ai-width,420px);
          gap:10px;
          padding:10px;
        }
        .cm-workspace.no-ai{grid-template-columns:290px minmax(0,1fr)}
        .cm-card{
          min-width:0;
          min-height:0;
          border:1px solid var(--cm-border);
          border-radius:var(--cm-radius);
          background:linear-gradient(180deg,rgba(14,27,47,.96),rgba(9,21,36,.96));
          box-shadow:var(--cm-shadow);
          overflow:hidden;
        }
        .cm-sidebar,.cm-editor-pane,.cm-ai-pane{display:flex;flex-direction:column;min-height:0}
        .cm-sidebar{padding:12px}
        .cm-sidebar-header{
          display:flex;align-items:center;justify-content:space-between;
          padding:4px 3px 12px;
        }
        .cm-section-label{
          font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#6f829a;
        }
        .cm-add-btn{
          width:32px;height:32px;border-radius:10px;
          border:1px solid rgba(74,222,128,.18);
          background:rgba(74,222,128,.08);color:#86efac;
          cursor:pointer;font-size:1.1rem;font-weight:700;
        }
        .cm-add-btn:hover{background:rgba(74,222,128,.14)}
        .cm-projects{overflow:auto;display:flex;flex-direction:column;gap:5px;padding-right:2px}
        .cm-project{
          width:100%;padding:11px 11px;border-radius:12px;
          border:1px solid transparent;background:transparent;color:var(--cm-text-2);
          cursor:pointer;text-align:left;transition:all .16s ease;
        }
        .cm-project:hover{background:rgba(255,255,255,.035);border-color:rgba(255,255,255,.06)}
        .cm-project.active{
          background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(56,189,248,.045));
          border-color:rgba(129,140,248,.23);
          color:#fff;
          box-shadow:inset 3px 0 0 #818cf8;
        }
        .cm-project-main{display:flex;align-items:center;gap:8px;font-size:.81rem;font-weight:800}
        .cm-project-meta{display:flex;gap:8px;padding-left:23px;margin-top:4px;font-size:.67rem;color:#64788e}
        .cm-file-head{
          display:flex;align-items:center;justify-content:space-between;
          padding:16px 4px 10px;
          margin-top:5px;
          border-top:1px solid rgba(255,255,255,.05);
        }
        .cm-mini-btn{
          border:1px solid var(--cm-border);background:rgba(255,255,255,.03);
          color:#9db0c8;cursor:pointer;padding:6px 9px;border-radius:8px;font-size:.67rem;font-weight:800;
        }
        .cm-mini-btn:hover{color:#fff;background:rgba(255,255,255,.07)}
        .cm-files{overflow:auto;flex:1;padding-right:2px}
        .cm-file{
          width:100%;display:flex;align-items:center;gap:8px;
          padding:8px 10px;border-radius:9px;border:1px solid transparent;
          background:transparent;color:#8fa2b8;cursor:pointer;text-align:left;
          font-size:.73rem;transition:all .15s ease;
        }
        .cm-file:hover{background:rgba(255,255,255,.03);color:#dbe8f7}
        .cm-file.active{background:rgba(99,102,241,.11);border-color:rgba(129,140,248,.16);color:#c7d2fe}
        .cm-file-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cm-sidebar-empty{
          padding:24px 10px;color:#61748c;font-size:.74rem;text-align:center;
          border:1px dashed rgba(148,163,184,.1);border-radius:12px;
        }
        .cm-editor-pane{position:relative}
        .cm-editor-tabs{
          display:flex;align-items:center;justify-content:space-between;
          min-height:56px;padding:0 12px;
          border-bottom:1px solid var(--cm-border);
          background:rgba(8,18,31,.74);
        }
        .cm-open-file{
          display:flex;align-items:center;gap:10px;min-width:0;
        }
        .cm-file-icon{
          width:30px;height:30px;border-radius:9px;display:grid;place-items:center;
          background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.12);
          color:#93c5fd;font-size:.8rem;
        }
        .cm-open-path{min-width:0}
        .cm-open-path-top{display:flex;align-items:center;gap:7px;font-size:.74rem;color:#6f8298}
        .cm-open-path-name{font-weight:800;color:#e8f1fb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40vw}
        .cm-open-status{font-size:.65rem;font-weight:800}
        .cm-open-status.unsaved{color:#fbbf24}
        .cm-open-status.saved{color:#86efac}
        .cm-toolbar{display:flex;align-items:center;gap:7px}
        .cm-toolbar-btn{
          display:inline-flex;align-items:center;gap:7px;
          padding:8px 11px;border-radius:10px;
          border:1px solid var(--cm-border);background:rgba(255,255,255,.03);
          color:#a9bbd0;cursor:pointer;font-size:.71rem;font-weight:800;
        }
        .cm-toolbar-btn:hover:not(:disabled){background:rgba(255,255,255,.07);color:#fff}
        .cm-toolbar-btn.primary{
          color:#06220f;background:linear-gradient(135deg,#4ade80,#22c55e);
          border-color:transparent;box-shadow:0 8px 20px rgba(34,197,94,.12);
        }
        .cm-toolbar-btn:disabled{opacity:.45;cursor:default}
        .cm-editor-body{flex:1;min-height:0;position:relative;background:#0a101b}
        .cm-empty-editor{
          height:100%;display:flex;align-items:center;justify-content:center;padding:32px;
          background:
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px),
            #0a101b;
          background-size:34px 34px;
        }
        .cm-empty-inner{max-width:620px;text-align:center}
        .cm-empty-icon{
          width:76px;height:76px;border-radius:24px;display:grid;place-items:center;margin:0 auto 18px;
          background:linear-gradient(135deg,rgba(99,102,241,.18),rgba(96,165,250,.08));
          border:1px solid rgba(129,140,248,.2);font-size:2rem;
          box-shadow:0 20px 55px rgba(79,70,229,.12);
        }
        .cm-empty-title{font-size:1.45rem;font-weight:900;letter-spacing:-.03em;margin-bottom:8px}
        .cm-empty-copy{max-width:510px;margin:0 auto;color:#73869d;line-height:1.65;font-size:.83rem}
        .cm-empty-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:24px}
        .cm-empty-tile{
          padding:14px;text-align:left;border-radius:14px;border:1px solid rgba(255,255,255,.06);
          background:rgba(255,255,255,.024);
        }
        .cm-empty-tile-icon{font-size:1rem;margin-bottom:8px}
        .cm-empty-tile-title{font-size:.73rem;font-weight:900;color:#dbe7f5;margin-bottom:3px}
        .cm-empty-tile-copy{font-size:.66rem;color:#687b92;line-height:1.5}
        .cm-statusbar{
          height:28px;flex:none;display:flex;align-items:center;justify-content:space-between;
          padding:0 10px;color:#67809a;font-size:.64rem;
          border-top:1px solid rgba(255,255,255,.05);background:#08111e;
        }
        .cm-status-left,.cm-status-right{display:flex;align-items:center;gap:12px}
        .cm-status-pill{display:inline-flex;align-items:center;gap:5px}
        .cm-status-dot{width:6px;height:6px;border-radius:50%;background:#22c55e}
        .cm-ai-pane{background:linear-gradient(180deg,rgba(13,27,46,.98),rgba(8,18,31,.98));position:relative;overflow:visible}
        .cm-ai-resize-handle{
          position:absolute;left:-7px;top:12px;bottom:12px;width:14px;z-index:8;
          display:flex;align-items:center;justify-content:center;cursor:col-resize;
        }
        .cm-ai-resize-handle span{
          width:3px;height:42px;border-radius:999px;background:rgba(148,163,184,.12);
          box-shadow:0 0 0 1px rgba(255,255,255,.02);transition:height .16s ease,background .16s ease,box-shadow .16s ease;
        }
        .cm-ai-resize-handle:hover span,.cm-ai-resize-handle.active span{
          height:64px;background:linear-gradient(180deg,#818cf8,#60a5fa);box-shadow:0 0 18px rgba(99,102,241,.35);
        }
        .cm-ai-head{
          min-height:70px;padding:12px 14px;
          display:flex;align-items:center;justify-content:space-between;gap:10px;
          border-bottom:1px solid var(--cm-border);
        }
        .cm-ai-title-wrap{display:flex;align-items:center;gap:10px}
        .cm-ai-orb{
          width:38px;height:38px;border-radius:12px;display:grid;place-items:center;
          background:radial-gradient(circle at 35% 30%,#c4b5fd,#6366f1 55%,#4338ca);
          box-shadow:0 10px 30px rgba(99,102,241,.24);
          font-size:1rem;
        }
        .cm-ai-title{font-size:.83rem;font-weight:900}
        .cm-ai-sub{font-size:.66rem;color:#667b94;margin-top:2px}
        .cm-ai-actions{display:flex;align-items:center;gap:6px}
        .cm-ai-actions select{
          max-width:140px;
          background:#0c1829;color:#a9bdd4;border:1px solid var(--cm-border);
          padding:7px 9px;border-radius:9px;font-size:.65rem;outline:none;
        }
        .cm-ai-new{
          border:1px solid rgba(129,140,248,.18);
          color:#c7d2fe;background:rgba(99,102,241,.11);
          padding:7px 9px;border-radius:9px;font-size:.65rem;font-weight:800;cursor:pointer;
        }
        .cm-ai-close{
          border:0;background:transparent;color:#657990;cursor:pointer;font-size:1.1rem;padding:5px 6px;
        }
        .cm-ai-close:hover{color:#fff}
        .cm-ai-width-reset{
          border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025);color:#7890a8;
          width:30px;height:30px;border-radius:9px;cursor:pointer;font-size:.78rem;font-weight:800;
        }
        .cm-ai-width-reset:hover{color:#fff;background:rgba(255,255,255,.06)}
        .cm-ai-message{
          width:100%;font-size:.76rem;line-height:1.68;
        }
        .cm-ai-message-user{
          align-self:flex-end;max-width:88%;background:linear-gradient(135deg,rgba(99,102,241,.22),rgba(79,70,229,.12));
          border:1px solid rgba(129,140,248,.16);padding:11px 13px;border-radius:15px 15px 5px 15px;color:#e8ecff;
          white-space:pre-wrap;
        }
        .cm-ai-message-assistant{
          align-self:flex-start;max-width:100%;padding:13px 14px;border-radius:15px 15px 15px 5px;
          border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.038);color:#d2dceb;overflow:hidden;
        }
        .cm-ai-message-assistant > *:first-child{margin-top:0}
        .cm-ai-message-assistant > *:last-child{margin-bottom:0}
        .cm-ai-message-assistant p{margin:0 0 10px;color:#d2dceb}
        .cm-ai-message-assistant h1,.cm-ai-message-assistant h2,.cm-ai-message-assistant h3{
          color:#f2f6fb;line-height:1.25;letter-spacing:-.02em;margin:15px 0 8px;font-weight:900;
        }
        .cm-ai-message-assistant h1{font-size:1rem}.cm-ai-message-assistant h2{font-size:.9rem}.cm-ai-message-assistant h3{font-size:.82rem}
        .cm-ai-message-assistant ul,.cm-ai-message-assistant ol{margin:6px 0 12px;padding-left:20px}
        .cm-ai-message-assistant li{margin:4px 0;padding-left:2px}
        .cm-ai-message-assistant strong{color:#fff;font-weight:850}
        .cm-ai-message-assistant em{color:#bcc9dc}
        .cm-ai-message-assistant blockquote{
          margin:10px 0;padding:9px 12px;border-left:3px solid #818cf8;background:rgba(129,140,248,.07);
          border-radius:0 10px 10px 0;color:#aebbd0;
        }
        .cm-ai-message-assistant hr{border:0;border-top:1px solid rgba(255,255,255,.08);margin:14px 0}
        .cm-ai-message-assistant a{color:#93c5fd;text-decoration:none}.cm-ai-message-assistant a:hover{text-decoration:underline}
        .cm-md-inline-code{padding:2px 5px;border-radius:6px;background:#091523;border:1px solid rgba(255,255,255,.08);color:#c4b5fd;font-family:'Fira Code','Cascadia Code','JetBrains Mono',monospace;font-size:.68rem}
        .cm-md-table-wrap{width:100%;overflow:auto;margin:10px 0 12px;border:1px solid rgba(255,255,255,.08);border-radius:10px}
        .cm-md-table-wrap table{width:100%;border-collapse:collapse;min-width:420px;font-size:.68rem}
        .cm-md-table-wrap th,.cm-md-table-wrap td{padding:8px 9px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:top}
        .cm-md-table-wrap th{background:rgba(255,255,255,.035);color:#eef5ff;font-weight:850}
        .cm-md-table-wrap td{color:#aebcd0}.cm-md-table-wrap tr:last-child td{border-bottom:0}
        .cm-ai-code-dropdown{margin:10px 0;border:1px solid rgba(148,163,184,.11);border-radius:12px;overflow:hidden;background:#07111d}
        .cm-ai-code-dropdown summary{
          list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;
          cursor:pointer;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.018));color:#a7b8cc;
        }
        .cm-ai-code-dropdown summary::-webkit-details-marker{display:none}
        .cm-ai-code-summary-left{display:flex;align-items:center;gap:7px;min-width:0}
        .cm-ai-code-chevron{width:17px;height:17px;display:grid;place-items:center;border-radius:5px;background:rgba(255,255,255,.05);font-size:.72rem;transition:transform .16s ease}
        .cm-ai-code-dropdown[open] .cm-ai-code-chevron{transform:rotate(90deg)}
        .cm-ai-code-label{font-size:.68rem;font-weight:850;color:#d8e3ef}.cm-ai-code-language{font-size:.6rem;padding:3px 6px;border-radius:999px;background:rgba(99,102,241,.1);color:#b8c0ff}
        .cm-ai-code-lines{font-size:.58rem;color:#647990;white-space:nowrap}.cm-ai-code-open-hint{font-size:.58rem;color:#647990}.cm-ai-code-summary-actions{display:flex;align-items:center}
        .cm-ai-code-apply{border:1px solid rgba(74,222,128,.18);background:rgba(74,222,128,.08);color:#86efac;padding:5px 8px;border-radius:8px;cursor:pointer;font-size:.6rem;font-weight:850}
        .cm-ai-code-apply:hover{background:rgba(74,222,128,.15);color:#bbf7d0}
        .cm-ai-code-body{border-top:1px solid rgba(255,255,255,.06)}
        .cm-ai-code-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;background:rgba(255,255,255,.018);font-size:.58rem;color:#61758c}
        .cm-ai-code-dropdown pre{margin:0;padding:12px;overflow:auto;border-top:1px solid rgba(255,255,255,.06);background:#050b13}
        .cm-ai-code-dropdown pre code{display:block;color:#d8e2ee;font:12px/1.65 'Fira Code','Cascadia Code','JetBrains Mono',monospace;white-space:pre}
        .cm-ai-context{
          margin:10px 12px 0;padding:9px 10px;
          border:1px solid rgba(96,165,250,.14);border-radius:10px;
          background:rgba(96,165,250,.045);color:#8fa6bf;font-size:.67rem;
        }
        .cm-ai-context strong{color:#c7d8eb}
        .cm-ai-messages{
          flex:1;min-height:0;overflow:auto;padding:14px 12px;
          display:flex;flex-direction:column;gap:12px;
        }
        .cm-ai-empty{
          margin:auto 0;padding:28px 14px;text-align:center;color:#657990;
        }
        .cm-ai-empty-icon{font-size:1.9rem;margin-bottom:10px}
        .cm-ai-empty-title{font-weight:900;color:#cdd8e6;font-size:.8rem;margin-bottom:5px}
        .cm-ai-empty-copy{font-size:.68rem;line-height:1.6}
        .cm-ai-quick{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:14px}
        .cm-ai-quick button{
          border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);color:#93a7bd;
          padding:6px 8px;border-radius:999px;font-size:.62rem;cursor:pointer;
        }
        .cm-ai-quick button:hover{background:rgba(255,255,255,.06);color:#fff}
        .cm-ai-composer{
          padding:11px;border-top:1px solid var(--cm-border);background:rgba(6,15,27,.58);
        }
        .cm-ai-input-row{display:flex;align-items:flex-end;gap:8px}
        .cm-ai-input{
          flex:1;min-height:44px;max-height:140px;min-height:44px;resize:vertical;
          background:#091523;border:1px solid var(--cm-border);color:#e7f0fb;
          padding:11px 12px;border-radius:12px;outline:none;font:inherit;font-size:.73rem;line-height:1.45;overflow:auto;
        }
        .cm-ai-input:focus{border-color:rgba(129,140,248,.38);box-shadow:0 0 0 3px rgba(99,102,241,.08)}
        .cm-ai-send{
          width:44px;height:44px;border-radius:12px;border:0;cursor:pointer;
          color:#fff;background:linear-gradient(135deg,#6366f1,#4f46e5);font-size:1rem;font-weight:900;
          box-shadow:0 8px 22px rgba(79,70,229,.22);
        }
        .cm-ai-send:disabled{opacity:.4;cursor:default;box-shadow:none}
        .cm-ai-tip{font-size:.61rem;color:#536a82;margin-top:7px;padding:0 2px}
        .cm-modal-backdrop{
          position:fixed;inset:0;z-index:100;
          display:flex;align-items:center;justify-content:center;padding:24px;
          background:rgba(2,7,16,.72);backdrop-filter:blur(14px);
        }
        .cm-modal{
          width:min(520px,100%);
          border:1px solid rgba(255,255,255,.1);border-radius:22px;
          background:linear-gradient(180deg,#101f34,#0a1728);
          box-shadow:0 40px 120px rgba(0,0,0,.48);
          overflow:hidden;
        }
        .cm-modal-head{padding:22px 22px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
        .cm-modal-title{font-size:1rem;font-weight:900;letter-spacing:-.02em}
        .cm-modal-copy{font-size:.72rem;color:#70839a;line-height:1.6;margin-top:5px}
        .cm-modal-body{padding:20px 22px}
        .cm-field{margin-bottom:15px}
        .cm-field label{display:block;font-size:.7rem;font-weight:800;color:#aabbd0;margin-bottom:7px}
        .cm-field input{
          width:100%;background:#091523;color:#e6eef8;border:1px solid var(--cm-border);
          border-radius:11px;padding:11px 12px;font:inherit;font-size:.76rem;outline:none;
        }
        .cm-field input:focus{border-color:rgba(129,140,248,.38);box-shadow:0 0 0 3px rgba(99,102,241,.08)}
        .cm-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:16px 22px;border-top:1px solid rgba(255,255,255,.06)}
        .cm-modal-btn{border:1px solid var(--cm-border);background:rgba(255,255,255,.035);color:#a8bbcf;border-radius:10px;padding:10px 13px;font-size:.72rem;font-weight:800;cursor:pointer}
        .cm-modal-btn.primary{border-color:transparent;background:linear-gradient(135deg,#4ade80,#22c55e);color:#07200f}
        .cm-modal-btn:disabled{opacity:.45;cursor:default}
        .cm-github-state{
          flex:1;display:flex;align-items:center;justify-content:center;padding:40px;position:relative;overflow:auto;
        }
        .cm-github-state::before{
          content:"";position:absolute;inset:8% 12%;
          background:radial-gradient(circle,rgba(99,102,241,.12),transparent 52%);
          pointer-events:none;
        }
        .cm-github-card{
          position:relative;z-index:1;width:min(820px,100%);
          display:grid;grid-template-columns:1.1fr .9fr;
          gap:18px;padding:18px;
          border:1px solid var(--cm-border);border-radius:26px;
          background:linear-gradient(135deg,rgba(14,27,47,.96),rgba(9,18,31,.96));
          box-shadow:0 28px 100px rgba(0,0,0,.34);
        }
        .cm-github-main{
          padding:26px;
          border-radius:18px;
          background:linear-gradient(145deg,rgba(99,102,241,.1),rgba(96,165,250,.035));
          border:1px solid rgba(129,140,248,.12);
        }
        .cm-github-mark{
          width:56px;height:56px;border-radius:17px;display:grid;place-items:center;
          background:#0b1018;border:1px solid rgba(255,255,255,.1);font-size:1.45rem;margin-bottom:20px;
        }
        .cm-github-title{font-size:2rem;font-weight:950;letter-spacing:-.045em;margin-bottom:10px}
        .cm-github-copy{font-size:.86rem;color:#7f93aa;line-height:1.7;max-width:560px}
        .cm-github-points{display:grid;gap:9px;margin-top:22px}
        .cm-github-point{display:flex;align-items:flex-start;gap:9px;font-size:.72rem;color:#96abc0}
        .cm-github-point-icon{width:24px;height:24px;border-radius:8px;display:grid;place-items:center;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.12)}
        .cm-github-side{
          display:flex;flex-direction:column;justify-content:space-between;gap:16px;
          padding:22px;border-radius:18px;background:#091523;border:1px solid rgba(255,255,255,.05);
        }
        .cm-connect-eyebrow{font-size:.66rem;color:#647990;text-transform:uppercase;font-weight:900;letter-spacing:.12em}
        .cm-connect-title{font-size:1rem;font-weight:900;margin-top:6px}
        .cm-connect-copy{font-size:.7rem;color:#70849a;line-height:1.6;margin-top:6px}
        .cm-connect-btn{
          width:100%;display:flex;align-items:center;justify-content:center;gap:9px;
          padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.1);
          background:#111827;color:#fff;cursor:pointer;font-size:.75rem;font-weight:900;
        }
        .cm-connect-btn:hover{background:#172033;border-color:rgba(255,255,255,.16)}
        .cm-alert{
          padding:11px 12px;border-radius:11px;border:1px solid rgba(244,63,94,.18);
          background:rgba(244,63,94,.07);color:#fda4af;font-size:.7rem;line-height:1.55;
        }
        .cm-kbd{
          display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:20px;
          padding:0 5px;border:1px solid rgba(255,255,255,.1);border-bottom-color:rgba(255,255,255,.18);
          border-radius:6px;background:rgba(255,255,255,.035);font-size:.58rem;color:#74879d;
        }
        @media (max-width:1180px){
          .cm-workspace{grid-template-columns:260px minmax(0,1fr) var(--cm-ai-width,330px)}
          .cm-workspace.no-ai{grid-template-columns:260px minmax(0,1fr)}
          .cm-top-center{display:none}
        }
        @media (max-width:900px){
          .cm-workspace,.cm-workspace.no-ai{grid-template-columns:220px minmax(0,1fr)}
          .cm-ai-pane{position:absolute;right:10px;top:78px;bottom:10px;width:min(var(--cm-ai-width,420px),calc(100vw - 30px));z-index:20}
          .cm-top-btn.ai{padding:9px 10px}
          .cm-account-name{display:none}
          .cm-github-card{grid-template-columns:1fr}
        }
        @media (max-width:680px){
          .cm-workspace,.cm-workspace.no-ai{grid-template-columns:1fr;padding:7px;gap:7px}
          .cm-sidebar{display:none}
          .cm-topbar{padding:0 10px;height:62px}
          .cm-brand{min-width:0}
          .cm-brand-sub,.cm-account,.cm-disconnect{display:none}
          .cm-brand-mark{width:34px;height:34px}
          .cm-top-btn.ai{font-size:.68rem}
          .cm-toolbar-btn span.label{display:none}
          .cm-open-path-name{max-width:42vw}
          .cm-empty-grid{grid-template-columns:1fr}
          .cm-statusbar{display:none}
          .cm-github-state{padding:16px}
          .cm-github-main{padding:20px}
          .cm-github-title{font-size:1.55rem}
        }
      `}</style>

      <header className="cm-topbar">
        <div className="cm-brand">
          <div className="cm-brand-mark">⌘</div>
          <div>
            <div className="cm-brand-title">CodeMatch</div>
            <div className="cm-brand-sub">Build smarter · ship with confidence</div>
          </div>
        </div>

        <div className="cm-top-center">
          <div className="cm-breadcrumb">
            <span>Workspace</span>
            <span className="dot">/</span>
            <strong>{selectedRepo ? selectedRepo.name : 'Startpunt'}</strong>
            {openFile && (
              <>
                <span className="dot">/</span>
                <strong>{openFile.name}</strong>
              </>
            )}
          </div>
        </div>

        <div className="cm-top-actions">
          {isGithubConnected && (
            <button
              className="cm-top-btn ai"
              onClick={() => setShowAiChat(!showAiChat)}
              aria-pressed={showAiChat}
            >
              ✦ <span>{showAiChat ? 'AI sluiten' : 'AI Assistent'}</span>
            </button>
          )}

          {isGithubConnected && (
            <div className="cm-account" title={`Verbonden met GitHub als ${githubUsername}`}>
              <span className="cm-account-dot" />
              <span className="cm-account-name">{githubUsername}</span>
            </div>
          )}

          {isGithubConnected && (
            <button className="cm-disconnect" onClick={handleDisconnect}>
              Ontkoppelen
            </button>
          )}

          <button className="cm-icon-btn" onClick={() => navigate('/chat')} aria-label="Terug naar chat" title="Terug naar chat">
            ←
          </button>
        </div>
      </header>

      {!isGithubConnected ? (
        <main className="cm-github-state">
          <div className="cm-github-card">
            <div className="cm-github-main">
              <div className="cm-github-mark">◉</div>
              <div className="cm-github-title">Jouw code.<br />Jouw projecten.<br />Één slimme workspace.</div>
              <p className="cm-github-copy">
                Koppel GitHub en werk direct vanuit CodeMatch aan echte repositories. Open bestanden in Monaco,
                laat de AI-assistent meedenken en commit wijzigingen zonder uit je workflow te stappen.
              </p>

              <div className="cm-github-points">
                <div className="cm-github-point"><span className="cm-github-point-icon">✓</span><span>Bekijk en bewerk echte projectbestanden in één omgeving.</span></div>
                <div className="cm-github-point"><span className="cm-github-point-icon">✦</span><span>Krijg hulp van AI met de context van je huidige bestand.</span></div>
                <div className="cm-github-point"><span className="cm-github-point-icon">↗</span><span>Werk met branches, commits en je bestaande GitHub-projecten.</span></div>
              </div>
            </div>

            <div className="cm-github-side">
              <div>
                <div className="cm-connect-eyebrow">Workspace access</div>
                <div className="cm-connect-title">Verbind GitHub om te beginnen</div>
                <div className="cm-connect-copy">
                  CodeMatch gebruikt je gekoppelde GitHub-account om je repositories en bestanden te tonen.
                </div>
              </div>

              <div>
                {!githubConfigured ? (
                  <div className="cm-alert">
                    ⚠️ GitHub is nog niet geconfigureerd door de beheerder. Vraag je beheerder om dit in te stellen via het CodeMatch instellingenpaneel.
                  </div>
                ) : (
                  <button className="cm-connect-btn" onClick={handleConnectGithub}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    Inloggen met GitHub
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className={`cm-workspace ${showAiChat ? '' : 'no-ai'}`} style={{ '--cm-ai-width': `${aiChatWidth}px` } as CSSProperties}>
          <aside className="cm-card cm-sidebar">
            <div className="cm-sidebar-header">
              <div>
                <div className="cm-section-label">Projecten</div>
                <div style={{fontSize:'.68rem',color:'#536a82',marginTop:3}}>{repos.length} gekoppeld</div>
              </div>
              <button className="cm-add-btn" onClick={() => setShowNewRepo(true)} title="Nieuw project">+</button>
            </div>

            <div className="cm-projects">
              {repos.map(repo => (
                <button
                  key={repo.id}
                  className={`cm-project ${selectedRepo?.id === repo.id ? 'active' : ''}`}
                  onClick={() => selectRepo(repo)}
                >
                  <div className="cm-project-main">
                    <span>{repo.private ? '🔒' : '🌐'}</span>
                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{repo.name}</span>
                  </div>
                  <div className="cm-project-meta">
                    {repo.language && <span>{repo.language}</span>}
                    <span>{timeAgo(repo.updated_at)}</span>
                  </div>
                </button>
              ))}

              {repos.length === 0 && (
                <div className="cm-sidebar-empty">
                  Nog geen repositories gevonden.<br />Maak een project aan of controleer GitHub.
                </div>
              )}
            </div>

            {selectedRepo && (
              <>
                <div className="cm-file-head">
                  <div>
                    <div className="cm-section-label">Bestanden</div>
                    <div style={{fontSize:'.66rem',color:'#536a82',marginTop:3}}>
                      {fileTree.length} items · {selectedRepo.default_branch}
                    </div>
                  </div>
                  <button className="cm-mini-btn" onClick={handleCreateFile}>+ Nieuw</button>
                </div>

                <div className="cm-files">
                  {fileTree.map(item => (
                    <button
                      key={item.sha}
                      className={`cm-file ${openFile?.path === item.path ? 'active' : ''}`}
                      onClick={() => openFileFromTree(item)}
                    >
                      <span>📄</span>
                      <span className="cm-file-name">{item.path}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </aside>

          <section className="cm-card cm-editor-pane">
            {openFile ? (
              <>
                <div className="cm-editor-tabs">
                  <div className="cm-open-file">
                    <div className="cm-file-icon">⌁</div>
                    <div className="cm-open-path">
                      <div className="cm-open-path-top">
                        <span>{selectedRepo?.name}</span>
                        <span className="dot">/</span>
                        <span className="cm-open-path-name">{openFile.path}</span>
                      </div>
                      {unsaved ? (
                        <div className="cm-open-status unsaved">● Niet opgeslagen</div>
                      ) : (
                        <div className="cm-open-status saved">✓ Synced met GitHub</div>
                      )}
                    </div>
                  </div>

                  <div className="cm-toolbar">
                    <button
                      className={`cm-toolbar-btn ${unsaved ? 'primary' : ''}`}
                      onClick={handleSaveFile}
                      disabled={!unsaved || saving}
                    >
                      {saving ? 'Opslaan…' : '💾'} <span className="label">{saving ? '' : 'Opslaan & committen'}</span>
                    </button>
                  </div>
                </div>

                <div className="cm-editor-body">
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
                      padding: { top: 18, bottom: 18 },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
                      fontLigatures: true,
                      bracketPairColorization: { enabled: true },
                      cursorBlinking: 'smooth',
                      smoothScrolling: true,
                      renderLineHighlight: 'line',
                      guides: { bracketPairs: true, indentation: true },
                      stickyScroll: { enabled: true },
                    }}
                  />
                </div>

                <div className="cm-statusbar">
                  <div className="cm-status-left">
                    <span className="cm-status-pill"><span className="cm-status-dot" /> GitHub connected</span>
                    <span>{getLanguage(openFile.name)}</span>
                    <span>{selectedRepo?.default_branch}</span>
                  </div>
                  <div className="cm-status-right">
                    <span><span className="cm-kbd">⌘</span> AI</span>
                    <span>CodeMatch workspace</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="cm-empty-editor">
                <div className="cm-empty-inner">
                  <div className="cm-empty-icon">⌁</div>
                  <div className="cm-empty-title">
                    {selectedRepo ? 'Kies een bestand om te beginnen' : 'Welkom in CodeMatch'}
                  </div>
                  <p className="cm-empty-copy">
                    {selectedRepo
                      ? 'Open een bestand uit je project en gebruik de editor om direct te werken. De AI-assistent kan meelezen met het geopende bestand.'
                      : 'Kies links een project, open daarna een bestand en laat CodeMatch je hele programmeerworkflow vanuit één rustige workspace begeleiden.'}
                  </p>

                  <div className="cm-empty-grid">
                    <div className="cm-empty-tile">
                      <div className="cm-empty-tile-icon">⌁</div>
                      <div className="cm-empty-tile-title">Direct bewerken</div>
                      <div className="cm-empty-tile-copy">Monaco Editor met syntax highlighting, minimap en slimme navigatie.</div>
                    </div>
                    <div className="cm-empty-tile">
                      <div className="cm-empty-tile-icon">✦</div>
                      <div className="cm-empty-tile-title">AI met context</div>
                      <div className="cm-empty-tile-copy">Vraag hulp over precies het bestand waar je aan werkt.</div>
                    </div>
                    <div className="cm-empty-tile">
                      <div className="cm-empty-tile-icon">↗</div>
                      <div className="cm-empty-tile-title">Opslaan & committen</div>
                      <div className="cm-empty-tile-copy">Breng wijzigingen terug naar GitHub zodra je klaar bent.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {showAiChat && (
            <aside className="cm-card cm-ai-pane">
              <div
                className={`cm-ai-resize-handle ${isResizingChat ? 'active' : ''}`}
                onMouseDown={startAiChatResize}
                role="separator"
                aria-orientation="vertical"
                aria-label="Chatbreedte aanpassen"
                title="Sleep om de chat breder of smaller te maken · dubbelklik om te resetten"
                onDoubleClick={resetAiChatWidth}
              >
                <span />
              </div>
              <div className="cm-ai-head">
                <div className="cm-ai-title-wrap">
                  <div className="cm-ai-orb">✦</div>
                  <div>
                    <div className="cm-ai-title">AI Code Assistent</div>
                    <div className="cm-ai-sub">Pair programmer voor je huidige project</div>
                  </div>
                </div>
                <div className="cm-ai-actions">
                  {conversations.length > 0 && (
                    <select
                      value={activeConversationId || ''}
                      onChange={e => loadConversation(e.target.value)}
                      aria-label="Selecteer gesprek"
                    >
                      <option value="" disabled>Gesprek…</option>
                      {conversations.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  )}
                  <button className="cm-ai-new" onClick={startNewConversation}>+ Nieuw</button>
                  <button className="cm-ai-width-reset" onClick={resetAiChatWidth} title={`Chatbreedte resetten (${Math.round(aiChatWidth)} px)`} aria-label="Chatbreedte resetten">↔</button>
                  <button className="cm-ai-close" onClick={() => setShowAiChat(false)} aria-label="AI-assistent sluiten">×</button>
                </div>
              </div>

              {openFile && (
                <div className="cm-ai-context">
                  <strong>Context:</strong> {openFile.name} · {getLanguage(openFile.name)}
                </div>
              )}

              <div className="cm-ai-messages">
                {aiMessages.length === 0 && (
                  <div className="cm-ai-empty">
                    <div className="cm-ai-empty-icon">✦</div>
                    <div className="cm-ai-empty-title">
                      {openFile ? `Ik lees ${openFile.name}` : 'Wat wil je bouwen?'}
                    </div>
                    <div className="cm-ai-empty-copy">
                      {openFile
                        ? 'Ik kan uitleg geven, bugs opsporen, code herschrijven of een oplossing uitwerken met de huidige bestandscontext.'
                        : 'Open een bestand voor context, of begin met een algemene programmeervraag.'}
                    </div>
                    <div className="cm-ai-quick">
                      <button onClick={() => setAiInput('Leg deze code stap voor stap uit.')}>Leg uit</button>
                      <button onClick={() => setAiInput('Zoek mogelijke bugs in dit bestand.')}>Zoek bugs</button>
                      <button onClick={() => setAiInput('Hoe kan ik dit beter structureren?')}>Verbeter structuur</button>
                    </div>
                  </div>
                )}

                {aiMessages.map((msg, i) => (
                  <div key={i} style={{display:'flex',flexDirection:'column'}}>
                    {renderAiMessage(msg)}
                  </div>
                ))}

                {aiLoading && (
                  <div style={{
                    alignSelf:'flex-start',
                    padding:'9px 12px',
                    borderRadius:'12px 12px 12px 5px',
                    border:'1px solid rgba(255,255,255,.06)',
                    background:'rgba(255,255,255,.03)',
                    color:'#8194aa',
                    fontSize:'.72rem'
                  }}>
                    🤔 De assistent analyseert je context…
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              <div className="cm-ai-composer">
                {models.length > 0 && (
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
                    <div style={{fontSize:'.61rem',color:'#556b83'}}>Model</div>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      style={{
                        background:'#091523',
                        border:'1px solid rgba(148,163,184,.12)',
                        color:'#91a7be',
                        borderRadius:8,
                        padding:'5px 7px',
                        fontSize:'.61rem'
                      }}
                    >
                      {models.map(m => (
                        <option key={m.id} value={m.ollamaName}>
                          {m.displayName} {m.isCodeMatchOnly ? '(CodeMatch)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="cm-ai-input-row">
                  <textarea
                    className="cm-ai-input"
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendAiMessage())}
                    placeholder={openFile ? 'Vraag iets over deze code…' : 'Stel je programmeervraag…'}
                    aria-label="Vraag de AI-assistent"
                    rows={1}
                  />
                  <button
                    className="cm-ai-send"
                    onClick={sendAiMessage}
                    disabled={aiLoading || !aiInput.trim()}
                    aria-label="Verstuur bericht"
                  >
                    ↑
                  </button>
                </div>
                <div className="cm-ai-tip">Enter om te versturen · Shift+Enter voor een nieuwe regel</div>
              </div>
            </aside>
          )}
        </main>
      )}

      {showNewRepo && (
        <div className="cm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowNewRepo(false)}>
          <div className="cm-modal" role="dialog" aria-modal="true" aria-labelledby="cm-new-project-title">
            <div className="cm-modal-head">
              <div id="cm-new-project-title" className="cm-modal-title">📦 Nieuw project</div>
              <div className="cm-modal-copy">
                Maak een private GitHub-repository aan en open hem direct in CodeMatch.
              </div>
            </div>

            <div className="cm-modal-body">
              <div className="cm-field">
                <label htmlFor="cm-repo-name">Projectnaam</label>
                <input
                  id="cm-repo-name"
                  value={newRepoName}
                  onChange={e => setNewRepoName(e.target.value.replace(/\s/g, '-'))}
                  placeholder="mijn-project"
                  autoFocus
                />
              </div>

              <div className="cm-field" style={{marginBottom:0}}>
                <label htmlFor="cm-repo-description">Beschrijving</label>
                <input
                  id="cm-repo-description"
                  value={newRepoDesc}
                  onChange={e => setNewRepoDesc(e.target.value)}
                  placeholder="Korte beschrijving van je project…"
                />
              </div>
            </div>

            <div className="cm-modal-foot">
              <button className="cm-modal-btn" onClick={() => setShowNewRepo(false)}>Annuleren</button>
              <button
                className="cm-modal-btn primary"
                onClick={handleCreateRepo}
                disabled={creatingRepo || !newRepoName.trim()}
              >
                {creatingRepo ? 'Aanmaken…' : '🚀 Aanmaken op GitHub'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
