import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
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
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Auto-request permission on mount if undetermined
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (processing || !data) return;
    setProcessing(true);

    try {
      let parsed: PairingPayload;
      try {
        parsed = JSON.parse(data);
      } catch {
        // Fallback: check if raw string is an HTTP URL to a Locra server
        if (data.startsWith('http')) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const openNativeScanner = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (CameraView.isModernBarcodeScannerAvailable) {
        const sub = CameraView.onModernBarcodeScanned((result) => {
          sub.remove();
          CameraView.dismissScanner();
          if (result?.data) {
            handleBarcodeScanned({ data: result.data });
          }
        });
        await CameraView.launchScanner({ barcodeTypes: ['qr'] });
      } else {
        Alert.alert('Niet beschikbaar', 'De Apple scanner is beschikbaar op fysieke iOS toestellen met iOS 16 of nieuwer.');
      }
    } catch (e: any) {
      console.warn('Native scanner error:', e);
    }
  };

  const handleManualSubmit = async () => {
    const raw = manualCode.trim();
    if (!raw) return;
    setManualModalVisible(false);
    handleBarcodeScanned({ data: raw });
  };

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

        <TouchableOpacity
          style={[styles.altButton, { borderColor: colors.border }]}
          onPress={() => setManualModalVisible(true)}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>✏️ Handmatig Koppelen</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.textMuted }}>Annuleren</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={processing ? undefined : handleBarcodeScanned}
        onCameraReady={() => {
          console.log('[Camera] Preview ready');
        }}
        onMountError={(e) => {
          console.warn('[Camera] Mount error:', e);
        }}
      />

      {/* Floating UI Overlay */}
      <View style={styles.overlay} pointerEvents="box-none">
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
        <View style={styles.viewfinderContainer} pointerEvents="none">
          <View style={[styles.viewfinder, { borderColor: colors.primary }]}>
            {/* Corner reticles */}
            <View style={[styles.corner, styles.cornerTL, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: colors.primary }]} />

            {processing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.processingText}>Koppelen met school...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom Helper Controls */}
        <View style={styles.bottomControls}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.systemScannerBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
              onPress={openNativeScanner}
            >
              <Text style={styles.systemScannerText}>⚡ Open Apple Scanner</Text>
            </TouchableOpacity>
          )}

          <View style={styles.fallbackRow}>
            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={() => setManualModalVisible(true)}
            >
              <Text style={styles.secondaryActionText}>✏️ Handmatig</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={() => navigation.navigate('SchoolSearch')}
            >
              <Text style={styles.secondaryActionText}>🏫 Zoek School</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Manual Input Modal */}
      <Modal visible={manualModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Handmatig Koppelen</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              Plak de koppelcode of het webadres van je school (bijv. https://locra.pieteroosterling.online).
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="Plak QR data of school URL..."
              placeholderTextColor={colors.textMuted}
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setManualModalVisible(false)}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleManualSubmit}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Verbinden</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  altButton: {
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1
  },
  cancelLink: {
    marginTop: 18,
    padding: 8
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 20
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)'
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
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
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
    justifyContent: 'center',
    backgroundColor: 'transparent'
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
  bottomControls: {
    gap: 12
  },
  systemScannerBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  systemScannerText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700'
  },
  fallbackRow: {
    flexDirection: 'row',
    gap: 10
  },
  secondaryActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: 'rgba(0, 0, 0, 0.65)'
  },
  secondaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 24
  },
  modalCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    gap: 16
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800'
  },
  modalDesc: {
    fontSize: 14,
    lineHeight: 20
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15
  },
  modalBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1
  },
  modalConfirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10
  }
});
