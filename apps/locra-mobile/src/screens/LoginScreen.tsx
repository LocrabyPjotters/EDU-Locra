import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import * as Haptics from 'expo-haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: { navigation: NavigationProp }) {
  const { colors, schoolOrg } = useTheme();
  const { login, disconnectSchool } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Fout', 'Vul je gebruikersnaam en wachtwoord in.');
      return;
    }

    setLoading(true);
    try {
      await login(username.trim(), password);
      navigation.reset({ index: 0, routes: [{ name: 'ChatList' }] });
    } catch (e: any) {
      Alert.alert('Inloggen Mislukt', e.message || 'Controleer je gebruikersnaam en wachtwoord.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* School Badge */}
          <View style={styles.schoolHeader}>
            <View style={[styles.schoolAvatar, { backgroundColor: `${colors.primary}25`, borderColor: `${colors.primary}50` }]}>
              <Text style={styles.schoolEmoji}>🏫</Text>
            </View>
            <Text style={[styles.schoolName, { color: colors.textPrimary }]}>
              {schoolOrg?.name || 'Locra School'}
            </Text>
            <Text style={[styles.connectCode, { color: colors.primary }]}>
              {schoolOrg?.connectCode || 'LOCRA'}
            </Text>
          </View>

          {/* Form */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.loginTitle, { color: colors.textPrimary }]}>Inloggen met Schoolaccount</Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Gebruikersnaam of E-mail</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceHover, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="bijv. p.oosterling"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Wachtwoord</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceHover, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
              />
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, { backgroundColor: colors.primary }]}
              disabled={loading}
              activeOpacity={0.85}
              onPress={handleLogin}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginBtnText}>Inloggen ➔</Text>
              )}
            </TouchableOpacity>

            {/* Quick QR Alternative */}
            <TouchableOpacity
              style={[styles.qrAltBtn, { borderColor: colors.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('QRScanner');
              }}
            >
              <Text style={{ fontSize: 16, marginRight: 6 }}>📷</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                Liever 1-klik inloggen via QR-code?
              </Text>
            </TouchableOpacity>
          </View>

          {/* Disconnect / Change School */}
          <TouchableOpacity
            style={styles.disconnectBtn}
            onPress={async () => {
              await disconnectSchool();
              navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
            }}
          >
            <Text style={[styles.disconnectText, { color: colors.textMuted }]}>
              🔄 Andere school koppelen
            </Text>
          </TouchableOpacity>
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
    justifyContent: 'center'
  },
  schoolHeader: {
    alignItems: 'center',
    marginBottom: 24
  },
  schoolAvatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  schoolEmoji: {
    fontSize: 32
  },
  schoolName: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center'
  },
  connectCode: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  card: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    gap: 16
  },
  loginTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4
  },
  inputGroup: {
    gap: 6
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600'
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15
  },
  loginBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6
  },
  loginBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16
  },
  qrAltBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4
  },
  disconnectBtn: {
    alignSelf: 'center',
    marginTop: 20,
    padding: 8
  },
  disconnectText: {
    fontSize: 13,
    fontWeight: '500'
  }
});
