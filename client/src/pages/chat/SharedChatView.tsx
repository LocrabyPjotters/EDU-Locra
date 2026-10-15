import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const getSavedTheme = (): 'light' | 'dark' => {
  try {
    return localStorage.getItem('locra_chat_theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

function parseAttachments(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export default function SharedChatView() {
  const { token } = useParams<{ token: string }>();
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(getSavedTheme);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`/api/chat/shared/${token}`)
      .then(res => {
        if (!res.ok) throw new Error('Dit gesprek bestaat niet (meer) of is niet langer gedeeld.');
        return res.json();
      })
      .then(data => {
        if (!cancelled) setConversation(data);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Het gesprek kon niet worden geladen.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    try { localStorage.setItem('locra_chat_theme', theme); } catch { /* Storage is optional. */ }
  }, [theme]);

  const createdDate = conversation?.createdAt
    ? new Date(conversation.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <main className={`shared-chat-page shared-theme-${theme}`} data-theme={theme}>
      <style>{`
        .shared-chat-page {
          --shared-bg: #f5f7fc; --shared-card: #ffffff; --shared-text: #202b42;
          --shared-muted: #68758d; --shared-border: #e5eaf3; --shared-soft: #eff2fb;
          --shared-user: #6257e8; --shared-shadow: 0 12px 36px rgba(31,44,79,.07);
          min-height: 100vh; color: var(--shared-text); background: var(--shared-bg);
          padding: 26px 24px 48px; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          transition: background .2s ease, color .2s ease;
        }
        .shared-chat-page.shared-theme-dark {
          --shared-bg: #0b1020; --shared-card: #141b2d; --shared-text: #edf1ff;
          --shared-muted: #a4aec2; --shared-border: rgba(148,163,184,.17); --shared-soft: #202940;
          --shared-user: #7568f5; --shared-shadow: 0 12px 36px rgba(0,0,0,.2); color-scheme: dark;
        }
        .shared-chat-page * { box-sizing: border-box; }
        .shared-chat-toolbar { max-width: 1050px; margin: 0 auto 44px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
        .shared-brand { display:flex; align-items:center; gap:11px; font-weight:800; letter-spacing:-.035em; }
        .shared-brand-mark { width:40px; height:40px; display:grid; place-items:center; border-radius:14px; color:#fff; background:linear-gradient(135deg,#7568f5,#39b6d8); box-shadow:0 7px 18px rgba(98,87,232,.22); font-size:20px; }
        .shared-theme-toggle { display:inline-flex; align-items:center; gap:8px; padding:9px 13px; border:1px solid var(--shared-border); border-radius:999px; background:var(--shared-card); color:var(--shared-text); font-weight:650; font-size:13px; cursor:pointer; box-shadow:0 2px 8px rgba(25,35,60,.035); }
        .shared-theme-toggle:hover { transform:translateY(-1px); }
        .shared-chat-heading { max-width:820px; margin:0 auto 32px; text-align:left; }
        .shared-eyebrow { display:inline-flex; align-items:center; gap:7px; padding:6px 10px; border:1px solid var(--shared-border); border-radius:999px; background:var(--shared-card); color:var(--shared-muted); text-transform:uppercase; letter-spacing:.09em; font-size:10px; font-weight:800; }
        .shared-chat-heading h1 { margin:16px 0 10px; font-size:clamp(28px,4vw,42px); line-height:1.12; letter-spacing:-.045em; overflow-wrap:anywhere; }
        .shared-chat-heading p { margin:0; color:var(--shared-muted); font-size:14px; line-height:1.65; }
        .shared-message-list { max-width:820px; margin:0 auto; display:flex; flex-direction:column; gap:28px; }
        .shared-message { min-width:0; }
        .shared-message.user { display:flex; flex-direction:column; align-items:flex-end; }
        .shared-message.assistant { display:grid; grid-template-columns:36px minmax(0,1fr); align-items:start; gap:12px; }
        .shared-avatar { width:36px; height:36px; display:grid; place-items:center; flex-shrink:0; border:1px solid color-mix(in srgb,var(--shared-user) 25%,var(--shared-border)); border-radius:13px; color:var(--shared-user); background:color-mix(in srgb,var(--shared-user) 9%,var(--shared-card)); }
        .shared-message-meta { display:flex; align-items:center; gap:8px; color:var(--shared-muted); font-size:12px; font-weight:700; margin:0 0 8px 2px; }
        .shared-bubble { min-width:0; max-width:100%; border:1px solid var(--shared-border); border-radius:18px; background:var(--shared-card); padding:20px 22px; box-shadow:var(--shared-shadow); line-height:1.75; overflow-wrap:anywhere; }
        .shared-message.user .shared-bubble { max-width:min(88%,680px); border:1px solid rgba(255,255,255,.13); background:var(--shared-user); color:white; border-radius:20px 20px 5px 20px; box-shadow:0 9px 24px rgba(91,81,220,.17); }
        .shared-message.user .shared-message-meta { margin-right:4px; }
        .shared-bubble .markdown-body > :first-child { margin-top:0; }
        .shared-bubble .markdown-body > :last-child { margin-bottom:0; }
        .shared-bubble .markdown-body pre { max-width:100%; overflow:auto; border-radius:12px; padding:14px; background:#111827; color:#f8fafc; }
        .shared-bubble .markdown-body code:not(pre code) { border-radius:5px; padding:2px 5px; background:var(--shared-soft); font-size:.88em; }
        .shared-bubble .markdown-body table { display:block; max-width:100%; overflow:auto; border-collapse:collapse; }
        .shared-bubble .markdown-body th,.shared-bubble .markdown-body td { border:1px solid var(--shared-border); padding:7px 10px; text-align:left; }
        .shared-bubble .markdown-body th { background:var(--shared-soft); }
        .shared-bubble .markdown-body a { color:var(--shared-user); }
        .shared-message.user .markdown-body a { color:#fff; }
        .shared-attachments { display:flex; flex-wrap:wrap; gap:10px; margin:0 0 12px; }
        .shared-attachments img { width:auto; max-width:min(100%,260px); max-height:240px; object-fit:contain; border-radius:11px; border:1px solid var(--shared-border); }
        .shared-empty-state { max-width:500px; margin:10vh auto; text-align:center; border:1px solid var(--shared-border); border-radius:24px; background:var(--shared-card); padding:38px 28px; box-shadow:var(--shared-shadow); }
        .shared-state-icon { width:54px; height:54px; margin:0 auto 16px; display:grid; place-items:center; border-radius:18px; background:var(--shared-soft); font-size:24px; }
        .shared-spinner { width:26px; height:26px; margin:0 auto; border:3px solid var(--shared-border); border-top-color:var(--shared-user); border-radius:50%; animation:shared-spin .8s linear infinite; }
        @keyframes shared-spin { to { transform:rotate(360deg); } }
        @media(max-width:640px) {
          .shared-chat-page { padding:18px 13px 32px; }
          .shared-chat-toolbar { margin-bottom:36px; }
          .shared-brand-mark { width:36px; height:36px; }
          .shared-chat-heading { margin-bottom:24px; }
          .shared-message-list { gap:22px; }
          .shared-message.assistant { grid-template-columns:30px minmax(0,1fr); gap:8px; }
          .shared-avatar { width:30px; height:30px; border-radius:10px; }
          .shared-bubble { padding:15px; border-radius:15px; }
          .shared-message.user .shared-bubble { max-width:94%; }
          .shared-theme-toggle { padding:8px 10px; }
          .shared-theme-toggle span:last-child { display:none; }
        }
        @media(prefers-reduced-motion:reduce) { .shared-chat-page *, .shared-chat-page *::before, .shared-chat-page *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
      `}</style>

      <div className="shared-chat-toolbar">
        <div className="shared-brand">
          <div className="shared-brand-mark" aria-hidden="true">✦</div>
          <div>
            <div style={{ fontSize: 18, lineHeight: 1.1 }}>Locra</div>
            <div style={{ color: 'var(--shared-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', marginTop: 4 }}>AI-gesprek delen</div>
          </div>
        </div>
        <button
          className="shared-theme-toggle"
          type="button"
          onClick={() => setTheme(current => current === 'light' ? 'dark' : 'light')}
          aria-label={theme === 'light' ? 'Schakel naar donkere modus' : 'Schakel naar lichte modus'}
          title={theme === 'light' ? 'Schakel naar donkere modus' : 'Schakel naar lichte modus'}
        >
          <span aria-hidden="true">{theme === 'light' ? '☀️' : '🌙'}</span>
          <span>{theme === 'light' ? 'Lichte modus' : 'Donkere modus'}</span>
        </button>
      </div>

      {loading ? (
        <div className="shared-empty-state" role="status" aria-live="polite">
          <div className="shared-spinner" />
          <h2 style={{ margin: '18px 0 6px', fontSize: 20 }}>Gesprek laden</h2>
          <p style={{ margin: 0, color: 'var(--shared-muted)', fontSize: 14 }}>De gedeelde berichten worden opgehaald.</p>
        </div>
      ) : error ? (
        <div className="shared-empty-state" role="alert">
          <div className="shared-state-icon">🔒</div>
          <h1 style={{ margin: '0 0 10px', fontSize: 25, letterSpacing: '-.03em' }}>Gesprek niet beschikbaar</h1>
          <p style={{ margin: 0, color: 'var(--shared-muted)', lineHeight: 1.7 }}>{error}</p>
        </div>
      ) : conversation ? (
        <>
          <header className="shared-chat-heading">
            <span className="shared-eyebrow"><span aria-hidden="true">↗</span> Gedeeld gesprek · Alleen lezen</span>
            <h1>{conversation.title || 'Gedeeld gesprek'}</h1>
            <p>
              Gedeeld door <strong style={{ color: 'var(--shared-text)' }}>{conversation.user?.displayName || 'Onbekend'}</strong>
              {createdDate ? ` · ${createdDate}` : ''}
            </p>
          </header>

          <section className="shared-message-list" aria-label="Berichten in het gedeelde gesprek">
            {(conversation.messages || []).map((message: any, index: number) => {
              const isUser = message.role === 'user';
              const attachments = parseAttachments(message.attachments ?? message.images);
              return (
                <article className={`shared-message ${isUser ? 'user' : 'assistant'}`} key={message.id || index}>
                  {!isUser && <div className="shared-avatar" aria-hidden="true">✦</div>}
                  <div style={{ minWidth: 0, maxWidth: '100%' }}>
                    <div className="shared-message-meta">
                      <span>{isUser ? (conversation.user?.displayName || 'Gebruiker') : 'Locra AI'}</span>
                      {!isUser && message.modelUsed && <span style={{ fontWeight: 500 }}>· {message.modelUsed}</span>}
                    </div>
                    <div className="shared-bubble">
                      {attachments.length > 0 && (
                        <div className="shared-attachments">
                          {attachments.map((src, imageIndex) => (
                            <img key={`${index}-${imageIndex}`} src={src} alt={`Bijlage ${imageIndex + 1}`} loading="lazy" />
                          ))}
                        </div>
                      )}
                      <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            {(!conversation.messages || conversation.messages.length === 0) && (
              <div className="shared-empty-state" style={{ margin: '0 auto' }}>
                <div className="shared-state-icon">💬</div>
                <h2 style={{ margin: '0 0 6px', fontSize: 19 }}>Nog geen berichten</h2>
                <p style={{ margin: 0, color: 'var(--shared-muted)', fontSize: 14 }}>Dit gesprek bevat nog geen berichten om te tonen.</p>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
