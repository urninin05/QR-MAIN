import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { decode } from 'base64-arraybuffer';

import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/useRole';

const BUCKET = 'profile-pictures';

type AdminProfile = {
  full_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
};

type ActivityLog = {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
};

export default function AdminProfileScreen() {
  const { isAdmin, loading: roleLoading } = useRole();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadActivityLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('id, action, details, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setActivityLogs((data ?? []) as ActivityLog[]);
    } catch (error) {
      console.error('Activity log loading failed:', error);
      setActivityLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const recordActivity = useCallback(async (action: string, details?: string) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      const { error } = await supabase.from('admin_activity_logs').insert({
        admin_id: user.id,
        action,
        details: details ?? null,
      });
      if (error) throw error;
      await loadActivityLogs();
    } catch (error) {
      // Logging should not prevent the main profile action from succeeding.
      console.error('Could not record admin activity:', error);
    }
  }, [loadActivityLogs]);

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
        .select('full_name, email, role, avatar_url')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data.role !== 'admin') {
        setProfile(null);
        return;
      }

      const loaded: AdminProfile = {
        full_name: data.full_name ?? '',
        email: data.email ?? user.email ?? '',
        role: data.role,
        avatar_url: data.avatar_url ?? null,
      };
      setProfile(loaded);
      setFullName(loaded.full_name);
      setAvatarPath(loaded.avatar_url);
      await loadActivityLogs();

      if (loaded.avatar_url) {
        const { data: signed, error: urlError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(loaded.avatar_url, 3600);
        setAvatarUrl(!urlError ? signed?.signedUrl ?? null : null);
      } else {
        setAvatarUrl(null);
      }

    } catch (error) {
      console.error('Admin profile loading failed:', error);
      Alert.alert(
        'Profile Error',
        error instanceof Error ? error.message : 'Unable to load your profile.',
      );
    } finally {
      setLoading(false);
    }
  }, [loadActivityLogs]);

  useEffect(() => {
    if (!roleLoading && isAdmin) void loadProfile();
    else if (!roleLoading && !isAdmin) setLoading(false);
  }, [isAdmin, roleLoading, loadProfile]);

  useFocusEffect(
    useCallback(() => {
      if (!roleLoading && isAdmin) void loadProfile();
    }, [isAdmin, roleLoading, loadProfile]),
  );

  async function handleSave() {
    if (!fullName.trim()) {
      Alert.alert('Missing Name', 'Please enter your full name.');
      return;
    }
    try {
      setSaving(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
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

      setProfile(current => current ? { ...current, full_name: fullName.trim() } : current);
      await recordActivity('Updated profile', 'Changed administrator full name.');
      Alert.alert('Success', 'Your profile has been updated.');
    } catch (error) {
      Alert.alert('Save Failed', error instanceof Error ? error.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChoosePicture() {
    if (uploading || saving) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow gallery access to choose a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Image Error', 'Could not read the selected picture.');
        return;
      }
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Image too large', 'Please choose an image under 5 MB.');
        return;
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('Please sign in again.');

      setUploading(true);
      const extension = (asset.mimeType?.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const path = `${user.id}/avatar.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, decode(asset.base64), {
          contentType: asset.mimeType || 'image/jpeg',
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: path })
        .eq('id', user.id);
      if (profileError) throw profileError;

      const { data: signed, error: signedError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 3600);
      if (signedError) throw signedError;

      setAvatarPath(path);
      setAvatarUrl(signed.signedUrl);
      setProfile(current => current ? { ...current, avatar_url: path } : current);
      await recordActivity('Changed profile photo', 'Uploaded a new administrator profile picture.');
      Alert.alert('Success', 'Profile picture updated.');
    } catch (error) {
      console.error('Profile picture upload failed:', error);
      Alert.alert(
        'Picture Upload Failed',
        error instanceof Error
          ? `${error.message}\n\nCheck that the profile-pictures Storage bucket exists and its policies allow this account to upload its own image.`
          : 'Unable to upload profile picture.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePicture() {
    if (!avatarPath || uploading) return;
    try {
      setUploading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('Please sign in again.');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);
      if (updateError) throw updateError;

      const { error: removeError } = await supabase.storage.from(BUCKET).remove([avatarPath]);
      if (removeError) console.warn('Could not remove old image:', removeError.message);

      setAvatarPath(null);
      setAvatarUrl(null);
      setProfile(current => current ? { ...current, avatar_url: null } : current);
      await recordActivity('Removed profile photo', 'Removed the administrator profile picture.');
      Alert.alert('Success', 'Profile picture removed.');
    } catch (error) {
      Alert.alert('Could not remove picture', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleChangePassword() {
    const email = profile?.email;
    if (!email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      await recordActivity('Requested password reset', 'Requested a password reset email.');
      Alert.alert('Password reset email sent', 'Check your email for the password reset link.');
    } catch (error) {
      Alert.alert('Password reset failed', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    try {
      setSigningOut(true);
      await recordActivity('Signed out', 'Administrator signed out of the app.');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/login');
    } catch (error) {
      Alert.alert('Sign Out Failed', error instanceof Error ? error.message : 'Unable to sign out.');
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
        <Ionicons name="lock-closed-outline" size={42} color={COLORS.danger} />
        <Text style={styles.title}>Profile Unavailable</Text>
        <Text style={styles.mutedText}>Please log in with an administrator account.</Text>
        <Pressable onPress={() => router.replace('/login')} style={styles.primaryButton}>
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
          <Text style={styles.subtitle}>Manage your administrator account.</Text>
        </View>
        <Pressable onPress={() => void loadProfile()} style={styles.iconButton} accessibilityLabel="Refresh profile">
          <Ionicons name="refresh-outline" size={22} color={COLORS.primary} />
        </Pressable>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <Pressable
            onPress={() => void handleChoosePicture()}
            disabled={uploading || saving}
            style={styles.cameraButton}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
          >
            {uploading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="camera" size={17} color="#FFFFFF" />}
          </Pressable>
        </View>

        <Text style={styles.profileName}>{fullName.trim() || 'Administrator'}</Text>
        <Text style={styles.profileEmail}>{profile.email}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="shield-checkmark" size={15} color={COLORS.primary} />
          <Text style={styles.roleText}>Administrator</Text>
        </View>

        <View style={styles.profileActions}>
          <Pressable onPress={() => void handleChoosePicture()} disabled={uploading} style={styles.secondaryButton}>
            <Ionicons name="image-outline" size={17} color={COLORS.primary} />
            <Text style={styles.secondaryButtonText}>{uploading ? 'Uploading...' : 'Change Photo'}</Text>
          </Pressable>
          {avatarPath ? (
            <Pressable onPress={() => void handleRemovePicture()} disabled={uploading} style={styles.secondaryButton}>
              <Ionicons name="trash-outline" size={17} color={COLORS.danger} />
              <Text style={[styles.secondaryButtonText, styles.dangerText]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Personal Information</Text>

        <Text style={styles.label}>Full Name</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
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
          <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
          <TextInput value={profile.email} style={styles.input} editable={false} selectTextOnFocus />
          <Ionicons name="lock-closed-outline" size={17} color={COLORS.textSecondary} />
        </View>
        <Text style={styles.helperText}>Your login email is read-only on this screen.</Text>

        <Pressable
          onPress={() => void handleSave()}
          disabled={saving || signingOut}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (saving || signingOut) && styles.disabledButton]}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : (
            <>
              <Ionicons name="save-outline" size={19} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Save Changes</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Account & Security</Text>
        <Pressable onPress={() => void handleChangePassword()} style={styles.menuRow}>
          <View style={styles.menuIcon}><Ionicons name="key-outline" size={21} color={COLORS.primary} /></View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Reset Password</Text>
            <Text style={styles.helperText}>Send a password reset link to your email.</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={COLORS.textSecondary} />
        </Pressable>
        <View style={styles.menuDivider} />
        <View style={styles.menuRow}>
          <View style={styles.menuIcon}><Ionicons name="shield-checkmark-outline" size={21} color={COLORS.primary} /></View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Administrator Access</Text>
            <Text style={styles.helperText}>Your role is managed securely by the system.</Text>
          </View>
          <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} />
        </View>
      </View>

      <View style={styles.formCard}>
        <View style={styles.activityHeading}>
          <Text style={styles.sectionTitle}>Admin Activity Logs</Text>
          <Pressable onPress={() => void loadActivityLogs()} accessibilityLabel="Refresh activity logs">
            <Ionicons name="refresh-outline" size={19} color={COLORS.primary} />
          </Pressable>
        </View>
        <Text style={styles.helperText}>Recent activity from your administrator account.</Text>
        {logsLoading ? (
          <View style={styles.logsState}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.helperText}>Loading activity...</Text>
          </View>
        ) : activityLogs.length === 0 ? (
          <View style={styles.logsState}>
            <Ionicons name="time-outline" size={22} color={COLORS.textSecondary} />
            <Text style={styles.helperText}>No activity recorded yet. Profile actions will appear here.</Text>
          </View>
        ) : (
          <View style={styles.activityList}>
            {activityLogs.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <View style={styles.menuDivider} /> : null}
                <View style={styles.activityItem}>
                  <View style={styles.menuIcon}>
                    <Ionicons name="time-outline" size={19} color={COLORS.primary} />
                  </View>
                  <View style={styles.menuText}>
                    <Text style={styles.menuTitle}>{item.action}</Text>
                    {item.details ? <Text style={styles.helperText}>{item.details}</Text> : null}
                    <Text style={styles.activityDate}>
                      {new Date(item.created_at).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={styles.menuDivider} />
        <View style={styles.menuRow}>
          <View style={styles.menuIcon}><Ionicons name="information-circle-outline" size={21} color={COLORS.primary} /></View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>QR Attendance Management System</Text>
            <Text style={styles.helperText}>Administrator profile and account settings.</Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => void handleSignOut()}
        disabled={signingOut}
        style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed, signingOut && styles.disabledButton]}
      >
        {signingOut ? <ActivityIndicator color={COLORS.danger} /> : (
          <>
            <Ionicons name="log-out-outline" size={21} color={COLORS.danger} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </>
        )}
      </Pressable>

      <Text style={styles.footerText}>QR Attendance Management System</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 20, paddingBottom: 48, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: COLORS.background },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 },
  headingText: { flex: 1 },
  title: { fontSize: 25, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { marginTop: 5, fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  mutedText: { marginTop: 8, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.card },
  profileCard: { alignItems: 'center', padding: 24, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, marginBottom: 18 },
  avatarWrap: { width: 96, height: 96, position: 'relative', marginBottom: 4 },
  avatarImage: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.background },
  avatarFallback: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, borderWidth: 2, borderColor: COLORS.border },
  avatarText: { fontSize: 36, fontWeight: '700', color: COLORS.primary },
  cameraButton: { position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.card },
  profileName: { marginTop: 12, fontSize: 20, fontWeight: '700', textAlign: 'center', color: COLORS.textPrimary },
  profileEmail: { marginTop: 5, fontSize: 13, textAlign: 'center', color: COLORS.textSecondary },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 13, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.background },
  roleText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  profileActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 9, marginTop: 16 },
  secondaryButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, backgroundColor: COLORS.background },
  secondaryButtonText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 14 },
  formCard: { padding: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, marginBottom: 18 },
  label: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  inputContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 13, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, backgroundColor: COLORS.card },
  readOnlyInput: { backgroundColor: COLORS.background },
  input: { flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 14, color: COLORS.textPrimary },
  helperText: { marginTop: 6, fontSize: 12, lineHeight: 18, color: COLORS.textSecondary },
  primaryButton: { minHeight: 48, marginTop: 22, paddingHorizontal: 16, borderRadius: 11, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  pressed: { opacity: 0.72 },
  disabledButton: { opacity: 0.55 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  menuIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: COLORS.background },
  menuText: { flex: 1, gap: 2 },
  menuTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  menuDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  signOutButton: { minHeight: 52, marginTop: 2, borderWidth: 1, borderColor: COLORS.danger, borderRadius: 12, backgroundColor: COLORS.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  signOutText: { fontSize: 15, fontWeight: '700', color: COLORS.danger },
  dangerText: { color: COLORS.danger },
  activityHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  logsState: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 16 },
  activityList: { marginTop: 12 },
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  activityDate: { marginTop: 4, fontSize: 11, color: COLORS.textSecondary },
  footerText: { marginTop: 22, marginBottom: 8, textAlign: 'center', fontSize: 12, color: COLORS.textSecondary },
});
