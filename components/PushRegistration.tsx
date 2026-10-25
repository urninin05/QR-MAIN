
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function PushRegistration() {
  const { session } = useAuth();

  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId || Platform.OS === 'web') {
      return;
    }

    let cancelled = false;

    async function register() {
      try {
        if (!Device.isDevice) {
          console.log(
            'Push notifications require a physical device.'
          );
          return;
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(
            'default',
            {
              name: 'Default',
              importance: Notifications.AndroidImportance.MAX,
              sound: 'default',
            }
          );
        }

        const currentPermission =
          await Notifications.getPermissionsAsync();

        let status = currentPermission.status;

        if (status !== 'granted') {
          const requested =
            await Notifications.requestPermissionsAsync();

          status = requested.status;
        }

        if (status !== 'granted') {
          console.log('Notification permission was not granted.');
          return;
        }

        const projectId =
          Constants.easConfig?.projectId ??
          Constants.expoConfig?.extra?.eas?.projectId;

        if (!projectId) {
          throw new Error('EAS project ID was not found.');
        }

        const tokenResult =
          await Notifications.getExpoPushTokenAsync({
            projectId,
          });

        if (cancelled) return;

        const { error } = await supabase
          .from('expo_push_tokens')
          .upsert(
            {
              user_id: userId,
              expo_push_token: tokenResult.data,
              platform: Platform.OS,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'expo_push_token',
            }
          );

        if (error) throw error;

        console.log('Push token registered successfully.');
      } catch (error) {
        console.warn(
          'Push notification registration failed:',
          error
        );
      }
    }

    void register();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  return null;
}
