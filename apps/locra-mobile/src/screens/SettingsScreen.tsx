import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, SafeAreaView, ScrollView } from 'react-native';
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
  }
});
