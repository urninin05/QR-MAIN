import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/useRole';

export default function ReportsScreen() {
  const { isAdmin, loading: roleLoading } = useRole();

  const [totalUsers, setTotalUsers] = useState(0);
  const [students, setStudents] = useState(0);
  const [teachers, setTeachers] = useState(0);
  const [admins, setAdmins] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalAttendance, setTotalAttendance] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadReports() {
    setLoading(true);
    setError(null);

    const [
      usersResult,
      studentsResult,
      teachersResult,
      adminsResult,
      eventsResult,
      attendanceResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true }),

      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student'),

      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'teacher'),

      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin'),

      supabase
        .from('events')
        .select('id', { count: 'exact', head: true }),

      supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true }),
    ]);

    const firstError =
      usersResult.error ||
      studentsResult.error ||
      teachersResult.error ||
      adminsResult.error ||
      eventsResult.error ||
      attendanceResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setTotalUsers(usersResult.count ?? 0);
    setStudents(studentsResult.count ?? 0);
    setTeachers(teachersResult.count ?? 0);
    setAdmins(adminsResult.count ?? 0);
    setTotalEvents(eventsResult.count ?? 0);
    setTotalAttendance(attendanceResult.count ?? 0);

    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) {
      loadReports();
    }
  }, [isAdmin]);

  if (roleLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text style={styles.loadingText}>
          Loading reports...
        </Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons
          name="lock-closed-outline"
          size={40}
          color={COLORS.danger}
        />

        <Text style={styles.accessDenied}>
          Access denied.
        </Text>

        <Text style={styles.accessSubtext}>
          Administrator access is required.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>
        Reports
      </Text>

      <Text style={styles.subtitle}>
        Overall school event attendance summary.
      </Text>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons
            name="alert-circle-outline"
            size={32}
            color={COLORS.danger}
          />

          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Ionicons
                name="people-outline"
                size={30}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>
                Total Users
              </Text>

              <Text style={styles.number}>
                {totalUsers}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Ionicons
                name="school-outline"
                size={30}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>
                Students
              </Text>

              <Text style={styles.number}>
                {students}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Ionicons
                name="person-outline"
                size={30}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>
                Teachers
              </Text>

              <Text style={styles.number}>
                {teachers}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Ionicons
                name="shield-checkmark-outline"
                size={30}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>
                Administrators
              </Text>

              <Text style={styles.number}>
                {admins}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Ionicons
                name="calendar-outline"
                size={30}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>
                Total Events
              </Text>

              <Text style={styles.number}>
                {totalEvents}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Ionicons
                name="clipboard-outline"
                size={30}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>
                Attendance Records
              </Text>

              <Text style={styles.number}>
                {totalAttendance}
              </Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: 24,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },

  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardContent: {
    marginLeft: 16,
  },

  cardTitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },

  number: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  errorCard: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 24,
  },

  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },

  accessDenied: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },

  accessSubtext: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 5,
  },
});