import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { COLORS } from '@/constants/colors';
import { useRole } from '@/lib/useRole';
import { signOut } from '@/lib/auth';

export default function AdminDashboard() {
  const { isAdmin, loading } = useRole();

  async function handleLogout() {
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text style={styles.loadingText}>
          Loading Admin Dashboard...
        </Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="lock-closed-outline"
          size={45}
          color={COLORS.danger}
        />

        <Text style={styles.deniedTitle}>
          Access Denied
        </Text>

        <Text style={styles.deniedText}>
          This page is for administrators only.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons
          name="shield-checkmark"
          size={55}
          color={COLORS.primary}
        />
      </View>

      <Text style={styles.title}>
        Admin Dashboard
      </Text>

      <Text style={styles.subtitle}>
        QR-ATT Administration
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Administrator
        </Text>

        <Text style={styles.cardText}>
          Manage users, events, attendance, and reports.
        </Text>
      </View>

      <Pressable
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Ionicons
          name="log-out-outline"
          size={22}
          color={COLORS.danger}
        />

        <Text style={styles.logoutText}>
          Logout
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    padding: 24,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },

  iconContainer: {
    marginTop: 40,
    marginBottom: 15,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  card: {
    width: '100%',
    marginTop: 30,
    padding: 22,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  cardText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },

  logoutButton: {
    width: '100%',
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.danger,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.danger,
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
  },

  deniedTitle: {
    marginTop: 15,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  deniedText: {
    marginTop: 8,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});