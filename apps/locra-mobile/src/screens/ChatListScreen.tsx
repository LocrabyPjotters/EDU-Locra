import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl, SafeAreaView, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Conversation } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { LocraApi } from '../services/api';
import * as Haptics from 'expo-haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChatList'>;

export default function ChatListScreen({ navigation }: { navigation: NavigationProp }) {
  const { colors, schoolOrg } = useTheme();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadConversations = useCallback(async () => {
    try {
      const convs = await LocraApi.getConversations();
      setConversations(convs);
    } catch (e) {
      console.error('Error loading conversations:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadConversations();
  };

  const handleStartNewChat = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const newConv = await LocraApi.createConversation();
      navigation.navigate('Chat', { conversationId: newConv.id, title: newConv.title });
    } catch {
      // Fallback
      navigation.navigate('Chat', { title: 'Nieuw gesprek' });
    }
  };

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.summary && c.summary.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.schoolPill, { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}40` }]}>
            <Text style={{ fontSize: 14, marginRight: 6 }}>🏫</Text>
            <Text style={[styles.schoolPillText, { color: colors.primary }]}>
              {schoolOrg?.name || 'Locra'}
            </Text>
          </View>
          <Text style={[styles.welcomeText, { color: colors.textPrimary }]}>
            Hoi, {user?.displayName?.split(' ')[0] || 'Leerling'} 👋
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.settingsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('Settings');
          }}
        >
          <Text style={{ fontSize: 18 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 14, marginRight: 8 }}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Zoek in je gesprekken..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: colors.textMuted, fontSize: 14, paddingHorizontal: 6 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Conversations List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>💬</Text>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Geen gesprekken gevonden</Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                Start een nieuw gesprek met de AI-assistent om vragen te stellen of lesstof te oefenen.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.75}
              onPress={() => {
                Haptics.selectionAsync();
                navigation.navigate('Chat', { conversationId: item.id, title: item.title });
              }}
            >
              <View style={[styles.chatIconBadge, { backgroundColor: `${colors.primary}18` }]}>
                <Text style={{ fontSize: 20 }}>💬</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.chatTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.summary ? (
                  <Text style={[styles.chatSummary, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.summary}
                  </Text>
                ) : (
                  <Text style={[styles.chatDate, { color: colors.textMuted }]}>
                    {new Date(item.updatedAt || Date.now()).toLocaleDateString('nl-NL')}
                  </Text>
                )}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Floating Action Button (New Chat) */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
        onPress={handleStartNewChat}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  headerLeft: {
    gap: 4
  },
  schoolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1
  },
  schoolPillText: {
    fontSize: 11,
    fontWeight: '700'
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '800'
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 44
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%'
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 90
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 30
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center'
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10
  },
  chatIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2
  },
  chatSummary: {
    fontSize: 12,
    lineHeight: 16
  },
  chatDate: {
    fontSize: 11,
    marginTop: 2
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8
  },
  fabIcon: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '300',
    marginTop: -2
  }
});
