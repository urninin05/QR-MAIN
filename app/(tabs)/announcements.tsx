import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';

type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export default function StudentAnnouncementsScreen() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('announcements')
        .select('id, title, body, created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setItems((data ?? []) as Announcement[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load announcements.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="megaphone-outline" size={25} color={COLORS.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Announcements</Text>
          <Text style={styles.subtitle}>School updates and important notices.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.subtitle}>Loading announcements...</Text>
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={34} color={COLORS.danger} />
          <Text style={styles.emptyTitle}>Could not load announcements</Text>
          <Text style={styles.subtitle}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => { setLoading(true); void load(); }}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-outline" size={36} color={COLORS.textSecondary} />
              <Text style={styles.emptyTitle}>No announcements yet</Text>
              <Text style={styles.subtitle}>Published notices from the administrator will appear here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.noticeIcon}>
                  <Ionicons name="megaphone-outline" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.titleWrap}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
                <View style={styles.publishedBadge}>
                  <Text style={styles.publishedText}>NEW</Text>
                </View>
              </View>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  iconWrap: { width: 48, height: 48, borderRadius: 13, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  heading: { fontSize: 23, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { marginTop: 5, fontSize: 13, lineHeight: 19, color: COLORS.textSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  list: { paddingBottom: 30, gap: 13, flexGrow: 1 },
  card: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 16, gap: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, gap: 4 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  date: { color: COLORS.textSecondary, fontSize: 11 },
  publishedBadge: { backgroundColor: '#E8F7EE', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5 },
  publishedText: { color: '#218653', fontSize: 10, fontWeight: '800' },
  body: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 22 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16 },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  retryButton: { marginTop: 16, backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});
