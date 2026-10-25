
import { useEffect } from 'react';
import {
  Stack,
  useRouter,
  useSegments,
  useRootNavigationState,
} from 'expo-router';
import * as Notifications from 'expo-notifications';

import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';
import { ThemeProvider } from '@/lib/theme';
import PushRegistration from '@/components/PushRegistration';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  const { session, loading } = useAuth();

  useEffect(() => {
    if (!navigationState?.key || loading) {
      return;
    }

    let active = true;

    const checkAuthentication = async () => {
      const firstSegment = segments[0] as string | undefined;

      const isLoginOrRegister =
        firstSegment === 'login' ||
        firstSegment === 'register';

      if (!session) {
        if (
          firstSegment !== 'login' &&
          firstSegment !== 'register'
        ) {
          router.replace('/login');
        }
        return;
      }

      const profile = await getProfile(session.user.id);

      if (!active) return;

      if (!profile) {
        router.replace('/login');
        return;
      }

      const dashboard =
        profile.role === 'admin'
          ? '/admin'
          : profile.role === 'teacher'
            ? '/(tabs)/teacher'
            : '/(tabs)';

      if (isLoginOrRegister || !firstSegment) {
        router.replace(dashboard);
        return;
      }

      if (
        profile.role === 'admin' &&
        firstSegment !== 'admin'
      ) {
        router.replace('/admin');
        return;
      }

      if (
        profile.role !== 'admin' &&
        firstSegment === 'admin'
      ) {
        router.replace(dashboard);
      }
    };

    checkAuthentication().catch((error) => {
      console.error('Authentication redirect failed:', error);
    });

    return () => {
      active = false;
    };
  }, [
    navigationState?.key,
    loading,
    session,
    segments,
    router,
  ]);

  return (
    <ThemeProvider>
      <PushRegistration />

      <Stack
        initialRouteName="login"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" />
      </Stack>
    </ThemeProvider>
  );
}
