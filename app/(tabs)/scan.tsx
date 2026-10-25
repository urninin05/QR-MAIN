
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { registerAttendance } from '@/lib/attendance';
import { useRole } from '@/lib/useRole';

export default function ScanScreen() {
  const { user } = useAuth();
  const { isStudent, loading: roleLoading } = useRole();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lastData, setLastData] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (roleLoading) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.subtitle}>Loading...</Text>
      </View>
    );
  }

  if (!isStudent) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.title}>Access Restricted</Text>
        <Text style={styles.subtitle}>
          Only students can scan attendance QR codes.
        </Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.subtitle}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.title}>Camera Permission Needed</Text>
        <Text style={styles.subtitle}>
          We need access to your camera to scan QR codes.
        </Text>

        <AppButton
          theme="primary"
          title="Grant Permission"
          icon="camera"
          onPress={requestPermission}
        />
      </View>
    );
  }

  const handleBarcodeScanned = async ({
    data,
  }: {
    data: string;
  }) => {
    if (processing || scanned) return;

    setScanned(true);
    setProcessing(true);
    setLastData(data);
    setMessage('Checking QR code and event time...');
    setSuccess(false);

    try {
      if (!user?.id) {
        setMessage('Please log in again before scanning.');
        return;
      }

      const result = await registerAttendance(data, user.id);

      setMessage(result.message);
      setSuccess(result.success);
    } catch (error: unknown) {
      console.error('Attendance registration error:', error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      setMessage(`Attendance error: ${errorMessage}`);
      setSuccess(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleScanAgain = () => {
    setScanned(false);
    setLastData(null);
    setMessage(null);
    setSuccess(false);
    setProcessing(false);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          {scanned ? 'QR Code detected!' : 'Point your camera at a QR code'}
        </Text>

        {scanned && message && (
          <Text
            style={[
              styles.scanResult,
              success ? styles.success : styles.error,
            ]}
          >
            {message}
          </Text>
        )}

        {scanned && lastData && (
          <Text style={styles.scanData}>
            {lastData}
          </Text>
        )}

        {processing && (
          <Text style={styles.processing}>
            Please wait...
          </Text>
        )}

        {scanned && !processing && (
          <AppButton
            theme="primary"
            title="Scan Again"
            icon="refresh"
            onPress={handleScanAgain}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  permissionContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  camera: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
},

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },

  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 60,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },

  overlayText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },

  scanResult: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
    lineHeight: 21,
  },

  success: {
    color: '#2E7D32',
  },

  error: {
    color: '#C62828',
  },

  scanData: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },

  processing: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
});
