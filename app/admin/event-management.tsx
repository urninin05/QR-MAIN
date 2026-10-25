
import { useCallback, useEffect, useState, createElement } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import QRCode from 'react-native-qrcode-svg';

import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';
import { buildQRPayload } from '@/lib/qr';

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

type SelectedQR = {
  title: string;
  eventCode: string;
  payload: string;
};

type DateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function DateTimeField({
  label,
  value,
  onChange,
}: DateTimeFieldProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const selectedDate = value ? new Date(value) : new Date();
  const validDate = !Number.isNaN(selectedDate.getTime());
  const displayDate = validDate ? selectedDate : new Date();

  function handleDateChange(
    event: DateTimePickerEvent,
    date?: Date,
  ) {
    setShowDatePicker(false);

    if (event.type !== 'set' || !date) return;

    const updated = new Date(displayDate);
    updated.setFullYear(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    onChange(updated.toISOString());

    // Pick the time after the date on Android.
    if (Platform.OS === 'android') {
      setShowTimePicker(true);
    }
  }

  function handleTimeChange(
    event: DateTimePickerEvent,
    time?: Date,
  ) {
    setShowTimePicker(false);

    if (event.type !== 'set' || !time) return;

    const updated = new Date(
      value && !Number.isNaN(new Date(value).getTime())
        ? value
        : new Date(),
    );

    updated.setHours(
      time.getHours(),
      time.getMinutes(),
      0,
      0,
    );

    onChange(updated.toISOString());
  }

  if (Platform.OS === 'web') {
    const localValue = value
      ? (() => {
          const d = new Date(value);
          if (Number.isNaN(d.getTime())) return '';
          const pad = (n: number) => String(n).padStart(2, '0');

          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
            d.getDate(),
          )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        })()
      : '';

    return (
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{label} *</Text>
        {createElement('input', {
          type: 'datetime-local',
          value: localValue,
          'aria-label': label,
          onChange: (e: { currentTarget: { value: string } }) => {
            const next = e.currentTarget.value;
            if (!next) {
              onChange('');
              return;
            }

            const parsed = new Date(next);
            if (!Number.isNaN(parsed.getTime())) {
              onChange(parsed.toISOString());
            }
          },
          style: webDateStyle,
        })}
      </View>
    );
  }

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label} *</Text>

      <Pressable
        style={styles.dateTimeButton}
        onPress={() => setShowDatePicker(true)}
      >
        <Ionicons
          name="calendar-outline"
          size={20}
          color={COLORS.primary}
        />

        <Text
          style={[
            styles.dateTimeText,
            !value && styles.placeholderText,
          ]}
        >
          {validDate
            ? displayDate.toLocaleString()
            : 'Select date and time'}
        </Text>

        <Ionicons
          name="chevron-down"
          size={18}
          color={COLORS.textSecondary}
        />
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={displayDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={displayDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}

export default function EventManagement() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [selectedQR, setSelectedQR] = useState<SelectedQR | null>(null);
  const [viewingEventId, setViewingEventId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [eventCode, setEventCode] = useState('');
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
      setError(
        err instanceof Error ? err.message : 'Unable to load events.',
      );
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

  function makeEventCode() {
    return `EVT-${Date.now().toString().slice(-8)}`;
  }

  function openAddModal() {
    setEditingEvent(null);
    setTitle('');
    setEventCode(makeEventCode());
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
    setEventCode(event.event_code);
    setStartTime(event.start_time);
    setEndTime(event.end_time);
    setVenue(event.venue ?? '');
    setDescription(event.description ?? '');
    setStatus(event.status ?? 'open');
    setModalVisible(true);
  }

  async function saveEvent() {
    const cleanTitle = title.trim();
    const cleanEventCode = eventCode.trim() || makeEventCode();
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (!cleanTitle) {
      Alert.alert('Missing Title', 'Please enter an event title.');
      return;
    }

    if (!cleanEventCode) {
      Alert.alert('Missing Event Code', 'Please enter an event code.');
      return;
    }

    if (
      !startTime ||
      !endTime ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      Alert.alert(
        'Missing Date/Time',
        'Please select both the start and end date and time.',
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
          Alert.alert('Not Signed In', 'Please sign in again.');
          return;
        }

        const { error: insertError } = await supabase.from('events').insert({
          ...eventData,
          event_code: cleanEventCode,
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
        err instanceof Error ? err.message : 'Unable to update event.',
      );
    }
  }

  function closeEvent(event: EventItem) {
    if (event.status === 'closed') {
      Alert.alert('Event Closed', 'This event is already closed.');
      return;
    }

    Alert.alert(
      'Close Event',
      `Close "${event.title}"?`,
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
          ? `${err.message}\n\nCheck Supabase permissions and attendance records.`
          : 'Unable to delete event.',
      );
    }
  }

  function confirmDelete(event: EventItem) {
    Alert.alert(
      'Delete Event',
      `Delete "${event.title}"? This action cannot be undone.`,
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

  function handleGenerateQR(event: EventItem) {
    if (event.status === 'closed') {
      Alert.alert(
        'Event Closed',
        'Reopen this event before generating its QR code.',
      );
      return;
    }

    const payload = buildQRPayload({
      eventId: event.event_code,
      title: event.title,
      start: event.start_time,
      end: event.end_time,
    });

    setSelectedQR({
      title: event.title,
      eventCode: event.event_code,
      payload,
    });
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
            Create, edit, and manage school events.
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
          placeholder="Search events..."
          placeholderTextColor="#888888"
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
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
          renderItem={({ item }) => {
            const isClosed = item.status === 'closed';
            const isViewing = viewingEventId === item.id;

            return (
              <View style={styles.eventCard}>
                <View style={styles.eventHeading}>
                  <View style={styles.eventIcon}>
                    <Ionicons
                      name="calendar-outline"
                      size={25}
                      color={COLORS.primary}
                    />
                  </View>

                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{item.title}</Text>
                    <Text style={styles.eventCode}>{item.event_code}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      isClosed ? styles.closedBadge : styles.openBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        isClosed ? styles.closedText : styles.openText,
                      ]}
                    >
                      {isClosed ? 'Closed' : 'Open'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={COLORS.textSecondary}
                  />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Starts</Text>
                    <Text style={styles.detailValue}>
                      {new Date(item.start_time).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={COLORS.textSecondary}
                  />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Ends</Text>
                    <Text style={styles.detailValue}>
                      {new Date(item.end_time).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={COLORS.textSecondary}
                  />
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Venue</Text>
                    <Text style={styles.detailValue}>
                      {item.venue || 'Not specified'}
                    </Text>
                  </View>
                </View>

                <View style={styles.descriptionBox}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailValue}>
                    {item.description || 'No description provided.'}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() =>
                      setViewingEventId(isViewing ? null : item.id)
                    }
                  >
                    <Ionicons
                      name="eye-outline"
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={styles.actionText}>
                      {isViewing ? 'Hide' : 'View'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionButton}
                    onPress={() => openEditModal(item)}
                  >
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleGenerateQR(item)}
                  >
                    <Ionicons
                      name="qr-code-outline"
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={styles.actionText}>QR</Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionButton}
                    onPress={() => closeEvent(item)}
                    disabled={isClosed}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={isClosed ? COLORS.textSecondary : COLORS.danger}
                    />
                    <Text
                      style={[
                        styles.actionText,
                        {
                          color: isClosed
                            ? COLORS.textSecondary
                            : COLORS.danger,
                        },
                      ]}
                    >
                      {isClosed ? 'Closed' : 'Close'}
                    </Text>
                  </Pressable>
                </View>

                {isViewing && (
                  <View style={styles.detailsBox}>
                    <Text style={styles.detailsTitle}>Event Details</Text>
                    <Text style={styles.detailsText}>
                      Title: {item.title}
                    </Text>
                    <Text style={styles.detailsText}>
                      Code: {item.event_code}
                    </Text>
                    <Text style={styles.detailsText}>
                      Venue: {item.venue || 'Not specified'}
                    </Text>
                    <Text style={styles.detailsText}>
                      Description: {item.description || 'No description'}
                    </Text>

                    {isClosed && (
                      <Pressable
                        style={styles.reopenButton}
                        onPress={() =>
                          void updateEventStatus(item, 'open')
                        }
                      >
                        <Ionicons
                          name="lock-open-outline"
                          size={18}
                          color={COLORS.primary}
                        />
                        <Text style={styles.actionText}>Reopen Event</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* QR modal */}
      <Modal
        visible={selectedQR !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedQR(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.qrModalCard}>
            <Text style={styles.modalTitle}>Event QR Code</Text>
            <Text style={styles.qrEventTitle}>{selectedQR?.title}</Text>

            <View style={styles.qrBox}>
              {selectedQR && (
                <QRCode
                  value={selectedQR.payload}
                  size={220}
                  backgroundColor="#FFFFFF"
                  color="#000000"
                />
              )}
            </View>

            <Text style={styles.eventCode}>{selectedQR?.eventCode}</Text>
            <Text style={styles.qrHint}>
              Students can scan this QR code during the event schedule.
            </Text>

            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setSelectedQR(null)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Create/edit event modal */}
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
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {editingEvent ? 'Edit Event' : 'Add Event'}
              </Text>

              <Text style={styles.fieldLabel}>Event Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter event title"
                placeholderTextColor="#888888"
              />

              <Text style={styles.fieldLabel}>Event Code *</Text>
              <TextInput
                style={styles.input}
                value={eventCode}
                onChangeText={(value) => setEventCode(value.toUpperCase())}
                placeholder="e.g. EVT-12345678"
                placeholderTextColor="#888888"
                autoCapitalize="characters"
                editable={!editingEvent}
              />
              <Text style={styles.muted}>
                {editingEvent
                  ? 'Event codes cannot be changed for existing events so previously generated QR codes keep working.'
                  : 'This code is used by the QR code and student attendance scanner.'}
              </Text>

              <DateTimeField
                label="Start Date & Time"
                value={startTime}
                onChange={setStartTime}
              />

              <DateTimeField
                label="End Date & Time"
                value={endTime}
                onChange={setEndTime}
              />

              <Text style={styles.fieldLabel}>Venue</Text>
              <TextInput
                style={styles.input}
                value={venue}
                onChangeText={setVenue}
                placeholder="Enter venue"
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

              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.statusChoices}>
                {(['open', 'closed'] as const).map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setStatus(value)}
                    style={[
                      styles.statusChoice,
                      status === value && styles.selectedChoice,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        status === value && styles.selectedChoiceText,
                      ]}
                    >
                      {value === 'open' ? 'Open' : 'Closed'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={styles.saveButton}
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

const webDateStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  minHeight: 48,
  padding: '12px 14px',
  borderRadius: 10,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.background,
  color: COLORS.textPrimary,
  fontSize: 15,
  fontFamily: 'inherit',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerText: { flex: 1 },
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
  list: { paddingBottom: 28, gap: 14 },
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
  eventInfo: { flex: 1, gap: 5 },
  eventTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  eventCode: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },
  openBadge: { backgroundColor: '#E8F7EE' },
  closedBadge: { backgroundColor: '#FCEAEA' },
  statusText: { fontSize: 11, fontWeight: '700' },
  openText: { color: '#218653' },
  closedText: { color: '#C53A3A' },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailInfo: { flex: 1, gap: 3 },
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    gap: 8,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: '20%',
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.background,
    paddingHorizontal: 6,
    paddingVertical: 11,
    borderRadius: 9,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  detailsBox: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  detailsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  reopenButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    padding: 11,
    marginTop: 8,
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
  errorText: { color: COLORS.danger, lineHeight: 20 },
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
  qrModalCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 24,
    gap: 14,
  },
  modalTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  qrEventTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  qrHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalCloseButton: {
    width: '100%',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  fieldGroup: {
    marginTop: 14,
  },
  fieldLabel: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.background,
  },
  dateTimeText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  placeholderText: {
    color: COLORS.textSecondary,
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
  statusChoices: {
    flexDirection: 'row',
    gap: 10,
  },
  statusChoice: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.card,
  },
  selectedChoice: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  choiceText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  selectedChoiceText: { color: '#FFFFFF' },
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
