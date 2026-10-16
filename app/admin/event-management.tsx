import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';

type EventStatus = 'open' | 'closed';

type EventItem = {
  id: string;
  event_code: string;
  title: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  description: string | null;
  status: EventStatus;
  created_at?: string;
};

export default function EventManagement() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<EventStatus>('open');

  const [saving, setSaving] = useState(false);

  const loadEvents = useCallback(async () => {
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('events')
        .select(
          'id, event_code, title, start_time, end_time, venue, description, status, created_at',
        )
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      setEvents((data ?? []) as EventItem[]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load events.';
      setError(message);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const filteredEvents = events.filter((event) =>
    `${event.title} ${event.event_code} ${event.venue ?? ''} ${
      event.description ?? ''
    }`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  function toLocalInput(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const pad = (number: number) => String(number).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function parseDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function makeEventCode() {
    return `EVT-${Date.now().toString().slice(-8)}`;
  }

  function openAddModal() {
    setEditingEvent(null);
    setTitle('');
    setStartTime('');
    setEndTime('');
    setVenue('');
    setDescription('');
    setStatus('open');
    setModalVisible(true);
  }

  function openEditModal(event: EventItem) {
    setEditingEvent(event);
    setTitle(event.title);
    setStartTime(toLocalInput(event.start_time));
    setEndTime(toLocalInput(event.end_time));
    setVenue(event.venue ?? '');
    setDescription(event.description ?? '');
    setStatus(event.status ?? 'open');
    setModalVisible(true);
  }

  async function saveEvent() {
    const cleanTitle = title.trim();
    const start = parseDate(startTime);
    const end = parseDate(endTime);

    if (!cleanTitle) {
      Alert.alert('Missing Title', 'Please enter an event title.');
      return;
    }

    if (!start || !end) {
      Alert.alert(
        'Invalid Date/Time',
        'Enter valid dates in YYYY-MM-DDTHH:mm format.',
      );
      return;
    }

    if (end <= start) {
      Alert.alert('Invalid Time', 'End time must be after start time.');
      return;
    }

    setSaving(true);

    try {
      const eventData = {
        title: cleanTitle,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        venue: venue.trim() || null,
        description: description.trim() || null,
        status,
      };

      if (editingEvent) {
        const { error: updateError } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', editingEvent.id);

        if (updateError) throw updateError;
      } else {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          Alert.alert('Not Signed In', 'Please sign in again and retry.');
          return;
        }

        const { error: insertError } = await supabase.from('events').insert({
          ...eventData,
          event_code: makeEventCode(),
          created_by: user.id,
        });

        if (insertError) throw insertError;
      }

      setModalVisible(false);
      await loadEvents();

      Alert.alert(
        'Success',
        editingEvent
          ? 'Event updated successfully.'
          : 'Event created successfully.',
      );
    } catch (err) {
      Alert.alert(
        'Save Failed',
        err instanceof Error ? err.message : 'Unable to save event.',
      );
    } finally {
      setSaving(false);
    }
  }

  function closeEvent(event: EventItem) {
    if (event.status === 'closed') {
      Alert.alert('Event Closed', 'This event is already closed.');
      return;
    }

    Alert.alert(
      'Close Event',
      `Close "${event.title}"? Students should no longer be allowed to record attendance for this event.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Event',
          style: 'destructive',
          onPress: () => void updateEventStatus(event, 'closed'),
        },
      ],
    );
  }

  async function updateEventStatus(
    event: EventItem,
    newStatus: EventStatus,
  ) {
    try {
      const { error: updateError } = await supabase
        .from('events')
        .update({ status: newStatus })
        .eq('id', event.id);

      if (updateError) throw updateError;

      await loadEvents();

      Alert.alert(
        'Success',
        newStatus === 'closed'
          ? 'The event has been closed.'
          : 'The event has been reopened.',
      );
    } catch (err) {
      Alert.alert(
        'Status Update Failed',
        err instanceof Error
          ? err.message
          : 'Unable to update event status.',
      );
    }
  }

  function confirmDelete(event: EventItem) {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteEvent(event),
        },
      ],
    );
  }

  async function deleteEvent(event: EventItem) {
    try {
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);

      if (deleteError) throw deleteError;

      await loadEvents();
      Alert.alert('Success', 'Event deleted.');
    } catch (err) {
      Alert.alert(
        'Delete Failed',
        err instanceof Error
          ? `${err.message}\n\nCheck your Supabase permissions and whether this event has attendance records.`
          : 'Unable to delete event.',
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Loading events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Event Management</Text>
          <Text style={styles.muted}>
            Create, edit, close, and manage school events.
          </Text>
        </View>

        <Pressable style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={21} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Event</Text>
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
          placeholder="Search events, venue, or description..."
          placeholderTextColor="#888888"
          autoCapitalize="none"
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons
            name="alert-circle-outline"
            size={23}
            color={COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.addButton}
            onPress={() => {
              setLoading(true);
              void loadEvents();
            }}
          >
            <Text style={styles.addButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadEvents();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No events found.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.eventCard}>
              <View style={styles.eventHeading}>
                <View style={styles.eventIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={26}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{item.title}</Text>
                  <Text style={styles.eventCode}>
                    Event Code: {item.event_code}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    item.status === 'closed'
                      ? styles.closedBadge
                      : styles.openBadge,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      item.status === 'closed'
                        ? styles.closedDot
                        : styles.openDot,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      item.status === 'closed'
                        ? styles.closedText
                        : styles.openText,
                    ]}
                  >
                    {item.status === 'closed' ? 'Closed' : 'Open'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons
                  name="time-outline"
                  size={19}
                  color={COLORS.textSecondary}
                />
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Start Time</Text>
                  <Text style={styles.detailValue}>
                    {new Date(item.start_time).toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons
                  name="time-outline"
                  size={19}
                  color={COLORS.textSecondary}
                />
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>End Time</Text>
                  <Text style={styles.detailValue}>
                    {new Date(item.end_time).toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons
                  name="location-outline"
                  size={19}
                  color={COLORS.textSecondary}
                />
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Venue</Text>
                  <Text style={styles.detailValue}>
                    {item.venue?.trim() || 'Not specified'}
                  </Text>
                </View>
              </View>

              <View style={styles.descriptionBox}>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.descriptionText}>
                  {item.description?.trim() || 'No description provided.'}
                </Text>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={styles.editButton}
                  onPress={() => openEditModal(item)}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.closeButton,
                    item.status === 'closed' && styles.disabledButton,
                  ]}
                  disabled={item.status === 'closed'}
                  onPress={() => closeEvent(item)}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={
                      item.status === 'closed'
                        ? COLORS.textSecondary
                        : COLORS.danger
                    }
                  />
                  <Text
                    style={[
                      styles.closeText,
                      item.status === 'closed' && styles.disabledText,
                    ]}
                  >
                    {item.status === 'closed' ? 'Closed' : 'Close Event'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.deleteButton}
                  onPress={() => confirmDelete(item)}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={COLORS.danger}
                  />
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>

              {item.status === 'closed' && (
                <Pressable
                  style={styles.reopenButton}
                  onPress={() => void updateEventStatus(item, 'open')}
                >
                  <Ionicons
                    name="lock-open-outline"
                    size={17}
                    color={COLORS.primary}
                  />
                  <Text style={styles.reopenText}>Reopen Event</Text>
                </Pressable>
              )}
            </View>
          )}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <Text style={styles.modalTitle}>
                {editingEvent ? 'Edit Event' : 'Add Event'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Enter the event information below.
              </Text>

              <Text style={styles.fieldLabel}>Event Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter event title"
                placeholderTextColor="#888888"
              />

              <Text style={styles.fieldLabel}>Start Time *</Text>
              <TextInput
                style={styles.input}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="2026-10-20T08:00"
                placeholderTextColor="#888888"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>End Time *</Text>
              <TextInput
                style={styles.input}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="2026-10-20T12:00"
                placeholderTextColor="#888888"
                autoCapitalize="none"
              />

              <Text style={styles.helper}>
                Use YYYY-MM-DDTHH:mm format in your local time.
              </Text>

              <Text style={styles.fieldLabel}>Venue</Text>
              <TextInput
                style={styles.input}
                value={venue}
                onChangeText={setVenue}
                placeholder="Enter event venue"
                placeholderTextColor="#888888"
              />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.descriptionInput]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the event..."
                placeholderTextColor="#888888"
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>Event Status</Text>
              <View style={styles.statusChoices}>
                <Pressable
                  onPress={() => setStatus('open')}
                  style={[
                    styles.statusChoice,
                    status === 'open' && styles.selectedOpen,
                  ]}
                >
                  <Ionicons
                    name="lock-open-outline"
                    size={18}
                    color={status === 'open' ? '#FFFFFF' : COLORS.primary}
                  />
                  <Text
                    style={[
                      styles.choiceText,
                      status === 'open' && styles.selectedChoiceText,
                    ]}
                  >
                    Open
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setStatus('closed')}
                  style={[
                    styles.statusChoice,
                    status === 'closed' && styles.selectedClosed,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={status === 'closed' ? '#FFFFFF' : COLORS.danger}
                  />
                  <Text
                    style={[
                      styles.choiceText,
                      status === 'closed' && styles.selectedChoiceText,
                    ]}
                  >
                    Closed
                  </Text>
                </Pressable>
              </View>

              {!editingEvent && (
                <Text style={styles.helper}>
                  An event code will be generated automatically.
                </Text>
              )}

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.saveButton,
                    saving && styles.disabledButton,
                  ]}
                  onPress={() => void saveEvent()}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveText}>
                      {editingEvent ? 'Save Changes' : 'Create Event'}
                    </Text>
                  )}
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
  },
  heading: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  muted: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: COLORS.textPrimary,
  },
  list: {
    paddingBottom: 28,
    gap: 14,
  },
  eventCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 18,
    gap: 16,
  },
  eventHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    flex: 1,
    gap: 5,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  eventCode: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },
  openBadge: {
    backgroundColor: '#E8F7EE',
  },
  closedBadge: {
    backgroundColor: '#FCEAEA',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  openDot: {
    backgroundColor: '#218653',
  },
  closedDot: {
    backgroundColor: '#C53A3A',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  openText: {
    color: '#218653',
  },
  closedText: {
    color: '#C53A3A',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailInfo: {
    flex: 1,
    gap: 3,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textPrimary,
  },
  descriptionBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    gap: 5,
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    gap: 8,
  },
  editButton: {
    flexGrow: 1,
    flexBasis: '25%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.background,
    padding: 11,
    borderRadius: 9,
  },
  editText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  closeButton: {
    flexGrow: 1,
    flexBasis: '35%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.background,
    padding: 11,
    borderRadius: 9,
  },
  closeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.danger,
  },
  deleteButton: {
    flexGrow: 1,
    flexBasis: '25%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.background,
    padding: 11,
    borderRadius: 9,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.danger,
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledText: {
    color: COLORS.textSecondary,
  },
  reopenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    padding: 11,
  },
  reopenText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  empty: {
    textAlign: 'center',
    padding: 24,
    color: COLORS.textSecondary,
  },
  errorBox: {
    padding: 16,
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: 12,
  },
  errorText: {
    color: COLORS.danger,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 22,
  },
  modalTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  fieldLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    color: COLORS.textPrimary,
  },
  descriptionInput: {
    minHeight: 90,
    paddingTop: 12,
  },
  helper: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
  statusChoices: {
    flexDirection: 'row',
    gap: 10,
  },
  statusChoice: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.card,
  },
  selectedOpen: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  selectedClosed: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  choiceText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  selectedChoiceText: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    marginBottom: 4,
  },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
  },
  cancelText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});