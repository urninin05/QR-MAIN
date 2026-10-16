
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';

type ReportStats = {
  users: number;
  students: number;
  teachers: number;
  admins: number;
  events: number;
  attendance: number;
};

export default function Reports() {
  const [stats, setStats] = useState<ReportStats>({
    users: 0,
    students: 0,
    teachers: 0,
    admins: 0,
    events: 0,
    attendance: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    setError('');

    const [usersResult, eventsResult, attendanceResult] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('id, role'),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('attendance')
          .select('student_id', { count: 'exact', head: true }),
      ]);

    const issue =
      usersResult.error ||
      eventsResult.error ||
      attendanceResult.error;

    if (issue) {
      setError(issue.message);
    } else {
      const profiles = usersResult.data ?? [];

      setStats({
        users: profiles.length,
        students: profiles.filter((user) => user.role === 'student').length,
        teachers: profiles.filter((user) => user.role === 'teacher').length,
        admins: profiles.filter((user) => user.role === 'admin').length,
        events: eventsResult.count ?? 0,
        attendance: attendanceResult.count ?? 0,
      });
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const reportItems = [
    {
      title: 'Total Users',
      value: stats.users,
      icon: 'people-outline' as const,
    },
    {
      title: 'Students',
      value: stats.students,
      icon: 'school-outline' as const,
    },
    {
      title: 'Teachers',
      value: stats.teachers,
      icon: 'person-outline' as const,
    },
    {
      title: 'Administrators',
      value: stats.admins,
      icon: 'shield-checkmark-outline' as const,
    },
    {
      title: 'Total Events',
      value: stats.events,
      icon: 'calendar-outline' as const,
    },
    {
      title: 'Attendance Records',
      value: stats.attendance,
      icon: 'clipboard-outline' as const,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.pageLabel}>Reports</Text>

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Reports</Text>
          <Text style={styles.subtitle}>
            Overall school event attendance summary.
          </Text>
        </View>

        <Pressable
          style={styles.refreshButton}
          onPress={() => {
            setRefreshing(true);
            void loadReports();
          }}
          accessibilityLabel="Refresh reports"
        >
          <Ionicons
            name="refresh-outline"
            size={21}
            color={COLORS.primary}
          />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.subtitle}>Loading reports...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <Ionicons
            name="alert-circle-outline"
            size={25}
            color={COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              void loadReports();
            }}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadReports();
              }}
            />
          }
        >
          {reportItems.map((item) => (
            <View key={item.title} style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons
                  name={item.icon}
                  size={27}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.cardText}>
                <Text style={styles.label}>{item.title}</Text>
                <Text style={styles.value}>{item.value}</Text>
              </View>
            </View>
          ))}

          <Text style={styles.footer}>
            Report totals are based on records currently accessible in
            Supabase.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  pageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 26,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  headerText: {
    flex: 1,
  },
  heading: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
    gap: 13,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 86,
    gap: 14,
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  cardText: {
    flex: 1,
    gap: 5,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  errorCard: {
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: 12,
    gap: 12,
  },
  errorText: {
    color: COLORS.danger,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footer: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
});
