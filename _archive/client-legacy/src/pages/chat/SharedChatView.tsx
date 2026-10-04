import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function SharedChatView() {
  const { token } = useParams<{ token: string }>();
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/chat/shared/${token}`)
      .then(res => {
        if (!res.ok) throw new Error('Gesprek niet gevonden of niet meer gedeeld.');
        return res.json();
      })
      .then(data => {
        setConversation(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return <div className="center-container">Laden...</div>;
  }

  if (error) {
    return (
      <div className="center-container" style={{ textAlign: 'center' }}>
        <h2>Oeps!</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>{conversation.title}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Gedeeld door <strong>{conversation.user?.displayName || 'Onbekend'}</strong> op {new Date(conversation.createdAt).toLocaleDateString()}
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {conversation.messages?.map((m: any, i: number) => (
          <div key={i} style={{ 
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'user' ? 'var(--primary)' : 'var(--bg-surface)',
            padding: '1rem 1.5rem',
            borderRadius: 'var(--radius-lg)',
            maxWidth: '90%',
            boxShadow: 'var(--shadow-sm)',
            lineHeight: 1.6,
            overflowX: 'auto'
          }}>
            <strong style={{ display: 'block', marginBottom: '0.25rem', color: m.role === 'user' ? 'var(--text-primary)' : 'var(--primary)' }}>
              {m.role === 'user' ? conversation.user?.displayName || 'Jij' : 'Locra'}
            </strong>
            <div className="markdown-body">
              {m.attachments && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {JSON.parse(m.attachments).map((img: string, idx: number) => (
                    <img key={idx} src={img} alt="attachment" style={{ maxWidth: '200px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
                  ))}
                </div>
              )}
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {m.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
