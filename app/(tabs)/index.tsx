import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';

export default function Index() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Header title="QR Attendance" />
      </View>

      <View style={styles.bodyContainer}>
        <Text style={styles.mainTitle}>School Event Attendance</Text>

        <Text style={styles.subtitle}>
          Scan QR Codes to record attendance during school activities.
        </Text>
      </View>

      <View style={styles.footerContainer}>
        <AppButton
          theme="primary"
          title="Scan QR Code"
          icon="qr-code-outline"
          onPress={() => router.push('/scan')}
        />

        <AppButton
          title="Attendance History"
          icon="time-outline"
          onPress={() => router.push('/history')}
        />

        <AppButton
          title="Profile"
          icon="person-outline"
          onPress={() => router.push('/profile')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'stretch',
  },

  headerContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    marginBottom: 32,
  },

  bodyContainer: {
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    marginBottom: 24,
  },

  mainTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'left',
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'left',
  },

  footerContainer: {
    paddingHorizontal: 24,
    width: '100%',
  },
});