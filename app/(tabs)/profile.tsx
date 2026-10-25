import NotificationSettingsPanel from '@/components/NotificationSettingsPanel';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';

import AppButton from '@/components/AppButton';
import type { ThemeColors } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import { getProfile, updateProfile } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme';

const BUCKET = 'profile-pictures';

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { isDark, setDarkMode, colors } = useAppTheme();

  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

  const [draftName, setDraftName] = useState('');
  const [role, setRole] = useState('student');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Expandable settings sections
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const [securityExpanded, setSecurityExpanded] = useState(false);
  const [notificationsExpanded, setNotificationsExpanded] = useState(false);

  // Notification preferences (currently UI-only)
  const [eventNotifications, setEventNotifications] = useState(true);
  const [attendanceReminders, setAttendanceReminders] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const profile = await getProfile(user.id);

      if (profile) {
        setDraftName(profile.full_name ?? '');
        setRole(profile.role);

        const path = profile.avatar_url ?? null;
        setAvatarPath(path);

        if (path) {
          const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(path, 3600);

          if (!error && data?.signedUrl) {
            setAvatarUrl(data.signedUrl);
          } else {
            setAvatarUrl(null);
            console.error('Avatar URL error:', error?.message);
          }
        } else {
          setAvatarUrl(null);
        }
      }
    } catch (error) {
      console.error('Profile loading error:', error);
      Alert.alert('Error', 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleChoosePicture = async () => {
    if (!user || uploading || saving) return;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          'Allow gallery access to choose a profile picture.'
        );
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
        Alert.alert('Error', 'Could not read the selected picture.');
        return;
      }

      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert(
          'Image too large',
          'Please choose an image under 5 MB.'
        );
        return;
      }

      const contentType =
        asset.mimeType === 'image/png'
          ? 'image/png'
          : asset.mimeType === 'image/webp'
            ? 'image/webp'
            : 'image/jpeg';

      const extension =
        contentType === 'image/png'
          ? 'png'
          : contentType === 'image/webp'
            ? 'webp'
            : 'jpg';

      const path = `${user.id}/avatar.${extension}`;

      setUploading(true);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, decode(asset.base64), {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        Alert.alert('Upload failed', uploadError.message);
        return;
      }

      const { data, error: urlError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 3600);

      if (urlError || !data?.signedUrl) {
        Alert.alert(
          'Error',
          'Picture uploaded, but could not display it.'
        );
        return;
      }

      setAvatarPath(path);
      setAvatarUrl(data.signedUrl);

      Alert.alert(
        'Picture selected',
        'Tap Save Changes to save your profile picture.'
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Could not select picture.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!draftName.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }

    setSaving(true);

    try {
      const { error } = await updateProfile(user.id, {
        full_name: draftName.trim(),
        avatar_url: avatarPath,
      });

      if (error) {
        Alert.alert('Save failed', error);
        return;
      }

      Alert.alert('Success', 'Your profile has been updated.');
      await loadProfile();
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Could not save profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    const email = user?.email;

    if (!email) {
      Alert.alert('Error', 'Your account email is unavailable.');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email
      );

      if (error) {
        Alert.alert('Password Reset Failed', error.message);
        return;
      }

      Alert.alert(
        'Check Your Email',
        `If password reset is available for ${email}, follow the instructions sent to your inbox.`
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Could not request a password reset.'
      );
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await signOut();
      router.replace('/login');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Failed to sign out.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>My Profile</Text>
      <Text style={styles.subtitle}>
        Manage your personal information and preferences.
      </Text>

      {/* Profile header */}
      <View style={styles.headerCard}>
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons
                name="person"
                size={42}
                color={colors.primary}
              />
            </View>
          )}
        </View>

        <Text style={styles.name}>
          {draftName.trim() || 'Your Name'}
        </Text>

        <Text style={styles.email}>
          {user?.email ?? ''}
        </Text>

        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </Text>
        </View>

        <AppButton
          title={uploading ? 'Uploading...' : 'Change Profile Picture'}
          icon="camera-outline"
          onPress={handleChoosePicture}
        />
      </View>

      {/* Personal information */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Personal Information
        </Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={draftName}
          onChangeText={setDraftName}
          placeholder="Enter your full name"
          placeholderTextColor={colors.textSecondary}
          editable={!saving && !uploading}
        />

        <Text style={styles.label}>Email Address</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>
            {user?.email || 'No email'}
          </Text>
          <Ionicons
            name="lock-closed-outline"
            size={16}
            color={colors.textSecondary}
          />
        </View>

        <Text style={styles.label}>Role</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </Text>
          <Ionicons
            name="lock-closed-outline"
            size={16}
            color={colors.textSecondary}
          />
        </View>

        <View style={styles.saveButtonContainer}>
          <AppButton
            title={saving ? 'Saving...' : 'Save Changes'}
            icon="save-outline"
            onPress={handleSave}
          />
        </View>
      </View>

      {/* Settings */}
      <Text style={styles.settingsHeading}>Settings</Text>
      <Text style={styles.settingsSubtitle}>
        Tap a section to view its options.
      </Text>

      {/* Appearance */}
      <View style={styles.card}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => setAppearanceExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: appearanceExpanded }}
        >
          <View style={styles.sectionIcon}>
            <Ionicons
              name="color-palette-outline"
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.accordionText}>
            <Text style={styles.sectionTitle}>Appearance</Text>
            <Text style={styles.muted}>
              Light Mode and Dark Mode
            </Text>
          </View>

          <Ionicons
            name={appearanceExpanded ? 'chevron-up' : 'chevron-down'}
            size={21}
            color={colors.textSecondary}
          />
        </Pressable>

        {appearanceExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Dark Mode</Text>
                <Text style={styles.muted}>
                  {isDark
                    ? 'Dark appearance is enabled.'
                    : 'Use a darker appearance for the app.'}
                </Text>
              </View>

              <Switch
                value={isDark}
                onValueChange={(enabled) => {
                  void setDarkMode(enabled);
                }}
                trackColor={{
                  false: colors.border,
                  true: colors.primary,
                }}
                thumbColor={colors.white}
                accessibilityLabel="Toggle Dark Mode"
              />
            </View>
          </View>
        )}
      </View>

      {/* Account and Security */}
      <View style={styles.card}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => setSecurityExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: securityExpanded }}
        >
          <View style={styles.sectionIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.accordionText}>
            <Text style={styles.sectionTitle}>
              Account Security
            </Text>
            <Text style={styles.muted}>
              Password and account access
            </Text>
          </View>

          <Ionicons
            name={securityExpanded ? 'chevron-up' : 'chevron-down'}
            size={21}
            color={colors.textSecondary}
          />
        </Pressable>

        {securityExpanded && (
          <View style={styles.expandedContent}>
            <Pressable
              style={styles.actionRow}
              onPress={handlePasswordReset}
            >
              <Ionicons
                name="key-outline"
                size={21}
                color={colors.primary}
              />

              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>
                  Reset Password
                </Text>
                <Text style={styles.muted}>
                  Request password reset instructions by email.
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={19}
                color={colors.textSecondary}
              />
            </Pressable>

            <View style={styles.signOutContainer}>
              <AppButton
                title="Sign Out"
                icon="log-out-outline"
                onPress={handleSignOut}
              />
            </View>
          </View>
        )}
      </View>

      {/* Notifications */}
      <View style={styles.card}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() =>
            setNotificationsExpanded((value) => !value)
          }
          accessibilityRole="button"
          accessibilityState={{ expanded: notificationsExpanded }}
        >
          <View style={styles.sectionIcon}>
            <Ionicons
              name="notifications-outline"
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.accordionText}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <Text style={styles.muted}>
              Event updates and attendance reminders
            </Text>
          </View>

          <Ionicons
            name={
              notificationsExpanded ? 'chevron-up' : 'chevron-down'
            }
            size={21}
            color={colors.textSecondary}
          />
        </Pressable>

        {notificationsExpanded && (
          <View style={styles.expandedContent}>
            <NotificationSettingsPanel/>
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>
                  Event Updates
                </Text>
                <Text style={styles.muted}>
                  Preference for event-related updates.
                </Text>
              </View>

              <Switch
                value={eventNotifications}
                onValueChange={setEventNotifications}
                trackColor={{
                  false: colors.border,
                  true: colors.primary,
                }}
                thumbColor={colors.white}
                accessibilityLabel="Toggle event updates preference"
              />
            </View>

            <View style={styles.settingDivider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>
                  Attendance Reminders
                </Text>
                <Text style={styles.muted}>
                  Preference for attendance reminders.
                </Text>
              </View>

              <Switch
                value={attendanceReminders}
                onValueChange={setAttendanceReminders}
                trackColor={{
                  false: colors.border,
                  true: colors.primary,
                }}
                thumbColor={colors.white}
                accessibilityLabel="Toggle attendance reminders preference"
              />
            </View>

            <Text style={styles.note}>
              These notification switches are preferences only for now.
              Actual notifications and saved preferences still need to
              be connected.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(COLORS: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    container: {
      padding: 20,
      paddingBottom: 40,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.background,
      gap: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    subtitle: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginTop: 5,
      marginBottom: 20,
    },
    headerCard: {
      backgroundColor: COLORS.card,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
      marginBottom: 18,
      gap: 10,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    avatarContainer: {
      marginBottom: 4,
    },
    avatar: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor: COLORS.border,
    },
    avatarPlaceholder: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor: COLORS.background,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      fontSize: 19,
      fontWeight: '700',
      color: COLORS.textPrimary,
      textAlign: 'center',
    },
    email: {
      fontSize: 13,
      color: COLORS.textSecondary,
      textAlign: 'center',
    },
    roleBadge: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: COLORS.background,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: 20,
    },
    roleText: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    card: {
      backgroundColor: COLORS.card,
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.textSecondary,
      marginTop: 12,
      marginBottom: 6,
    },
    input: {
      backgroundColor: COLORS.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 15,
      color: COLORS.textPrimary,
    },
    readOnlyField: {
      minHeight: 42,
      backgroundColor: COLORS.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    readOnlyText: {
      flex: 1,
      fontSize: 14,
      color: COLORS.textPrimary,
    },
    muted: {
      fontSize: 13,
      color: COLORS.textSecondary,
      lineHeight: 19,
    },
    saveButtonContainer: {
      marginTop: 30,
      paddingTop: 12,
    },
    settingsHeading: {
      fontSize: 21,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginTop: 8,
      marginBottom: 5,
    },
    settingsSubtitle: {
      fontSize: 13,
      color: COLORS.textSecondary,
      marginBottom: 14,
    },
    accordionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 48,
    },
    sectionIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: COLORS.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accordionText: {
      flex: 1,
      gap: 4,
    },
    expandedContent: {
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      marginTop: 14,
      paddingTop: 8,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
    },
    settingInfo: {
      flex: 1,
      gap: 4,
    },
    settingTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textPrimary,
    },
    settingDivider: {
      height: 1,
      backgroundColor: COLORS.border,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
    },
    signOutContainer: {
      marginTop: 12,
    },
    note: {
      fontSize: 12,
      color: COLORS.textSecondary,
      lineHeight: 18,
      marginTop: 8,
    },
  });
}
