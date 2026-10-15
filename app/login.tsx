import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { signIn } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await signIn(
        email.trim(),
        password
      );

      if (authError) {
        setError(authError.message);
        return;
      }

      if (!data.user) {
        setError('Login successful, but no user was found.');
        return;
      }

      // Get the user's role
      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        return;
      }

      // ADMIN → Admin Dashboard
      if (profile?.role === 'admin') {
        router.replace('/admin');
        return;
      }

      // STUDENT / TEACHER → Normal tabs
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(
        err?.message || 'Something went wrong during login.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
        },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Header title="QR Attendance" />
          </View>

          <Text style={styles.title}>
            Welcome Back
          </Text>

          <Text style={styles.subtitle}>
            Sign in to record your attendance
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>
              Email
            </Text>

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your.email@school.edu"
              placeholderTextColor={
                COLORS.textSecondary
              }
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
            />

            <Text style={styles.label}>
              Password
            </Text>

            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={
                COLORS.textSecondary
              }
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {error && (
              <Text style={styles.error}>
                {error}
              </Text>
            )}

            {loading ? (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={styles.loader}
              />
            ) : (
              <AppButton
                theme="primary"
                title="Sign In"
                icon="log-in-outline"
                onPress={handleLogin}
              />
            )}
          </View>

          <Link
            href="/register"
            style={styles.link}
          >
            Don't have an account? Sign Up
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },

  headerContainer: {
    marginBottom: 20,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 28,
  },

  form: {
    width: '100%',
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 7,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 18,
  },

  error: {
    color: COLORS.danger,
    fontSize: 13,
    marginBottom: 15,
  },

  loader: {
    marginVertical: 15,
  },

  link: {
    textAlign: 'center',
    color: COLORS.primary,
    fontSize: 14,
    marginTop: 24,
  },
});