import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ShareModal from '../../components/ShareModal';
import UserSettingsModal from './UserSettingsModal';
import SomtodayPanel from './SomtodayPanel';
import WatermarkDetector from './WatermarkDetector';
import WebPreviewFrame from './WebPreviewFrame';
import { useToast } from '../../components/ToastProvider';
import { useAcademyName } from '../../store/orgStore';

export default function ChatLayout() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const academyName = useAcademyName();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');
  const urlConvId = searchParams.get('conversationId');
  const { addToast } = useToast();
  
  const VIBES = [
    "Wat is de vibe",
    "Waar kunnen we je vandaag mee helpen",
    "Hoe gaat het ermee",
    "Wat spookt er door je hoofd",
    "Klaar voor wat AI-magie",
    "Hoe kunnen we je werk makkelijker maken",
    "Wat staat er op de planning",
    "Heb je een briljant idee"
  ];

  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(urlConvId || null);

  const currentVibe = React.useMemo(() => {
    return VIBES[Math.floor(Math.random() * VIBES.length)];
  }, [activeConvId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showWatermarkModal, setShowWatermarkModal] = useState(false);
  const [webPreviewUrl, setWebPreviewUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [prompt, setPrompt] = useState('');
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  
  useEffect(() => {
    const prefill = searchParams.get('prefill') || searchParams.get('prompt');
    if (prefill) {
      setPrompt(prefill);
    }
  }, [searchParams]);
  
  // Model indicator during generation
  const [generatingModel, setGeneratingModel] = useState<string | null>(null);
  
  const ws = useRef<WebSocket | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [attachments, setAttachments] = useState<string[]>([]);
  const [fileAttachments, setFileAttachments] = useState<{name: string, content: string, type: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
        if (file.type.startsWith('image/')) {
          // Images: read as data URL for display
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (ev.target?.result) {
              setAttachments(prev => [...prev, ev.target!.result as string]);
            }
          };
          reader.readAsDataURL(file);
        } else {
          // Documents: read as text
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (ev.target?.result) {
              setFileAttachments(prev => [...prev, {
                name: file.name,
                content: ev.target!.result as string,
                type: file.type
              }]);
            }
          };
          reader.readAsText(file);
        }
      });
    }
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [saveToServer, setSaveToServer] = useState(true);
  
  // Plus Menu & Toggles (Thinking is OFF by default!)
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [useInternetSearch, setUseInternetSearch] = useState(false);
  const [useDeepResearch, setUseDeepResearch] = useState(false);
  const [useThinkMode, setUseThinkMode] = useState(false);
  const [useSomtoday, setUseSomtoday] = useState(false);
  const [showSomtodayPanel, setShowSomtodayPanel] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);
  const [selectedKb, setSelectedKb] = useState<string>('');
  const [quickActions, setQuickActions] = useState<any[]>([]);
  const [labels, setLabels] = useState<any[]>([]);
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [showPinnedDrawer, setShowPinnedDrawer] = useState(false);
  const [assignmentInfo, setAssignmentInfo] = useState<any | null>(null);
  const [googleDocUrl, setGoogleDocUrl] = useState<string | null>(null);
  const [isGoogleDocPanelOpen, setIsGoogleDocPanelOpen] = useState(false);
  const [orgDetails, setOrgDetails] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDocLinkModal, setShowDocLinkModal] = useState(false);
  const [docLinkInput, setDocLinkInput] = useState('');
  const [activeHoverMsg, setActiveHoverMsg] = useState<number | null>(null);
  
  // RAG/Web Sources state
  const pendingSourcesRef = useRef<any[]>([]);
  const [previewSource, setPreviewSource] = useState<any | null>(null);

  // Local Storage for chats if saveToServer is false
  const [localConversations, setLocalConversations] = useState<any[]>(() => {
    const saved = localStorage.getItem('locra_conversations');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [localMessages, setLocalMessages] = useState<Record<string, any[]>>(() => {
    const saved = localStorage.getItem('locra_messages');
    return saved ? JSON.parse(saved) : {};
  });

  // Initial Data Fetching
  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    // Fetch models
    fetch('/api/models', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      setModels(data);
    });

    // Fetch knowledge bases
    fetch('/api/knowledge', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      setKnowledgeBases(data || []);
    }).catch(() => {});

    // Fetch quick actions
    fetch('/api/quick-actions', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setQuickActions(data);
    }).catch(() => {});

    // Fetch labels
    fetch('/api/chat/labels', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setLabels(data);
    }).catch(() => {});

    // Fetch org details
    fetch('/api/organization/customization', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      if (!data.error) setOrgDetails(data);
    }).catch(() => {});

    // Fetch assignment context if active
    if (assignmentId) {
      fetch(`/api/assignments/${assignmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()).then(data => {
        if (!data.error) {
          setAssignmentInfo(data);
          if (data.submissions?.[0]?.googleDocUrl) {
            setGoogleDocUrl(data.submissions[0].googleDocUrl);
            setIsGoogleDocPanelOpen(true);
          }
        }
      }).catch(() => {});
    }

    // Speech Recognition setup
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'nl-NL';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
           setPrompt(prev => (prev + ' ' + finalTranscript).trim());
        }
      };
      
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, [token, assignmentId]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      addToast('Microfoon gestopt', 'info');
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
      addToast('Microfoon gestart, spreek nu...', 'info');
    }
  };

  // Fetch conversations
  useEffect(() => {
    const searchParams = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
    fetch(`/api/chat/conversations${searchParams}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      setConversations(data);
      if (data.length > 0 && !activeConvId && !searchQuery && !urlConvId) {
        setActiveConvId(data[0].id);
      }
    });
  }, [token, navigate, searchQuery]);

  // Load Pinned messages for active conversation
  const loadPinnedMessages = async (convId: string) => {
    if (!convId || convId.startsWith('local-')) {
      setPinnedMessages([]);
      return;
    }
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/pinned`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPinnedMessages(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Pin a message
  const handlePinMessage = async (msgId: string) => {
    if (!msgId) return;
    try {
      const res = await fetch(`/api/chat/messages/${msgId}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: '' })
      });
      if (res.ok) {
        addToast('Bericht vastgepind! 📌', 'success');
        if (activeConvId) loadPinnedMessages(activeConvId);
      }
    } catch (e) {
      addToast('Fout bij pinnen', 'error');
    }
  };

  // Unpin a message
  const handleUnpinMessage = async (msgId: string) => {
    try {
      const res = await fetch(`/api/chat/messages/${msgId}/pin`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        addToast('Bericht ontpind', 'info');
        if (activeConvId) loadPinnedMessages(activeConvId);
      }
    } catch (e) {
      addToast('Fout bij ontpinnen', 'error');
    }
  };

  // Active Conversation & WS Setup
  useEffect(() => {
    if (activeConvId) {
      loadPinnedMessages(activeConvId);

      const isLocal = activeConvId.startsWith('local-');
      
      if (isLocal) {
        setMessages(localMessages[activeConvId] || []);
      } else {
        fetch(`/api/chat/conversations/${activeConvId}/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()).then(data => setMessages(data.map((m: any) => ({
          ...m,
          images: m.attachments ? JSON.parse(m.attachments) : m.images
        }))));
      }
      
      // Setup WS
      if (ws.current) ws.current.close();
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/chat/ws`);
      ws.current = socket;
      
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'auth', token }));
      };
      
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'start') {
          if (data.model) setGeneratingModel(data.model);
        } else if (data.type === 'chunk') {
          setThinkingStatus(null);
          setMessages(prev => {
            const last = [...prev];
            if (last.length > 0) {
              const lastMsg = { ...last[last.length - 1] };
              if (lastMsg.role === 'assistant' && lastMsg.streaming) {
                lastMsg.content += data.content;
                last[last.length - 1] = lastMsg;
                return last;
              }
            }
            last.push({ role: 'assistant', content: data.content, streaming: true, modelUsed: generatingModel || selectedModel });
            return last;
          });
        } else if (data.type === 'thinking') {
          setThinkingStatus(data.message);
          if (data.model) setGeneratingModel(data.model);
        } else if (data.type === 'title_update') {
          setConversations(prev => prev.map(c => 
            c.id === data.conversationId ? { ...c, title: data.title } : c
          ));
        } else if (data.type === 'error') {
          setIsGenerating(false);
          setThinkingStatus(null);
          setGeneratingModel(null);
          addToast(data.message || 'Er is een onbekende fout opgetreden', 'error');
          // Haal het laatst verstuurde (maar on-opgeslagen) bericht uit de UI
          setMessages(prev => {
            const last = [...prev];
            if (last.length > 0 && last[last.length - 1].role === 'user') {
              last.pop();
            }
            return last;
          });
        } else if (data.type === 'rag_sources') {
          pendingSourcesRef.current = data.sources || [];
        } else if (data.type === 'done') {
          setIsGenerating(false);
          setThinkingStatus(null);
          setGeneratingModel(null);
          setMessages(prev => {
            const last = [...prev];
            const lastMsg = { ...last[last.length - 1] };
            if (lastMsg) {
              lastMsg.streaming = false;
              if (data.messageId) lastMsg.dbId = data.messageId;
              if (data.metadata) lastMsg.metadata = data.metadata;
              if (data.model) lastMsg.modelUsed = data.model;
              if (data.finalContent) lastMsg.content = data.finalContent;
              lastMsg.sources = pendingSourcesRef.current.length > 0 ? [...pendingSourcesRef.current] : undefined;
              last[last.length - 1] = lastMsg;
            }
            
            if (isLocal) {
              const newLocalMessages = { ...localMessages, [activeConvId]: last };
              setLocalMessages(newLocalMessages);
              localStorage.setItem('locra_messages', JSON.stringify(newLocalMessages));
            }
            return last;
          });
          pendingSourcesRef.current = [];
        }
      };
    }
  }, [activeConvId, token]);

  const createConversation = async () => {
    if (!saveToServer) {
      const newId = 'local-' + Date.now();
      const newConv = { id: newId, title: 'Lokaal Gesprek' };
      const updatedLocalConvs = [newConv, ...localConversations];
      setLocalConversations(updatedLocalConvs);
      localStorage.setItem('locra_conversations', JSON.stringify(updatedLocalConvs));
      setActiveConvId(newId);
      return newId;
    }

    const res = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: 'Nieuw gesprek', modelId: selectedModel })
    });
    const conv = await res.json();
    setConversations([conv, ...conversations]);
    setActiveConvId(conv.id);
    return conv.id;
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() && attachments.length === 0 && fileAttachments.length === 0) return;
    if (isGenerating) return;
    
    let convIdToUse = activeConvId;
    if (!convIdToUse) {
       convIdToUse = await createConversation();
    }

    // Build the final prompt with file contents prepended
    let finalPrompt = prompt;
    if (fileAttachments.length > 0) {
      const fileContextParts = fileAttachments.map(f => 
        `=== BESTAND: ${f.name} ===\n${f.content.substring(0, 30000)}\n=== EINDE BESTAND ===`
      );
      finalPrompt = fileContextParts.join('\n\n') + '\n\n' + prompt;
    }

    const isLocal = convIdToUse!.startsWith('local-');
    const newMessages = [...messages, { role: 'user', content: prompt }];
    
    if (attachments.length > 0) {
       newMessages[newMessages.length - 1].images = attachments;
    }
    if (fileAttachments.length > 0) {
       newMessages[newMessages.length - 1].fileNames = fileAttachments.map(f => f.name);
    }
    
    setMessages(newMessages);
    
    if (isLocal) {
      const updatedLocalConvs = localConversations.map(c => 
        c.id === convIdToUse ? { ...c, title: prompt.substring(0, 30) } : c
      );
      setLocalConversations(updatedLocalConvs);
      localStorage.setItem('locra_conversations', JSON.stringify(updatedLocalConvs));
      
      const updatedLocal = { ...localMessages, [convIdToUse!]: newMessages };
      setLocalMessages(updatedLocal);
      localStorage.setItem('locra_messages', JSON.stringify(updatedLocal));
    }

    setPrompt('');
    setAttachments([]);
    setFileAttachments([]);
    setIsGenerating(true);
    setGeneratingModel(selectedModel === 'auto' ? 'Locra Smart Model' : selectedModel);

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'chat',
        conversationId: convIdToUse,
        model: selectedModel,
        prompt: finalPrompt,
        saveToServer: !isLocal,
        localHistory: isLocal ? localMessages[convIdToUse!] || [] : undefined,
        images: attachments.length > 0 ? attachments : undefined,
        knowledgeBaseId: selectedKb,
        internetSearch: useInternetSearch,
        deepResearch: useDeepResearch,
        thinkMode: useThinkMode,
        useSomtoday: useSomtoday
      }));
    }
  };

  const handleShareToggle = async (newSharedState: boolean) => {
    if (!activeConvId || activeConvId.startsWith('local-')) return;
    const res = await fetch(`/api/chat/conversations/${activeConvId}/share`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isShared: newSharedState })
    });
    if (res.ok) {
      const updated = await res.json();
      setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, isShared: updated.isShared, shareToken: updated.shareToken } : c));
    }
  };

  const handleDeleteConv = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Gesprek definitief verwijderen?')) return;
    
    if (id.startsWith('local-')) {
      const newConvs = localConversations.filter(c => c.id !== id);
      setLocalConversations(newConvs);
      localStorage.setItem('locra_conversations', JSON.stringify(newConvs));
      if (activeConvId === id) setActiveConvId(newConvs.length > 0 ? newConvs[0].id : null);
      return;
    }

    try {
      const res = await fetch(`/api/chat/conversations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConvId === id) setActiveConvId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameConv = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    if (id.startsWith('local-')) {
      const newConvs = localConversations.map(c => c.id === id ? { ...c, title: editTitle } : c);
      setLocalConversations(newConvs);
      localStorage.setItem('locra_conversations', JSON.stringify(newConvs));
      setEditingConvId(null);
      return;
    }

    try {
      const res = await fetch(`/api/chat/conversations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: editTitle })
      });
      if (res.ok) {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, title: editTitle } : c));
        setEditingConvId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReaction = async (messageId: string, emoji: string, msgIndex: number) => {
    try {
      const res = await fetch(`/api/chat/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ emoji })
      });
      if (res.ok) {
        setMessages(prev => {
          const newMessages = [...prev];
          const msg = { ...newMessages[msgIndex] };
          if (!msg.reactions) msg.reactions = [];
          
          const existing = msg.reactions.find((r: any) => r.userId === user?.id && r.emoji === emoji);
          if (!existing) {
            msg.reactions.push({ emoji, userId: user?.id });
          }
          newMessages[msgIndex] = msg;
          return newMessages;
        });
      }
    } catch (err) {
      console.error('Error adding reaction', err);
    }
  };

  // Submit assignment directly from chat
  const handleAssignmentSubmit = async () => {
    if (!assignmentId) return;
    if (!confirm('Weet je zeker dat je je werk voor deze opdracht wilt inleveren bij je docent?')) return;
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
      });
      if (res.ok) {
        addToast('Opdracht succesvol ingeleverd!', 'success');
        navigate('/student');
      } else {
        const err = await res.json();
        addToast(err.error || 'Inleveren mislukt', 'error');
      }
    } catch (e) {
      addToast('Netwerkfout bij inleveren', 'error');
    }
  };

  // Filter conversations by label if set
  const filteredConversations = conversations.filter(c => {
    if (!selectedLabelFilter) return true;
    return c.labels?.some((cl: any) => cl.labelId === selectedLabelFilter);
  });

  return (
    <>
    <div className="mobile-split-pane" style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', position: 'relative', overflowX: 'hidden' }}>
      
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="mobile-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} 
        />
      )}

      {/* ── SIDEBAR ── */}
      <div className={`sidebar-chatgpt ${isSidebarOpen ? 'open' : ''}`} style={{ zIndex: 50, height: '100vh', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column' }}>
        
        {/* Top Controls */}
        <div style={{ padding: '1.25rem 1.25rem 0.5rem 1.25rem' }}>
          <button 
            onClick={createConversation} 
            className="btn btn-primary" 
            style={{ width: '100%', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <span>+</span> Nieuw Gesprek
          </button>
          
          <input 
            type="text" 
            className="input-field" 
            placeholder="🔍 Zoek in gesprekken..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.45rem 0.75rem', marginBottom: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.85rem' }}
          />

          {/* Quick Classroom / Navigation Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '0.75rem' }}>
            <button
              onClick={() => navigate('/student')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.18)',
                color: '#38bdf8',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span>🎒</span> Mijn Opdrachten
            </button>

            <button
              onClick={() => navigate('/academy')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(6, 182, 212, 0.12))',
                border: '1px solid rgba(99, 102, 241, 0.28)',
                color: '#c7d2fe',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span>🏛️</span> {academyName}
            </button>

            {user && ['teacher', 'admin', 'superadmin'].includes(user.role) && (
              <button
                onClick={() => navigate('/teacher')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  background: 'rgba(124, 92, 252, 0.1)',
                  border: '1px solid rgba(124, 92, 252, 0.25)',
                  color: '#c4b5fd',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span>🎓</span> Docentenportaal
              </button>
            )}
          </div>

          {/* Chat Labels Pills (filter) */}
          {labels.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '6px' }}>
              <span
                onClick={() => setSelectedLabelFilter(null)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  background: selectedLabelFilter === null ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                  color: '#fff'
                }}
              >
                Alles
              </span>
              {labels.map(l => (
                <span
                  key={l.id}
                  onClick={() => setSelectedLabelFilter(selectedLabelFilter === l.id ? null : l.id)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    background: selectedLabelFilter === l.id ? l.color || 'var(--primary)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {l.name}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <input 
              type="checkbox" 
              id="saveToggle" 
              checked={saveToServer} 
              onChange={e => setSaveToServer(e.target.checked)} 
            />
            <label htmlFor="saveToggle" style={{ cursor: 'pointer' }}>Opslaan op server</label>
          </div>
        </div>

        {/* Conversations List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
          {saveToServer && filteredConversations.map(c => (
            <div 
              key={c.id} 
              onClick={() => setActiveConvId(c.id)}
              style={{ 
                padding: '0.55rem 0.75rem', 
                cursor: 'pointer', 
                borderRadius: 'var(--radius-md)', 
                background: c.id === activeConvId ? 'var(--bg-surface-hover)' : 'transparent',
                marginBottom: '0.25rem',
                color: c.id === activeConvId ? 'var(--primary)' : 'var(--text-primary)',
                fontWeight: c.id === activeConvId ? 500 : 400,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                const actions = e.currentTarget.querySelector('.conv-actions');
                if (actions) (actions as HTMLElement).style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                const actions = e.currentTarget.querySelector('.conv-actions');
                if (actions) (actions as HTMLElement).style.opacity = '0';
              }}
            >
              {editingConvId === c.id ? (
                <form onSubmit={(e) => handleRenameConv(e, c.id)} style={{ flex: 1, display: 'flex', gap: '0.25rem' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editTitle} 
                    onChange={e => setEditTitle(e.target.value)} 
                    autoFocus 
                    style={{ padding: '0.25rem', fontSize: '0.875rem', width: '100%' }}
                  />
                </form>
              ) : (
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: '0.85rem' }}>
                  {c.isParticipantOnly && <span style={{ fontSize: '0.75rem', marginRight: '4px' }}>👥</span>}
                  {c.title}
                </div>
              )}
              
              {editingConvId !== c.id && (
                <div className="conv-actions" style={{ display: 'flex', gap: '4px', opacity: 0, transition: 'opacity 0.2s', background: 'inherit' }}>
                  <button onClick={(e) => { e.stopPropagation(); setEditTitle(c.title); setEditingConvId(c.id); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 4px' }} title="Hernoemen">✏️</button>
                  <button onClick={(e) => handleDeleteConv(e, c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px 4px' }} title="Verwijderen">🗑️</button>
                </div>
              )}
            </div>
          ))}
          
          {!saveToServer && localConversations.map(c => (
            <div 
              key={c.id} 
              onClick={() => setActiveConvId(c.id)}
              style={{ 
                padding: '0.55rem 0.75rem', 
                cursor: 'pointer', 
                borderRadius: 'var(--radius-md)', 
                background: c.id === activeConvId ? 'var(--bg-surface-hover)' : 'transparent',
                marginBottom: '0.25rem',
                color: c.id === activeConvId ? 'var(--primary)' : 'var(--text-primary)',
                fontWeight: c.id === activeConvId ? 500 : 400,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: '0.85rem' }}>
                <span style={{ fontSize: '0.75rem', marginRight: '4px' }}>🔒</span> {c.title}
              </div>
              <button onClick={(e) => handleDeleteConv(e, c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🗑️</button>
            </div>
          ))}
        </div>
        
        {/* Bottom User Area */}
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <button onClick={() => setShowSettings(true)} className="btn" style={{ background: 'transparent', width: '100%', border: 'none', color: 'var(--text-secondary)', justifyContent: 'flex-start', padding: '0.5rem', fontSize: '0.85rem' }}>
            ⚙️ Instellingen
          </button>
          {user?.role === 'admin' || user?.role === 'superadmin' ? (
             <button onClick={() => navigate('/admin')} className="btn" style={{ background: 'transparent', width: '100%', border: 'none', color: 'var(--text-secondary)', justifyContent: 'flex-start', padding: '0.5rem', fontSize: '0.85rem' }}>
               🛡️ Beheerderspaneel
             </button>
          ) : null}
        </div>
      </div>

      {/* ── GOOGLE DOC WORKSPACE (IF LINKED) ── */}
      {googleDocUrl && isGoogleDocPanelOpen && (
        <div style={{ flex: 1.5, borderRight: '1px solid rgba(255,255,255,0.08)', background: '#fff', position: 'relative' }}>
           <iframe 
             src={googleDocUrl.replace(/\/edit.*$/, '/edit?rm=minimal')} 
             style={{ width: '100%', height: '100%', border: 'none' }} 
             title="Google Doc Workspace"
           />
           <button
             onClick={() => setIsGoogleDocPanelOpen(false)}
             style={{ position: 'absolute', top: 10, right: 10, background: 'var(--bg-surface)', border: '1px solid rgba(0,0,0,0.1)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
           >
             Sluiten
           </button>
        </div>
      )}

      {/* ── MAIN CHAT AREA ── */}
      <div style={{ flex: googleDocUrl && isGoogleDocPanelOpen ? 1 : 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        
        {/* Assignment Mode Banner if opened through an assignment */}
        {assignmentInfo && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(124, 92, 252, 0.2) 0%, rgba(56, 189, 248, 0.2) 100%)',
            borderBottom: '1px solid rgba(124, 92, 252, 0.35)',
            padding: '10px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 30,
            backdropFilter: 'blur(8px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.3rem' }}>📋</span>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
                  Opdrachtmodus: {assignmentInfo.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {assignmentInfo.subject ? `${assignmentInfo.subject} • ` : ''}Je interacties met de AI worden didactisch geregistreerd voor je docent
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigate('/student')}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                ← Terug naar Opdrachten
              </button>
              
              {!googleDocUrl ? (
                <button
                  onClick={() => setShowDocLinkModal(true)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📄 Doc Koppelen
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  {!isGoogleDocPanelOpen && (
                    <button
                      onClick={() => setIsGoogleDocPanelOpen(true)}
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      📄 Open Doc
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if(confirm('Weet je zeker dat je het document wilt loskoppelen?')) {
                        const subId = assignmentInfo?.submissions?.[0]?.id;
                        if(subId) {
                          fetch(`/api/assignments/submissions/${subId}/attach-doc`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ googleDocUrl: null })
                          }).then(() => {
                            setGoogleDocUrl(null);
                            setIsGoogleDocPanelOpen(false);
                            addToast('Document losgekoppeld', 'success');
                          });
                        }
                      }
                    }}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    ❌ Loskoppelen
                  </button>
                </div>
              )}
              <button
                onClick={handleAssignmentSubmit}
                style={{ background: 'var(--success)', border: 'none', color: '#000', fontWeight: 700, padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Inleveren ✓
              </button>
            </div>
          </div>
        )}

        {/* Header Bar */}
        <header style={{
          padding: '0.8rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(10, 14, 26, 0.75)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          zIndex: 20
        }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             {isSidebarOpen ? null : (
               <button 
                 className="hamburger-btn" 
                 onClick={() => setIsSidebarOpen(true)}
                 style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '1.4rem', cursor: 'pointer', padding: '4px' }}
               >
                 ☰
               </button>
             )}
             
             {/* Model Selector Pill */}
             <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-pill)', border: '1px solid rgba(255,255,255,0.08)' }}>
               <span style={{ fontSize: '0.85rem', marginRight: '4px' }}>⚡</span>
               <select 
                 className="input-field" 
                 value={selectedModel} 
                 onChange={e => setSelectedModel(e.target.value)}
                 style={{ padding: '0.3rem 0.5rem', width: 'auto', minWidth: '140px', background: 'transparent', border: 'none', fontSize: '0.825rem', color: '#fff', fontWeight: 500 }}
               >
                 {models.filter(m => !m.ollamaName.includes('embed') && m.ollamaName !== 'all-minilm').length === 0 && <option value="">Geen chat modellen</option>}
                 {models.filter(m => !m.ollamaName.includes('embed') && m.ollamaName !== 'all-minilm').length > 0 && <option value="auto">✨ Auto Route (Snelst)</option>}
                 {models.filter(m => !m.ollamaName.includes('embed') && m.ollamaName !== 'all-minilm').map(m => (
                   <option key={m.id} value={m.ollamaName}>{m.displayName}</option>
                 ))}
               </select>

               {/* Kennisbank selectie */}
               {knowledgeBases.length > 0 && (
                 <>
                   <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.15)', margin: '0 0.3rem' }} />
                   <select 
                     className="input-field" 
                     value={selectedKb} 
                     onChange={e => setSelectedKb(e.target.value)}
                     style={{ padding: '0.3rem 0.5rem', width: 'auto', background: 'transparent', border: 'none', fontSize: '0.825rem', color: selectedKb ? 'var(--primary)' : 'var(--text-secondary)' }}
                   >
                     <option value="">Geen Kennisbank</option>
                     {knowledgeBases.map(kb => (
                       <option key={kb.id} value={kb.id}>📚 {kb.name}</option>
                     ))}
                   </select>
                 </>
               )}
             </div>

             {/* Live Generation Indicator in Header */}
             {isGenerating && (
               <div className="model-indicator-badge">
                 <span className="pulse-dot"></span>
                 <span>Bezig met <strong>{generatingModel || selectedModel}</strong></span>
               </div>
             )}
           </div>
           
           {/* Top Right Actions */}
           <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
             {pinnedMessages.length > 0 && (
               <button
                 onClick={() => setShowPinnedDrawer(!showPinnedDrawer)}
                 className="btn btn-ghost"
                 style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: showPinnedDrawer ? 'rgba(124, 92, 252, 0.2)' : 'transparent', color: '#c4b5fd' }}
                 title="Vastgepinde berichten"
               >
                 📌 {pinnedMessages.length} Pinned
               </button>
             )}

             {user && ['teacher', 'admin', 'superadmin'].includes(user.role) && (
               <button
                 onClick={() => setShowWatermarkModal(true)}
                 className="btn btn-ghost"
                 style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                 title="AI Watermerk Detectie"
               >
                 🕵️ Detectie
               </button>
             )}

             {activeConvId && !activeConvId.startsWith('local-') && (
               <button 
                 onClick={() => setShowShareModal(true)}
                 className="btn btn-ghost"
                 style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: conversations.find(c => c.id === activeConvId)?.isShared ? 'var(--primary)' : 'var(--text-secondary)' }}
               >
                 🔗 Delen
               </button>
             )}

             {orgDetails?.logoUrl && (
               <img src={orgDetails.logoUrl} alt="Logo" style={{ maxHeight: '24px', opacity: 0.85 }} />
             )}
           </div>
        </header>

        {/* Pinned Messages Banner/Drawer */}
        {showPinnedDrawer && pinnedMessages.length > 0 && (
          <div style={{
            background: 'rgba(17, 24, 39, 0.9)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '12px 20px',
            maxHeight: '180px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 15
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              📌 Vastgepinde berichten in dit gesprek
            </div>
            {pinnedMessages.map((pin, pIdx) => (
              <div key={pin.id || pIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.825rem' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                  {pin.content?.replace(/<think>[\s\S]*?<\/think>/gi, '').substring(0, 120)}...
                </span>
                <button onClick={() => handleUnpinMessage(pin.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Ontpinnen">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Scrollable Messages Area */}
        {messages.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {messages.filter(m => m.role !== 'system').map((m, i) => (
                <div 
                  key={i} 
                  onMouseEnter={() => setActiveHoverMsg(i)}
                  onMouseLeave={() => setActiveHoverMsg(null)}
                  style={{ 
                    display: 'flex',
                    justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                    width: '100%',
                    position: 'relative'
                  }}
                >
                  {m.role === 'assistant' && (
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: 'transparent',
                      border: '1px solid rgba(124, 92, 252, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '1rem',
                      marginTop: '0.2rem',
                      flexShrink: 0
                    }}>
                      <span style={{ fontSize: '16px' }}>✨</span>
                    </div>
                  )}
                  
                  <div style={{ 
                    background: m.role === 'user' ? 'var(--bg-surface-hover)' : 'transparent',
                    border: 'none',
                    padding: m.role === 'user' ? '0.75rem 1.25rem' : '0.2rem 0',
                    borderRadius: m.role === 'user' ? '20px' : '0',
                    maxWidth: m.role === 'user' ? '75%' : '100%',
                    flex: m.role === 'assistant' ? 1 : 'none',
                    lineHeight: 1.6,
                    fontSize: '1rem',
                    position: 'relative',
                    color: 'var(--text-primary)'
                  }}>
                    {/* Header for assistant message showing which model was used! */}
                    {m.role === 'assistant' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Locra AI</span>
                          {/* Live model generation badge */}
                          {(m.streaming ? (generatingModel || selectedModel) : m.modelUsed) && (
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '2px 7px',
                              borderRadius: '999px',
                              background: m.streaming ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.06)',
                              color: m.streaming ? '#38bdf8' : 'var(--text-secondary)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {m.streaming && <span className="pulse-dot" style={{ width: '5px', height: '5px' }}></span>}
                              {m.streaming ? `Gereed via ${generatingModel || selectedModel}` : m.modelUsed}
                            </span>
                          )}
                        </div>
                        {m.responseTimeMs && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {(m.responseTimeMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="markdown-body">
                      {m.images && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          {m.images.map((img: string, idx: number) => (
                            <img key={idx} src={img} alt="attachment" style={{ maxWidth: '200px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
                          ))}
                        </div>
                      )}
                      
                      {(() => {
                        const content = m.content || '';
                        let thinkText = null;
                        let mainText = content;
                        let isCurrentlyThinking = false;
                        
                        const lowerContent = content.toLowerCase();
                        const startTag = '<think>';
                        const endTag = '</think>';
                        
                        const startIdx = lowerContent.indexOf(startTag);
                        const endIdx = lowerContent.indexOf(endTag);
                        
                        if (startIdx !== -1) {
                          if (endIdx !== -1 && endIdx > startIdx) {
                            thinkText = content.substring(startIdx + startTag.length, endIdx).trim();
                            mainText = content.substring(0, startIdx) + content.substring(endIdx + endTag.length);
                            mainText = mainText.trim();
                          } else {
                            isCurrentlyThinking = true;
                            thinkText = content.substring(startIdx + startTag.length).trim();
                            mainText = content.substring(0, startIdx).trim();
                          }
                        }

                        return (
                          <>
                            {thinkText && (
                              <details 
                                open={isCurrentlyThinking} 
                                style={{
                                  marginBottom: '1rem',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  borderLeft: '2px solid #a855f7',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '0 8px 8px 0',
                                  fontSize: '0.85rem',
                                  color: 'var(--text-secondary)'
                                }}
                              >
                                <summary style={{ cursor: 'pointer', outline: 'none', fontWeight: 500, userSelect: 'none', color: '#c4b5fd' }}>
                                  {isCurrentlyThinking ? '🧠 Aan het denken...' : '🧠 Denkproces bekijken'}
                                </summary>
                                <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', opacity: 0.85, fontSize: '0.825rem' }}>
                                  {thinkText}
                                  {isCurrentlyThinking && <span style={{ animation: 'blink 1s step-end infinite' }}>|</span>}
                                </div>
                              </details>
                            )}
                            {mainText && (
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                  a({ href, children, ...props }: any) {
                                    return (
                                      <a
                                        {...props}
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => {
                                          if (href && href.startsWith('http')) {
                                            e.preventDefault();
                                            setWebPreviewUrl(href);
                                          }
                                        }}
                                        style={{ color: '#38bdf8', textDecoration: 'underline', cursor: 'pointer' }}
                                      >
                                        {children}
                                      </a>
                                    );
                                  },
                                  code({ className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const codeString = String(children).replace(/\n$/, '');
                                    return match ? (
                                      <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', margin: '0.5rem 0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 1rem', background: 'rgba(255,255,255,0.06)', fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                          <span>{match[1]}</span>
                                          <button 
                                            onClick={() => { navigator.clipboard.writeText(codeString); addToast('Code gekopieerd!', 'success'); }}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px' }}
                                          >
                                            📋 Kopiëren
                                          </button>
                                        </div>
                                        <SyntaxHighlighter
                                          style={oneDark}
                                          language={match[1]}
                                          PreTag="div"
                                          customStyle={{ margin: 0, borderRadius: '0 0 8px 8px', fontSize: '0.85rem' }}
                                        >
                                          {codeString}
                                        </SyntaxHighlighter>
                                      </div>
                                    ) : (
                                      <code className={className} style={{ background: 'rgba(255,255,255,0.08)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.875em' }} {...props}>
                                        {children}
                                      </code>
                                    );
                                  }
                                }}
                              >
                                {mainText}
                              </ReactMarkdown>
                            )}
                            {m.streaming && !isCurrentlyThinking && <span style={{ marginLeft: '4px', animation: 'blink 1s step-end infinite' }}>|</span>}
                          </>
                        );
                      })()}
                    </div>

                    {/* Action Bar for AI messages (Copy, Pin) */}
                    {m.role === 'assistant' && !m.streaming && m.content && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '0.75rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="msg-action-btn"
                          onClick={() => {
                            const plainText = (m.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                            navigator.clipboard.writeText(plainText);
                            addToast('Gekopieerd naar klembord!', 'success');
                          }}
                          title="Kopieer antwoord"
                        >
                          📋 Kopiëren
                        </button>
                        
                        {m.dbId && (
                          <button
                            type="button"
                            className="msg-action-btn"
                            onClick={() => handlePinMessage(m.dbId)}
                            title="Pin dit bericht"
                          >
                            📌 Vastpinnen
                          </button>
                        )}
                      </div>
                    )}

                    {/* Sources Section */}
                    {m.sources && m.sources.length > 0 && !m.streaming && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.06)'
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          📚 Gebruikte Bronnen
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {m.sources.map((src: any, idx: number) => (
                            <button
                              type="button"
                              key={idx}
                              onClick={() => {
                                if (src.type === 'web' && src.url) {
                                  setWebPreviewUrl(src.url);
                                } else {
                                  setPreviewSource(src);
                                }
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.3rem 0.7rem',
                                fontSize: '0.8rem',
                                background: src.type === 'web' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)',
                                border: `1px solid ${src.type === 'web' ? 'rgba(59,130,246,0.25)' : 'rgba(16,185,129,0.25)'}`,
                                borderRadius: '999px',
                                color: src.type === 'web' ? '#60a5fa' : '#34d399',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              title={src.type === 'web' ? src.url : src.title}
                            >
                              <span>{src.type === 'web' ? '🌐' : '📄'}</span>
                              <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {src.title}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reactions Display */}
                    {m.reactions && m.reactions.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                        {Object.entries(
                          m.reactions.reduce((acc: any, r: any) => {
                            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([emoji, count]) => (
                          <div key={emoji} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={() => m.id && handleReaction(m.id, emoji, i)}>
                            <span>{emoji}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{count as React.ReactNode}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reaction Bar on Hover */}
                    {activeHoverMsg === i && m.id && !m.streaming && (
                      <div style={{ 
                        position: 'absolute', 
                        bottom: m.role === 'user' ? '-16px' : '-24px', 
                        right: m.role === 'user' ? '0' : 'auto',
                        left: m.role === 'assistant' ? '0' : 'auto',
                        background: 'var(--bg-elevated)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '24px',
                        padding: '4px 8px',
                        display: 'flex',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        zIndex: 10,
                        animation: 'fadeIn 0.2s ease'
                      }}>
                        {['👍', '👎', '❤️', '😂', '😲'].map(emoji => (
                          <button 
                            key={emoji} 
                            onClick={() => handleReaction(m.id, emoji, i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '2px', transition: 'transform 0.1s ease' }}
                            className="hover-scale"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Docent Feedback (if available) */}
                    {(m as any).teacherFeedback && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        background: 'rgba(251, 191, 36, 0.1)',
                        borderLeft: '3px solid #fbbf24',
                        borderRadius: '4px 8px 8px 4px',
                        fontSize: '0.85rem'
                      }}>
                        <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: '4px' }}>Feedback van je docent:</div>
                        <div style={{ color: '#fff' }}>{(m as any).teacherFeedback}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Thinking / Generating Bubble */}
              {isGenerating && messages[messages.length - 1]?.role === 'user' && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', alignItems: 'center' }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.2) 0%, rgba(56, 189, 248, 0.2) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.75rem',
                    flexShrink: 0
                  }}>
                    <span style={{ fontSize: '15px' }}>🤖</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'rgba(17, 24, 39, 0.65)',
                    padding: '8px 16px',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <span className="pulse-dot"></span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {thinkingStatus || 'Antwoord wordt opgesteld...'}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      background: 'rgba(124, 92, 252, 0.2)',
                      color: '#c4b5fd',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontWeight: 600
                    }}>
                      {generatingModel || selectedModel}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input & Empty State Container */}
        <div style={{ 
          flex: messages.length === 0 ? 1 : 'none', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: messages.length === 0 ? 'center' : 'flex-end', 
          alignItems: 'center',
          padding: messages.length === 0 ? '2rem' : '0 1.5rem 1.25rem',
          position: 'relative'
        }}>
          
          {/* Futuristic ambient glowing orb in empty state */}
          {messages.length === 0 && <div className="ambient-orb" />}
          
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', width: '100%', maxWidth: '820px', marginBottom: '1.5rem', position: 'relative', zIndex: 5 }}>
              <h1 className="gemini-welcome-text" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                {currentVibe}, {user?.displayName?.split(' ')[0] || 'leerling'}?
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>
                Kies een slimme actiekaart hieronder of typ direct je vraag.
              </p>

              {/* Quick Action Cards */}
              {quickActions.length > 0 && (
                <div className="quick-actions-grid">
                  {quickActions.slice(0, 4).map((card: any) => (
                    <div
                      key={card.id}
                      className="quick-action-card"
                      onClick={() => {
                        setPrompt(card.prompt);
                        textareaRef.current?.focus();
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.25rem' }}>{card.icon || '💡'}</span>
                        <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{card.title}</strong>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {card.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Active Model Indicator during Generation (above input box) */}
          {isGenerating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', zIndex: 10 }}>
              <div className="model-indicator-badge">
                <span className="pulse-dot"></span>
                <span>Genereren via <strong>{generatingModel || selectedModel}</strong></span>
              </div>
            </div>
          )}

          {/* Feature Pills Bar (Thinking toggle, SOMtoday, etc.) */}
          <div style={{ display: 'flex', gap: '6px', width: '100%', maxWidth: '820px', marginBottom: '8px', flexWrap: 'wrap', zIndex: 10 }}>
            {/* Thinking Mode Pill (Student controls when to think!) */}
            <button
              type="button"
              className={`feature-pill ${useThinkMode ? 'active' : ''}`}
              onClick={() => {
                setUseThinkMode(!useThinkMode);
                addToast(!useThinkMode ? '🧠 Denkmodus geactiveerd voor deze vraag' : 'Denkmodus uitgeschakeld', 'info');
              }}
              title="Schakel uitgebreid redeneren (thinking) in of uit"
            >
              <span>🧠</span> Denkmodus {useThinkMode ? '✓' : ''}
            </button>

            {/* Internet Search Pill */}
            {orgDetails?.orgSettings?.enableWebSearch !== false && (
              <button
                type="button"
                className={`feature-pill ${useInternetSearch ? 'active' : ''}`}
                onClick={() => setUseInternetSearch(!useInternetSearch)}
              >
                <span>🌐</span> Zoeken op internet {useInternetSearch ? '✓' : ''}
              </button>
            )}

            {/* Deep Research Pill */}
            <button
              type="button"
              className={`feature-pill ${useDeepResearch ? 'active' : ''}`}
              onClick={() => setUseDeepResearch(!useDeepResearch)}
            >
              <span>🔬</span> Diepgaand {useDeepResearch ? '✓' : ''}
            </button>

            {/* SOMtoday Pill */}
            <button
              type="button"
              className={`feature-pill ${useSomtoday ? 'active' : ''}`}
              onClick={() => setUseSomtoday(!useSomtoday)}
            >
              <span>🎓</span> SOMtoday {useSomtoday ? '✓' : ''}
            </button>
          </div>

          {/* Floating Input Wrapper */}
          <div className="floating-input-wrapper glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem 1rem 0.75rem 1.25rem', width: '100%', maxWidth: '820px', zIndex: 10, borderRadius: '32px' }}>
             {/* Image Previews */}
             {attachments.length > 0 && (
               <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                 {attachments.map((src, i) => (
                   <div key={i} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                     <img src={src} alt="attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                     <button type="button" onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer' }}>×</button>
                   </div>
                 ))}
               </div>
             )}
             {fileAttachments.length > 0 && (
               <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                 {fileAttachments.map((f, i) => (
                   <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(124,92,252,0.12)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem' }}>
                     <span>📄</span>
                     <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                     <button type="button" onClick={() => setFileAttachments(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                   </div>
                 ))}
               </div>
             )}
             
             <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
               <div style={{ position: 'relative' }}>
                 <button 
                   type="button" 
                   onClick={() => fileInputRef.current?.click()}
                    className="btn btn-ghost" 
                    style={{ width: '38px', height: '38px', padding: 0, borderRadius: '50%', flexShrink: 0, color: 'var(--text-secondary)' }}
                   disabled={isGenerating || !activeConvId}
                   title="Bestand toevoegen"
                 >
                   ➕
                 </button>
                 
                 {showPlusMenu && (
                   <div className="animate-fade-in" style={{ 
                     position: 'absolute', 
                     bottom: '100%', 
                     left: 0, 
                     marginBottom: '1rem',
                     background: 'var(--bg-elevated)',
                     border: '1px solid var(--bg-surface-hover)',
                     borderRadius: '12px',
                     padding: '0.5rem',
                     minWidth: '220px',
                     boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                     display: 'flex',
                     flexDirection: 'column',
                     gap: '4px',
                     zIndex: 9999
                   }}>
                     <button type="button" onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                       📎 Foto's & Bestanden toevoegen
                     </button>
                     <button type="button" onClick={() => { setUseThinkMode(!useThinkMode); setShowPlusMenu(false); }} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: useThinkMode ? '#c4b5fd' : 'inherit' }}>
                       {useThinkMode ? '✓' : '🧠'} Denkmodus inschakelen
                     </button>
                     <button type="button" onClick={() => { setShowSomtodayPanel(true); setShowPlusMenu(false); }} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                       ⚙️ SOMtoday Rooster inzien
                     </button>
                   </div>
                 )}
               </div>

               <input 
                 type="file" 
                 ref={fileInputRef} 
                 style={{ display: 'none' }} 
                 accept="image/*,.pdf,.txt,.doc,.docx,.md,.csv,.json,.js,.ts,.py,.html,.css,.xml,.yaml,.yml,.rtf" 
                 multiple
                 onChange={handleFileSelect} 
               />
               <textarea 
                 ref={textareaRef}
                 value={prompt}
                 onChange={e => {
                   setPrompt(e.target.value);
                   const el = e.target as HTMLTextAreaElement;
                   el.style.height = 'auto';
                   const lineH = parseFloat(getComputedStyle(el).lineHeight) || 24;
                   el.style.height = Math.min(el.scrollHeight, lineH * 4) + 'px';
                 }}
                 onKeyDown={e => {
                   if (e.key === 'Enter' && !e.shiftKey) {
                     e.preventDefault();
                     if ((prompt.trim() || attachments.length > 0) && !isGenerating && activeConvId) {
                       handleSend();
                     }
                   }
                 }}
                 placeholder={activeConvId ? "Stel een vraag, vraag hulp bij huiswerk..." : "Maak eerst een nieuw gesprek aan"}
                 rows={1}
                 style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem', resize: 'none', fontFamily: 'inherit', lineHeight: '1.5', maxHeight: '96px', overflow: 'auto', padding: '0.5rem 0' }}
                 disabled={!activeConvId}
               />
               
               {recognitionRef.current && (
                 <button 
                   type="button" 
                   onClick={toggleListening} 
                   className="btn btn-ghost" 
                   style={{ width: '38px', height: '38px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: isListening ? 'var(--danger-color)' : 'var(--text-secondary)', animation: isListening ? 'pulse 1.5s infinite' : 'none' }}
                   disabled={!activeConvId}
                   title="Spreek een bericht in"
                 >
                   🎤
                 </button>
               )}
               
               <button 
                 type="button" 
                 onClick={() => handleSend()}
                 className="btn btn-primary" 
                 style={{ width: '42px', height: '42px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.2rem' }} 
                 disabled={isGenerating || !activeConvId || (!prompt.trim() && attachments.length === 0)}
               >
                 ➤
               </button>
             </div>
          </div>

          <div
            style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
            dangerouslySetInnerHTML={{
              __html: orgDetails?.footerText ||
                'AI kan fouten maken. Controleer antwoorden. Locra voor Scholen • Pjotters'
            }}
          />
        </div>
      </div>
    </div>

    {/* Share Modal */}
    {showShareModal && activeConvId && !activeConvId.startsWith('local-') && (
      <ShareModal
        conversationId={activeConvId}
        isShared={conversations.find(c => c.id === activeConvId)?.isShared || false}
        shareToken={conversations.find(c => c.id === activeConvId)?.shareToken || null}
        onClose={() => setShowShareModal(false)}
        onShareToggle={handleShareToggle}
      />
    )}
    
    {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
    {showSomtodayPanel && <SomtodayPanel onClose={() => setShowSomtodayPanel(false)} />}

    {/* Document Preview Modal */}
    {previewSource && previewSource.type === 'document' && (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem',
          animation: 'fadeIn 0.2s ease'
        }}
        onClick={() => setPreviewSource(null)}
      >
        <div 
          style={{
            width: '100%',
            maxWidth: '900px',
            height: '85vh',
            background: 'var(--bg-elevated)',
            borderRadius: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            animation: 'slideIn 0.3s ease'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'var(--bg-surface)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>📄</span>
              <div>
                <div style={{ fontWeight: 600 }}>{previewSource.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Document preview</div>
              </div>
            </div>
            <button 
              onClick={() => setPreviewSource(null)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                color: 'var(--text-secondary)',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            <iframe 
              src={`/api/knowledge/documents/${previewSource.id}/preview`}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'white'
              }}
              title={previewSource.title}
            />
          </div>
        </div>
      </div>
    )}
    
    {showWatermarkModal && <WatermarkDetector onClose={() => setShowWatermarkModal(false)} />}

    {/* Doc Link Modal */}
    {showDocLinkModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', width: '100%', maxWidth: '500px', padding: '28px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.3rem' }}>📄 Google Doc Koppelen</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.5 }}>
            Plak de link van je Google Doc hieronder. Zorg ervoor dat in je Google Doc de optie <strong>"Iedereen met de link kan bewerken"</strong> is ingeschakeld, zodat de docent het document kan openen en beoordelen.
          </p>
          <input
            type="text"
            autoFocus
            placeholder="https://docs.google.com/document/d/..."
            value={docLinkInput}
            onChange={e => setDocLinkInput(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '10px', fontSize: '0.9rem', marginBottom: '20px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button onClick={() => { setShowDocLinkModal(false); setDocLinkInput(''); }} style={{ padding: '10px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', borderRadius: '10px', cursor: 'pointer' }}>
              Annuleren
            </button>
            <button
              onClick={() => {
                if (docLinkInput && docLinkInput.includes('docs.google.com/document')) {
                  const subId = assignmentInfo?.submissions?.[0]?.id;
                  if (!subId) {
                    addToast('Geen actieve inzending gevonden.', 'error');
                    return;
                  }
                  fetch(`/api/assignments/submissions/${subId}/attach-doc`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ googleDocUrl: docLinkInput })
                  }).then(r => r.json()).then(res => {
                    if (res.success) {
                      setGoogleDocUrl(docLinkInput);
                      setIsGoogleDocPanelOpen(true);
                      addToast('Google Doc succesvol gekoppeld!', 'success');
                      setShowDocLinkModal(false);
                      setDocLinkInput('');
                    } else {
                      addToast(res.error || 'Fout bij koppelen', 'error');
                    }
                  });
                } else if (docLinkInput) {
                  addToast('Ongeldige URL. Zorg dat het een "docs.google.com/document" link is.', 'error');
                } else {
                  addToast('Vul een link in', 'error');
                }
              }}
              style={{ padding: '10px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
            >
              Koppelen
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Web Source Side Panel */}
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: webPreviewUrl ? 'min(520px, 45vw)' : '0',
      height: '100vh',
      background: 'var(--bg-sidebar, var(--bg-card))',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 500,
      transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
      boxShadow: webPreviewUrl ? '-8px 0 32px rgba(0,0,0,0.35)' : 'none',
    }}>
      {webPreviewUrl && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.9rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, background: 'var(--bg-surface)' }}>
            <button
              type="button"
              onClick={() => setWebPreviewUrl(null)}
              className="btn btn-ghost"
              style={{ padding: '0.3rem 0.5rem', flexShrink: 0, fontSize: '1rem' }}
              title="Sluiten"
            >
              ✕
            </button>
            <span style={{ fontSize: '0.9rem' }}>🌐</span>
            <div style={{
              flex: 1,
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {webPreviewUrl}
            </div>
            <a
              href={webPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ color: 'var(--primary)', fontSize: '0.78rem', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              ↗ Nieuw tabblad
            </a>
          </div>
          <WebPreviewFrame url={webPreviewUrl} />
        </>
      )}
    </div>
    </>
  );
}
