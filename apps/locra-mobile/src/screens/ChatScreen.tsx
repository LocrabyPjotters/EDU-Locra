import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator,
  Alert, Animated, Dimensions
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, ChatMessage } from '../types';
import { useTheme } from '../context/ThemeContext';
import { LocraApi } from '../services/api';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

// ── Typing Indicator Component ──
function TypingDots({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay)
        ])
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4 }}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: color,
            opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }]
          }}
        />
      ))}
    </View>
  );
}

// ── Main Chat Screen ──
export default function ChatScreen({ route, navigation }: Props) {
  const { conversationId, title } = route.params || {};
  const { colors, schoolOrg } = useTheme();

  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId || null);
  const [chatTitle, setChatTitle] = useState(title || 'Nieuw gesprek');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useThinkMode, setUseThinkMode] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('');
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<TextInput>(null);

  const aiName = schoolOrg?.aiName || 'Locra AI';

  // Load existing messages
  useEffect(() => {
    if (activeConvId) {
      setLoading(true);
      LocraApi.getMessages(activeConvId)
        .then(msgs => setMessages(msgs))
        .catch(err => console.error('Error fetching messages:', err))
        .finally(() => setLoading(false));
    }
  }, [activeConvId]);

  // Auto-scroll on new messages
  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  // ── Send Message with Streaming ──
  const handleSend = async (textToSend?: string) => {
    const finalPrompt = (textToSend || prompt).trim();
    if (!finalPrompt || isGenerating) return;

    setPrompt('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Ensure conversation exists
    let convId = activeConvId;
    if (!convId) {
      try {
        const newConv = await LocraApi.createConversation(finalPrompt.substring(0, 36));
        convId = newConv.id;
        setActiveConvId(newConv.id);
        setChatTitle(newConv.title || finalPrompt.substring(0, 36));
      } catch (e: any) {
        Alert.alert('Fout', 'Kon gesprek niet starten.');
        return;
      }
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: finalPrompt,
      createdAt: new Date().toISOString(),
      isThinkMode: useThinkMode
    };

    // Add placeholder for streaming assistant reply
    const streamId = `stream_${Date.now()}`;
    const placeholderMsg: ChatMessage = {
      id: streamId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      isThinkMode: useThinkMode
    };

    setMessages(prev => [...prev, userMsg, placeholderMsg]);
    setStreamingMsgId(streamId);
    setIsGenerating(true);
    setThinkingStatus(useThinkMode ? '🧠 Diep aan het nadenken...' : '');
    scrollToEnd();

    try {
      const stop = await LocraApi.sendMessageStream({
        convId: convId!,
        prompt: finalPrompt,
        useThinkMode,
        onChunk: (chunk: string) => {
          setThinkingStatus('');
          setMessages(prev =>
            prev.map(m =>
              m.id === streamId ? { ...m, content: m.content + chunk } : m
            )
          );
          scrollToEnd();
        },
        onThinking: (message: string) => {
          setThinkingStatus(message);
        },
        onDone: (finalText: string) => {
          setMessages(prev =>
            prev.map(m =>
              m.id === streamId ? { ...m, content: finalText || m.content, id: `ast_${Date.now()}` } : m
            )
          );
          setIsGenerating(false);
          setStreamingMsgId(null);
          setThinkingStatus('');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          scrollToEnd();
        },
        onError: (error: string) => {
          // Remove placeholder on error
          setMessages(prev => prev.filter(m => m.id !== streamId));
          setIsGenerating(false);
          setStreamingMsgId(null);
          setThinkingStatus('');
          Alert.alert('Fout bij antwoorden', error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      });
      stopStreamRef.current = stop;
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== streamId));
      setIsGenerating(false);
      setStreamingMsgId(null);
      Alert.alert('Fout', e.message || 'Kon geen verbinding maken.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleStopGenerating = () => {
    if (stopStreamRef.current) {
      stopStreamRef.current();
      stopStreamRef.current = null;
    }
    setIsGenerating(false);
    setStreamingMsgId(null);
    setThinkingStatus('');
  };

  const quickPrompts = [
    { emoji: '💡', label: 'Vat samen', prompt: 'Vat het vorige samen in 3 kernpunten' },
    { emoji: '❓', label: 'Quiz mij', prompt: 'Stel mij een oefenvraag over het onderwerp' },
    { emoji: '📖', label: 'Eenvoudiger', prompt: 'Leg dit eenvoudiger uit op B1 niveau' },
    { emoji: '🔬', label: 'Verdieping', prompt: 'Geef verdiepende uitleg over dit onderwerp' }
  ];

  // ── Render Message Bubble ──
  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isUser = item.role === 'user';
    const isStreaming = item.id === streamingMsgId;
    const showContent = item.content.length > 0;

    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAi]}>
        {/* AI Avatar */}
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: `${colors.primary}20` }]}>
            <Text style={{ fontSize: 16 }}>✨</Text>
          </View>
        )}

        <View style={[styles.msgContent, isUser ? styles.msgContentUser : styles.msgContentAi]}>
          {/* Think Mode Badge */}
          {item.isThinkMode && !isUser && (
            <View style={[styles.thinkBadge, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}>
              <Text style={[styles.thinkBadgeText, { color: colors.primary }]}>🧠 Uitgebreid nagedacht</Text>
            </View>
          )}

          {/* Message Bubble */}
          <View style={[
            styles.bubble,
            isUser
              ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 }
              : { backgroundColor: colors.surface, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.border }
          ]}>
            {/* Streaming: show content or typing dots */}
            {isStreaming && !showContent ? (
              <View>
                {thinkingStatus ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                      {thinkingStatus}
                    </Text>
                  </View>
                ) : (
                  <TypingDots color={colors.primary} />
                )}
              </View>
            ) : (
              <Text
                style={[
                  styles.msgText,
                  { color: isUser ? '#ffffff' : colors.textPrimary }
                ]}
                selectable
              >
                {item.content}
              </Text>
            )}

            {/* Streaming cursor blink */}
            {isStreaming && showContent && (
              <Text style={{ color: colors.primary, fontSize: 16, marginLeft: 1 }}>▍</Text>
            )}
          </View>

          {/* Timestamp */}
          <Text style={[styles.timestamp, { color: colors.textMuted, textAlign: isUser ? 'right' : 'left' }]}>
            {isUser ? 'Jij' : aiName} • {new Date(item.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* User Avatar */}
        {isUser && (
          <View style={[styles.avatar, { backgroundColor: `${colors.primary}30` }]}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.primary }}>
              {(route.params as any)?.userName?.[0]?.toUpperCase() || '🧑'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ── Empty State (Gemini-style welcome) ──
  const EmptyWelcome = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.welcomeOrb, { backgroundColor: `${colors.primary}12` }]}>
        <Text style={{ fontSize: 48 }}>✨</Text>
      </View>
      <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>
        Hoi! Waar kan ik je{'\n'}mee helpen?
      </Text>
      <Text style={[styles.welcomeSub, { color: colors.textSecondary }]}>
        Stel een vraag over je lesstof, vraag feedback op je tekst, of oefen met een quiz.
      </Text>

      {/* Quick Prompt Chips */}
      <View style={styles.quickGrid}>
        {quickPrompts.map((qp, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.75}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleSend(qp.prompt);
            }}
          >
            <Text style={{ fontSize: 22, marginBottom: 6 }}>{qp.emoji}</Text>
            <Text style={[styles.quickLabel, { color: colors.textPrimary }]}>{qp.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: `${colors.textMuted}15` }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600' }}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerModel, { color: colors.textSecondary }]}>
            {aiName} {useThinkMode ? '• 🧠' : ''}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {chatTitle}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: `${colors.textMuted}15` }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // Future: options menu
          }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 16 }}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* ── Messages ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={[
              styles.messagesList,
              messages.length === 0 && { flex: 1, justifyContent: 'center' }
            ]}
            onContentSizeChange={scrollToEnd}
            ListEmptyComponent={<EmptyWelcome />}
            renderItem={renderMessage}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* ── Stop Generating Button ── */}
        {isGenerating && (
          <TouchableOpacity
            style={[styles.stopBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleStopGenerating}
            activeOpacity={0.7}
          >
            <View style={[styles.stopIcon, { backgroundColor: colors.textSecondary }]} />
            <Text style={[styles.stopText, { color: colors.textSecondary }]}>Stop genereren</Text>
          </TouchableOpacity>
        )}

        {/* ── Input Bar (Gemini-style) ── */}
        <View style={[styles.inputContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.inputBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Plus / Attach */}
            <TouchableOpacity
              style={styles.inputAction}
              onPress={() => {
                // Future: file picker
                Haptics.selectionAsync();
              }}
            >
              <Text style={{ fontSize: 20, color: colors.textMuted }}>＋</Text>
            </TouchableOpacity>

            {/* Text Input */}
            <TextInput
              ref={inputRef}
              style={[styles.inputField, { color: colors.textPrimary }]}
              placeholder={`Vraag het ${aiName}...`}
              placeholderTextColor={colors.textMuted}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              maxLength={4000}
              editable={!isGenerating}
              onSubmitEditing={() => handleSend()}
              blurOnSubmit={false}
            />

            {/* Think Mode Toggle */}
            <TouchableOpacity
              style={[
                styles.inputAction,
                useThinkMode && { backgroundColor: `${colors.primary}20`, borderRadius: 12 }
              ]}
              onPress={() => {
                setUseThinkMode(!useThinkMode);
                Haptics.selectionAsync();
              }}
            >
              <Text style={{ fontSize: 18 }}>🧠</Text>
            </TouchableOpacity>

            {/* Send / Stop */}
            {isGenerating ? (
              <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.textMuted }]} onPress={handleStopGenerating}>
                <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#fff' }} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  { backgroundColor: prompt.trim() ? colors.primary : `${colors.textMuted}40` }
                ]}
                disabled={!prompt.trim()}
                onPress={() => handleSend()}
              >
                <Text style={styles.sendIcon}>↑</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center'
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerModel: { fontSize: 11, fontWeight: '600', marginBottom: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700' },

  // ── Messages ──
  centerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messagesList: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },

  // ── Message Row ──
  msgRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowAi: { justifyContent: 'flex-start' },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4
  },
  msgContent: { maxWidth: '78%', gap: 4 },
  msgContentUser: { alignItems: 'flex-end' },
  msgContentAi: { alignItems: 'flex-start' },

  // ── Bubble ──
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 12,
    minHeight: 40
  },
  msgText: { fontSize: 15, lineHeight: 22 },
  timestamp: { fontSize: 10, marginHorizontal: 4, marginTop: 2 },

  // ── Think Badge ──
  thinkBadge: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 10, borderWidth: 1, marginBottom: 4
  },
  thinkBadgeText: { fontSize: 11, fontWeight: '700' },

  // ── Empty Welcome ──
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20
  },
  welcomeOrb: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20
  },
  welcomeTitle: {
    fontSize: 24, fontWeight: '800',
    textAlign: 'center', marginBottom: 8
  },
  welcomeSub: {
    fontSize: 14, textAlign: 'center',
    lineHeight: 20, marginBottom: 28, maxWidth: 300
  },
  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, justifyContent: 'center',
    width: '100%'
  },
  quickCard: {
    width: (SCREEN_WIDTH - 72) / 2,
    paddingVertical: 16, paddingHorizontal: 14,
    borderRadius: 16, borderWidth: 1,
    alignItems: 'center'
  },
  quickLabel: { fontSize: 13, fontWeight: '700' },

  // ── Stop Button ──
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, marginBottom: 8
  },
  stopIcon: { width: 10, height: 10, borderRadius: 2 },
  stopText: { fontSize: 13, fontWeight: '600' },

  // ── Input ──
  inputContainer: {
    paddingHorizontal: 12, paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    borderRadius: 24, borderWidth: 1,
    paddingHorizontal: 6, paddingVertical: 6,
    minHeight: 48, gap: 4
  },
  inputAction: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center'
  },
  inputField: {
    flex: 1, fontSize: 15, lineHeight: 20,
    maxHeight: 100, paddingVertical: 6, paddingHorizontal: 4
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center'
  },
  sendIcon: {
    color: '#ffffff', fontSize: 18, fontWeight: '700'
  }
});
