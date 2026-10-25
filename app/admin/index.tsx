import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/useRole';

type RecentEvent = {
  id: string;
  title: string;
  start_time: string | null;
  event_code: string | null;
};

type DayAttendance = {
  label: string;
  count: number;
};

export default function AdminDashboard() {
  const { isAdmin, loading: roleLoading } = useRole();
  const { width } = useWindowDimensions();

  const isWide = width >= 700;

  const [stats, setStats] = useState({
    users: 0,
    events: 0,
    attendance: 0,
  });

  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [chartData, setChartData] = useState<DayAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setError('');

    try {
      const [users, events, attendance, latestEvents, attendanceRows] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true }),

          supabase
            .from('events')
            .select('id', { count: 'exact', head: true }),

          supabase
            .from('attendance')
            .select('id', { count: 'exact', head: true }),

          supabase
            .from('events')
            .select('id, title, start_time, event_code')
            .order('created_at', { ascending: false })
            .limit(5),

          supabase
            .from('attendance')
            .select('scanned_at')
            .order('scanned_at', { ascending: false })
            .limit(500),
        ]);

      const issue =
        users.error ||
        events.error ||
        attendance.error ||
        latestEvents.error ||
        attendanceRows.error;

      if (issue) {
        setError(issue.message);
        return;
      }

      setStats({
        users: users.count ?? 0,
        events: events.count ?? 0,
        attendance: attendance.count ?? 0,
      });

      setRecentEvents((latestEvents.data ?? []) as RecentEvent[]);

      // Group actual attendance records into the last 7 days.
      const now = new Date();
      const days: DayAttendance[] = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - i);

        days.push({
          label: date.toLocaleDateString('en-US', {
            weekday: 'short',
          }),
          count: 0,
        });
      }

      for (const row of attendanceRows.data ?? []) {
        if (!row.scanned_at) continue;

        const scannedDate = new Date(row.scanned_at);

        const dayIndex = days.findIndex((_, index) => {
          const targetDate = new Date(now);
          targetDate.setHours(0, 0, 0, 0);
          targetDate.setDate(targetDate.getDate() - (6 - index));

          return (
            scannedDate.getFullYear() === targetDate.getFullYear() &&
            scannedDate.getMonth() === targetDate.getMonth() &&
            scannedDate.getDate() === targetDate.getDate()
          );
        });

        if (dayIndex !== -1) {
          days[dayIndex].count += 1;
        }
      }

      setChartData(days);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load dashboard data.',
      );
    }
  }, []);

  useEffect(() => {
    if (roleLoading) return;

    if (!isAdmin) {
      setLoading(false);
      return;
    }

    let active = true;

    const run = async () => {
      await loadDashboard();

      if (active) {
        setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [isAdmin, roleLoading, loadDashboard]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  if (roleLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.subtitle}>Loading dashboard...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="lock-closed-outline"
          size={40}
          color={COLORS.danger}
        />
        <Text style={styles.pageTitle}>Access Denied</Text>
        <Text style={styles.subtitle}>Administrators only.</Text>
      </View>
    );
  }

  const maxCount = Math.max(
    1,
    ...chartData.map((item) => item.count),
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            School attendance management
          </Text>
        </View>

        <Pressable
          onPress={handleRefresh}
          disabled={refreshing}
          style={styles.refreshButton}
          accessibilityRole="button"
          accessibilityLabel="Refresh dashboard"
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons
              name="refresh-outline"
              size={22}
              color={COLORS.primary}
            />
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.welcomeRow}>
          <View style={styles.welcomeText}>
            <Text style={styles.pageTitle}>Overview</Text>
            <Text style={styles.description}>
              Welcome back, Administrator! Here is your school attendance
              summary.
            </Text>
          </View>
          <Ionicons
            name="shield-checkmark-outline"
            size={32}
            color={COLORS.primary}
          />
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={22}
              color={COLORS.danger}
            />
            <View style={styles.errorContent}>
              <Text style={styles.errorTitle}>
                Unable to load all dashboard data
              </Text>
              <Text style={styles.error}>{error}</Text>
              <Pressable onPress={handleRefresh} style={styles.retryButton}>
                <Text style={styles.retryText}>Try Again</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Key Statistics</Text>
              <Text style={styles.sectionHint}>Live database totals</Text>
            </View>

            <View style={[styles.statsGrid, isWide && styles.statsGridWide]}>
              <Stat
                title="Total Users"
                value={stats.users}
                icon="people-outline"
                description="Registered accounts"
              />
              <Stat
                title="Total Events"
                value={stats.events}
                icon="calendar-outline"
                description="School events"
              />
              <Stat
                title="Attendance"
                value={stats.attendance}
                icon="clipboard-outline"
                description="Attendance records"
              />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Attendance Overview</Text>
              <Text style={styles.sectionHint}>Last 7 days</Text>
            </View>

            <View style={styles.panel}>
              <View style={styles.chartSummary}>
                <View>
                  <Text style={styles.chartNumber}>
                    {chartData.reduce((sum, day) => sum + day.count, 0)}
                  </Text>
                  <Text style={styles.chartCaption}>
                    Records in the last 7 days
                  </Text>
                </View>
                <View style={styles.chartIcon}>
                  <Ionicons
                    name="bar-chart-outline"
                    size={25}
                    color={COLORS.primary}
                  />
                </View>
              </View>

              <View style={styles.chart}>
                {chartData.map((day, index) => (
                  <View key={`${day.label}-${index}`} style={styles.barItem}>
                    <Text style={styles.barValue}>
                      {day.count > 0 ? day.count : ''}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${Math.max(
                              5,
                              (day.count / maxCount) * 100,
                            )}%`,
                            opacity: day.count === 0 ? 0.2 : 1,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{day.label}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.chartFootnote}>
                Based on attendance records available to your administrator
                account.
              </Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Events</Text>
              <Text style={styles.sectionHint}>
                {recentEvents.length} shown
              </Text>
            </View>

            <View style={styles.panel}>
              {recentEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="calendar-clear-outline"
                    size={32}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.emptyTitle}>No events yet</Text>
                  <Text style={styles.emptyText}>
                    Created events will appear here.
                  </Text>
                </View>
              ) : (
                recentEvents.map((event, index) => (
                  <View key={event.id}>
                    {index > 0 && <View style={styles.separator} />}

                    <View style={styles.eventRow}>
                      <View style={styles.eventIcon}>
                        <Ionicons
                          name="calendar-outline"
                          size={22}
                          color={COLORS.primary}
                        />
                      </View>

                      <View style={styles.eventDetails}>
                        <Text style={styles.eventTitle} numberOfLines={2}>
                          {event.title}
                        </Text>
                        <Text style={styles.eventDate}>
                          {event.start_time
                            ? new Date(event.start_time).toLocaleString(
                                'en-PH',
                                {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                },
                              )
                            : 'Date not set'}
                        </Text>
                        {event.event_code ? (
                          <Text style={styles.eventCode}>
                            Code: {event.event_code}
                          </Text>
                        ) : null}
                      </View>

                      <Ionicons
                        name="chevron-forward-outline"
                        size={19}
                        color={COLORS.textSecondary}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.infoCard}>
              <Ionicons
                name="shield-checkmark-outline"
                size={26}
                color={COLORS.primary}
              />
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>Administrator Access</Text>
                <Text style={styles.infoDescription}>
                  Use the navigation tabs to manage users, events,
                  attendance records, and reports.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: number;
  icon: 'people-outline' | 'calendar-outline' | 'clipboard-outline';
  description: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statTop}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={23} color={COLORS.primary} />
        </View>
        <Text style={styles.statTitle}>{title}</Text>
      </View>

      <Text style={styles.number}>{value}</Text>
      <Text style={styles.statDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  refreshButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 36,
    gap: 18,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  welcomeText: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  description: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statsGridWide: {
    flexWrap: 'nowrap',
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 100,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 15,
    padding: 14,
  },
  statTop: {
    gap: 9,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  statTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  number: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statDescription: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },
  panel: {
    padding: 17,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
  },
  chartSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  chartCaption: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  chartIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chart: {
    height: 155,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginTop: 20,
  },
  barItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barValue: {
    height: 18,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  barTrack: {
    width: '100%',
    maxWidth: 42,
    flex: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    backgroundColor: COLORS.background,
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    backgroundColor: COLORS.primary,
  },
  barLabel: {
    marginTop: 8,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  chartFootnote: {
    marginTop: 14,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  eventIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  eventDate: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  eventCode: {
    marginTop: 3,
    fontSize: 11,
    color: COLORS.primary,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.card,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  infoDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  error: {
    marginTop: 5,
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  retryText: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});