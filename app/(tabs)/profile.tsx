import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import { getProfile, updateProfile } from '@/lib/profiles';

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [draftName, setDraftName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadProfile = async () => {
        if (!user) return;

        setLoading(true);

        const profile = await getProfile(user.id);

        if (active && profile) {
          setFullName(profile.full_name ?? '');
          setDraftName(profile.full_name ?? '');
          setRole(profile.role);
        }

        if (active) {
          setLoading(false);
        }
      };

      loadProfile();

      return () => {
        active = false;
      };
    }, [user])
  );

  const handleSaveName = async () => {
    if (!user) return;

    if (!draftName.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }

    setSaving(true);

    const { error } = await updateProfile(user.id, {
      full_name: draftName.trim(),
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    setFullName(draftName.trim());
    Alert.alert('Success', 'Name updated successfully.');
  };

  const handleSignOut = async () => {
    setLoading(true);

    try {
      await signOut();
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      {user && (
        <View style={styles.infoCard}>
          <Text style={styles.label}>Full Name</Text>

          <TextInput
            style={styles.input}
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Enter your full name"
            placeholderTextColor={COLORS.textSecondary}
            editable={!saving}
          />

          <Text style={styles.label}>Role</Text>
          <Text style={styles.role}>
            {role === 'teacher' ? 'Teacher' : 'Student'}
          </Text>

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email}</Text>

          <Text style={styles.label}>User ID</Text>
          <Text style={styles.valueSmall}>{user.id}</Text>

          <AppButton
            title={saving ? 'Saving...' : 'Save Name'}
            icon="save-outline"
            onPress={handleSaveName}
          />
        </View>
      )}

      <AppButton
        title="Sign Out"
        icon="log-out-outline"
        onPress={handleSignOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },

  input: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
  },

  value: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  valueSmall: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  role: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
});