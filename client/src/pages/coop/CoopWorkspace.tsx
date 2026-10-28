import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { QRCodeSVG } from 'qrcode.react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import CoopJoinModal from '../../components/coop/CoopJoinModal';
import {
  Users, MessageSquare, FileText, Sparkles, Plus, Search,
  Share2, Copy, Check, QrCode, LogOut, Send, KeyRound,
  ChevronRight, ChevronLeft, Paperclip, Trash2, Crown,
  Zap, RefreshCw, X, ArrowLeft, Bot, UserCheck, Shield,
  Sun, Moon, Mic, Monitor, PanelLeft
} from 'lucide-react';

interface Participant {
  id: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  user?: {
    id: string;
    username: string;
    displayName: string;
    email: string;
  };
}

interface Room {
  id: string;
  title: string;
  folder: string;
  collabCode: string;
  isOwner: boolean;
  summary?: string;
  owner?: {
    id: string;
    displayName: string;
    username: string;
  };
  participants: Participant[];
  _count?: {
    messages: number;
  };
  messages?: any[];
  updatedAt: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string | Date;
  userId?: string;
  user?: {
    id?: string;
    name?: string;
    displayName?: string;
  };
  modelUsed?: string;
}

// Sparkle SVG component resembling Google Gemini's signature icon
function GeminiSparkleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="geminiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="35%" stopColor="#9B72CB" />
          <stop offset="70%" stopColor="#D96570" />
          <stop offset="100%" stopColor="#F4B400" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.52285 12 2Z"
        fill="url(#geminiGrad)"
      />
    </svg>
  );
}

