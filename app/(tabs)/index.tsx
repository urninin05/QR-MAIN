
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';

export default function Index() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<
    TeacherEventAttendance[]
  >([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setRecords([]);
      setTeacherEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const profile = await getProfile(user.id);
      const currentRole = profile?.role ?? 'student';

      setRole(currentRole);

      if (currentRole === 'teacher') {
        const events = await getTeacherEventAttendance(user.id);
        setTeacherEvents(events);
        setRecords([]);
      } else {
        const data = await getAttendanceHistory(user.id);
        setRecords(data);
        setTeacherEvents([]);
      }
    } catch (error) {
      console.error('Failed to load home attendance:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.welcomeCard}>
        <Text style={styles.eyebrow}>QR ATTENDANCE</Text>
        <Text style={styles.welcomeTitle}>Welcome back!</Text>
        <Text style={styles.welcomeText}>
          {role === 'teacher'
            ? 'Manage your events and monitor student attendance.'
            : 'Keep track of your attendance and stay updated with your school events.'}
        </Text>

        <Pressable
          style={styles.scanButton}
          onPress={() =>
            router.push(
              role === 'teacher'
                ? '/(tabs)/teacher'
                : '/(tabs)/scan'
            )
          }
        >
          <Text style={styles.scanButtonText}>
            {role === 'teacher'
              ? 'Manage Events'
              : '▦  Scan Attendance'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>
        {role === 'teacher' ? 'My Events' : 'My Attendance'}
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          {role === 'teacher'
            ? 'Total Events Created'
            : 'Total Recorded Attendance'}
        </Text>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <Text style={styles.summaryNumber}>
            {role === 'teacher'
              ? teacherEvents.length
              : records.length}
          </Text>
        )}

        <Text style={styles.summaryHint}>
          {role === 'teacher'
            ? 'Events created by your account'
            : 'Based on your saved attendance records'}
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {role === 'teacher'
            ? 'Recent Events'
            : 'Recent Attendance'}
        </Text>

        <Pressable
          onPress={() =>
            router.push(
              role === 'teacher'
                ? '/(tabs)/teacher'
                : '/(tabs)/history'
            )
          }
        >
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loader}
        />
      ) : role === 'teacher' ? (
        teacherEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptyText}>
              Create an event to start recording attendance.
            </Text>
          </View>
        ) : (
          teacherEvents.slice(0, 3).map((event) => (
            <View key={event.eventId} style={styles.recordCard}>
              <View style={styles.recordIcon}>
                <Text style={styles.recordIconText}>✓</Text>
              </View>

              <View style={styles.recordDetails}>
                <Text style={styles.recordTitle}>{event.title}</Text>
                <Text style={styles.recordDate}>
                  Event Code: {event.eventCode}
                </Text>
                <Text style={styles.recordDate}>
                  Students present: {event.attendeeCount}
                </Text>
              </View>
            </View>
          ))
        )
      ) : records.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No attendance yet</Text>
          <Text style={styles.emptyText}>
            Scan an event QR code to record your attendance.
          </Text>
        </View>
      ) : (
        records.slice(0, 3).map((record) => (
          <View key={record.id} style={styles.recordCard}>
            <View style={styles.recordIcon}>
              <Text style={styles.recordIconText}>✓</Text>
            </View>

            <View style={styles.recordDetails}>
              <Text style={styles.recordTitle}>
                {record.eventTitle}
              </Text>
              <Text style={styles.recordDate}>
                {formatDate(record.scannedAt)}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  welcomeCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  eyebrow: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  welcomeTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 10,
  },
  welcomeText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  scanButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  scanButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  viewAll: {
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  summaryNumber: {
    color: COLORS.textPrimary,
    fontSize: 36,
    fontWeight: '800',
    marginTop: 8,
  },
  summaryHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loader: {
    marginTop: 24,
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recordIconText: {
    color: '#15803d',
    fontSize: 20,
    fontWeight: '800',
  },
  recordDetails: {
    flex: 1,
  },
  recordTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  recordDate: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 5,
  },
});
