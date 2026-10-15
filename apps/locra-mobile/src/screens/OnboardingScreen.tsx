import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import * as Haptics from 'expo-haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: { navigation: NavigationProp }) {
  const { colors } = useTheme();
  const { connectSchoolOnly } = useAuth();

  const [showManual, setShowManual] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleManualConnect = async () => {
    const url = manualUrl.trim();
    if (!url) {
      Alert.alert('Fout', 'Vul een geldige server URL in.');
      return;
    }
    setLoading(true);
    try {
      await connectSchoolOnly(url.startsWith('http') ? url : `http://${url}`);
      navigation.navigate('Login');
    } catch (e: any) {
      Alert.alert('Verbindingsfout', e.message || 'Kon geen verbinding maken met deze schoolserver.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Hero Branding */}
          <View style={styles.heroSection}>
            <View style={[styles.logoBadge, { backgroundColor: `${colors.primary}25`, borderColor: `${colors.primary}50` }]}>
              <Text style={styles.logoIcon}>🎓</Text>
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Locra</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Jouw slimme, privacy-vriendelijke AI-leeromgeving voor school
            </Text>
          </View>

          {/* Action Cards */}
          <View style={styles.actionsSection}>
            {/* 1. Scan QR Card (Primary) */}
            <TouchableOpacity
              style={[styles.primaryCard, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate('QRScanner');
              }}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>📷</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Snelste Optie</Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>Scan Koppel-QR-code</Text>
              <Text style={styles.cardDesc}>
                Open Locra op je computer, ga naar Instellingen ➔ 'Koppel App' en richt je camera. Direct ingelogd!
              </Text>
            </TouchableOpacity>

            {/* 2. Search School (Locra Connect) */}
            <TouchableOpacity
              style={[styles.secondaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('SchoolSearch');
              }}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>🏫</Text>
              </View>
              <Text style={[styles.cardTitleSecondary, { color: colors.textPrimary }]}>Zoek je School</Text>
              <Text style={[styles.cardDescSecondary, { color: colors.textSecondary }]}>
                Zoek op de naam van je school of vul je unieke schoolcode in (bijv. LOCRA-BERLAGE).
              </Text>
            </TouchableOpacity>

            {/* 3. Manual Server URL toggle */}
            {!showManual ? (
              <TouchableOpacity
                style={styles.manualLink}
                onPress={() => {
                  setShowManual(true);
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[styles.manualLinkText, { color: colors.textMuted }]}>
                  ⚙️ Handmatige server-URL invoeren
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.manualContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.manualTitle, { color: colors.textPrimary }]}>Eigen Server URL</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceHover, color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="bijv. locra.school.nl of 192.168.1.50:4000"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={manualUrl}
                  onChangeText={setManualUrl}
                />
                <View style={styles.manualButtons}>
                  <TouchableOpacity
                    style={[styles.btnCancel, { borderColor: colors.border }]}
                    onPress={() => setShowManual(false)}
                  >
                    <Text style={{ color: colors.textSecondary }}>Annuleren</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnConnect, { backgroundColor: colors.primary }]}
                    disabled={loading}
                    onPress={handleManualConnect}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>Verbinden</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              Locra voor Scholen • Beveiligd & AVG-conform
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
    flexGrow: 1,
    justifyContent: 'space-between'
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 28
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  logoIcon: {
    fontSize: 38
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 290
  },
  actionsSection: {
    gap: 14
  },
  primaryCard: {
    borderRadius: 22,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  cardIcon: {
    fontSize: 28
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6
  },
  cardDesc: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    lineHeight: 18
  },
  secondaryCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1
  },
  cardTitleSecondary: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4
  },
  cardDescSecondary: {
    fontSize: 13,
    lineHeight: 18
  },
  manualLink: {
    alignSelf: 'center',
    paddingVertical: 10
  },
  manualLinkText: {
    fontSize: 13,
    fontWeight: '500'
  },
  manualContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10
  },
  manualTitle: {
    fontSize: 14,
    fontWeight: '700'
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    fontSize: 14
  },
  manualButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10
  },
  btnCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
  },
  btnConnect: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8
  },
  footer: {
    marginTop: 24,
    alignItems: 'center'
  },
  footerText: {
    fontSize: 12
  }
});