function getAvatarColor(str: string = ''): string {
  const colors = [
    'linear-gradient(135deg, #4285F4, #669df6)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #8b5cf6, #6366f1)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #ec4899, #be185d)',
    'linear-gradient(135deg, #06b6d4, #0284c7)'
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function CoopWorkspace() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId?: string }>();
  const token = useAuthStore(s => s.token);
  const currentUser = useAuthStore(s => s.user);

  // Theming: Light by default (matching the Gemini screenshot)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('locra_coop_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('locra_coop_theme', next);
  };

  const isLight = theme === 'light';

  // Studio State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(roomId || null);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);

  // Sidebar collapse & search
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [roomSearch, setRoomSearch] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);

  // Modals
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('Algemeen');
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Split-Screen Right Panel (Docs & Members)
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [activeSideTab, setActiveSideTab] = useState<'docs' | 'members'>('docs');
  const [docContent, setDocContent] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [docSaveStatus, setDocSaveStatus] = useState<string | null>(null);

  // Chat Input
  const [inputPrompt, setInputPrompt] = useState('');
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);

  // Multiplayer Presence & Typing
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);

  // User search for inviting
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // 1. Initial Load of Rooms
  useEffect(() => {
    fetchRooms();
  }, []);

  // Sync URL param roomId with activeRoomId
  useEffect(() => {
    if (roomId && roomId !== activeRoomId) {
      setActiveRoomId(roomId);
    }
  }, [roomId]);

  // Update active room when ID changes
  useEffect(() => {
    if (activeRoomId) {
      loadRoomDetails(activeRoomId);
    } else if (rooms.length > 0 && !activeRoomId) {
      setActiveRoomId(rooms[0].id);
    }
  }, [activeRoomId, rooms.length]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, streamBuffer, typingUsers]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputPrompt]);

  // 2. WebSocket Connection for Multiplayer Live Studio
  useEffect(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/chat/ws`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', token }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'auth_success') {
          if (activeRoomId) {
            socket.send(JSON.stringify({ type: 'coop_join', conversationId: activeRoomId }));
          }
        } else if (data.type === 'coop_presence') {
          if (data.conversationId === activeRoomId) {
            setOnlineUserIds(data.onlineUserIds || []);
          }
        } else if (data.type === 'coop_typing') {
          if (data.conversationId === activeRoomId) {
            if (data.isTyping) {
              setTypingUsers(prev => Array.from(new Set([...prev, data.userName || 'Iemand'])));
            } else {
              setTypingUsers(prev => prev.filter(u => u !== (data.userName || 'Iemand')));
            }
          }
        } else if (data.type === 'coop_message') {
          if (data.message?.conversationId === activeRoomId) {
            setMessages(prev => {
              if (prev.some(m => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
          }
        } else if (data.type === 'chunk' || data.type === 'coop_ai_chunk') {
          setIsAiStreaming(true);
          setStreamBuffer(prev => prev + (data.content || data.chunk || ''));
        } else if (data.type === 'done' || data.type === 'coop_ai_done') {
          setIsAiStreaming(false);
          const finalAiText = data.finalContent || streamBuffer;
          if (finalAiText) {
            setMessages(prev => [
              ...prev,
              {
                id: data.messageId || `ai-${Date.now()}`,
                role: 'assistant',
                content: finalAiText,
                createdAt: new Date(),
                modelUsed: data.model || 'Locra AI'
              }
            ]);
          }
          setStreamBuffer('');
        }
      } catch (err) {
        console.error('WS Parse error', err);
      }
    };

    return () => {
      socket.close();
    };
  }, [token, activeRoomId]);

  // Notify socket when switching rooms
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeRoomId) {
      wsRef.current.send(JSON.stringify({ type: 'coop_join', conversationId: activeRoomId }));
    }
  }, [activeRoomId]);

  const fetchRooms = async () => {
    try {
      setLoadingRooms(true);
      const res = await fetch('/api/chat/coop/rooms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
        if (data.length > 0 && !activeRoomId) {
          setActiveRoomId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    } finally {
      setLoadingRooms(false);
    }
  };

  const loadRoomDetails = async (id: string) => {
    try {
      setLoadingChat(true);
      const fallbackRoom = rooms.find(r => r.id === id);
      if (fallbackRoom) {
        setActiveRoom(prev => (prev?.id === id ? prev : fallbackRoom));
      }
      const res = await fetch(`/api/chat/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveRoom(data);
        setMessages(data.messages || []);
        setDocContent(data.summary || '');
      } else {
        console.error('Failed to load room details: HTTP', res.status);
      }
    } catch (e) {
      console.error('Failed to load room details', e);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreatingRoom(true);
    try {
      const res = await fetch('/api/chat/coop/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          subject: newSubject.trim()
        })
      });

      if (res.ok) {
        const created = await res.json();
        setRooms(prev => [created, ...prev]);
        setActiveRoomId(created.id);
        navigate(`/coop/${created.id}`);
        setShowCreateModal(false);
        setNewTitle('');
      }
    } catch (e) {
      console.error('Failed to create room', e);
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleSendMessage = (overrideText?: string, forceAiParam?: boolean) => {
    const textToSend = overrideText || inputPrompt;
    if (!textToSend.trim() || !activeRoomId || !wsRef.current) return;

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      createdAt: new Date(),
      userId: currentUser?.id,
      user: {
        id: currentUser?.id,
        name: currentUser?.displayName || currentUser?.username || 'Jij'
      }
    };

    setMessages(prev => [...prev, userMsg]);
    if (!overrideText) setInputPrompt('');

    // Check if AI is mentioned or forced
    const hasAiMention = /\B@(locra|ai|assistent)\b/i.test(textToSend) || forceAiParam || aiEnabled;

    wsRef.current.send(JSON.stringify({
      type: 'chat',
      conversationId: activeRoomId,
      prompt: textToSend.trim(),
      model: 'auto',
      forceAi: hasAiMention
    }));

    sendTypingStatus(false);
  };

  const sendTypingStatus = (isTyping: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeRoomId) {
      wsRef.current.send(JSON.stringify({
        type: 'coop_typing',
        conversationId: activeRoomId,
        isTyping
      }));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else {
      sendTypingStatus(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStatus(false);
      }, 2000);
    }
  };

  const handleSaveDoc = async () => {
    if (!activeRoomId) return;
    setSavingDoc(true);
    try {
      const res = await fetch(`/api/chat/coop/rooms/${activeRoomId}/doc`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ docContent })
      });
      if (res.ok) {
        setDocSaveStatus('Opgeslagen ✓');
        setTimeout(() => setDocSaveStatus(null), 3000);
      }
    } catch (e) {
      setDocSaveStatus('Opslaan mislukt');
    } finally {
      setSavingDoc(false);
    }
  };

  const handleCopyCode = () => {
    if (!activeRoom?.collabCode) return;
    navigator.clipboard.writeText(activeRoom.collabCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleUserSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchingUsers(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        const filtered = list.filter((u: any) => 
          !activeRoom?.participants?.some(p => p.userId === u.id) && u.id !== currentUser?.id
        );
        setSearchResults(filtered);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleAddParticipant = async (userId: string) => {
    if (!activeRoomId) return;
    try {
      const res = await fetch(`/api/chat/conversations/${activeRoomId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId, role: 'editor' })
      });
      if (res.ok) {
        setSearchQuery('');
        setSearchResults([]);
        loadRoomDetails(activeRoomId);
        fetchRooms();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    if (!activeRoomId) return;
    if (!confirm('Weet je zeker dat je deze deelnemer wilt verwijderen?')) return;
    try {
      const res = await fetch(`/api/chat/conversations/${activeRoomId}/participants/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        loadRoomDetails(activeRoomId);
        fetchRooms();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleQuickAction = (action: 'summary' | 'tasks' | 'brainstorm') => {
    if (action === 'summary') {
      handleSendMessage('@Locra Vat onze groepsdiscussie en de gemaakte afspraken samen in heldere kernpunten en actielijst.', true);
    } else if (action === 'tasks') {
      handleSendMessage('@Locra Verdeel de taken voor dit project eerlijk over de groepsleden met concrete deadlines en stappen.', true);
    } else if (action === 'brainstorm') {
      handleSendMessage('@Locra Brainstorm 5 creatieve invalshoeken en unieke onderzoeksvragen voor ons project.', true);
    }
  };

  const filteredRooms = rooms.filter(r => 
    r.title.toLowerCase().includes(roomSearch.toLowerCase()) ||
    r.folder.toLowerCase().includes(roomSearch.toLowerCase()) ||
    r.collabCode.toLowerCase().includes(roomSearch.toLowerCase())
  );

  const firstName = currentUser?.displayName?.split(' ')[0] || currentUser?.username || 'daar';
  const hasMessages = messages.length > 0;

  // Theme Colors
  const colors = {
    bg: isLight ? '#ffffff' : '#131314',
    bgGradient: isLight 
      ? 'radial-gradient(ellipse 80% 50% at 50% 100%, #e0f2fe 0%, #f0f7ff 35%, #ffffff 80%)'
      : 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(30, 58, 138, 0.15) 0%, rgba(15, 23, 42, 0.3) 45%, #131314 85%)',
    sidebarBg: isLight ? '#f0f4f9' : '#1e1f20',
    sidebarBorder: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.07)',
    textPrimary: isLight ? '#1f1f1f' : '#e3e3e3',
    textSecondary: isLight ? '#444746' : '#9ca3af',
    textMuted: isLight ? '#747775' : '#6b7280',
    cardBg: isLight ? '#ffffff' : '#1e1f20',
    cardBorder: isLight ? '#e1e3e1' : '#37393b',
    cardShadow: isLight ? '0 4px 20px rgba(0, 0, 0, 0.05)' : '0 8px 30px rgba(0, 0, 0, 0.4)',
    activePill: isLight ? '#dde3ea' : '#282a2c',
    hoverPill: isLight ? '#e9eef6' : '#282a2c',
    inputBoxBg: isLight ? '#ffffff' : '#1e1f20',
    inputBoxBorder: isLight ? '#d3e3fd' : '#3c4043',
    sendBtnBg: isLight ? '#d3e3fd' : '#a8c7fa',
    sendBtnColor: '#041e49',
    userBubble: isLight ? '#f0f4f9' : '#282a2c',
    aiBubble: isLight ? 'transparent' : 'transparent',
    topbarBorder: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      background: colors.bg,
      color: colors.textPrimary,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflow: 'hidden'
    }}>
      {/* ── GEMINI-STIJL LINKER SIDEBAR ── */}
      <aside style={{
        width: sidebarOpen ? '270px' : '0px',
        minWidth: sidebarOpen ? '270px' : '0px',
        background: colors.sidebarBg,
        borderRight: sidebarOpen ? `1px solid ${colors.sidebarBorder}` : 'none',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 40
      }}>
        {sidebarOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '270px' }}>
            {/* Top Bar: Gemini Sparkle Logo + Locra Brand + Icons */}
            <div style={{
              padding: '1.1rem 1rem 0.75rem 1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }} onClick={() => navigate('/chat')}>
                <GeminiSparkleIcon size={24} />
                <span style={{ fontWeight: 600, fontSize: '1.1rem', letterSpacing: '-0.02em', color: colors.textPrimary }}>
                  Locra CO-OP
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button
                  onClick={() => setShowSearchInput(prev => !prev)}
                  title="Zoeken"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = colors.hoverPill}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Search size={17} />
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  title="Sidebar inklappen"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = colors.hoverPill}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <PanelLeft size={17} />
                </button>
              </div>
            </div>

            {/* Zoekbalk (indien open) */}
            {showSearchInput && (
              <div style={{ padding: '0 1rem 0.75rem' }}>
                <input
                  type="text"
                  value={roomSearch}
                  onChange={e => setRoomSearch(e.target.value)}
                  placeholder="Zoek projectkamer..."
                  autoFocus
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: isLight ? '#ffffff' : '#282a2c',
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: '20px',
                    padding: '0.5rem 0.85rem',
                    color: colors.textPrimary,
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                />
              </div>
            )}

            {/* Actieknop: Nieuwe Kamer (Gemini 'Nieuw gesprek' stijl pill) */}
            <div style={{ padding: '0 0.85rem 0.75rem' }}>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  width: '100%',
                  background: isLight ? '#dde3ea' : '#282a2c',
                  border: 'none',
                  color: colors.textPrimary,
                  padding: '0.7rem 1.1rem',
                  borderRadius: '24px',
                  fontSize: '0.86rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = isLight ? '#d3dbe3' : '#333538'}
                onMouseLeave={e => e.currentTarget.style.background = isLight ? '#dde3ea' : '#282a2c'}
              >
                <Plus size={18} color="#4285F4" />
                <span>Nieuwe kamer</span>
              </button>
            </div>

            {/* Navigatielinks (zoals in het screenshot: Bibliotheek, Join code) */}
            <div style={{ padding: '0 0.85rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button
                onClick={() => {
                  if (activeRoom) {
                    setSidePanelOpen(true);
                    setActiveSideTab('docs');
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.textPrimary,
                  padding: '0.55rem 0.9rem',
                  borderRadius: '20px',
                  fontSize: '0.84rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = colors.hoverPill}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <FileText size={16} color={colors.textSecondary} />
                <span>Locra Docs & Notities</span>
              </button>

              <button
                onClick={() => setShowJoinModal(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.textPrimary,
                  padding: '0.55rem 0.9rem',
                  borderRadius: '20px',
                  fontSize: '0.84rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = colors.hoverPill}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <KeyRound size={16} color={colors.textSecondary} />
                <span>Deelnemen met code</span>
              </button>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: colors.sidebarBorder, margin: '0.5rem 1rem' }} />

            {/* Kamers / Gesprekken Lijst */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0.85rem' }}>
              <div style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: colors.textMuted,
                padding: '0.4rem 0.75rem 0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>KAMERS</span>
                <span>{filteredRooms.length}</span>
              </div>

              {loadingRooms ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.82rem' }}>
                  Laden...
                </div>
              ) : filteredRooms.length === 0 ? (
                <div style={{ padding: '1.5rem 0.75rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.8rem' }}>
                  Nog geen kamers.<br />Maak er een aan met de knop hierboven!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {filteredRooms.map(room => {
                    const isActive = room.id === activeRoomId;
                    return (
                      <div
                        key={room.id}
                        onClick={() => {
                          setActiveRoomId(room.id);
                          navigate(`/coop/${room.id}`, { replace: true });
                        }}
                        style={{
                          padding: '0.6rem 0.85rem',
                          borderRadius: '20px',
                          background: isActive ? colors.activePill : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'background 0.15s',
                          position: 'relative'
                        }}
                        onMouseEnter={e => {
                          if (!isActive) e.currentTarget.style.background = colors.hoverPill;
                        }}
                        onMouseLeave={e => {
                          if (!isActive) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                          <MessageSquare size={15} color={isActive ? '#4285F4' : colors.textMuted} style={{ flexShrink: 0 }} />
                          <span style={{
                            fontSize: '0.84rem',
                            fontWeight: isActive ? 600 : 400,
                            color: colors.textPrimary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {room.title}
                          </span>
                        </div>

                        {/* Deelnemers indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: '0.4rem' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            color: colors.textMuted,
                            fontWeight: 500
                          }}>
                            {room.folder}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Profile Bar (zoals in het screenshot: avatar + naam) */}
            <div style={{
              padding: '0.75rem 1rem',
              borderTop: `1px solid ${colors.sidebarBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}>
                  {(currentUser?.displayName || currentUser?.username || 'U')[0].toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: colors.textPrimary, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser?.displayName || currentUser?.username || 'Gebruiker'}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: colors.textMuted }}>
                    Locra Studio
                  </span>
                </div>
              </div>

              {/* Theme toggle in profile row */}
              <button
                onClick={toggleTheme}
                title={isLight ? 'Schakel naar donkere modus' : 'Schakel naar lichte modus'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isLight ? <Moon size={16} /> : <Sun size={16} />}
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── HOOFD CANVAS (GEMINI CHAT WORKSPACE) ── */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: colors.bgGradient,
        height: '100vh',
        overflow: 'hidden'
      }}>
        {/* ── SUBTIELE TOPBAR ── */}
        <header style={{
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          borderBottom: `1px solid ${colors.topbarBorder}`,
          zIndex: 30,
          background: isLight ? 'rgba(255, 255, 255, 0.7)' : 'rgba(19, 19, 20, 0.7)',
          backdropFilter: 'blur(12px)'
        }}>
          {/* Linkerzijde: Sidebar toggle (indien ingeklapt) + Kamertitel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Sidebar openen"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={e => e.currentTarget.style.background = colors.hoverPill}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <PanelLeft size={20} />
              </button>
            )}

            {activeRoom ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '1rem', color: colors.textPrimary }}>
                  {activeRoom.title}
                </span>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  background: isLight ? '#e8f0fe' : 'rgba(66, 133, 244, 0.15)',
                  color: '#1a73e8',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {activeRoom.folder}
                </span>
              </div>
            ) : (
              <span style={{ fontWeight: 600, fontSize: '1rem', color: colors.textPrimary }}>
                CO-OP Studio
              </span>
            )}
          </div>

          {/* Rechterzijde: Kamercode, Live Avatars, Docs & Thema */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {activeRoom && (
              <>
                {/* 1-Klik Kamercode knop */}
                <button
                  onClick={handleCopyCode}
                  title="Klik om kamercode te kopiëren"
                  style={{
                    background: isLight ? '#f0f4f9' : '#282a2c',
                    border: `1px solid ${colors.cardBorder}`,
                    color: colors.textPrimary,
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = colors.hoverPill}
                  onMouseLeave={e => e.currentTarget.style.background = isLight ? '#f0f4f9' : '#282a2c'}
                >
                  {copiedCode ? <Check size={13} color="#10b981" /> : <Copy size={13} color={colors.textSecondary} />}
                  <span>{copiedCode ? 'Gekopieerd!' : `Code: ${activeRoom.collabCode}`}</span>
                </button>

                {/* Live Deelnemers Avatars */}
                <div
                  onClick={() => {
                    setSidePanelOpen(true);
                    setActiveSideTab('members');
                  }}
                  title="Deelnemers bekijken"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '3px 6px',
                    borderRadius: '20px',
                    background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)'
                  }}
                >
                  {(activeRoom.participants || []).slice(0, 4).map((p, idx) => {
                    const isOnline = onlineUserIds.includes(p.userId);
                    return (
                      <div
                        key={p.userId}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: getAvatarColor(p.user?.displayName || p.userId),
                          border: `2px solid ${colors.bg}`,
                          marginLeft: idx > 0 ? '-7px' : '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          color: '#fff',
                          position: 'relative'
                        }}
                        title={`${p.user?.displayName || 'Lid'} (${isOnline ? 'online' : 'offline'})`}
                      >
                        {(p.user?.displayName || 'U')[0].toUpperCase()}
                        {isOnline && (
                          <div style={{
                            position: 'absolute',
                            bottom: '-1px',
                            right: '-1px',
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: '#10b981',
                            border: `1.5px solid ${colors.bg}`
                          }} />
                        )}
                      </div>
                    );
                  })}
                  <span style={{ fontSize: '0.72rem', color: colors.textSecondary, marginLeft: '6px', fontWeight: 600 }}>
                    {activeRoom.participants?.length || 1}
                  </span>
                </div>

                {/* Documenten & Leden knop */}
                <button
                  onClick={() => setSidePanelOpen(prev => !prev)}
                  title="Docs & Ledenpaneel"
                  style={{
                    background: sidePanelOpen ? (isLight ? '#dde3ea' : '#333538') : 'transparent',
                    border: 'none',
                    color: colors.textPrimary,
                    padding: '0.4rem 0.75rem',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => {
                    if (!sidePanelOpen) e.currentTarget.style.background = colors.hoverPill;
                  }}
                  onMouseLeave={e => {
                    if (!sidePanelOpen) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <FileText size={15} color={colors.textSecondary} />
                  <span>Docs</span>
                </button>
              </>
            )}

            {/* Terug naar Chat knop */}
            <button
              onClick={() => navigate('/chat')}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.textSecondary,
                padding: '0.4rem 0.75rem',
                borderRadius: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.8rem',
                fontWeight: 500
              }}
              onMouseEnter={e => e.currentTarget.style.background = colors.hoverPill}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <ArrowLeft size={14} />
              <span>Chat</span>
            </button>
          </div>
        </header>

        {/* ── CHAT FEED OF LEGE STAAT (ZOALS GEMINI SCREENSHOT) ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative'
        }}>
          {activeRoom ? (
            <>
              {/* LEGE STAAT: Gecentreerde begroeting + zwevende invoerkaart (zoals op het screenshot) */}
              {!hasMessages ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem 1.5rem',
                  maxWidth: '820px',
                  width: '100%',
                  margin: '0 auto',
                  boxSizing: 'border-box'
                }}>
                  {/* Begroetingstekst */}
                  <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
                      <GeminiSparkleIcon size={32} />
                    </div>
                    <h1 style={{
                      fontSize: '2.25rem',
                      fontWeight: 500,
                      color: colors.textPrimary,
                      margin: '0 0 0.5rem 0',
                      letterSpacing: '-0.02em',
                      fontFamily: "'Outfit', 'Inter', sans-serif"
                    }}>
                      Hallo {firstName}, waarmee kan ik helpen?
                    </h1>
                    <p style={{
                      margin: 0,
                      fontSize: '0.95rem',
                      color: colors.textSecondary,
                      fontWeight: 400
                    }}>
                      Samenwerken in <strong>{activeRoom.title}</strong> • Typ <strong>@Locra</strong> voor AI ondersteuning
                    </p>
                  </div>

                  {/* Gecentreerde zwevende promptkaart (exact zoals in de Gemini afbeelding) */}
                  <div style={{
                    width: '100%',
                    background: colors.cardBg,
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: '28px',
                    boxShadow: colors.cardShadow,
                    padding: '1rem 1.25rem 0.85rem',
                    boxSizing: 'border-box',
                    transition: 'box-shadow 0.2s, border-color 0.2s'
                  }}>
                    <textarea
                      ref={textareaRef}
                      value={inputPrompt}
                      onChange={e => setInputPrompt(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder="Vraag het Locra of typ een bericht naar je groep..."
                      rows={2}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: 'transparent',
                        border: 'none',
                        color: colors.textPrimary,
                        fontSize: '1rem',
                        outline: 'none',
                        resize: 'none',
                        fontFamily: 'inherit',
                        lineHeight: 1.5
                      }}
                    />

                    {/* Bottom row van de kaart: bijlagen, scherm delen, @Locra, mic, send knop */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '0.5rem'
                    }}>
                      {/* Links: + en Scherm delen */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSidePanelOpen(true);
                            setActiveSideTab('docs');
                          }}
                          title="Bijlage / Docs openen"
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'transparent',
                            border: 'none',
                            color: colors.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = colors.hoverPill}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Plus size={18} />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSidePanelOpen(true);
                            setActiveSideTab('docs');
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: colors.textSecondary,
                            borderRadius: '20px',
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.82rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = colors.hoverPill}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Monitor size={15} />
                          <span>Scherm delen</span>
                        </button>
                      </div>

                      {/* Rechts: @Locra pill, microfoon, blauwe ronde zendknop */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <button
                          type="button"
                          onClick={() => setAiEnabled(prev => !prev)}
                          style={{
                            background: aiEnabled ? (isLight ? '#e8f0fe' : 'rgba(66, 133, 244, 0.2)') : 'transparent',
                            border: `1px solid ${aiEnabled ? '#1a73e8' : colors.cardBorder}`,
                            color: aiEnabled ? '#1a73e8' : colors.textMuted,
                            padding: '0.3rem 0.75rem',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Sparkles size={13} />
                          <span>Automatisch @Locra</span>
                        </button>

                        <button
                          type="button"
                          title="Spraakopname"
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'transparent',
                            border: 'none',
                            color: colors.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Mic size={17} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendMessage()}
                          disabled={!inputPrompt.trim()}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: inputPrompt.trim() ? colors.sendBtnBg : (isLight ? '#f0f4f9' : '#282a2c'),
                            color: inputPrompt.trim() ? colors.sendBtnColor : colors.textMuted,
                            border: 'none',
                            cursor: inputPrompt.trim() ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Send size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Suggesties onder de promptbox */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.6rem',
                    justifyContent: 'center',
                    marginTop: '1.5rem'
                  }}>
                    <button
                      onClick={() => handleQuickAction('summary')}
                      style={{
                        background: colors.cardBg,
                        border: `1px solid ${colors.cardBorder}`,
                        borderRadius: '20px',
                        padding: '0.5rem 0.95rem',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        color: colors.textSecondary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#4285F4'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = colors.cardBorder}
                    >
                      <span>📋</span>
                      <span>Vat het overleg samen</span>
                    </button>

                    <button
                      onClick={() => handleQuickAction('tasks')}
                      style={{
                        background: colors.cardBg,
                        border: `1px solid ${colors.cardBorder}`,
                        borderRadius: '20px',
                        padding: '0.5rem 0.95rem',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        color: colors.textSecondary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#4285F4'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = colors.cardBorder}
                    >
                      <span>🎯</span>
                      <span>Verdeel taken eerlijk</span>
                    </button>

                    <button
                      onClick={() => handleQuickAction('brainstorm')}
                      style={{
                        background: colors.cardBg,
                        border: `1px solid ${colors.cardBorder}`,
                        borderRadius: '20px',
                        padding: '0.5rem 0.95rem',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        color: colors.textSecondary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#4285F4'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = colors.cardBorder}
                    >
                      <span>💡</span>
                      <span>Brainstorm 5 ideeën</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* ACTIEVE CHAT: Schone gecentreerde gespreksfeed (zoals Gemini) */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                  <div
                    ref={chatScrollRef}
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '2rem 1.5rem 8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.5rem',
                      maxWidth: '820px',
                      width: '100%',
                      margin: '0 auto',
                      boxSizing: 'border-box'
                    }}
                  >
                    {messages.map((msg, index) => {
                      const isMe = msg.userId === currentUser?.id;
                      const isAi = msg.role === 'assistant';
                      const senderName = isAi ? 'Locra AI' : (msg.user?.name || msg.user?.displayName || (isMe ? 'Jij' : 'Groepslid'));

                      if (isAi) {
                        return (
                          <div
                            key={msg.id || index}
                            style={{
                              display: 'flex',
                              gap: '1rem',
                              alignSelf: 'stretch',
                              animation: 'fadeIn 0.2s ease-out'
                            }}
                          >
                            {/* Gemini Sparkle Avatar */}
                            <div style={{ flexShrink: 0, marginTop: '2px' }}>
                              <GeminiSparkleIcon size={24} />
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: colors.textPrimary }}>
                                  Locra AI Assistent
                                </span>
                                <button
                                  onClick={() => {
                                    setDocContent(prev => prev ? `${prev}\n\n### AI Bijdrage:\n${msg.content}` : `### AI Bijdrage:\n${msg.content}`);
                                    setSidePanelOpen(true);
                                    setActiveSideTab('docs');
                                  }}
                                  title="Voeg toe aan Locra Docs"
                                  style={{
                                    background: isLight ? '#f0f4f9' : '#282a2c',
                                    border: 'none',
                                    color: colors.textSecondary,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}
                                >
                                  <FileText size={12} />
                                  <span>Naar Docs</span>
                                </button>
                              </div>

                              <div style={{
                                fontSize: '0.95rem',
                                lineHeight: 1.65,
                                color: colors.textPrimary
                              }} className="markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id || index}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '75%',
                            animation: 'fadeIn 0.2s ease-out'
                          }}
                        >
                          {!isMe && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', marginLeft: '0.25rem' }}>
                              <div style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                background: getAvatarColor(senderName),
                                display: 'flex',
                                alignItems: 'center',
                                justifySelf: 'center',
                                fontSize: '0.55rem',
                                fontWeight: 700,
                                color: '#fff'
                              }}>
                                {senderName[0].toUpperCase()}
                              </div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.textSecondary }}>
                                {senderName}
                              </span>
                            </div>
                          )}

                          <div style={{
                            background: isMe ? (isLight ? '#e8f0fe' : '#1e3a5f') : colors.userBubble,
                            border: `1px solid ${isMe ? (isLight ? '#c2e7ff' : '#2563eb') : colors.cardBorder}`,
                            borderRadius: isMe ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                            padding: '0.85rem 1.15rem',
                            color: colors.textPrimary,
                            fontSize: '0.92rem',
                            lineHeight: 1.5
                          }}>
                            {msg.content}
                          </div>

                          <span style={{
                            fontSize: '0.65rem',
                            color: colors.textMuted,
                            marginTop: '0.2rem',
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            marginRight: isMe ? '0.25rem' : '0',
                            marginLeft: !isMe ? '0.25rem' : '0'
                          }}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}

                    {/* AI Streaming Live Indicator */}
                    {isAiStreaming && (
                      <div style={{
                        display: 'flex',
                        gap: '1rem',
                        alignSelf: 'stretch'
                      }}>
                        <div style={{ flexShrink: 0, marginTop: '2px' }}>
                          <GeminiSparkleIcon size={24} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a73e8', marginBottom: '0.4rem' }}>
                            Locra AI antwoordt...
                          </div>
                          <div style={{ fontSize: '0.95rem', lineHeight: 1.65, color: colors.textPrimary }} className="markdown-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {streamBuffer}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Wie typt er indicator */}
                    {typingUsers.length > 0 && (
                      <div style={{
                        fontSize: '0.78rem',
                        color: colors.textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontStyle: 'italic',
                        padding: '0.25rem 0.5rem'
                      }}>
                        <span className="typing-dots">•••</span>
                        <span>{typingUsers.join(', ')} {typingUsers.length > 1 ? 'zijn' : 'is'} aan het typen...</span>
                      </div>
                    )}
                  </div>

                  {/* VASTGEZETTE ZWEVENDE INVOERKAART ONDERAAN HET GESPREK */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '0.75rem 1.5rem 1.25rem',
                    background: isLight 
                      ? 'linear-gradient(to top, #ffffff 60%, rgba(255, 255, 255, 0))' 
                      : 'linear-gradient(to top, #131314 60%, rgba(19, 19, 20, 0))',
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                  }}>
                    <div style={{
                      width: '100%',
                      maxWidth: '820px',
                      background: colors.cardBg,
                      border: `1px solid ${colors.cardBorder}`,
                      borderRadius: '28px',
                      boxShadow: colors.cardShadow,
                      padding: '0.85rem 1.15rem 0.75rem',
                      boxSizing: 'border-box',
                      pointerEvents: 'auto'
                    }}>
                      <textarea
                        ref={textareaRef}
                        value={inputPrompt}
                        onChange={e => setInputPrompt(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        placeholder="Vraag het Locra of typ een bericht naar je groep..."
                        rows={1}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          background: 'transparent',
                          border: 'none',
                          color: colors.textPrimary,
                          fontSize: '0.95rem',
                          outline: 'none',
                          resize: 'none',
                          fontFamily: 'inherit',
                          lineHeight: 1.5
                        }}
                      />

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '0.35rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSidePanelOpen(true);
                              setActiveSideTab('docs');
                            }}
                            title="Docs openen"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              background: 'transparent',
                              border: 'none',
                              color: colors.textSecondary,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <Plus size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setAiEnabled(prev => !prev)}
                            style={{
                              background: aiEnabled ? (isLight ? '#e8f0fe' : 'rgba(66, 133, 244, 0.2)') : 'transparent',
                              border: `1px solid ${aiEnabled ? '#1a73e8' : colors.cardBorder}`,
                              color: aiEnabled ? '#1a73e8' : colors.textMuted,
                              padding: '2px 8px',
                              borderRadius: '16px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <Sparkles size={12} />
                            <span>@Locra</span>
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            title="Microfoon"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              background: 'transparent',
                              border: 'none',
                              color: colors.textSecondary,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <Mic size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendMessage()}
                            disabled={!inputPrompt.trim()}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: inputPrompt.trim() ? colors.sendBtnBg : (isLight ? '#f0f4f9' : '#282a2c'),
                              color: inputPrompt.trim() ? colors.sendBtnColor : colors.textMuted,
                              border: 'none',
                              cursor: inputPrompt.trim() ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s'
                            }}
                          >
                            <Send size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* GEEN KAMER GESELECTEERD */
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '24px',
                background: isLight ? '#e8f0fe' : '#282a2c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem'
              }}>
                <GeminiSparkleIcon size={34} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: colors.textPrimary, margin: '0 0 0.5rem 0' }}>
                Kies of Maak een Projectkamer
              </h2>
              <p style={{ maxWidth: '420px', color: colors.textSecondary, fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Werk realtime samen met klasgenoten en school AI in een gedeelde werkruimte met live documenten en chat.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    background: '#1a73e8',
                    border: 'none',
                    color: '#fff',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '20px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Plus size={16} />
                  <span>Nieuwe Kamer</span>
                </button>
                <button
                  onClick={() => setShowJoinModal(true)}
                  style={{
                    background: isLight ? '#f0f4f9' : '#282a2c',
                    border: `1px solid ${colors.cardBorder}`,
                    color: colors.textPrimary,
                    padding: '0.75rem 1.25rem',
                    borderRadius: '20px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <KeyRound size={16} />
                  <span>Deelnemen met Code</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── SPLIT-SCREEN RECHTERPANEEL: DOCS & LEDEN ── */}
      {sidePanelOpen && activeRoom && (
        <aside style={{
          width: '360px',
          background: colors.sidebarBg,
          borderLeft: `1px solid ${colors.sidebarBorder}`,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          animation: 'fadeIn 0.2s ease-out',
          zIndex: 40
        }}>
          {/* Header met Tabs en Sluitknop */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${colors.sidebarBorder}`,
            padding: '0.5rem 0.75rem'
          }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                onClick={() => setActiveSideTab('docs')}
                style={{
                  background: activeSideTab === 'docs' ? (isLight ? '#dde3ea' : '#282a2c') : 'transparent',
                  border: 'none',
                  color: activeSideTab === 'docs' ? colors.textPrimary : colors.textSecondary,
                  padding: '0.4rem 0.8rem',
                  borderRadius: '16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <FileText size={14} />
                <span>Locra Docs</span>
              </button>

              <button
                onClick={() => setActiveSideTab('members')}
                style={{
                  background: activeSideTab === 'members' ? (isLight ? '#dde3ea' : '#282a2c') : 'transparent',
                  border: 'none',
                  color: activeSideTab === 'members' ? colors.textPrimary : colors.textSecondary,
                  padding: '0.4rem 0.8rem',
                  borderRadius: '16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Users size={14} />
                <span>Leden ({activeRoom.participants?.length || 1})</span>
              </button>
            </div>

            <button
              onClick={() => setSidePanelOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.textSecondary,
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* TAB 1: LIVE DOCS CANVAS */}
          {activeSideTab === 'docs' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{
                padding: '0.6rem 1rem',
                borderBottom: `1px solid ${colors.sidebarBorder}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                  {docSaveStatus ? (
                    <span style={{ color: '#10b981', fontWeight: 600 }}>{docSaveStatus}</span>
                  ) : (
                    'Gezamenlijke notities & opzet'
                  )}
                </div>
                <button
                  onClick={handleSaveDoc}
                  disabled={savingDoc}
                  style={{
                    background: '#1a73e8',
                    border: 'none',
                    color: '#fff',
                    padding: '4px 12px',
                    borderRadius: '14px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: savingDoc ? 'not-allowed' : 'pointer'
                  }}
                >
                  {savingDoc ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>

              <textarea
                value={docContent}
                onChange={e => setDocContent(e.target.value)}
                placeholder="Houd hier gezamenlijk notities bij, schrijf concepten of laat AI bijdragen invoegen..."
                style={{
                  flex: 1,
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'transparent',
                  border: 'none',
                  padding: '1rem',
                  color: colors.textPrimary,
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          )}

          {/* TAB 2: LEDEN & KAMERCODE QR */}
          {activeSideTab === 'members' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Uitnodigingscode & QR Kaart */}
              <div style={{
                background: colors.cardBg,
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: '20px',
                padding: '1.25rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.textMuted, marginBottom: '0.4rem' }}>
                  Kamercode
                </div>
                <div style={{
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: '#1a73e8',
                  marginBottom: '0.75rem'
                }}>
                  {activeRoom.collabCode}
                </div>

                <div style={{
                  background: '#fff',
                  padding: '10px',
                  borderRadius: '12px',
                  display: 'inline-block',
                  marginBottom: '0.75rem',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
                }}>
                  <QRCodeSVG
                    value={`${window.location.origin}/coop?code=${activeRoom.collabCode}`}
                    size={110}
                    level="M"
                  />
                </div>

                <div>
                  <button
                    onClick={handleCopyCode}
                    style={{
                      background: isLight ? '#e8f0fe' : '#282a2c',
                      border: `1px solid ${colors.cardBorder}`,
                      color: colors.textPrimary,
                      padding: '0.45rem 1rem',
                      borderRadius: '16px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    {copiedCode ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    <span>{copiedCode ? 'Gekopieerd!' : 'Kopieer Deellink'}</span>
                  </button>
                </div>
              </div>

              {/* Direct Leerling Toevoegen */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.textMuted, marginBottom: '0.4rem' }}>
                  Lid Toevoegen op Naam
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleUserSearch(e.target.value)}
                  placeholder="Zoek naam of e-mail..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: colors.cardBg,
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: '14px',
                    padding: '0.5rem 0.75rem',
                    color: colors.textPrimary,
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                />

                {searchResults.length > 0 && (
                  <div style={{
                    background: colors.cardBg,
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: '12px',
                    marginTop: '0.35rem',
                    maxHeight: '130px',
                    overflowY: 'auto'
                  }}>
                    {searchResults.map(u => (
                      <div
                        key={u.id}
                        style={{
                          padding: '0.5rem 0.75rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: `1px solid ${colors.sidebarBorder}`
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: colors.textPrimary }}>{u.displayName}</div>
                          <div style={{ fontSize: '0.7rem', color: colors.textMuted }}>{u.email}</div>
                        </div>
                        <button
                          onClick={() => handleAddParticipant(u.id)}
                          style={{
                            background: '#1a73e8',
                            border: 'none',
                            color: '#fff',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Toevoegen
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Huidige Ledenlijst */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.textMuted, marginBottom: '0.4rem' }}>
                  Huidige Deelnemers
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {(activeRoom.participants || []).map(p => {
                    const isOwner = p.role === 'owner';
                    const isOnline = onlineUserIds.includes(p.userId);
                    const name = p.user?.displayName || p.user?.username || 'Deelnemer';

                    return (
                      <div
                        key={p.userId}
                        style={{
                          background: colors.cardBg,
                          border: `1px solid ${colors.cardBorder}`,
                          borderRadius: '12px',
                          padding: '0.6rem 0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ position: 'relative' }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: getAvatarColor(name),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#fff'
                            }}>
                              {name[0].toUpperCase()}
                            </div>
                            {isOnline && (
                              <div style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#10b981',
                                border: `1.5px solid ${colors.bg}`
                              }} />
                            )}
                          </div>

                          <div>
                            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: colors.textPrimary }}>
                              {name} {p.userId === currentUser?.id ? '(Jij)' : ''}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: isOnline ? '#10b981' : colors.textMuted }}>
                              {isOnline ? 'Nu actief' : 'Offline'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {isOwner ? (
                            <span style={{
                              fontSize: '0.68rem',
                              background: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.2)',
                              color: '#d97706',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontWeight: 700
                            }}>
                              <Crown size={11} /> Eigenaar
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.68rem',
                              background: isLight ? '#f0f4f9' : '#282a2c',
                              color: colors.textMuted,
                              padding: '2px 6px',
                              borderRadius: '6px'
                            }}>
                              Editor
                            </span>
                          )}

                          {activeRoom.isOwner && !isOwner && (
                            <button
                              onClick={() => handleRemoveParticipant(p.userId)}
                              title="Verwijder deelnemer"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </aside>
      )}

      {/* ── MODAL: NIEUWE KAMER AANMAKEN (GEMINI STIJL) ── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '28px',
            width: '100%',
            maxWidth: '460px',
            padding: '2rem',
            position: 'relative',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
          }}>
            <button
              onClick={() => setShowCreateModal(false)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'transparent',
                border: 'none',
                color: colors.textMuted,
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <GeminiSparkleIcon size={24} />
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 600, color: colors.textPrimary }}>
                Nieuwe Projectkamer
              </h2>
            </div>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: colors.textSecondary }}>
              Start een gezamenlijke studio voor je groepsproject of practicum.
            </p>

            <form onSubmit={handleCreateRoom}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: colors.textSecondary, marginBottom: '0.4rem' }}>
                  Titel van het Project
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Bijv. Geschiedenis PO Koude Oorlog"
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: isLight ? '#f0f4f9' : '#282a2c',
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: '16px',
                    padding: '0.75rem 1rem',
                    color: colors.textPrimary,
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: colors.textSecondary, marginBottom: '0.4rem' }}>
                  Vak of Categorie
                </label>
                <select
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: isLight ? '#f0f4f9' : '#282a2c',
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: '16px',
                    padding: '0.75rem 1rem',
                    color: colors.textPrimary,
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                >
                  <option value="Algemeen">Algemeen</option>
                  <option value="Geschiedenis">Geschiedenis</option>
                  <option value="Nederlands">Nederlands</option>
                  <option value="Engels">Engels</option>
                  <option value="Wiskunde">Wiskunde</option>
                  <option value="Biologie">Biologie</option>
                  <option value="Natuurkunde">Natuurkunde</option>
                  <option value="Scheikunde">Scheikunde</option>
                  <option value="Aardrijkskunde">Aardrijkskunde</option>
                  <option value="Profielwerkstuk">Profielwerkstuk (PWS)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: `1px solid ${colors.cardBorder}`,
                    color: colors.textPrimary,
                    padding: '0.75rem',
                    borderRadius: '20px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={creatingRoom || !newTitle.trim()}
                  style={{
                    flex: 1.5,
                    background: '#1a73e8',
                    border: 'none',
                    color: '#fff',
                    padding: '0.75rem',
                    borderRadius: '20px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {creatingRoom ? 'Aanmaken...' : 'Kamer Aanmaken'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: JOIN MET CODE ── */}
      <CoopJoinModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoined={(joinedRoomId) => {
          fetchRooms();
          setActiveRoomId(joinedRoomId);
          navigate(`/coop/${joinedRoomId}`);
        }}
      />
    </div>
  );
}
