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
import CoopModal from '../../components/CoopModal';
import UserSettingsModal from './UserSettingsModal';
import SomtodayPanel from './SomtodayPanel';
import WatermarkDetector from './WatermarkDetector';
import WebPreviewFrame from './WebPreviewFrame';
import InteractiveQuizCard, { parseQuizBlocks } from './InteractiveQuizCard';
import { useToast } from '../../components/ToastProvider';
import { useAcademyName } from '../../store/orgStore';
interface ChatLayoutProps {
  mode?: 'personal' | 'coop';
}

export default function ChatLayout({ mode = 'personal' }: ChatLayoutProps) {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const academyName = useAcademyName();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');
  const urlConvId = searchParams.get('conversationId');
  const { addToast } = useToast();

  const handleAuthError = () => {
    logout();
    navigate('/login');
  };
  
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
  const [selectedPersona, setSelectedPersona] = useState<string>('bot');
  
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('locra_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [chatTheme, setChatTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('locra_chat_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('locra_chat_theme', chatTheme);
    } catch {
      // The chat remains usable when browser storage is unavailable.
    }
  }, [chatTheme]);

  useEffect(() => {
    try {
      localStorage.setItem('locra_sidebar_collapsed', String(isSidebarCollapsed));
    } catch { }
  }, [isSidebarCollapsed]);
  
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
  const [useNewsSearch, setUseNewsSearch] = useState(false);
  const [useDeepResearch, setUseDeepResearch] = useState(false);
  const [useThinkMode, setUseThinkMode] = useState(false);
  const [useSomtoday, setUseSomtoday] = useState(false);
  const [useQuizMode, setUseQuizMode] = useState(false);
  const [useEssayCoach, setUseEssayCoach] = useState(false);
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
  const [showCoopModal, setShowCoopModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDocLinkModal, setShowDocLinkModal] = useState(false);
  const [docLinkInput, setDocLinkInput] = useState('');
  const [activeHoverMsg, setActiveHoverMsg] = useState<number | null>(null);
  
  // RAG/Web Sources state
  const pendingSourcesRef = useRef<any[]>([]);
  const [previewSource, setPreviewSource] = useState<any | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [canvasContent, setCanvasContent] = useState<string | null>(null);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('Mijn Document');
  const [docHistory, setDocHistory] = useState<string[]>([]);
  const [isAiEditingDoc, setIsAiEditingDoc] = useState(false);
  const [customAiDocInstruction, setCustomAiDocInstruction] = useState('');
  const [showAiCustomInput, setShowAiCustomInput] = useState(false);

  const handleAiDocEdit = async (action: string, customText?: string) => {
    if (!canvasContent || !canvasContent.trim() || isAiEditingDoc) return;
    setIsAiEditingDoc(true);
    // Push current content to history for undo
    setDocHistory(prev => [canvasContent, ...prev.slice(0, 9)]);

    try {
      const res = await fetch('/api/chat/docs/ai-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          docContent: canvasContent,
          action,
          customInstruction: customText || customAiDocInstruction,
          model: selectedModel
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI bewerking mislukt');

      if (data.updatedContent) {
        setCanvasContent(data.updatedContent);
        addToast('Document direct bijgewerkt door AI!', 'success');
        setShowAiCustomInput(false);
        setCustomAiDocInstruction('');
      }
    } catch (err: any) {
      addToast(err.message || 'Fout bij AI bewerking', 'error');
    } finally {
      setIsAiEditingDoc(false);
    }
  };

  const handleUndoDoc = () => {
    if (docHistory.length === 0) return;
    const [previous, ...rest] = docHistory;
    setCanvasContent(previous);
    setDocHistory(rest);
    addToast('Vorige versie hersteld', 'info');
  };

  // Slash command & @-mention autocomplete
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashSelectedIdx, setSlashSelectedIdx] = useState(0);

  const ALL_COMMANDS = [
    // Slash commands
    { cmd: '/denkmodus', type: 'slash', label: '🧠 Denkmodus', desc: 'Diepe AI redenering in- of uitschakelen', toggle: () => { setUseThinkMode(v => !v); addToast(!useThinkMode ? '🧠 Denkmodus aan' : 'Denkmodus uit', 'info'); }, isActive: () => useThinkMode },
    { cmd: '/zoeken', type: 'slash', label: '🌐 Zoeken', desc: 'Internet doorzoeken voor actuele info', toggle: () => { setUseInternetSearch(v => !v); addToast(!useInternetSearch ? '🌐 Zoeken aan' : 'Zoeken uit', 'info'); }, isActive: () => useInternetSearch },
    { cmd: '/nieuws', type: 'slash', label: '📰 Nieuws', desc: 'Actueel nieuws doorzoeken', toggle: () => { setUseNewsSearch(v => !v); addToast(!useNewsSearch ? '📰 Nieuws aan' : 'Nieuws uit', 'info'); }, isActive: () => useNewsSearch },
    { cmd: '/diepgaand', type: 'slash', label: '🔬 Diepgaand', desc: 'Grondig diepte-onderzoek', toggle: () => { setUseDeepResearch(v => !v); addToast(!useDeepResearch ? '🔬 Diepgaand aan' : 'Diepgaand uit', 'info'); }, isActive: () => useDeepResearch },
    { cmd: '/somtoday', type: 'slash', label: '📚 SOMtoday', desc: 'Schoolrooster en cijfers inzien', toggle: () => { setUseSomtoday(v => !v); setShowSomtodayPanel(true); }, isActive: () => useSomtoday },
    { cmd: '/opstel', type: 'slash', label: '✏️ Opstel-coach', desc: 'Directe feedback op je schrijftekst', toggle: () => { setUseEssayCoach(v => !v); if (!useEssayCoach) setUseQuizMode(false); addToast(!useEssayCoach ? '✏️ Opstel-coach actief' : 'Opstel-coach uit', 'info'); }, isActive: () => useEssayCoach },
    { cmd: '/quiz', type: 'slash', label: '🎯 Quiz-modus', desc: 'Interactieve quizvragen genereren', toggle: () => { setUseQuizMode(v => !v); if (!useQuizMode) setUseEssayCoach(false); addToast(!useQuizMode ? '🎯 Quiz-modus actief' : 'Quiz-modus uit', 'info'); }, isActive: () => useQuizMode },
    { cmd: '/docs', type: 'slash', label: '📝 Locra Docs', desc: 'Document live werkplek & AI-editor', toggle: () => setIsCanvasOpen(true), isActive: () => isCanvasOpen },
    { cmd: '/wissen', type: 'slash', label: '🗑️ Nieuwe chat', desc: 'Gesprek wissen en nieuw starten', toggle: () => createConversation(), isActive: () => false },

    // @ Mentions (modi, tools en bronnen)
    { cmd: '@quiz', type: 'mention', label: '🎯 Quiz-modus', desc: 'Interactieve oefentoets/quiz starten', toggle: () => { setUseQuizMode(v => !v); if (!useQuizMode) setUseEssayCoach(false); addToast(!useQuizMode ? '🎯 Quiz-modus actief' : 'Quiz-modus uit', 'info'); }, isActive: () => useQuizMode },
    { cmd: '@docs', type: 'mention', label: '📝 Locra Docs', desc: 'Live document editor openen', toggle: () => setIsCanvasOpen(true), isActive: () => isCanvasOpen },
    { cmd: '@denkmodus', type: 'mention', label: '🧠 Denkmodus', desc: 'Diepe redeneermodus inschakelen', toggle: () => { setUseThinkMode(v => !v); addToast(!useThinkMode ? '🧠 Denkmodus aan' : 'Denkmodus uit', 'info'); }, isActive: () => useThinkMode },
    { cmd: '@zoeken', type: 'mention', label: '🌐 Web Zoeken', desc: 'Internet raadplegen als bron', toggle: () => { setUseInternetSearch(v => !v); addToast(!useInternetSearch ? '🌐 Zoeken aan' : 'Zoeken uit', 'info'); }, isActive: () => useInternetSearch },
    { cmd: '@nieuws', type: 'mention', label: '📰 Nieuwsbronnen', desc: 'Recent nieuws raadplegen', toggle: () => { setUseNewsSearch(v => !v); addToast(!useNewsSearch ? '📰 Nieuws aan' : 'Nieuws uit', 'info'); }, isActive: () => useNewsSearch },
    { cmd: '@somtoday', type: 'mention', label: '📚 SOMtoday', desc: 'Rooster en schoolgegevens', toggle: () => { setUseSomtoday(v => !v); setShowSomtodayPanel(true); }, isActive: () => useSomtoday },
    { cmd: '@opstel', type: 'mention', label: '✏️ Opstel-coach', desc: 'Schrijfbegeleiding & correctie', toggle: () => { setUseEssayCoach(v => !v); if (!useEssayCoach) setUseQuizMode(false); addToast(!useEssayCoach ? '✏️ Opstel-coach actief' : 'Opstel-coach uit', 'info'); }, isActive: () => useEssayCoach },
    { cmd: '@kennisbank', type: 'mention', label: '📖 Kennisbank', desc: 'Doorzoek schooldocumenten en readers', toggle: () => addToast('📖 Kennisbank actief — bestanden worden automatisch doorzocht', 'info'), isActive: () => false },
  ];

  const isAtQuery = slashQuery !== null && slashQuery.startsWith('@');
  const isSlashQuery = slashQuery !== null && slashQuery.startsWith('/');
  const queryClean = slashQuery ? slashQuery.slice(1).toLowerCase() : '';

  const filteredSlashCmds = slashQuery !== null
    ? ALL_COMMANDS.filter(s => {
        if (isAtQuery && s.type !== 'mention') return false;
        if (isSlashQuery && s.type !== 'slash') return false;
        if (!queryClean) return true;
        const nameClean = s.cmd.slice(1).toLowerCase();
        return nameClean.includes(queryClean) || s.label.toLowerCase().includes(queryClean) || s.desc.toLowerCase().includes(queryClean);
      })
    : [];

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
    }).then(r => {
      if (r.status === 401) { handleAuthError(); return null; }
      return r.json();
    }).then(data => {
      if (Array.isArray(data)) setModels(data.filter((m: any) => !m.isCodeMatchOnly));
    }).catch(() => {});

    // Fetch knowledge bases
    fetch('/api/knowledge', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => {
      if (r.status === 401) { handleAuthError(); return null; }
      return r.json();
    }).then(data => {
      if (Array.isArray(data)) setKnowledgeBases(data);
    }).catch(() => {});

    // Fetch quick actions
    fetch('/api/quick-actions', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => {
      if (r.status === 401) { handleAuthError(); return null; }
      return r.json();
    }).then(data => {
      if (Array.isArray(data)) setQuickActions(data);
    }).catch(() => {});

    // Fetch labels
    fetch('/api/chat/labels', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => {
      if (r.status === 401) { handleAuthError(); return null; }
      return r.json();
    }).then(data => {
      if (Array.isArray(data)) setLabels(data);
    }).catch(() => {});

    // Fetch org details
    fetch('/api/organization/customization', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => {
      if (r.status === 401) { handleAuthError(); return null; }
      return r.json();
    }).then(data => {
      if (data && !data.error) setOrgDetails(data);
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

  const loadConversations = () => {
    if (!token) return;
    const searchParams = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
    fetch(`/api/chat/conversations${searchParams}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => {
      if (r.status === 401) {
        handleAuthError();
        return null;
      }
      return r.json();
    }).then(data => {
      if (Array.isArray(data)) {
        setConversations(data);
        if (urlConvId) {
          setActiveConvId(urlConvId);
        }
      }
    }).catch(console.error);
  };

  // Fetch conversations
  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadConversations();
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
      if (res.status === 401) {
        handleAuthError();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPinnedMessages(data);
        } else {
          setPinnedMessages([]);
        }
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
        }).then(r => {
          if (r.status === 401) {
            handleAuthError();
            return null;
          }
          return r.json();
        }).then(data => {
          if (Array.isArray(data)) {
            setMessages(data.map((m: any) => ({
              ...m,
              images: m.attachments ? JSON.parse(m.attachments) : m.images
            })));
          } else {
            setMessages([]);
          }
        }).catch(err => {
          console.error(err);
          setMessages([]);
        });
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
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          console.warn('[WS] Ongeldig bericht ontvangen:', event.data);
          return;
        }
        if (data.type === 'auth_error') {
          handleAuthError();
          return;
        }
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
            c.id === data.conversationId ? { ...c, title: data.title, tags: data.tags ? JSON.stringify(data.tags) : c.tags } : c
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
        } else if (data.type === 'coop_message') {
          const msg = data.message;
          if (document.hidden && Notification.permission === 'granted') {
            new Notification(`Nieuw bericht van ${msg.user.name || 'Co-op Leden'}`, {
              body: msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '')
            });
          } else if (Notification.permission === 'default') {
            Notification.requestPermission();
          }
          if (msg.conversationId === activeConvId) {
            setMessages(prev => [...prev, {
              role: 'user',
              content: msg.content,
              dbId: msg.id,
              userId: msg.userId,
              user: msg.user,
              streaming: false
            }]);
          } else {
            addToast(`Nieuw bericht in Co-op van ${msg.user.name || 'iemand'}`, 'info');
          }
        } else if (data.type === 'done') {
          setIsGenerating(false);
          setThinkingStatus(null);
          setGeneratingModel(null);
          
          if (data.isHumanOnly) {
            // It was a multiplayer chat without AI mention. We just need to update the user message ID.
            setMessages(prev => {
              const last = [...prev];
              if (last.length > 0) {
                last[last.length - 1] = { ...last[last.length - 1], dbId: data.messageId };
              }
              return last;
            });
            return;
          }

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
        newsSearch: useNewsSearch,
        deepResearch: useDeepResearch,
        thinkMode: useThinkMode,
        useSomtoday: useSomtoday,
        persona: selectedPersona,
        quizMode: useQuizMode,
        essayCoach: useEssayCoach,
        docContent: isCanvasOpen && canvasContent ? canvasContent : undefined
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

  const handleOrganizeWithAI = async () => {
    setOrganizing(true);
    addToast('Gesprekken worden gesorteerd door AI...', 'info');
    try {
      const res = await fetch('/api/chat/conversations/organize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        addToast('Gesprekken succesvol gesorteerd!', 'success');
        loadConversations();
      } else {
        addToast('Fout bij sorteren van gesprekken', 'error');
      }
    } catch (e) {
      addToast('Netwerkfout', 'error');
    } finally {
      setOrganizing(false);
    }
  };

  const exportChat = () => {
    const _isLocalConv = activeConvId?.startsWith('local-');
    const msgsToExport = _isLocalConv ? (localMessages[activeConvId!] || []) : messages;
    if (msgsToExport.length === 0) return;
    
    let content = `# Locra Chat Export\nDatum: ${new Date().toLocaleString('nl-NL')}\n\n`;
    msgsToExport.forEach(m => {
      const roleName = m.role === 'user' ? '👤 Jij' : `🤖 ${m.modelUsed || 'AI'}`;
      content += `### ${roleName}\n${m.content}\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
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

  // Filter conversations by label if set & sluit opdracht-chats uit van de reguliere chatlijst
  const filteredConversations = conversations.filter(c => {
    if (c.title?.startsWith('[Opdracht]') || c.isAssignment || c.assignmentId) return false;
    if (mode === 'coop' && !c.isCollab) return false;
    if (mode === 'personal' && c.isCollab) return false;

    if (!selectedLabelFilter) return true;
    return c.labels?.some((cl: any) => cl.labelId === selectedLabelFilter);
  });

  return (
    <>
<style>{`
        .locra-chat-shell {
          color: var(--text-primary);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          isolation: isolate;
          transition: background-color .22s ease, color .22s ease;
        }
        .locra-chat-shell * { box-sizing: border-box; }
        .locra-chat-shell button, .locra-chat-shell input, .locra-chat-shell textarea, .locra-chat-shell select { font: inherit; }
        .locra-chat-shell button { transition: background-color .18s ease, border-color .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease; }
        .locra-chat-shell button:focus-visible, .locra-chat-shell input:focus-visible, .locra-chat-shell textarea:focus-visible, .locra-chat-shell select:focus-visible {
          outline: 3px solid color-mix(in srgb, var(--primary) 34%, transparent); outline-offset: 2px;
        }
        .locra-chat-shell .sidebar-chatgpt {
          background: var(--bg-sidebar, var(--bg-surface));
          border-right: 1px solid var(--border-color, rgba(127,140,166,.18));
          box-shadow: 8px 0 28px rgba(24,35,65,.035);
        }
        .locra-chat-shell header { box-shadow: 0 4px 22px rgba(25,35,60,.035); }
        .locra-chat-shell .locra-theme-toggle {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          min-height: 36px; padding: 7px 11px; border: 1px solid var(--border-color);
          border-radius: 999px; background: var(--bg-surface); color: var(--text-primary);
          font-size: .78rem; font-weight: 650; cursor: pointer; white-space: nowrap;
        }
        .locra-chat-shell .locra-theme-toggle:hover { transform: translateY(-1px); box-shadow: 0 5px 14px rgba(33,43,77,.09); }
        .locra-chat-shell .floating-input-wrapper {
          background: var(--bg-surface) !important; border: 1px solid var(--border-color) !important;
          box-shadow: 0 12px 36px rgba(32,45,78,.09), 0 2px 8px rgba(32,45,78,.035);
          transition: box-shadow .2s ease, border-color .2s ease, background .2s ease;
        }
        .locra-chat-shell .floating-input-wrapper:focus-within {
          border-color: color-mix(in srgb, var(--primary) 55%, var(--border-color)) !important;
          box-shadow: 0 14px 38px rgba(54,65,120,.12), 0 0 0 3px color-mix(in srgb, var(--primary) 10%, transparent);
        }
        .locra-chat-shell .quick-actions-grid { gap: 12px; }
        .locra-chat-shell .quick-action-card {
          border: 1px solid var(--border-color, rgba(127,140,166,.2)) !important;
          border-radius: 18px !important; background: var(--bg-surface) !important;
          box-shadow: 0 5px 18px rgba(31,44,79,.035); padding: 17px !important;
          text-align: left; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }
        .locra-chat-shell .quick-action-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--primary) 48%, var(--border-color)) !important; box-shadow: 0 12px 26px rgba(31,44,79,.08); }
        .locra-chat-shell .feature-pill { border-radius: 999px !important; padding: 7px 11px !important; font-weight: 600; }
        .locra-chat-shell .model-indicator-badge { border: 1px solid var(--border-color); border-radius: 999px; padding: 7px 12px; background: var(--bg-surface); color: var(--text-secondary); }
        .locra-chat-shell .markdown-body { overflow-wrap: anywhere; }
        .locra-chat-shell .markdown-body img { max-width: 100%; height: auto; }
        .locra-chat-shell .markdown-body table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
        .locra-chat-shell .markdown-body th, .locra-chat-shell .markdown-body td { border: 1px solid var(--border-color); padding: .5rem .7rem; }
        .locra-chat-shell .markdown-body th { background: color-mix(in srgb, var(--bg-surface-hover) 72%, transparent); }
        .locra-chat-shell .msg-action-btn { border: 1px solid var(--border-color); border-radius: 9px; padding: 5px 9px; background: var(--bg-surface); color: var(--text-secondary); }
        .locra-chat-shell .msg-action-btn:hover { color: var(--text-primary); border-color: color-mix(in srgb, var(--primary) 45%, var(--border-color)); }
        .locra-chat-shell.theme-light { color-scheme: light; }
        .locra-chat-shell.theme-light .sidebar-chatgpt { background: #fbfcff !important; border-color: #e5e9f2 !important; }
        .locra-chat-shell.theme-light .sidebar-chatgpt button:not(.btn-primary) { color: #43506a !important; }
        .locra-chat-shell.theme-light .sidebar-chatgpt .btn-primary { color: #fff !important; }
        .locra-chat-shell.theme-light .sidebar-chatgpt input { background: #f5f7fb !important; border-color: #e4e9f2 !important; color: #1d2940 !important; }
        .locra-chat-shell.theme-light .sidebar-chatgpt .conv-actions button { color: #65718a !important; }
        .locra-chat-shell.theme-light header { background: rgba(255,255,255,.9) !important; border-bottom: 1px solid #e6eaf2 !important; }
        .locra-chat-shell.theme-light header select { color: #28334a !important; }
        .locra-chat-shell.theme-light header select option { color: #1d2940; background: #fff; }
        .locra-chat-shell.theme-light .quick-action-card strong { color: #202b42 !important; }
        .locra-chat-shell.theme-light .markdown-body a { color: #245fca !important; }
        .locra-chat-shell.theme-light .markdown-body code:not(pre code) { background: #edf1f7 !important; color: #35415a; }
        .locra-chat-shell.theme-light .markdown-body pre { border: 1px solid #e1e6ef; }
        .locra-chat-shell.theme-light details summary { color: #6d40c6 !important; }
        .locra-chat-shell.theme-light .ambient-orb { opacity: .16; }
        .locra-chat-shell.theme-light .btn-ghost { color: #526078; }
        .locra-chat-shell.theme-light .mobile-overlay { background: rgba(22,31,52,.32) !important; backdrop-filter: blur(3px); }
        .locra-chat-shell.theme-light .locra-pinned-drawer { background: #fff !important; border-color: var(--border-color) !important; color: var(--text-primary); box-shadow: 0 8px 24px rgba(31,44,79,.06); }
        .locra-chat-shell.theme-light .locra-pinned-message { background: #f6f8fc !important; border: 1px solid #e7ebf3; }
        .locra-chat-shell.theme-light .locra-theme-toggle { background: #f2f4ff; border-color: #dce2ff; color: #4e46c7; }
        .locra-chat-shell.theme-dark .locra-theme-toggle { background: rgba(255,255,255,.06); color: #e4e8f4; border-color: rgba(255,255,255,.12); }
        @media (max-width: 760px) {
          .locra-chat-shell { height: 100dvh !important; }
          .locra-chat-shell header { padding: .65rem .75rem !important; gap: .5rem; align-items: flex-start !important; }
          .locra-chat-shell header > div:first-child { min-width: 0; flex-wrap: wrap; gap: .45rem !important; }
          .locra-chat-shell header > div:first-child > div { max-width: calc(100vw - 90px); flex-wrap: wrap; }
          .locra-chat-shell header > div:last-child { gap: .25rem !important; flex-wrap: wrap; justify-content: flex-end; }
          .locra-chat-shell .locra-theme-toggle { min-height: 32px; padding: 6px 8px; font-size: .72rem; }
          .locra-chat-shell .quick-actions-grid { grid-template-columns: 1fr !important; }
          .locra-chat-shell .floating-input-wrapper { border-radius: 22px !important; padding: .65rem !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .locra-chat-shell *, .locra-chat-shell *::before, .locra-chat-shell *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; }
        }
      `}</style>
          <div
      className={`mobile-split-pane locra-chat-shell theme-${chatTheme}`}
      data-theme={chatTheme}
      style={{
        display: 'flex', height: '100vh', background: 'var(--bg-base)', position: 'relative', overflowX: 'hidden', color: 'var(--text-primary)',
        '--bg-base': chatTheme === 'light' ? '#f5f7fb' : '#0b1020',
        '--bg-surface': chatTheme === 'light' ? '#ffffff' : '#141b2d',
        '--bg-surface-hover': chatTheme === 'light' ? '#edf1fb' : '#202940',
        '--bg-elevated': chatTheme === 'light' ? '#ffffff' : '#192238',
        '--bg-sidebar': chatTheme === 'light' ? '#fbfcff' : '#0f1525',
        '--bg-card': chatTheme === 'light' ? '#ffffff' : '#141b2d',
        '--surface-color': chatTheme === 'light' ? '#ffffff' : '#141b2d',
        '--text-primary': chatTheme === 'light' ? '#1d2940' : '#eef2ff',
        '--text-secondary': chatTheme === 'light' ? '#65718a' : '#a8b2c7',
        '--text-muted': chatTheme === 'light' ? '#8792a8' : '#7d89a2',
        '--primary': chatTheme === 'light' ? '#6457e8' : '#8b7cff',
        '--primary-color': chatTheme === 'light' ? '#6457e8' : '#8b7cff',
        '--primary-light': chatTheme === 'light' ? '#6c5ce7' : '#aaa0ff',
        '--success': chatTheme === 'light' ? '#16a34a' : '#4ade80',
        '--success-color': chatTheme === 'light' ? '#16a34a' : '#4ade80',
        '--danger-color': chatTheme === 'light' ? '#dc2626' : '#fb7185',
        '--border-color': chatTheme === 'light' ? '#e4e9f2' : 'rgba(148,163,184,.16)',
        '--shadow-sm': chatTheme === 'light' ? '0 4px 14px rgba(31,44,79,.07)' : '0 4px 14px rgba(0,0,0,.22)',
        '--radius-md': '12px', '--radius-lg': '18px', '--radius-pill': '999px'
      } as React.CSSProperties}
    >
      
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="mobile-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} 
        />
      )}

      {/* ── SIDEBAR ── */}
      <div 
        className={`sidebar-chatgpt ${isSidebarOpen ? 'open' : ''}`} 
        style={{ 
          zIndex: 50, 
          height: '100vh', 
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
          display: 'flex', 
          flexDirection: 'column',
          width: isSidebarCollapsed ? '56px' : '260px',
          minWidth: isSidebarCollapsed ? '56px' : '260px',
          overflow: 'hidden'
        }}
      >
        
        {/* Sidebar Header with Toggle */}
        <div style={{ 
          padding: isSidebarCollapsed ? '1rem 0.5rem 0.5rem' : '1.25rem 1.25rem 0.5rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isSidebarCollapsed ? 'center' : 'stretch',
          gap: '8px'
        }}>
          {/* Collapse/Expand Toggle */}
          <div style={{ display: 'flex', justifyContent: isSidebarCollapsed ? 'center' : 'flex-end', marginBottom: '4px' }}>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? 'Sidebar uitklappen' : 'Sidebar inklappen'}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '6px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                transition: 'all 0.2s ease',
                fontSize: '0.85rem'
              }}
            >
              {isSidebarCollapsed ? '☰' : '◁'}
            </button>
          </div>

          {/* New Conversation Button */}
          <button 
            onClick={createConversation} 
            className="btn btn-primary" 
            style={{ 
              width: '100%', 
              marginBottom: isSidebarCollapsed ? '0' : '0.75rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px',
              padding: isSidebarCollapsed ? '8px' : undefined,
              minWidth: 0
            }}
            title="Nieuw Gesprek"
          >
            <span>+</span> {!isSidebarCollapsed && 'Nieuw Gesprek'}
          </button>
          
          
          {isSidebarCollapsed ? (
            /* Collapsed: icon-only nav */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', marginTop: '8px' }}>
              <button onClick={() => navigate('/student')} title="Mijn Opdrachten" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)', borderRadius: '8px', padding: '8px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>🎒</button>
              <button onClick={() => navigate('/academy')} title={academyName} style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.28)', borderRadius: '8px', padding: '8px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>🏛️</button>
              <button onClick={() => navigate('/codematch')} title="CodeMatch" style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '8px', padding: '8px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>💻</button>
              {user && ['teacher', 'admin', 'superadmin'].includes(user.role) && (
                <button onClick={() => navigate('/teacher')} title="Docentenportaal" style={{ background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.25)', borderRadius: '8px', padding: '8px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>🎓</button>
              )}
            </div>
          ) : (
            /* Expanded: full content */
            <>
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

            {/* We can conditionally render this based on orgSettings, but for now we display it */}
            <button
              onClick={() => navigate('/codematch')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                borderRadius: '8px',
                background: 'rgba(74, 222, 128, 0.1)',
                border: '1px solid rgba(74, 222, 128, 0.25)',
                color: '#86efac',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span>💻</span> CodeMatch
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
            </>
          )}

          {/* Chat Labels Pills (filter) - hidden when collapsed */}
          {!isSidebarCollapsed && labels.length > 0 && (
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

          {/* Save to Server Toggle - hidden when collapsed */}
          {!isSidebarCollapsed && (
          <div style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            padding: '8px 12px', background: 'rgba(255,255,255,0.02)', 
            borderRadius: '12px', marginBottom: '8px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
              ☁️ Opslaan op server
            </span>
            <button 
              onClick={() => setSaveToServer(!saveToServer)}
              style={{
                width: '36px', height: '20px', borderRadius: '20px',
                background: saveToServer ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                border: 'none', position: 'relative', cursor: 'pointer',
                transition: 'background 0.2s ease'
              }}
            >
              <div style={{
                position: 'absolute', top: '2px', left: saveToServer ? '18px' : '2px',
                width: '16px', height: '16px', borderRadius: '50%',
                background: 'white', transition: 'left 0.2s ease, transform 0.2s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </button>
          </div>
          )}
        </div>

        {/* Conversations List - hidden when sidebar collapsed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem', display: isSidebarCollapsed ? 'none' : 'block' }}>
          {saveToServer && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginBottom: '10px' }}>
              <button
                onClick={() => {
                  const allFolderNames = filteredConversations
                    .map(c => c.folder || 'Overig')
                    .filter((v, i, a) => a.indexOf(v) === i);
                  const allCollapsed = allFolderNames.every(f => collapsedFolders[f]);
                  const newState: Record<string, boolean> = {};
                  allFolderNames.forEach(f => { newState[f] = !allCollapsed; });
                  setCollapsedFolders(newState);
                }}
                title={Object.values(collapsedFolders).some(v => !v) ? 'Sluit alle mappen' : 'Open alle mappen'}
                style={{ 
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-muted)',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {Object.values(collapsedFolders).some(v => !v) ? '📁 Alles sluiten' : '📂 Alles openen'}
              </button>
              <button 
                onClick={handleOrganizeWithAI}
                disabled={organizing}
                style={{ 
                  background: 'linear-gradient(135deg, rgba(124,92,252,0.1), rgba(56,189,248,0.1))',
                  border: '1px solid rgba(124,92,252,0.3)',
                  color: '#c4b5fd',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: organizing ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: organizing ? 0.7 : 1
                }}
              >
                {organizing ? '⏳ Sorteren...' : '✨ Sorteer met AI'}
              </button>
            </div>
          )}


          {/* ── Recent Chats: Laatste 48 uur & Afgelopen 7 dagen ── */}
          {saveToServer && (() => {
            const now = Date.now();
            const MS_48H = 48 * 60 * 60 * 1000;
            const MS_7D = 7 * 24 * 60 * 60 * 1000;
            const recent48h = filteredConversations.filter(c => {
              const t = new Date(c.updatedAt || c.createdAt).getTime();
              return now - t <= MS_48H;
            }).sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
            const recent7d = filteredConversations.filter(c => {
              const t = new Date(c.updatedAt || c.createdAt).getTime();
              return now - t > MS_48H && now - t <= MS_7D;
            }).sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

            const renderRecentItem = (c: any) => (
              <div
                key={'recent-' + c.id}
                onClick={() => setActiveConvId(c.id)}
                style={{
                  padding: '0.45rem 0.7rem',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  background: c.id === activeConvId ? 'var(--bg-surface-hover)' : 'transparent',
                  marginBottom: '2px',
                  color: c.id === activeConvId ? 'var(--primary)' : 'var(--text-primary)',
                  fontWeight: c.id === activeConvId ? 500 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                  fontSize: '0.82rem'
                }}
              >
                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>💬</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                  {c.title || 'Naamloos gesprek'}
                </span>
              </div>
            );

            return (
              <>
                {recent48h.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div
                      onClick={() => setCollapsedFolders(prev => ({ ...prev, '__recent48h': !prev['__recent48h'] }))}
                      style={{
                        fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)',
                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px',
                        paddingLeft: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                        opacity: 0.85
                      }}
                    >
                      <span style={{ fontSize: '0.6rem' }}>{collapsedFolders['__recent48h'] ? '▶' : '▼'}</span>
                      🕐 Laatste 48 uur
                      <span style={{
                        background: 'color-mix(in srgb, var(--primary) 18%, transparent)',
                        padding: '1px 6px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 600
                      }}>{recent48h.length}</span>
                    </div>
                    {!collapsedFolders['__recent48h'] && recent48h.map(renderRecentItem)}
                  </div>
                )}
                {recent7d.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div
                      onClick={() => setCollapsedFolders(prev => ({ ...prev, '__recent7d': !prev['__recent7d'] }))}
                      style={{
                        fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px',
                        paddingLeft: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                        opacity: 0.85
                      }}
                    >
                      <span style={{ fontSize: '0.6rem' }}>{collapsedFolders['__recent7d'] ? '▶' : '▼'}</span>
                      📅 Afgelopen 7 dagen
                      <span style={{
                        background: 'rgba(255,255,255,0.06)',
                        padding: '1px 6px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 600
                      }}>{recent7d.length}</span>
                    </div>
                    {!collapsedFolders['__recent7d'] && recent7d.map(renderRecentItem)}
                  </div>
                )}
                {(recent48h.length > 0 || recent7d.length > 0) && (
                  <div style={{
                    height: '1px', background: 'linear-gradient(90deg, transparent, var(--border-color), transparent)',
                    margin: '6px 8px 14px'
                  }} />
                )}
              </>
            );
          })()}

          {saveToServer && Object.entries(
            filteredConversations.reduce((acc, c) => {
              const folderName = c.folder || 'Overig';
              if (!acc[folderName]) acc[folderName] = [];
              acc[folderName].push(c);
              return acc;
            }, {} as Record<string, any[]>)
          ).sort(([a], [b]) => a === 'Overig' ? 1 : b === 'Overig' ? -1 : a.localeCompare(b)).map(([folder, convs]: [string, any]) => {
            const isCollapsed = collapsedFolders[folder] || false;
            return (
            <div key={folder} style={{ marginBottom: '16px' }}>
              <div 
                onClick={() => setCollapsedFolders(prev => ({ ...prev, [folder]: !isCollapsed }))}
                style={{ 
                  fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', 
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', 
                  paddingLeft: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' 
                }}
              >
                <span>{isCollapsed ? '▶' : '▼'}</span> 📁 {folder}
              </div>
              {!isCollapsed && convs.map((c: any) => (
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
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    {c.isParticipantOnly && <span style={{ fontSize: '0.75rem', marginRight: '4px' }}>👥</span>}
                    {c.title}
                  </div>
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
            </div>
            );
          })}
        </div>
          
          {!saveToServer && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
              {localConversations.map(c => (
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
          )}
        
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

      {/* ── LOCRA DOCS WORKSPACE (LIVE DOCUMENT BEWERKING MET DIRECTE AI ACTIES) ── */}
      {isCanvasOpen && canvasContent !== null && (
        <div style={{
          flex: 1.4,
          minWidth: '380px',
          maxWidth: '680px',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          background: chatTheme === 'dark' ? '#0f172a' : '#f8fafc',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
          boxShadow: '4px 0 24px rgba(0,0,0,0.25)'
        }}>
          {/* 1. Header Toolbar */}
          <div style={{
            padding: '12px 18px',
            background: chatTheme === 'dark' ? 'rgba(30, 41, 59, 0.85)' : '#ffffff',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '1.2rem' }}>📄</span>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Document Titel..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: chatTheme === 'dark' ? '#fff' : '#0f172a',
                  width: '100%',
                  fontFamily: 'Outfit, sans-serif'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontSize: '0.72rem',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(34, 197, 94, 0.1)',
                padding: '3px 8px',
                borderRadius: '12px'
              }}>
                ● Live gesynchroniseerd
              </span>

              {/* Kopiëren */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(canvasContent);
                  addToast('Tekst gekopieerd naar klembord!', 'success');
                }}
                className="btn btn-ghost"
                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px' }}
                title="Kopieer inhoud"
              >
                📋 Kopiëren
              </button>

              {/* Downloaden als .txt of .md */}
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([canvasContent], { type: 'text/markdown;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${docTitle.trim() || 'document'}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                  addToast('Document gedownload (.md)', 'info');
                }}
                className="btn btn-ghost"
                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px' }}
                title="Download als Markdown bestand"
              >
                💾 Opslaan
              </button>

              <button
                type="button"
                onClick={() => setIsCanvasOpen(false)}
                className="btn btn-ghost"
                style={{ padding: '4px 8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}
                title="Sluit Docs Workspace"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 2. Directe AI Acties Werkbalk */}
          <div style={{
            padding: '8px 14px',
            background: 'linear-gradient(90deg, rgba(124, 92, 252, 0.12), rgba(56, 189, 248, 0.12))',
            borderBottom: '1px solid rgba(124, 92, 252, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: '#c4b5fd' }}>
                <span>✨ AI Directe Bewerking:</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={isAiEditingDoc}
                  onClick={() => handleAiDocEdit('improve')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                  title="Verbeter spelling, grammatica en interpunctie"
                >
                  🪄 Verbeteren
                </button>
                <button
                  type="button"
                  disabled={isAiEditingDoc}
                  onClick={() => handleAiDocEdit('formal')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                  title="Maak de stijl formeler en academischer"
                >
                  💼 Formeler
                </button>
                <button
                  type="button"
                  disabled={isAiEditingDoc}
                  onClick={() => handleAiDocEdit('shorten')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                  title="Kort de tekst in tot de essentie"
                >
                  ✂️ Inkorten
                </button>
                <button
                  type="button"
                  disabled={isAiEditingDoc}
                  onClick={() => handleAiDocEdit('expand')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                  title="Breid uit met extra uitleg en voorbeelden"
                >
                  💡 Uitbreiden
                </button>
                <button
                  type="button"
                  disabled={isAiEditingDoc}
                  onClick={() => handleAiDocEdit('b1')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                  title="Herschrijf naar eenvoudig B1 taalniveau"
                >
                  🇳🇱 B1 Niveau
                </button>
                <button
                  type="button"
                  disabled={isAiEditingDoc}
                  onClick={() => setShowAiCustomInput(v => !v)}
                  style={{ background: showAiCustomInput ? '#7c5cfc' : 'rgba(124, 92, 252, 0.25)', border: '1px solid #7c5cfc', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  💬 Vraag AI...
                </button>
                {docHistory.length > 0 && (
                  <button
                    type="button"
                    disabled={isAiEditingDoc}
                    onClick={handleUndoDoc}
                    style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                    title="Herstel vorige versie van voor de AI wijziging"
                  >
                    ↩️ Ongedaan
                  </button>
                )}
              </div>
            </div>

            {/* Custom AI Instruction Row */}
            {showAiCustomInput && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                <input
                  type="text"
                  value={customAiDocInstruction}
                  onChange={(e) => setCustomAiDocInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAiDocEdit('custom');
                  }}
                  placeholder="Bijv. 'Herschrijf alinea 2 met meer spanning' of 'Voeg 3 bronnen toe'..."
                  disabled={isAiEditingDoc}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(124,92,252,0.4)',
                    color: '#fff',
                    fontSize: '0.78rem'
                  }}
                />
                <button
                  type="button"
                  disabled={isAiEditingDoc || !customAiDocInstruction.trim()}
                  onClick={() => handleAiDocEdit('custom')}
                  style={{
                    background: '#7c5cfc',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isAiEditingDoc ? 'Bezig...' : 'Toepassen →'}
                </button>
              </div>
            )}

            {isAiEditingDoc && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c4b5fd', fontSize: '0.74rem' }}>
                <span className="pulse-dot"></span>
                <span>AI bewerkt momenteel het document direct in de editor...</span>
              </div>
            )}
          </div>

          {/* 3. Snelle Formatting Helper balk */}
          <div style={{
            padding: '6px 14px',
            background: chatTheme === 'dark' ? 'rgba(15, 23, 42, 0.6)' : '#f1f5f9',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.72rem',
            color: 'var(--text-muted)'
          }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setCanvasContent(prev => (prev || '') + '\n## Nieuwe Kop\n')}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px 4px', fontWeight: 700 }}
                title="Kop toevoegen"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => setCanvasContent(prev => (prev || '') + ' **vetgedrukt** ')}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px 4px', fontWeight: 700 }}
                title="Vetgedrukt"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => setCanvasContent(prev => (prev || '') + ' *cursief* ')}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px 4px', fontStyle: 'italic' }}
                title="Cursief"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => setCanvasContent(prev => (prev || '') + '\n- Punt 1\n- Punt 2\n')}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px 4px' }}
                title="Lijst"
              >
                • Lijst
              </button>
              <button
                type="button"
                onClick={() => setCanvasContent(prev => (prev || '') + '\n> Citaat / toelichting\n')}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px 4px' }}
                title="Citaat"
              >
                ” Citaat
              </button>
            </div>

            <div>
              {canvasContent ? `${canvasContent.trim().split(/\s+/).filter(Boolean).length} woorden • ${canvasContent.length} tekens` : '0 woorden'}
            </div>
          </div>

          {/* 4. Live Textarea / Paper Canvas */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <textarea
              value={canvasContent}
              onChange={(e) => setCanvasContent(e.target.value)}
              placeholder="Schrijf hier je tekst of vraag de AI in de chat om het document voor je te schrijven..."
              style={{
                width: '100%',
                height: '100%',
                padding: '24px 28px',
                border: chatTheme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                borderRadius: '12px',
                resize: 'none',
                outline: 'none',
                fontSize: '0.95rem',
                lineHeight: '1.75',
                fontFamily: 'Inter, system-ui, sans-serif',
                color: chatTheme === 'dark' ? '#e2e8f0' : '#1e293b',
                background: chatTheme === 'dark' ? '#1e293b' : '#ffffff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}
            />
          </div>
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
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isCanvasOpen && (!canvasContent || !canvasContent.trim())) {
                        setCanvasContent(`# ${assignmentInfo?.title || 'Opdracht'}\n\n${assignmentInfo?.description || ''}\n\n---\n\nBegin hier met je uitwerking...`);
                        setDocTitle(assignmentInfo?.title || 'Opdracht');
                      }
                      setIsCanvasOpen(true);
                    }}
                    style={{ background: isCanvasOpen ? '#7c5cfc' : 'rgba(124, 92, 252, 0.2)', border: '1px solid #7c5cfc', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                  >
                    📝 Locra Docs
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDocLinkModal(true)}
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🔗 Google Doc Koppelen
                  </button>
                </div>
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

               <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.15)', margin: '0 0.3rem' }} />
               <span style={{ fontSize: '0.85rem', marginRight: '2px', marginLeft: '4px' }}>🎭</span>
               <select 
                 className="input-field" 
                 value={selectedPersona} 
                 onChange={e => setSelectedPersona(e.target.value)}
                 style={{ padding: '0.3rem 0.5rem', width: 'auto', background: 'transparent', border: 'none', fontSize: '0.825rem', color: '#fff', fontWeight: 500 }}
               >
                 <option value="bot">Standaard Assistent</option>
                 <option value="yoda">Yoda (Star Wars)</option>
                 <option value="professor">De Strenge Professor</option>
                 <option value="socrates">Socrates (Wedervragen)</option>
               </select>
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
             <button
               type="button"
               className="locra-theme-toggle"
               onClick={() => setChatTheme(current => current === 'light' ? 'dark' : 'light')}
               aria-label={chatTheme === 'light' ? 'Schakel naar donkere modus' : 'Schakel naar lichte modus'}
               title={chatTheme === 'light' ? 'Schakel naar donkere modus' : 'Schakel naar lichte modus'}
             >
               <span aria-hidden="true">{chatTheme === 'light' ? '☀️' : '🌙'}</span>
               <span>{chatTheme === 'light' ? 'Licht' : 'Donker'}</span>
             </button>
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
             {activeConvId && !activeConvId.startsWith('local-') && orgDetails?.orgSettings?.enableCollabChats !== false && (
               <button 
                 onClick={() => setShowCoopModal(true)}
                 className="btn btn-ghost"
                 style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
               >
                 👥 Co-op
               </button>
             )}
             {activeConvId && (
               <button 
                 onClick={exportChat}
                 className="btn btn-ghost"
                 style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                 title="Exporteer als Markdown/PDF"
               >
                 📄 Exporteren
               </button>
             )}

             {/* ── LOCRA DOCS TOGGLE BUTTON ── */}
             <button
               type="button"
               onClick={() => {
                 if (!isCanvasOpen && (!canvasContent || !canvasContent.trim())) {
                   setCanvasContent('# ' + (docTitle || 'Mijn Document') + '\n\nBegin hier met schrijven, of vraag de AI in de chat om een opstel, verslag of document voor je op te stellen...');
                 }
                 setIsCanvasOpen(prev => !prev);
               }}
               className="btn btn-ghost"
               style={{
                 padding: '0.35rem 0.75rem',
                 fontSize: '0.8rem',
                 background: isCanvasOpen ? 'rgba(124, 92, 252, 0.25)' : 'rgba(255,255,255,0.06)',
                 color: isCanvasOpen ? '#c4b5fd' : '#fff',
                 border: isCanvasOpen ? '1px solid #7c5cfc' : '1px solid rgba(255,255,255,0.1)',
                 fontWeight: 600,
                 display: 'flex',
                 alignItems: 'center',
                 gap: '6px'
               }}
               title="Locra Docs: Live document bewerken & direct samenwerken met AI"
             >
               <span>📝 Docs</span>
               {canvasContent && canvasContent.trim() && (
                 <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
               )}
             </button>
             {orgDetails?.logoUrl && (
               <img src={orgDetails.logoUrl} alt="Logo" style={{ maxHeight: '24px', opacity: 0.85 }} />
             )}
           </div>
        </header>

        {/* Pinned Messages Banner/Drawer */}
        {showPinnedDrawer && pinnedMessages.length > 0 && (
          <div className="locra-pinned-drawer" style={{
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
              <div key={pin.id || pIdx} className="locra-pinned-message" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.825rem' }}>
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

                        let canvasText = '';
                        let cTag = '';
                        let cStartIdx = -1;
                        for (const tag of ['<docs>', '<canvas>']) {
                          const idx = mainText.toLowerCase().indexOf(tag);
                          if (idx !== -1 && (cStartIdx === -1 || idx < cStartIdx)) {
                            cStartIdx = idx;
                            cTag = tag;
                          }
                        }
                        
                        if (cStartIdx !== -1) {
                          const endTag = cTag === '<docs>' ? '</docs>' : '</canvas>';
                          const cEndIdx = mainText.toLowerCase().indexOf(endTag);
                          if (cEndIdx !== -1 && cEndIdx > cStartIdx) {
                            canvasText = mainText.substring(cStartIdx + cTag.length, cEndIdx).trim();
                            mainText = mainText.substring(0, cStartIdx) + mainText.substring(cEndIdx + endTag.length);
                            mainText = mainText.trim();
                          } else {
                            canvasText = mainText.substring(cStartIdx + cTag.length).trim();
                            mainText = mainText.substring(0, cStartIdx).trim();
                          }
                        }
                        // Parse :::quiz blocks
                        const quizParsed = parseQuizBlocks(mainText);
                        const quizData = quizParsed.quiz;
                        if (quizData) {
                          mainText = (quizParsed.before + '\n' + quizParsed.after).trim();
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
                                urlTransform={(value: string) => value}
                                components={{
                                  a({ href, children, ...props }: any) {
                                    if (href && href.startsWith('rag-source:')) {
                                      const idx = parseInt(href.split(':')[1]) - 1;
                                      const source = m.sources && m.sources[idx];
                                      
                                      if (source) {
                                        return (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              setPreviewSource(source);
                                            }}
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.2rem',
                                              padding: '0.1rem 0.4rem',
                                              margin: '0 0.2rem',
                                              fontSize: '0.75rem',
                                              background: 'rgba(16,185,129,0.15)',
                                              border: '1px solid rgba(16,185,129,0.3)',
                                              borderRadius: '12px',
                                              color: '#34d399',
                                              cursor: 'pointer',
                                              verticalAlign: 'middle',
                                              fontWeight: 600,
                                              textDecoration: 'none'
                                            }}
                                            title="Bekijk bronbestand"
                                          >
                                            📄 {children} +{idx + 1}
                                          </button>
                                        );
                                      }
                                    }
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

                            {/* Interactive Quiz Card */}
                            {quizData && (
                              <div style={{ marginTop: mainText ? '1rem' : 0, marginBottom: '0.5rem' }}>
                                <InteractiveQuizCard data={quizData} theme={chatTheme} />
                              </div>
                            )}

                            {canvasText && (
                              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '1.2rem' }}>📝</span>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Locra Docs document bijgewerkt</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Klik om te openen en live te bewerken</div>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => { setCanvasContent(canvasText); setIsCanvasOpen(true); }}
                                  className="btn btn-primary"
                                  style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                  <span>📝</span> Openen in Docs
                                </button>
                              </div>
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


          {/* Floating Input Wrapper */}
          {(() => {
            const isAssignmentLocked = assignmentInfo?.submissions?.[0]?.status === 'submitted' || assignmentInfo?.submissions?.[0]?.status === 'reviewed';
            if (isAssignmentLocked) {
              return (
                <div className="floating-input-wrapper glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem', width: '100%', maxWidth: '820px', zIndex: 10, borderRadius: '32px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <h4 style={{ margin: 0, color: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span>🔒</span> Opdracht is ingeleverd
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Je kunt deze chat alleen nog inzien. Wacht op vrijgave of feedback van de docent.</p>
                </div>
              );
            }
            return (
              <div className="floating-input-wrapper glass-panel" style={{ position: 'relative', overflow: 'visible', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem 1rem 0.75rem 1.25rem', width: '100%', maxWidth: '820px', zIndex: 100, borderRadius: '32px' }}>
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
             
             <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', position: 'relative' }}>
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
                {/* Slash & Mention Command Autocomplete Popover */}
                {slashQuery !== null && filteredSlashCmds.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 12px)',
                    left: 0,
                    right: 0,
                    maxHeight: '290px',
                    overflowY: 'auto',
                    background: 'var(--bg-elevated, #18181b)',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    borderRadius: '16px',
                    padding: '8px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08)',
                    zIndex: 99999,
                    animation: 'fadeIn 0.15s ease'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {isAtQuery ? '@ Vermeldingen & Tools' : '/ Commando\'s & Snelkoppelingen'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        ↑↓ navigeren • Enter selecteren • Esc sluiten
                      </span>
                    </div>
                    {filteredSlashCmds.map((sc, idx) => (
                      <div
                        key={sc.cmd}
                        onClick={() => {
                          sc.toggle();
                          setPrompt(prev => prev.replace(/(?:^|\s)[\/\@][^\s]*$/, ' ').trimEnd() + ' ');
                          setSlashQuery(null);
                          setSlashSelectedIdx(0);
                          textareaRef.current?.focus();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          background: idx === slashSelectedIdx ? 'rgba(124, 92, 252, 0.2)' : 'transparent',
                          border: idx === slashSelectedIdx ? '1px solid rgba(124, 92, 252, 0.35)' : '1px solid transparent',
                          transition: 'all 0.12s ease'
                        }}
                        onMouseEnter={() => setSlashSelectedIdx(idx)}
                      >
                        <span style={{ fontSize: '1.2rem', width: '30px', textAlign: 'center' }}>{sc.label.split(' ')[0]}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: sc.isActive() ? 'var(--primary)' : 'var(--text-primary)' }}>
                              {sc.cmd}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              {sc.label.split(' ').slice(1).join(' ')}
                            </span>
                            {sc.isActive() && (
                              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#4ade80', fontWeight: 700, background: 'rgba(74, 222, 128, 0.12)', padding: '2px 8px', borderRadius: '999px' }}>
                                ✓ ACTIEF
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>{sc.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Active Mode Chips */}
                {(() => {
                  const activeModesArr = ALL_COMMANDS.filter(s => s.type === 'slash' && s.cmd !== '/wissen' && s.cmd !== '/docs' && s.isActive());
                  if (activeModesArr.length === 0) return null;
                  return (
                    <div style={{
                      position: 'absolute',
                      top: '-36px',
                      left: '56px',
                      display: 'flex',
                      gap: '5px',
                      flexWrap: 'wrap'
                    }}>
                      {activeModesArr.map(m => (
                        <span
                          key={m.cmd}
                          onClick={() => { m.toggle(); }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                            color: 'var(--primary)',
                            border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title={`Klik om ${m.label.split(' ').slice(1).join(' ')} uit te schakelen`}
                        >
                          {m.label.split(' ')[0]} {m.label.split(' ').slice(1).join(' ')}
                          <span style={{ fontSize: '0.65rem', opacity: 0.6, marginLeft: '2px' }}>✕</span>
                        </span>
                      ))}
                    </div>
                  );
                })()}

               <textarea 
                 ref={textareaRef}
                 value={prompt}
                 onChange={e => {
                   const val = e.target.value;
                   setPrompt(val);
                   const el = e.target as HTMLTextAreaElement;
                   el.style.height = 'auto';
                   const lineH = parseFloat(getComputedStyle(el).lineHeight) || 24;
                   el.style.height = Math.min(el.scrollHeight, lineH * 4) + 'px';
                   // Detect slash or @ command at the end of input
                   const slashMatch = val.match(/(?:^|\s)([\/\@][^\s]*)$/);
                   if (slashMatch) {
                     setSlashQuery(slashMatch[1]);
                     setSlashSelectedIdx(0);
                   } else {
                     setSlashQuery(null);
                   }
                 }}
                 onKeyDown={e => {
                   // Navigate slash popover
                   if (slashQuery !== null && filteredSlashCmds.length > 0) {
                     if (e.key === 'ArrowDown') {
                       e.preventDefault();
                       setSlashSelectedIdx(prev => Math.min(prev + 1, filteredSlashCmds.length - 1));
                       return;
                     }
                     if (e.key === 'ArrowUp') {
                       e.preventDefault();
                       setSlashSelectedIdx(prev => Math.max(prev - 1, 0));
                       return;
                     }
                     if (e.key === 'Enter' || e.key === 'Tab') {
                       e.preventDefault();
                       const sc = filteredSlashCmds[slashSelectedIdx];
                       if (sc) {
                         sc.toggle();
                         setPrompt(prev => prev.replace(/(?:^|\s)[\/\@][^\s]*$/, ' ').trimEnd() + ' ');
                         setSlashQuery(null);
                         setSlashSelectedIdx(0);
                       }
                       return;
                     }
                     if (e.key === 'Escape') {
                       setSlashQuery(null);
                       return;
                     }
                   }
                   if (e.key === 'Enter' && !e.shiftKey) {
                     e.preventDefault();
                     if ((prompt.trim() || attachments.length > 0) && !isGenerating && activeConvId) {
                       handleSend();
                     }
                   }
                 }}
                 placeholder={activeConvId ? "Typ / voor commando's of @ voor tools, of stel je vraag..." : "Maak eerst een nieuw gesprek aan"}
                 rows={1}
                 style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem', resize: 'none', fontFamily: 'inherit', lineHeight: '1.5', maxHeight: '96px', overflow: 'auto', padding: '0.5rem 0' }}
                 disabled={!activeConvId}
               />
               
               {/* Thinking / Denkmodus Toggle Knop */}
               <button
                 type="button"
                 onClick={() => {
                   const next = !useThinkMode;
                   setUseThinkMode(next);
                   addToast(next ? '🧠 Denkmodus geactiveerd' : 'Denkmodus uitgeschakeld', 'info');
                 }}
                 className={`btn ${useThinkMode ? 'btn-primary' : 'btn-ghost'}`}
                 style={{
                   width: '38px',
                   height: '38px',
                   borderRadius: '50%',
                   padding: 0,
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   flexShrink: 0,
                   fontSize: '1.15rem',
                   background: useThinkMode ? 'rgba(124, 92, 252, 0.25)' : 'transparent',
                   border: useThinkMode ? '1px solid rgba(124, 92, 252, 0.55)' : '1px solid transparent',
                   color: useThinkMode ? '#c4b5fd' : 'var(--text-secondary)',
                   boxShadow: useThinkMode ? '0 0 12px rgba(124, 92, 252, 0.4)' : 'none',
                   transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                   cursor: activeConvId ? 'pointer' : 'not-allowed'
                 }}
                 disabled={!activeConvId || isGenerating}
                 title={useThinkMode ? '🧠 Denkmodus actief (klik om uit te schakelen)' : '🧠 Denkmodus inschakelen (thinking)'}
               >
                 🧠
               </button>

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
          );
        })()}

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

    {showCoopModal && activeConvId && !activeConvId.startsWith('local-') && (
      <CoopModal
        conversationId={activeConvId}
        onClose={() => setShowCoopModal(false)}
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
