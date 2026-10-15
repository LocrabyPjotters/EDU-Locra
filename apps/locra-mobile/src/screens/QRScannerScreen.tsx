import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, PairingPayload } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import * as Haptics from 'expo-haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'QRScanner'>;

export default function QRScannerScreen({ navigation }: { navigation: NavigationProp }) {
  const [permission, requestPermission] = useCameraPermissions();
  const { pairWithQr, connectSchoolOnly } = useAuth();
  const { colors } = useTheme();

  const [torch, setTorch] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (!permission) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background, padding: 32 }]}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>Cameratoegang Nodig</Text>
        <Text style={[styles.permissionDesc, { color: colors.textSecondary }]}>
          Locra heeft toestemming nodig voor de camera om de Koppel-QR-code van je school te scannen.
        </Text>
        <TouchableOpacity
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
        >
          <Text style={styles.permissionBtnText}>Toestemming Geven</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.textMuted }}>Annuleren</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (processing) return;
    setProcessing(true);

    try {
      let parsed: PairingPayload;
      try {
        parsed = JSON.parse(data);
      } catch {
        // Fallback: check if raw string is an HTTP URL to a Locra server
        if (data.startsWith('http')) {
          await connectSchoolOnly(data);
          navigation.replace('Login');
          return;
        }
        throw new Error('Dit is geen geldige Locra QR-code.');
      }

      if (parsed.type === 'locra-pair' && parsed.serverUrl && parsed.pairingCode) {
        // 1-Click login!
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await pairWithQr(parsed.serverUrl, parsed.pairingCode);
        navigation.reset({ index: 0, routes: [{ name: 'ChatList' }] });
      } else if (parsed.type === 'locra-school' && parsed.serverUrl) {
        // School-level QR (connects school and opens login)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await connectSchoolOnly(parsed.serverUrl);
        navigation.replace('Login');
      } else {
        throw new Error('Onbekend QR-formaat. Gebruik de Koppel-QR uit Locra.');
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Koppelfout',
        e.message || 'Kon de koppelcode niet verifiëren. Probeer het opnieuw.',
        [{ text: 'OK', onPress: () => setProcessing(false) }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={processing ? undefined : handleBarcodeScanned}
      />

      {/* Dark Overlay around Scanner */}
      <View style={styles.overlay}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
          >
            <Text style={styles.circleBtnText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Scan Koppel-QR</Text>

          <TouchableOpacity
            style={[styles.circleBtn, torch && styles.circleBtnActive]}
            onPress={() => {
              setTorch(!torch);
              Haptics.selectionAsync();
            }}
          >
            <Text style={styles.circleBtnText}>{torch ? '🔦' : '💡'}</Text>
          </TouchableOpacity>
        </View>

        {/* Viewfinder Target */}
        <View style={styles.viewfinderContainer}>
          <View style={[styles.viewfinder, { borderColor: colors.primary }]}>
            {/* Corner reticles */}
            <View style={[styles.corner, styles.cornerTL, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: colors.primary }]} />

            {processing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.processingText}>Koppelen...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom Helper */}
        <View style={styles.bottomBanner}>
          <Text style={styles.bannerText}>
            Richt je camera op de QR-code op je computerscherm of schoolposter.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000'
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  permissionIcon: {
    fontSize: 54,
    marginBottom: 16
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center'
  },
  permissionDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 280
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center'
  },
  permissionBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16
  },
  cancelLink: {
    marginTop: 18,
    padding: 8
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'space-between',
    paddingVertical: 48,
    paddingHorizontal: 24
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  circleBtnActive: {
    backgroundColor: '#ffffff'
  },
  circleBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700'
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700'
  },
  viewfinderContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewfinder: {
    width: 250,
    height: 250,
    borderRadius: 28,
    borderWidth: 1.5,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#6366f1'
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 28
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 28
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 28
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 28
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  processingText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15
  },
  bottomBanner: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  bannerText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18
  }
});
