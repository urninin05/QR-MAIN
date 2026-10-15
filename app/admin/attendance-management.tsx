import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/useRole';

type Attendance = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
};

type Student = {
  id: string;
  full_name: string | null;
  email: string;
};

type Event = {
  id: string;
  title: string;
};

type AttendanceDisplay = Attendance & {
  studentName: string;
  studentEmail: string;
  eventTitle: string;
};

export default function AttendanceManagement() {
  const { isAdmin, loading: roleLoading } = useRole();

  const [records, setRecords] = useState<AttendanceDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      loadAttendance();
    }
  }, [isAdmin]);

  async function loadAttendance() {
    try {
      setLoading(true);
      setError(null);

      // Get attendance records
      const { data: attendanceData, error: attendanceError } =
        await supabase
          .from('attendance')
          .select(
            'id, student_id, event_id, scanned_at'
          )
          .order('scanned_at', { ascending: false });

      if (attendanceError) {
        throw new Error(attendanceError.message);
      }

      const attendance =
        (attendanceData ?? []) as Attendance[];

      if (attendance.length === 0) {
        setRecords([]);
        return;
      }

      // Get unique student IDs
      const studentIds = [
        ...new Set(
          attendance
            .map((item) => item.student_id)
            .filter(Boolean)
        ),
      ];

      // Get unique event IDs
      const eventIds = [
        ...new Set(
          attendance
            .map((item) => item.event_id)
            .filter(Boolean)
        ),
      ];

      // Get students
      let students: Student[] = [];

      if (studentIds.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', studentIds);

        if (error) {
          throw new Error(
            `Could not load students: ${error.message}`
          );
        }

        students = (data ?? []) as Student[];
      }

      // Get events
      let events: Event[] = [];

      if (eventIds.length > 0) {
        const { data, error } = await supabase
          .from('events')
          .select('id, title')
          .in('id', eventIds);

        if (error) {
          throw new Error(
            `Could not load events: ${error.message}`
          );
        }

        events = (data ?? []) as Event[];
      }

      // Combine everything
      const formattedRecords: AttendanceDisplay[] =
        attendance.map((attendanceItem) => {
          const student = students.find(
            (item) =>
              item.id === attendanceItem.student_id
          );

          const event = events.find(
            (item) =>
              item.id === attendanceItem.event_id
          );

          return {
            ...attendanceItem,
            studentName:
              student?.full_name || 'Unknown Student',
            studentEmail:
              student?.email || '',
            eventTitle:
              event?.title || 'Unknown Event',
          };
        });

      setRecords(formattedRecords);
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to load attendance records.'
      );
    } finally {
      setLoading(false);
    }
  }

  function formatDateTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return {
        date: value,
        time: '',
      };
    }

    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
    };
  }

  if (roleLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text style={styles.loadingText}>
          Loading attendance records...
        </Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Access Denied
        </Text>

        <Text style={styles.errorText}>
          This page is for administrators only.
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
        Attendance Records
      </Text>

      <Text style={styles.subtitle}>
        View all attendance records in the system.
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorMessage}>
            {error}
          </Text>
        </View>
      )}

      {!error && records.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>
            No Attendance Records
          </Text>

          <Text style={styles.emptyText}>
            There are no attendance records yet.
          </Text>
        </View>
      )}

      {records.map((record) => {
        const dateTime = formatDateTime(
          record.scanned_at
        );

        return (
          <View
            key={record.id}
            style={styles.recordCard}
          >
            <Text style={styles.eventTitle}>
              {record.eventTitle}
            </Text>

            <View style={styles.divider} />

            <View style={styles.row}>
              <Text style={styles.label}>
                Student
              </Text>

              <Text style={styles.value}>
                {record.studentName}
              </Text>
            </View>

            {record.studentEmail ? (
              <View style={styles.row}>
                <Text style={styles.label}>
                  Email
                </Text>

                <Text style={styles.value}>
                  {record.studentEmail}
                </Text>
              </View>
            ) : null}

            <View style={styles.row}>
              <Text style={styles.label}>
                Date
              </Text>

              <Text style={styles.value}>
                {dateTime.date}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>
                Time
              </Text>

              <Text style={styles.value}>
                {dateTime.time}
              </Text>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.label}>
                Status
              </Text>

              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  Present
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: 20,
    paddingBottom: 90,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  subtitle: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  recordCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },

  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 10,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 14,
  },

  row: {
    marginBottom: 12,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 3,
  },

  value: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  statusBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  errorBox: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 14,
    padding: 20,
    marginTop: 10,
  },

  errorMessage: {
    color: COLORS.danger,
    textAlign: 'center',
  },

  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  errorText: {
    marginTop: 8,
    color: COLORS.textSecondary,
  },

  emptyBox: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  emptyText: {
    marginTop: 6,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});