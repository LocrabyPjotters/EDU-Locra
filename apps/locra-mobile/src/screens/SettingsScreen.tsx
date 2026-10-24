import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, SafeAreaView, ScrollView, Modal } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import { RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { storage } from '../services/storage';
import * as Haptics from 'expo-haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: { navigation: NavigationProp }) {
  const { colors, isDark, toggleDark, schoolOrg } = useTheme();
  const { user, logout, disconnectSchool } = useAuth();

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showPrivacyCheck, setShowPrivacyCheck] = useState(false);

  const tutorialSteps = [
    {
      icon: '🎓',
      title: 'Welkom bij Locra Mobile',
      subtitle: 'Stap 1 van 4',
      text: 'Jouw didactische AI-studieassistent die speciaal is afgestemd op het voortgezet en hoger onderwijs in Nederland.'
    },
    {
      icon: '💡',
      title: 'Didactisch Leren',
      subtitle: 'Stap 2 van 4',
      text: 'Locra kauwt antwoorden niet blindelings voor. We helpen je door stapsgewijze hints te geven en je denkstappen te stimuleren.'
    },
    {
      icon: '⚡',
      title: 'Slimme Commands',
      subtitle: 'Stap 3 van 4',
      text: 'Gebruik slash-commando’s zoals /denkmodus voor diepe logica, /oefentoets om jezelf te testen en /zoeken voor internetbronnen.'
    },
    {
      icon: '🛡️',
      title: 'Privacy & Integriteit',
      subtitle: 'Stap 4 van 4',
      text: 'Geen persoonsgegevens invoeren. Je gegevens worden veilig verwerkt conform de AVG en blijven binnen de beschermde schoolmuren.'
    }
  ];

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(hasHardware => {
      setBiometricsAvailable(hasHardware);
    });
    storage.isBiometricsEnabled().then(enabled => {
      setBiometricsEnabled(enabled);
    });
  }, []);

  const handleToggleBiometrics = async (val: boolean) => {
    if (val) {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Bevestig met Face ID / Vingerafdruk',
        cancelLabel: 'Annuleren'
      });
      if (res.success) {
        await storage.setBiometricsEnabled(true);
        setBiometricsEnabled(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      await storage.setBiometricsEnabled(false);
      setBiometricsEnabled(false);
      Haptics.selectionAsync();
    }
  };

  const handleLogout = () => {
    Alert.alert('Uitloggen', 'Weet je zeker dat je wilt uitloggen?', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Uitloggen',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      }
    ]);
  };

  const handleDisconnectSchool = () => {
    Alert.alert(
      'School Ontkoppelen',
      'Weet je zeker dat je deze school wilt ontkoppelen? Je zult opnieuw een QR-code moeten scannen of schoolcode invoeren.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Ontkoppelen',
          style: 'destructive',
          onPress: async () => {
            await disconnectSchool();
            navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Instellingen</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.userInitials}>
              {(user?.displayName || user?.username || 'U').substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.userName, { color: colors.textPrimary }]}>
              {user?.displayName || user?.username}
            </Text>
            <Text style={[styles.userRole, { color: colors.primary }]}>
              {user?.role === 'student' ? 'Leerling' : user?.role === 'teacher' ? 'Docent' : user?.role}
            </Text>
            {user?.email && (
              <Text style={[styles.userEmail, { color: colors.textMuted }]}>{user.email}</Text>
            )}
          </View>
        </View>

        {/* Connected School Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Gekoppelde School</Text>
          <View style={styles.schoolRow}>
            <View style={[styles.schoolIconBadge, { backgroundColor: `${colors.primary}20` }]}>
              <Text style={{ fontSize: 24 }}>🏫</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.schoolName, { color: colors.textPrimary }]}>
                {schoolOrg?.name || 'Locra School'}
              </Text>
              <Text style={[styles.schoolCode, { color: colors.primary }]}>
                {schoolOrg?.connectCode || 'LOCRA'}
              </Text>
              <Text style={[styles.schoolUrl, { color: colors.textMuted }]}>
                {schoolOrg?.serverUrl || 'Verbonden'}
              </Text>
            </View>
          </View>
        </View>

        {/* Preferences */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Voorkeuren & Beveiliging</Text>

          {biometricsAvailable && (
            <View style={styles.settingRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                  Face ID / Vingerafdruk
                </Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                  Ontgrendel de app veilig met biometrie
                </Text>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: colors.surfaceHover, true: colors.primary }}
              />
            </View>
          )}

          <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Donker Thema</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Prettig voor de ogen in de avond
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleDark}
              trackColor={{ false: colors.surfaceHover, true: colors.primary }}
            />
          </View>
        </View>

        {/* Uitleg & Privacy Zelfhulp */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🎓 Uitleg & Privacy Zelfhulp</Text>

          <TouchableOpacity
            style={[styles.guideRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            onPress={() => {
              setTutorialStep(0);
              setShowTutorial(true);
            }}
          >
            <View style={[styles.guideBadge, { backgroundColor: `${colors.primary}18` }]}>
              <Text style={{ fontSize: 18 }}>🎓</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Tutorial opnieuw bekijken</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>Interactieve rondleiding over slimme functies</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.guideRow}
            onPress={() => setShowPrivacyCheck(true)}
          >
            <View style={[styles.guideBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Text style={{ fontSize: 18 }}>🛡️</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Privacy & Veiligheid Check</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>Maandelijkse richtlijnen over persoonsgegevens</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone Actions */}
        <View style={styles.dangerSection}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
            onPress={handleLogout}
          >
            <Text style={{ fontSize: 18, marginRight: 8 }}>🚪</Text>
            <Text style={styles.logoutText}>Uitloggen</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleDisconnectSchool}
          >
            <Text style={{ fontSize: 18, marginRight: 8 }}>🔄</Text>
            <Text style={[styles.disconnectText, { color: colors.textSecondary }]}>School ontkoppelen</Text>
          </TouchableOpacity>
        </View>

        {/* App Info Footer */}
        <View style={styles.footer}>
          <Text style={[styles.versionText, { color: colors.textMuted }]}>
            Locra Mobile v1.0.0 • Locra Connect SDK 52
          </Text>
        </View>
      </ScrollView>

      {/* Tutorial Modal */}
      <Modal
        visible={showTutorial}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTutorial(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 32 }}>{tutorialSteps[tutorialStep].icon}</Text>
              <TouchableOpacity onPress={() => setShowTutorial(false)} style={styles.modalCloseBtn}>
                <Text style={{ color: colors.textMuted, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalBadge, { color: colors.primary }]}>{tutorialSteps[tutorialStep].subtitle}</Text>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{tutorialSteps[tutorialStep].title}</Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>{tutorialSteps[tutorialStep].text}</Text>
            
            <View style={styles.dotsRow}>
              {tutorialSteps.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    { backgroundColor: idx === tutorialStep ? colors.primary : colors.border }
                  ]}
                />
              ))}
            </View>

            <View style={styles.modalBtnRow}>
              {tutorialStep > 0 && (
                <TouchableOpacity
                  style={[styles.modalBtnSecondary, { borderColor: colors.border }]}
                  onPress={() => setTutorialStep(s => s - 1)}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Terug</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={() => {
                  if (tutorialStep < tutorialSteps.length - 1) {
                    setTutorialStep(s => s + 1);
                  } else {
                    setShowTutorial(false);
                  }
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {tutorialStep === tutorialSteps.length - 1 ? 'Afronden' : 'Volgende'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Privacy Modal */}
      <Modal
        visible={showPrivacyCheck}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrivacyCheck(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 32 }}>🛡️</Text>
              <TouchableOpacity onPress={() => setShowPrivacyCheck(false)} style={styles.modalCloseBtn}>
                <Text style={{ color: colors.textMuted, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalBadge, { color: '#10b981' }]}>Veiligheid op School</Text>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Privacy Awareness Check</Text>
            <Text style={[styles.modalText, { color: colors.textSecondary, marginBottom: 12 }]}>
              Om jouw privacy en die van anderen te waarborgen, gelden deze 4 gouden regels:
            </Text>

            <ScrollView style={{ maxHeight: 220, marginBottom: 14 }}>
              <View style={{ gap: 10 }}>
                <View style={[styles.ruleCard, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                  <Text style={[styles.ruleTitle, { color: '#ef4444' }]}>🚫 1. Nooit Persoonsgegevens Delen</Text>
                  <Text style={[styles.ruleText, { color: colors.textSecondary }]}>Voer nooit je achternaam, adres, telefoonnummer, BSN of wachtwoorden in.</Text>
                </View>

                <View style={[styles.ruleCard, { backgroundColor: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.2)' }]}>
                  <Text style={[styles.ruleTitle, { color: '#3b82f6' }]}>👥 2. Respecteer Andermans Privacy</Text>
                  <Text style={[styles.ruleText, { color: colors.textSecondary }]}>Plaats geen gevoelige informatie of cijfers van klasgenoten of docenten.</Text>
                </View>

                <View style={[styles.ruleCard, { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.2)' }]}>
                  <Text style={[styles.ruleTitle, { color: '#f59e0b' }]}>🔎 3. Verifieer AI Antwoorden</Text>
                  <Text style={[styles.ruleText, { color: colors.textSecondary }]}>AI kan hallucineren. Controleer belangrijke feiten altijd in je schoolboeken.</Text>
                </View>

                <View style={[styles.ruleCard, { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <Text style={[styles.ruleTitle, { color: '#10b981' }]}>🎓 4. Academische Eerlijkheid</Text>
                  <Text style={[styles.ruleText, { color: colors.textSecondary }]}>Gebruik Locra om stof écht te begrijpen. Fraudeer niet bij toetsen of opdrachten.</Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalBtnPrimary, { backgroundColor: '#10b981' }]}
              onPress={() => {
                setShowPrivacyCheck(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Begrepen & Akkoord</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '800'
  },
  scrollContent: {
    padding: 20,
    gap: 16
  },
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    gap: 12
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  userInitials: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800'
  },
  userName: {
    fontSize: 17,
    fontWeight: '800'
  },
  userRole: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4
  },
  schoolRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  schoolIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  schoolName: {
    fontSize: 16,
    fontWeight: '700'
  },
  schoolCode: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  schoolUrl: {
    fontSize: 11,
    marginTop: 2
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700'
  },
  settingDesc: {
    fontSize: 12,
    marginTop: 2
  },
  dangerSection: {
    gap: 10,
    marginTop: 8
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '700'
  },
  disconnectText: {
    fontSize: 14,
    fontWeight: '600'
  },
  footer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 20
  },
  versionText: {
    fontSize: 12
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12
  },
  guideBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  modalCloseBtn: {
    padding: 6
  },
  modalBadge: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 16
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  modalBtnPrimary: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalBtnSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  ruleCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  ruleText: {
    fontSize: 12,
    lineHeight: 16
  }
});
