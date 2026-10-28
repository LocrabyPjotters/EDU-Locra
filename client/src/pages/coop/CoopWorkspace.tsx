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
  Zap, RefreshCw, X, ArrowLeft, Bot, UserCheck, Shield
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

// Generate consistent avatar color based on name/id
function getAvatarColor(str: string = ''): string {
  const colors = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #ec4899, #be185d)',
    'linear-gradient(135deg, #8b5cf6, #d946ef)',
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

  // Studio State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(roomId || null);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);

  // Search & Filter
  const [roomSearch, setRoomSearch] = useState('');

  // Modals
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('Algemeen');
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Split-Screen Right Panel
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [activeSideTab, setActiveSideTab] = useState<'docs' | 'members'>('docs');
  const [docContent, setDocContent] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [docSaveStatus, setDocSaveStatus] = useState<string | null>(null);

  // Chat Input
  const [inputPrompt, setInputPrompt] = useState('');
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');

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

  // 2. WebSocket Connection for Multiplayer Live Studio
  useEffect(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/chat/ws`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      // Authenticate socket
      socket.send(JSON.stringify({ type: 'auth', token }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'auth_success') {
          // Join current room presence
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
          // Live peer message received
          if (data.message?.conversationId === activeRoomId) {
            setMessages(prev => {
              if (prev.some(m => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
          }
        } else if (data.type === 'chunk' || data.type === 'coop_ai_chunk') {
          // AI stream chunk
          setIsAiStreaming(true);
          setStreamBuffer(prev => prev + (data.content || data.chunk || ''));
        } else if (data.type === 'done' || data.type === 'coop_ai_done') {
          // AI stream done
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
        setShowCreateModal(false);
        setNewTitle('');
      }
    } catch (e) {
      console.error('Failed to create room', e);
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleSendMessage = (overrideText?: string, forceAi: boolean = false) => {
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
    const hasAiMention = /\B@(locra|ai|assistent)\b/i.test(textToSend) || forceAi;

    // Send via WebSocket
    wsRef.current.send(JSON.stringify({
      type: 'chat',
      conversationId: activeRoomId,
      prompt: textToSend.trim(),
      model: 'auto',
      forceAi: hasAiMention
    }));

    // Broadcast typing stop
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

  // Quick Action Buttons
  const handleQuickAction = (action: 'summary' | 'tasks' | 'brainstorm') => {
    if (action === 'summary') {
      handleSendMessage('@Locra Vat onze groepsdiscussie en de gemaakte afspraken samen in heldere kernpunten en actielijst.', true);
    } else if (action === 'tasks') {
      handleSendMessage('@Locra Verdeel de taken voor dit project eerlijk over de groepsleden met concrete deadlines en stappen.', true);
    } else if (action === 'brainstorm') {
      handleSendMessage('@Locra Brainstorm 5 creatieve invalshoeken en unieke onderzoeksvragen voor ons project.', true);
    }
  };

  // Filtered room list
  const filteredRooms = rooms.filter(r => 
    r.title.toLowerCase().includes(roomSearch.toLowerCase()) ||
    r.folder.toLowerCase().includes(roomSearch.toLowerCase()) ||
    r.collabCode.toLowerCase().includes(roomSearch.toLowerCase())
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      background: '#090d16',
      color: '#f8fafc',
      fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
      overflow: 'hidden'
    }}>
      {/* ── TOP STUDIO NAVBAR ── */}
      <header style={{
        height: '60px',
        background: 'rgba(13, 19, 36, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        zIndex: 50,
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate('/chat')}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.8)',
              padding: '0.45rem 0.8rem',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            <ArrowLeft size={14} />
            <span>Chat</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
            }}>
              <Users size={18} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
                  Locra CO-OP Studio
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '1px 6px',
                  borderRadius: '12px'
                }}>
                  beta
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Midden: Huidige Kamer Info & Quick Action Pills */}
        {activeRoom && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflowX: 'auto', padding: '0 0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: '0.5rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>
                {activeRoom.title}
              </span>
              <span style={{
                fontSize: '0.75rem',
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#a5b4fc',
                padding: '2px 8px',
                borderRadius: '8px',
                fontWeight: 500
              }}>
                {activeRoom.folder}
              </span>
            </div>

            {/* Quick Action Pills */}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                onClick={() => handleQuickAction('summary')}
                style={{
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  color: '#c7d2fe',
                  borderRadius: '20px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)'}
              >
                <span>📋</span> Vat samen
              </button>

              <button
                onClick={() => handleQuickAction('tasks')}
                style={{
                  background: 'rgba(6, 182, 212, 0.12)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  color: '#a5f3fc',
                  borderRadius: '20px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(6, 182, 212, 0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(6, 182, 212, 0.12)'}
              >
                <span>🎯</span> Verdeel taken
              </button>

              <button
                onClick={() => handleQuickAction('brainstorm')}
                style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  color: '#fde68a',
                  borderRadius: '20px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)'}
              >
                <span>💡</span> Brainstorm
              </button>
            </div>
          </div>
        )}

        {/* Rechts: Code Knop & Side Panel Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {activeRoom && (
            <button
              onClick={handleCopyCode}
              title="Klik om kamercode te kopiëren"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#6ee7b7',
                padding: '0.4rem 0.85rem',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'}
            >
              {copiedCode ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
              <span>{copiedCode ? 'Gekopieerd!' : activeRoom.collabCode}</span>
            </button>
          )}

          <button
            onClick={() => setSidePanelOpen(prev => !prev)}
            style={{
              background: sidePanelOpen ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: sidePanelOpen ? '#a5b4fc' : 'rgba(255, 255, 255, 0.8)',
              padding: '0.45rem 0.8rem',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            <FileText size={15} />
            <span>Docs & Leden</span>
          </button>
        </div>
      </header>

      {/* ── 3-KOLOMS STUDIO LAY-OUT ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {/* ── KOLOM 1: KAMERS & PROJECTEN (LINKS) ── */}
        <aside style={{
          width: '290px',
          background: 'rgba(11, 16, 31, 0.95)',
          borderRight: '1px solid rgba(255, 255, 255, 0.07)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          {/* Zoekbalk & Acties */}
          <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.6rem',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
                }}
              >
                <Plus size={15} />
                <span>Nieuwe Kamer</span>
              </button>

              <button
                onClick={() => setShowJoinModal(true)}
                title="Deelnemen met kamercode"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.85)',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <KeyRound size={14} />
                <span>Join</span>
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'rgba(255, 255, 255, 0.4)' }} />
              <input
                type="text"
                value={roomSearch}
                onChange={e => setRoomSearch(e.target.value)}
                placeholder="Zoek projectkamer..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '0.45rem 0.5rem 0.45rem 2rem',
                  color: '#fff',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Lijst van Kamers */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
            <div style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'rgba(255, 255, 255, 0.4)',
              padding: '0 0.5rem 0.5rem'
            }}>
              Mijn Projecten ({filteredRooms.length})
            </div>

            {loadingRooms ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.85rem' }}>
                Kamers laden...
              </div>
            ) : filteredRooms.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.82rem' }}>
                Geen projectkamers gevonden.<br />Maak er een aan of vraag om een code!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
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
                        padding: '0.75rem',
                        borderRadius: '12px',
                        background: isActive ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(6, 182, 212, 0.1))' : 'rgba(255, 255, 255, 0.02)',
                        border: isActive ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        position: 'relative'
                      }}
                      onMouseEnter={e => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={e => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.85)' }}>
                          {room.title}
                        </span>
                        <span style={{
                          fontSize: '0.68rem',
                          background: 'rgba(255, 255, 255, 0.07)',
                          color: 'rgba(255, 255, 255, 0.6)',
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}>
                          {room.folder}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.04em' }}>
                          Code: <strong style={{ color: '#a5b4fc' }}>{room.collabCode}</strong>
                        </span>

                        {/* Deelnemer Avatars Stack */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {(room.participants || []).slice(0, 3).map((p, idx) => (
                            <div
                              key={p.userId}
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: getAvatarColor(p.user?.displayName || p.userId),
                                border: '1.5px solid #090d16',
                                marginLeft: idx > 0 ? '-6px' : '0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                color: '#fff'
                              }}
                              title={p.user?.displayName || 'Deelnemer'}
                            >
                              {(p.user?.displayName || 'U')[0].toUpperCase()}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ── KOLOM 2: MULTIPLAYER REALTIME CHAT FEED (MIDDEN) ── */}
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.08), transparent 70%), #090d16',
          overflow: 'hidden'
        }}>
          {activeRoom ? (
            <>
              {/* Berichten Feed */}
              <div
                ref={chatScrollRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                {/* Welkomstbanner per kamer */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(20, 26, 46, 0.6), rgba(13, 19, 36, 0.8))',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                      Welkom in {activeRoom.title}! 🚀
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.5 }}>
                      Werk samen met je groep aan {activeRoom.folder}. Typ <strong style={{ color: '#818cf8' }}>@Locra</strong> in de chat als je hulp nodig hebt van de AI.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.2rem' }}>
                      Kamercode
                    </div>
                    <div
                      onClick={handleCopyCode}
                      style={{
                        background: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        color: '#c7d2fe',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {activeRoom.collabCode}
                    </div>
                  </div>
                </div>

                {/* Berichten Lijst */}
                {messages.map((msg, index) => {
                  const isMe = msg.userId === currentUser?.id;
                  const isAi = msg.role === 'assistant';
                  const senderName = isAi ? 'Locra AI' : (msg.user?.name || msg.user?.displayName || (isMe ? 'Jij' : 'Groepslid'));

                  if (isAi) {
                    return (
                      <div
                        key={msg.id || index}
                        style={{
                          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.6), rgba(15, 23, 42, 0.8))',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          borderRadius: '18px',
                          padding: '1.25rem',
                          maxWidth: '85%',
                          alignSelf: 'flex-start',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                          animation: 'fadeIn 0.2s ease-out'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '8px',
                              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <Bot size={15} color="#fff" />
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#c4b5fd' }}>
                              Locra AI Assistent
                            </span>
                            <span style={{
                              fontSize: '0.65rem',
                              background: 'rgba(139, 92, 246, 0.2)',
                              color: '#a78bfa',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}>
                              GROEP
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setDocContent(prev => prev ? `${prev}\n\n### AI Bijdrage:\n${msg.content}` : `### AI Bijdrage:\n${msg.content}`);
                              setSidePanelOpen(true);
                              setActiveSideTab('docs');
                            }}
                            title="Voeg toe aan Locra Docs"
                            style={{
                              background: 'rgba(255, 255, 255, 0.06)',
                              border: 'none',
                              color: 'rgba(255, 255, 255, 0.7)',
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

                        <div style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#e2e8f0' }} className="markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {msg.content}
                          </ReactMarkdown>
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
                      {/* Afzender Badge */}
                      {!isMe && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', marginLeft: '0.25rem' }}>
                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: getAvatarColor(senderName),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.55rem',
                            fontWeight: 700,
                            color: '#fff'
                          }}>
                            {senderName[0].toUpperCase()}
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>
                            {senderName}
                          </span>
                        </div>
                      )}

                      {/* Bericht Bubbel */}
                      <div style={{
                        background: isMe ? 'linear-gradient(135deg, #4f46e5, #06b6d4)' : 'rgba(255, 255, 255, 0.05)',
                        border: isMe ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        padding: '0.85rem 1rem',
                        color: '#fff',
                        fontSize: '0.9rem',
                        lineHeight: 1.5,
                        boxShadow: isMe ? '0 4px 15px rgba(79, 70, 229, 0.25)' : 'none'
                      }}>
                        {msg.content}
                      </div>

                      <span style={{
                        fontSize: '0.65rem',
                        color: 'rgba(255, 255, 255, 0.35)',
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
                    background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.6), rgba(15, 23, 42, 0.8))',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '18px',
                    padding: '1.25rem',
                    maxWidth: '85%',
                    alignSelf: 'flex-start',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                      <Bot size={15} color="#c4b5fd" />
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#c4b5fd' }}>
                        Locra AI beantwoordt...
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#e2e8f0' }} className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {streamBuffer}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Wie typt er indicator */}
                {typingUsers.length > 0 && (
                  <div style={{
                    fontSize: '0.78rem',
                    color: '#a5b4fc',
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

              {/* Chat Invoerbalk */}
              <div style={{
                padding: '1rem',
                background: 'rgba(11, 16, 31, 0.95)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div style={{
                  background: 'rgba(20, 26, 46, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '0.5rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                }}>
                  <textarea
                    value={inputPrompt}
                    onChange={e => setInputPrompt(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Typ een bericht naar je groep, of stel een vraag via @Locra..."
                    rows={2}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'inherit',
                      lineHeight: 1.5
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setInputPrompt(prev => prev ? `${prev} @Locra ` : '@Locra ')}
                        style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          color: '#a5b4fc',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        + @Locra
                      </button>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.4)' }}>
                        Enter om te versturen
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={!inputPrompt.trim()}
                      style={{
                        background: inputPrompt.trim() ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'rgba(255, 255, 255, 0.05)',
                        border: 'none',
                        color: '#fff',
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        cursor: inputPrompt.trim() ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        boxShadow: inputPrompt.trim() ? '0 4px 12px rgba(99, 102, 241, 0.35)' : 'none'
                      }}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
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
                width: '72px',
                height: '72px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(6, 182, 212, 0.2))',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
                boxShadow: '0 8px 25px rgba(99, 102, 241, 0.2)'
              }}>
                <Users size={34} color="#818cf8" />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '0 0 0.5rem 0' }}>
                Kies of Maak een Projectkamer
              </h2>
              <p style={{ maxWidth: '420px', color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Werk realtime samen met klasgenoten en je school AI in één gedeelde werkruimte met live documenten en chat.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                    border: 'none',
                    color: '#fff',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '12px',
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
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '12px',
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
        </main>

        {/* ── KOLOM 3: SPLIT-SCREEN LIVE DOCS & LEDENPANEEL (RECHTS) ── */}
        {sidePanelOpen && activeRoom && (
          <aside style={{
            width: '380px',
            background: 'rgba(13, 19, 36, 0.95)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Tab Navigatie */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(10, 14, 26, 0.5)'
            }}>
              <button
                onClick={() => setActiveSideTab('docs')}
                style={{
                  flex: 1,
                  background: activeSideTab === 'docs' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: activeSideTab === 'docs' ? '2px solid #818cf8' : '2px solid transparent',
                  color: activeSideTab === 'docs' ? '#a5b4fc' : 'rgba(255, 255, 255, 0.6)',
                  padding: '0.85rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.15s'
                }}
              >
                <FileText size={15} />
                <span>Locra Docs</span>
              </button>

              <button
                onClick={() => setActiveSideTab('members')}
                style={{
                  flex: 1,
                  background: activeSideTab === 'members' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: activeSideTab === 'members' ? '2px solid #818cf8' : '2px solid transparent',
                  color: activeSideTab === 'members' ? '#a5b4fc' : 'rgba(255, 255, 255, 0.6)',
                  padding: '0.85rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.15s'
                }}
              >
                <Users size={15} />
                <span>Leden ({activeRoom.participants?.length || 1})</span>
              </button>
            </div>

            {/* TAB 1: LIVE LOCRA DOCS CANVAS */}
            {activeSideTab === 'docs' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                    {docSaveStatus ? (
                      <span style={{ color: '#34d399', fontWeight: 600 }}>{docSaveStatus}</span>
                    ) : (
                      'Gezamenlijke notities & opzet'
                    )}
                  </div>
                  <button
                    onClick={handleSaveDoc}
                    disabled={savingDoc}
                    style={{
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      color: '#c7d2fe',
                      padding: '4px 10px',
                      borderRadius: '8px',
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
                    color: '#e2e8f0',
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                    outline: 'none',
                    resize: 'none',
                    fontFamily: "'Inter', sans-serif"
                  }}
                />
              </div>
            )}

            {/* TAB 2: LEDEN & KAMERCODE QR */}
            {activeSideTab === 'members' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* 6-Cijferige Code & QR Kaart */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(20, 26, 46, 0.8), rgba(13, 19, 36, 0.95))',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.5rem' }}>
                    Uitnodigingscode
                  </div>
                  <div style={{
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    color: '#818cf8',
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
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
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
                        background: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        color: '#c7d2fe',
                        padding: '0.5rem 1rem',
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                    >
                      {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedCode ? 'Gekopieerd!' : 'Kopieer Deellink'}</span>
                    </button>
                  </div>
                </div>

                {/* Direct Leerling Toevoegen */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.5rem' }}>
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
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '0.5rem 0.75rem',
                      color: '#fff',
                      fontSize: '0.82rem',
                      outline: 'none'
                    }}
                  />

                  {searchResults.length > 0 && (
                    <div style={{
                      background: 'rgba(20, 26, 46, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
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
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>{u.displayName}</div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)' }}>{u.email}</div>
                          </div>
                          <button
                            onClick={() => handleAddParticipant(u.id)}
                            style={{
                              background: 'rgba(99, 102, 241, 0.25)',
                              border: 'none',
                              color: '#a5b4fc',
                              padding: '3px 8px',
                              borderRadius: '6px',
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
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.5rem' }}>
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
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '10px',
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
                                  border: '1.5px solid #090d16',
                                  boxShadow: '0 0 6px #10b981'
                                }} />
                              )}
                            </div>

                            <div>
                              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff' }}>
                                {name} {p.userId === currentUser?.id ? '(Jij)' : ''}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: isOnline ? '#34d399' : 'rgba(255, 255, 255, 0.4)' }}>
                                {isOnline ? 'Nu actief' : 'Offline'}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {isOwner ? (
                              <span style={{
                                fontSize: '0.68rem',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#fbbf24',
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
                                background: 'rgba(255, 255, 255, 0.06)',
                                color: 'rgba(255, 255, 255, 0.6)',
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
      </div>

      {/* ── MODAL: NIEUWE KAMER AANMAKEN ── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 8, 18, 0.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(20, 26, 46, 0.95), rgba(12, 17, 33, 0.98))',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '460px',
            padding: '2rem',
            position: 'relative',
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.7)'
          }}>
            <button
              onClick={() => setShowCreateModal(false)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>

            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.35rem', fontWeight: 700, color: '#fff' }}>
              Nieuwe Projectkamer Maken
            </h2>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.55)' }}>
              Start een gezamenlijke studio voor je groepsproject of practicum.
            </p>

            <form onSubmit={handleCreateRoom}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.4rem' }}>
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
                    background: 'rgba(10, 14, 26, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '0.75rem',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.4rem' }}>
                  Vak of Categorie
                </label>
                <select
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(10, 14, 26, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '0.75rem',
                    color: '#fff',
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
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    padding: '0.75rem',
                    borderRadius: '12px',
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
                    background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                    border: 'none',
                    color: '#fff',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)'
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
        }}
      />
    </div>
  );
}
