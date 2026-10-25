
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';

export type NotificationPreferences = {
  event_updates_enabled: boolean;
  attendance_reminders_enabled: boolean;
  push_enabled: boolean;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export async function loadNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select(
      'event_updates_enabled, attendance_reminders_enabled, push_enabled'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const { data: created, error: insertError } = await supabase
      .from('notification_preferences')
      .insert({ user_id: userId })
      .select(
        'event_updates_enabled, attendance_reminders_enabled, push_enabled'
      )
      .single();

    if (insertError) throw insertError;
    return created;
  }

  return data;
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
) {
  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) throw error;
}

export async function registerPushNotifications(userId: string) {
  // Push tokens require a physical device and native push setup.
  if (!Device.isDevice) {
    throw new Error(
      'Use a physical phone to register for push notifications.'
    );
  }

  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    throw new Error(
      'EAS project ID is missing. Configure extra.eas.projectId in your app config.'
    );
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    throw new Error(
      'Notification permission was not granted. Enable notifications in your device settings.'
    );
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  const { error } = await supabase
    .from('expo_push_tokens')
    .upsert(
      {
        user_id: userId,
        expo_push_token: tokenResult.data,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'expo_push_token' }
    );

  if (error) throw error;

  return tokenResult.data;
}

export async function getMyNotifications(
  limit = 50
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, type, data, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []) as AppNotification[];
}

export async function markNotificationAsRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function createMyTestNotification(
  userId: string
) {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title: 'QR Attendance',
      body: 'Your notification system is connected successfully.',
      type: 'general',
    });

  if (error) throw error;
}
