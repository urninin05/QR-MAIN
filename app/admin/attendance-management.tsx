
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';

type AttendanceItem = {
  student_id: string;
  event_id: string;
  scanned_at: string;
};

type EventItem = {
  id: string;
  title: string;
};

type ProfileItem = {
  id: string;
  email: string;
  full_name: string | null;
};

type DisplayRecord = AttendanceItem & {
  studentName: string;
  email: string;
  eventTitle: string;
};

export default function AttendanceManagement() {
  const [records, setRecords] = useState<DisplayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadAttendance = useCallback(async () => {
    setError('');

    const [attendanceResult, eventsResult, profilesResult] =
      await Promise.all([
        supabase
          .from('attendance')
          .select('student_id, event_id, scanned_at')
          .order('scanned_at', { ascending: false }),

        supabase.from('events').select('id, title'),

        supabase.from('profiles').select('id, email, full_name'),
      ]);

    if (attendanceResult.error) {
      setError(attendanceResult.error.message);
      setRecords([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (eventsResult.error) {
      setError(eventsResult.error.message);
      setRecords([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (profilesResult.error) {
      setError(profilesResult.error.message);
      setRecords([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const events = (eventsResult.data ?? []) as EventItem[];
    const profiles = (profilesResult.data ?? []) as ProfileItem[];

    const eventMap = new Map(
      events.map((event) => [event.id, event.title]),
    );

    const profileMap = new Map(
      profiles.map((profile) => [profile.id, profile]),
    );

    const mappedRecords: DisplayRecord[] = (
      attendanceResult.data ?? []
    ).map((record) => {
      const profile = profileMap.get(record.student_id);

      return {
        ...record,
        studentName: profile?.full_name?.trim() || 'Unknown Student',
        email: profile?.email || 'Email unavailable',
        eventTitle: eventMap.get(record.event_id) || 'Unknown Event',
      };
    });

    setRecords(mappedRecords);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const filteredRecords = records.filter((record) => {
    const query = search.trim().toLowerCase();

    return (
      record.studentName.toLowerCase().includes(query) ||
      record.email.toLowerCase().includes(query) ||
      record.eventTitle.toLowerCase().includes(query) ||
      record.student_id.toLowerCase().includes(query)
    );
  });

  function formatDate(value: string) {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? 'Invalid date'
      : date.toLocaleDateString();
  }

  function formatTime(value: string) {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? 'Invalid time'
      : date.toLocaleTimeString();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.subtitle}>Loading attendance records...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageLabel}>Attendance</Text>

      <View style={styles.pageHeader}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Attendance Management</Text>
          <Text style={styles.subtitle}>
            Search, review, and monitor attendance records.
          </Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Ionicons
            name="clipboard-outline"
            size={28}
            color={COLORS.primary}
          />
        </View>

        <View style={styles.summaryText}>
          <Text style={styles.summaryNumber}>{records.length}</Text>
          <Text style={styles.summaryLabel}>
            Total attendance records
          </Text>
        </View>

        <Pressable
          style={styles.refreshButton}
          onPress={() => {
            setRefreshing(true);
            void loadAttendance();
          }}
          accessibilityLabel="Refresh attendance records"
        >
          <Ionicons
            name="refresh-outline"
            size={21}
            color={COLORS.primary}
          />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Ionicons
          name="search-outline"
          size={20}
          color={COLORS.textSecondary}
        />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search student, email, or event..."
          placeholderTextColor="#888888"
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons
              name="close-circle"
              size={20}
              color={COLORS.textSecondary}
            />
          </Pressable>
        )}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons
            name="alert-circle-outline"
            size={24}
            color={COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              void loadAttendance();
            }}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item, index) =>
            `${item.event_id}-${item.student_id}-${item.scanned_at}-${index}`
          }
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadAttendance();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              No attendance records found.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <View style={styles.eventIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={24}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>
                    {item.eventTitle}
                  </Text>
                  <Text style={styles.recordId} numberOfLines={1}>
                    Student attendance record
                  </Text>
                </View>

                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Present</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Student</Text>
                <Text style={styles.detailValue}>
                  {item.studentName}
                </Text>
              </View>

              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{item.email}</Text>
              </View>

              <View style={styles.dateTimeRow}>
                <View style={styles.dateTimeBlock}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(item.scanned_at)}
                  </Text>
                </View>

                <View style={styles.dateTimeBlock}>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue}>
                    {formatTime(item.scanned_at)}
                  </Text>
                </View>
              </View>

              <View style={styles.statusRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Present</Text>
                </View>
              </View>
            </View>
          )}
        />
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },
  pageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 26,
  },
  pageHeader: {
    marginBottom: 18,
  },
  headerText: {
    gap: 5,
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
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    minHeight: 94,
    gap: 14,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  summaryText: {
    flex: 1,
    gap: 4,
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    color: COLORS.textPrimary,
  },
  list: {
    paddingBottom: 24,
    gap: 14,
  },
  recordCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 18,
    gap: 16,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  eventInfo: {
    flex: 1,
    gap: 4,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
  },
  recordId: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  detailBlock: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dateTimeBlock: {
    flex: 1,
    gap: 5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    textAlign: 'center',
    marginTop: 30,
    color: COLORS.textSecondary,
  },
  errorBox: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 18,
    alignItems: 'flex-start',
    gap: 12,
  },
  errorText: {
    color: COLORS.danger,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
