import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, SchoolOrg } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import * as Haptics from 'expo-haptics';

import { LocraApi } from '../services/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SchoolSearch'>;

export default function SchoolSearchScreen({ navigation }: { navigation: NavigationProp }) {
  const { colors } = useTheme();
  const { connectSchoolOnly } = useAuth();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SchoolOrg[]>([]);

  // Search by name, code or domain
  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    try {
      // 1. Query central directory at api.rowmatch.nl
      const centralResults = await LocraApi.searchCentralSchools(q);
      if (centralResults && centralResults.length > 0) {
        setResults(centralResults);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      // 2. Fallback: If user typed a direct URL, domain or IP, try direct discovery
      let targetUrl = q;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = `http://${targetUrl}`;
      }

      const directOrg = await LocraApi.discoverSchoolInfo(targetUrl);
      setResults([directOrg]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(
        'School niet gevonden',
        `Geen actieve school gevonden voor "${query}". Controleer de schoolnaam, schoolcode of scan de Koppel-QR.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSchool = async (org: SchoolOrg) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await connectSchoolOnly(org.serverUrl);
      navigation.navigate('Login');
    } catch (e: any) {
      Alert.alert('Fout', e.message || 'Kon niet verbinden met school.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Zoek je School</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Schoolnaam of bijv. LOCRA-BERLAGE"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={{ color: colors.textMuted, fontSize: 16, paddingHorizontal: 6 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: colors.primary }]}
          onPress={handleSearch}
          disabled={loading || !query.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.searchBtnText}>Zoeken</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Results / Suggestions */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.connectCode || item.slug}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>🏫</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Zoek op Schoolnaam of Code</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Elke school heeft een unieke Locra code, te vinden op het inlogscherm van de school-website of opgevraagd bij je docent.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.schoolCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => handleSelectSchool(item)}
          >
            <View style={[styles.schoolAvatar, { backgroundColor: `${item.primaryColor || colors.primary}25` }]}>
              <Text style={{ fontSize: 24 }}>🏫</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.schoolName, { color: colors.textPrimary }]}>{item.name}</Text>
              <Text style={[styles.schoolCode, { color: item.primaryColor || colors.primary }]}>
                {item.connectCode}
              </Text>
              <Text style={[styles.schoolUrl, { color: colors.textMuted }]}>{item.serverUrl}</Text>
            </View>
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: 'bold' }}>➔</Text>
          </TouchableOpacity>
        )}
      />
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
    paddingHorizontal: 20,
    paddingVertical: 14
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800'
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 10
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%'
  },
  searchBtn: {
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48
  },
  searchBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 30
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18
  },
  schoolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12
  },
  schoolAvatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  schoolName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2
  },
  schoolCode: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2
  },
  schoolUrl: {
    fontSize: 11
  }
});
