import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';

type Announcement = {
  id: string;
  title: string;
  body: string;
  is_published: boolean;
  created_at: string;
  updated_at?: string;
  created_by: string;
};

export default function AnnouncementsScreen() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');

  const loadAnnouncements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, body, is_published, created_at, updated_at, created_by')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as Announcement[]);
    } catch (e) {
      console.error('Load announcements failed:', e);
      Alert.alert(
        'Unable to load announcements',
        e instanceof Error ? e.message : 'Check the announcements table and Supabase policies.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  function openNew() {
    setEditing(null);
    setTitle('');
    setBody('');
    setModalVisible(true);
  }

  function openEdit(item: Announcement) {
    setEditing(item);
    setTitle(item.title);
    setBody(item.body);
    setModalVisible(true);
  }

  async function saveAnnouncement() {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) {
      Alert.alert('Missing information', 'Enter both a title and announcement details.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Please sign in again.');

      if (editing) {
        const { error } = await supabase
          .from('announcements')
          .update({
            title: cleanTitle,
            body: cleanBody,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('announcements').insert({
          title: cleanTitle,
          body: cleanBody,
          is_published: false,
          created_by: user.id,
        });
        if (error) throw error;
      }

      setModalVisible(false);
      await loadAnnouncements();
      Alert.alert('Saved', editing ? 'Announcement updated.' : 'Draft announcement created. Publish it when ready.');
    } catch (e) {
      Alert.alert(
        'Save failed',
        e instanceof Error ? e.message : 'Unable to save announcement. Check table columns and RLS policies.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(item: Announcement) {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({
          is_published: !item.is_published,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      if (error) throw error;
      await loadAnnouncements();
    } catch (e) {
      Alert.alert(
        'Could not update publication',
        e instanceof Error ? e.message : 'Check announcements table columns and RLS policies.',
      );
    }
  }

  function deleteAnnouncement(item: Announcement) {
    Alert.alert('Delete announcement?', `Delete "${item.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void (async () => {
          try {
            const { error } = await supabase.from('announcements').delete().eq('id', item.id);
            if (error) throw error;
            await loadAnnouncements();
          } catch (e) {
            Alert.alert('Delete failed', e instanceof Error ? e.message : 'Unable to delete announcement.');
          }
        })(),
      },
    ]);
  }

  const filtered = items.filter((item) =>
    `${item.title} ${item.body}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Loading announcements...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Notices Management</Text>
          <Text style={styles.muted}>Create and publish updates for students.</Text>
        </View>
        <Pressable style={styles.addButton} onPress={openNew}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>New</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={19} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search announcements..."
          placeholderTextColor={COLORS.textSecondary}
        />
        <Pressable onPress={() => { setRefreshing(true); void loadAnnouncements(); }}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.primary} />
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); void loadAnnouncements(); }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="megaphone-outline" size={38} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No announcements yet</Text>
            <Text style={styles.muted}>Create a notice for students to see after you publish it.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.noticeIcon}>
                <Ionicons name="megaphone-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              <View style={[styles.badge, item.is_published ? styles.published : styles.draft]}>
                <Text style={[styles.badgeText, item.is_published ? styles.publishedText : styles.draftText]}>
                  {item.is_published ? 'Published' : 'Draft'}
                </Text>
              </View>
            </View>
            <Text style={styles.body} numberOfLines={5}>{item.body}</Text>
            <View style={styles.actions}>
              <Pressable style={styles.actionButton} onPress={() => openEdit(item)}>
                <Ionicons name="create-outline" size={17} color={COLORS.primary} />
                <Text style={styles.actionText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={() => void togglePublish(item)}>
                <Ionicons
                  name={item.is_published ? 'eye-off-outline' : 'send-outline'}
                  size={17}
                  color={COLORS.primary}
                />
                <Text style={styles.actionText}>{item.is_published ? 'Unpublish' : 'Publish'}</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={() => deleteAnnouncement(item)}>
                <Ionicons name="trash-outline" size={17} color={COLORS.danger} />
                <Text style={[styles.actionText, { color: COLORS.danger }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!saving) setModalVisible(false); }}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editing ? 'Edit Announcement' : 'New Announcement'}</Text>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter announcement title"
                placeholderTextColor={COLORS.textSecondary}
                maxLength={160}
              />
              <Text style={styles.label}>Details *</Text>
              <TextInput
                style={[styles.input, styles.bodyInput]}
                value={body}
                onChangeText={setBody}
                placeholder="Write your announcement..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.muted}>New posts are saved as drafts. Publish them when ready.</Text>
              <View style={styles.modalActions}>
                <Pressable style={styles.cancelButton} onPress={() => setModalVisible(false)} disabled={saving}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={() => void saveAnnouncement()} disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  headerText: { flex: 1 },
  heading: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  muted: { marginTop: 5, color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 10 },
  addButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.card, marginBottom: 14 },
  searchInput: { flex: 1, paddingVertical: 12, color: COLORS.textPrimary },
  list: { paddingBottom: 32, gap: 14, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  emptyTitle: { marginTop: 10, color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  cardTitleWrap: { flex: 1, gap: 4 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  date: { color: COLORS.textSecondary, fontSize: 11 },
  badge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  published: { backgroundColor: '#E8F7EE' },
  draft: { backgroundColor: '#F3EFFB' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  publishedText: { color: '#218653' },
  draftText: { color: '#7047B8' },
  body: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 9, backgroundColor: COLORS.background },
  actionText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 520, maxHeight: '90%', backgroundColor: COLORS.card, borderRadius: 18, padding: 22 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 14 },
  label: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 7 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, backgroundColor: COLORS.background, color: COLORS.textPrimary },
  bodyInput: { minHeight: 140, paddingTop: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10 },
  cancelText: { color: COLORS.textPrimary, fontWeight: '600' },
  saveButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 10 },
  saveText: { color: '#FFFFFF', fontWeight: '700' },
});
