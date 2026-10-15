import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, ChatMessage } from '../types';
import { useTheme } from '../context/ThemeContext';
import { LocraApi } from '../services/api';
import * as Haptics from 'expo-haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export default function ChatScreen({ route, navigation }: Props) {
  const { conversationId, title } = route.params || {};
  const { colors, schoolOrg } = useTheme();

  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useThinkMode, setUseThinkMode] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (activeConvId) {
      setLoading(true);
      LocraApi.getMessages(activeConvId)
        .then(msgs => setMessages(msgs))
        .catch(err => console.error('Error fetching messages:', err))
        .finally(() => setLoading(false));
    }
  }, [activeConvId]);

  const handleSend = async (textToSend?: string) => {
    const finalPrompt = (textToSend || prompt).trim();
    if (!finalPrompt || isGenerating) return;

    setPrompt('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Ensure conversation exists
    let convId = activeConvId;
    if (!convId) {
      try {
        const newConv = await LocraApi.createConversation(finalPrompt.substring(0, 30));
        convId = newConv.id;
        setActiveConvId(newConv.id);
      } catch (e: any) {
        Alert.alert('Fout', 'Kon gesprek niet starten.');
        return;
      }
    }

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: finalPrompt,
      createdAt: new Date().toISOString(),
      isThinkMode: useThinkMode
    };

    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const response = await LocraApi.sendMessage({
        convId,
        prompt: finalPrompt,
        useThinkMode
      });

      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        createdAt: new Date().toISOString(),
        isThinkMode: useThinkMode,
        quiz: response.quiz
      };

      setMessages(prev => [...prev, assistantMsg]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Fout bij antwoorden', e.message || 'Kon geen antwoord ophalen.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGenerating(false);
    }
  };

  const quickPrompts = [
    '💡 Vat samen in 3 kernpunten',
    '❓ Maak een oefenvraag voor mij',
    '📖 Leg dit eenvoudiger uit (B1)'
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 16 }}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {title || 'Locra Chat'}
          </Text>
          <Text style={[styles.headerSub, { color: colors.primary }]}>
            {schoolOrg?.aiName || 'Locra AI'} • {schoolOrg?.name || 'School'}
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {/* Messages List */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={{ fontSize: 44, marginBottom: 12 }}>✨</Text>
                <Text style={[styles.emptyChatTitle, { color: colors.textPrimary }]}>
                  Waar kan ik je vandaag mee helpen?
                </Text>
                <Text style={[styles.emptyChatSub, { color: colors.textSecondary }]}>
                  Stel een vraag over je lesstof, vraag om feedback op je tekst of oefen met een quiz!
                </Text>

                <View style={styles.quickPromptsContainer}>
                  {quickPrompts.map((qp, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.quickChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => handleSend(qp.substring(2).trim())}
                    >
                      <Text style={[styles.quickChipText, { color: colors.textPrimary }]}>{qp}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            }
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              return (
                <View style={[styles.bubbleWrapper, isUser ? styles.bubbleUserWrap : styles.bubbleAiWrap]}>
                  {/* Thinking badge */}
                  {item.isThinkMode && !isUser && (
                    <View style={styles.thinkBadge}>
                      <Text style={styles.thinkBadgeText}>🧠 Uitgebreid Nagedacht</Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.bubble,
                      isUser
                        ? [styles.userBubble, { backgroundColor: colors.primary }]
                        : [styles.aiBubble, { backgroundColor: colors.surface, borderColor: colors.border }]
                    ]}
                  >
                    <Text style={[styles.messageText, { color: isUser ? '#ffffff' : colors.textPrimary }]}>
                      {item.content}
                    </Text>
                  </View>

                  <Text style={[styles.timestamp, { color: colors.textMuted }]}>
                    {new Date(item.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {/* Generating Indicator */}
        {isGenerating && (
          <View style={styles.generatingBar}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.generatingText, { color: colors.primary }]}>
              {useThinkMode ? '🧠 Diep aan het nadenken...' : 'Antwoord genereren...'}
            </Text>
          </View>
        )}

        {/* Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {/* Thinking Brain Toggle Button */}
          <TouchableOpacity
            style={[
              styles.thinkBtn,
              useThinkMode
                ? { backgroundColor: `${colors.primary}30`, borderColor: colors.primary }
                : { backgroundColor: colors.surfaceHover, borderColor: colors.border }
            ]}
            onPress={() => {
              setUseThinkMode(!useThinkMode);
              Haptics.selectionAsync();
            }}
          >
            <Text style={{ fontSize: 18 }}>🧠</Text>
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.surfaceHover, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder={useThinkMode ? "Stel een vraag (Denkmodus actief)..." : "Stel je vraag..."}
            placeholderTextColor={colors.textMuted}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            maxLength={2000}
          />

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: colors.primary },
              (!prompt.trim() || isGenerating) && { opacity: 0.5 }
            ]}
            disabled={!prompt.trim() || isGenerating}
            onPress={() => handleSend()}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerInfo: {
    alignItems: 'center',
    maxWidth: 240
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800'
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12
  },
  emptyChat: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 20
  },
  emptyChatTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center'
  },
  emptyChatSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24
  },
  quickPromptsContainer: {
    width: '100%',
    gap: 8
  },
  quickChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '600'
  },
  bubbleWrapper: {
    maxWidth: '82%',
    marginBottom: 6
  },
  bubbleUserWrap: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end'
  },
  bubbleAiWrap: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start'
  },
  thinkBadge: {
    backgroundColor: 'rgba(124, 92, 252, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4
  },
  thinkBadgeText: {
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: '700'
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  userBubble: {
    borderBottomRightRadius: 4
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    marginHorizontal: 4
  },
  generatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  generatingText: {
    fontSize: 12,
    fontWeight: '600'
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8
  },
  thinkBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  inputField: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 90,
    fontSize: 14
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendIcon: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 2
  }
});
