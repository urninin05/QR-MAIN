
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme';
import type { ThemeColors } from '@/constants/colors';

type Preferences = {
  event_updates_enabled: boolean;
  attendance_reminders_enabled: boolean;
  push_enabled: boolean;
};

type AppNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  read_at: string | null;
  created_at: string;
};

const DEFAULT_PREFERENCES: Preferences = {
  event_updates_enabled: true,
  attendance_reminders_enabled: true,
  push_enabled: true,
};

export default function NotificationSettingsPanel() {
  const { user } = useAuth();
  const { colors } = useAppTheme();

  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);
  const [notifications, setNotifications] =
    useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof Preferences | null>(
    null
  );

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [preferenceResult, notificationResult] =
        await Promise.all([
          supabase
            .from('notification_preferences')
            .select(
              'event_updates_enabled, attendance_reminders_enabled, push_enabled'
            )
            .eq('user_id', user.id)
            .maybeSingle(),

          supabase
            .from('notifications')
            .select('id, title, body, type, read_at, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20),
        ]);

      if (preferenceResult.error) {
        throw preferenceResult.error;
      }

      if (notificationResult.error) {
        throw notificationResult.error;
      }

      if (preferenceResult.data) {
        setPreferences(preferenceResult.data);
      } else {
        const { data, error } = await supabase
          .from('notification_preferences')
          .upsert(
            { user_id: user.id, ...DEFAULT_PREFERENCES },
            { onConflict: 'user_id' }
          )
          .select(
            'event_updates_enabled, attendance_reminders_enabled, push_enabled'
          )
          .single();

        if (error) throw error;
        setPreferences(data);
      }

      setNotifications(notificationResult.data ?? []);
    } catch (error) {
      console.error('Notification loading failed:', error);
      Alert.alert(
        'Notifications',
        'Could not load notification settings. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`my-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, loadNotifications]);

  const updatePreference = async (
    key: keyof Preferences,
    enabled: boolean
  ) => {
    if (!user || savingKey) return;

    const previous = preferences;
    const updated = { ...preferences, [key]: enabled };

    setPreferences(updated);
    setSavingKey(key);

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert(
          {
            user_id: user.id,
            ...updated,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;
    } catch (error) {
      setPreferences(previous);
      console.error('Saving notification preference failed:', error);

      Alert.alert(
        'Save Failed',
        'Your notification preference could not be saved.'
      );
    } finally {
      setSavingKey(null);
    }
  };

  const markAsRead = async (item: AppNotification) => {
    if (!user || item.read_at) return;

    const readAt = new Date().toISOString();

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', item.id)
      .eq('user_id', user.id);

    if (error) {
      Alert.alert('Error', 'Could not mark notification as read.');
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === item.id
          ? { ...notification, read_at: readAt }
          : notification
      )
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Loading notification settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PreferenceRow
        title="Event Updates"
        description="Receive updates about events."
        value={preferences.event_updates_enabled}
        disabled={savingKey !== null}
        colors={colors}
        onChange={(value) =>
          void updatePreference('event_updates_enabled', value)
        }
      />

      <View style={styles.divider} />

      <PreferenceRow
        title="Attendance Reminders"
        description="Receive attendance-related reminders."
        value={preferences.attendance_reminders_enabled}
        disabled={savingKey !== null}
        colors={colors}
        onChange={(value) =>
          void updatePreference('attendance_reminders_enabled', value)
        }
      />

      <View style={styles.divider} />

      <PreferenceRow
        title="Push Notifications"
        description="Allow push delivery to registered devices."
        value={preferences.push_enabled}
        disabled={savingKey !== null}
        colors={colors}
        onChange={(value) =>
          void updatePreference('push_enabled', value)
        }
      />

      <Text style={styles.historyTitle}>Notification History</Text>

      {notifications.length === 0 ? (
        <Text style={styles.muted}>
          No notifications yet.
        </Text>
      ) : (
        notifications.map((item) => (
          <Pressable
            key={item.id}
            style={[
              styles.notification,
              !item.read_at && styles.unread,
            ]}
            onPress={() => void markAsRead(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.read_at ? 'Read' : 'Unread'}`}
          >
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>
                {item.title}
              </Text>
              {!item.read_at && (
                <View style={styles.unreadDot} />
              )}
            </View>

            <Text style={styles.body}>{item.body}</Text>

            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

function PreferenceRow({
  title,
  description,
  value,
  disabled,
  colors,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  disabled: boolean;
  colors: ThemeColors;
  onChange: (value: boolean) => void;
}) {
  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceInfo}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.muted}>{description}</Text>
      </View>

      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{
          false: colors.border,
          true: colors.primary,
        }}
        thumbColor={colors.white}
        accessibilityLabel={title}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: 8,
    },
    loading: {
      paddingVertical: 20,
      alignItems: 'center',
      gap: 10,
    },
    preferenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
    },
    preferenceInfo: {
      flex: 1,
      gap: 4,
    },
    preferenceTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    muted: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    historyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 20,
      marginBottom: 8,
    },
    notification: {
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      gap: 6,
    },
    unread: {
      backgroundColor: colors.background,
      borderColor: colors.primary,
    },
    notificationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    notificationTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    body: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textPrimary,
    },
    date: {
      fontSize: 11,
      color: colors.textSecondary,
    },
  });
}
