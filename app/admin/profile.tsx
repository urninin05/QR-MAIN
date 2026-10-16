import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/useRole';

type AdminProfile = {
  full_name: string;
  email: string;
  role: string;
};

export default function AdminProfileScreen() {
  const { isAdmin, loading: roleLoading } = useRole();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email, role')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data.role !== 'admin') {
        setProfile(null);
        return;
      }

      const loadedProfile: AdminProfile = {
        full_name: data.full_name ?? '',
        email: data.email ?? user.email ?? '',
        role: data.role,
      };

      setProfile(loadedProfile);
      setFullName(loadedProfile.full_name);
    } catch (error) {
      console.error('Profile loading failed:', error);
      Alert.alert(
        'Profile Error',
        error instanceof Error
          ? error.message
          : 'Unable to load your profile.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!roleLoading && isAdmin) {
      void loadProfile();
    } else if (!roleLoading && !isAdmin) {
      setLoading(false);
    }
  }, [isAdmin, roleLoading, loadProfile]);

  async function handleSave() {
    if (!fullName.trim()) {
      Alert.alert('Missing Name', 'Please enter your full name.');
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.replace('/login');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);

      if (error) throw error;

      setProfile((current) =>
        current
          ? { ...current, full_name: fullName.trim() }
          : current,
      );

      Alert.alert('Success', 'Your profile has been updated.');
    } catch (error) {
      console.error('Profile update failed:', error);
      Alert.alert(
        'Save Failed',
        error instanceof Error
          ? error.message
          : 'Unable to save profile changes.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;

    try {
      setSigningOut(true);

      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      router.replace('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
      Alert.alert(
        'Sign Out Failed',
        error instanceof Error
          ? error.message
          : 'Unable to sign out. Please try again.',
      );
    } finally {
      setSigningOut(false);
    }
  }

  if (roleLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.mutedText}>Loading profile...</Text>
      </View>
    );
  }

  if (!isAdmin || !profile) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="lock-closed-outline"
          size={42}
          color={COLORS.danger}
        />
        <Text style={styles.title}>Profile Unavailable</Text>
        <Text style={styles.mutedText}>
          Please log in with an administrator account.
        </Text>

        <Pressable
          onPress={() => router.replace('/login')}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  const initial = fullName.trim().charAt(0).toUpperCase() || 'A';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.title}>My Profile</Text>
          <Text style={styles.subtitle}>
            Manage your administrator account.
          </Text>
        </View>

        <Pressable
          onPress={() => void loadProfile()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Refresh profile"
        >
          <Ionicons
            name="refresh-outline"
            size={22}
            color={COLORS.primary}
          />
        </Pressable>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <Text style={styles.profileName}>
          {fullName.trim() || 'Administrator'}
        </Text>
        <Text style={styles.profileEmail}>{profile.email}</Text>

        <View style={styles.roleBadge}>
          <Ionicons
            name="shield-checkmark"
            size={15}
            color={COLORS.primary}
          />
          <Text style={styles.roleText}>Administrator</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Account Information</Text>

        <Text style={styles.label}>Full Name</Text>
        <View style={styles.inputContainer}>
          <Ionicons
            name="person-outline"
            size={20}
            color={COLORS.textSecondary}
          />
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.input}
            editable={!saving && !signingOut}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        <Text style={styles.label}>Email Address</Text>
        <View style={[styles.inputContainer, styles.readOnlyInput]}>
          <Ionicons
            name="mail-outline"
            size={20}
            color={COLORS.textSecondary}
          />
          <TextInput
            value={profile.email}
            style={styles.input}
            editable={false}
            selectTextOnFocus
          />
          <Ionicons
            name="lock-closed-outline"
            size={17}
            color={COLORS.textSecondary}
          />
        </View>

        <Text style={styles.helperText}>
          Your email address cannot be changed here.
        </Text>

        <Pressable
          onPress={handleSave}
          disabled={saving || signingOut}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            (saving || signingOut) && styles.disabledButton,
          ]}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name="save-outline"
                size={19}
                color="#FFFFFF"
              />
              <Text style={styles.primaryButtonText}>Save Changes</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.securityCard}>
        <View style={styles.securityIcon}>
          <Ionicons
            name="shield-checkmark-outline"
            size={23}
            color={COLORS.primary}
          />
        </View>
        <View style={styles.securityText}>
          <Text style={styles.sectionTitle}>Account Security</Text>
          <Text style={styles.helperText}>
            Sign out when you have finished managing attendance records.
          </Text>
        </View>
      </View>

      <Pressable
        onPress={handleSignOut}
        disabled={signingOut}
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.pressed,
          signingOut && styles.disabledButton,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Sign out of administrator account"
      >
        {signingOut ? (
          <ActivityIndicator color={COLORS.danger} />
        ) : (
          <>
            <Ionicons
              name="log-out-outline"
              size={21}
              color={COLORS.danger}
            />
            <Text style={styles.signOutText}>Sign Out</Text>
          </>
        )}
      </Pressable>

      <Text style={styles.footerText}>
        QR Attendance Management System
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: COLORS.background,
  },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  headingText: {
    flex: 1,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  mutedText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
  },
  profileCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    marginBottom: 18,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.primary,
  },
  profileName: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: COLORS.textPrimary,
  },
  profileEmail: {
    marginTop: 5,
    fontSize: 13,
    textAlign: 'center',
    color: COLORS.textSecondary,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 13,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.background,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  formCard: {
    padding: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  label: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    backgroundColor: COLORS.card,
  },
  readOnlyInput: {
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  primaryButton: {
    minHeight: 48,
    marginTop: 22,
    paddingHorizontal: 16,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.72,
  },
  disabledButton: {
    opacity: 0.55,
  },
  securityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    marginTop: 18,
    padding: 17,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  securityIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: COLORS.background,
  },
  securityText: {
    flex: 1,
    gap: 5,
  },
  signOutButton: {
    minHeight: 52,
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.danger,
  },
  
  footerText: {
    marginTop: 22,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});