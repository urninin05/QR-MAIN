import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { createElement, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  closeEvent,
  createEvent,
  getEventsByTeacher,
  updateEvent,
  type CloudEvent,
  type Event,
} from '@/lib/events';
import { buildQRPayload } from '@/lib/qr';
import { useRole } from '@/lib/useRole';
import {
  getTeacherEventAttendance,
  type TeacherEventAttendance,
} from '@/lib/attendance';

type EditTarget = 'start' | 'end';

const QUICK_END_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not set';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPickerDate(date: Date) {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function TeacherScreen() {
  const { user } = useAuth();
  const { isTeacher, loading: roleLoading } = useRole();

  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');

  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [attendanceData, setAttendanceData] = useState<TeacherEventAttendance[]>([]);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [viewingCode, setViewingCode] = useState<string | null>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAndroid = Platform.OS === 'android';

  const loadEvents = useCallback(async () => {
    if (!user?.id) {
      setEvents([]);
      return;
    }

    setLoadingEvents(true);

    try {
      const result = await getEventsByTeacher(user.id);
      setEvents(result);
    } catch (error) {
      console.error('Could not load events:', error);
      setMessage('Could not load events. Please try again.');
    } finally {
      setLoadingEvents(false);
    }
  }, [user?.id]);

  const loadAttendance = useCallback(async () => {
    if (!user?.id) {
      setAttendanceData([]);
      return;
    }

    setLoadingAttendance(true);
    try {
      const result = await getTeacherEventAttendance(user.id);
      setAttendanceData(result);
    } catch (error) {
      console.error('Could not load attendance:', error);
      setMessage('Could not load attendance. Please try again.');
    } finally {
      setLoadingAttendance(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadEvents();
    void loadAttendance();
  }, [loadEvents, loadAttendance]);

  const resetForm = () => {
    setTitle('');
    setEventId('');
    setVenue('');
    setDescription('');
    setStartDate(new Date());
    setEndDate(new Date(Date.now() + 60 * 60 * 1000));
    setEditingCode(null);
    setEditTarget(null);
    setPayload(null);
    setMessage(null);
  };

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!editTarget) return;

    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current = editTarget === 'start' ? startDate : endDate;
    const next = new Date(current);

    next.setFullYear(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate()
    );

    next.setHours(
      selected.getHours(),
      selected.getMinutes(),
      0,
      0
    );

    if (editTarget === 'start') {
      setStartDate(next);
    } else {
      setEndDate(next);
    }

    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(new Date(startDate.getTime() + ms));
  };

  const handleSaveEvent = async () => {
    if (!user?.id) {
      setMessage('Please log in again.');
      return;
    }

    const event: Event = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: toLocalISO(startDate),
      end: toLocalISO(endDate),
      venue: venue.trim(),
      description: description.trim(),
    };

    if (!event.eventId || !event.title) {
      setMessage('Event title and code are required.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('End time must be after start time.');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const result = editingCode
        ? await updateEvent(event, editingCode)
        : await createEvent(event);

      if (result.error) {
        setMessage(result.error);
        return;
      }

      setMessage(
        editingCode
          ? 'Event updated successfully!'
          : 'Event created successfully!'
      );

      setPayload(buildQRPayload(event));
      setEditingCode(null);
      setViewingCode(null);
      setTitle('');
      setEventId('');
      setVenue('');
      setDescription('');

      await loadEvents();
      await loadAttendance();
    } catch (error) {
      console.error('Save event failed:', error);
      setMessage('Could not save event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditEvent = (event: CloudEvent) => {
    if (event.status === 'closed') {
      Alert.alert(
        'Event Closed',
        'Reopen this event before editing it.'
      );
      return;
    }

    setEditingCode(event.event_code);
    setEventId(event.event_code);
    setTitle(event.title);
    setVenue(event.venue ?? '');
    setDescription(event.description ?? '');
    setStartDate(
      event.start_time ? new Date(event.start_time) : new Date()
    );
    setEndDate(
      event.end_time
        ? new Date(event.end_time)
        : new Date(Date.now() + 60 * 60 * 1000)
    );

    setPayload(null);
    setViewingCode(null);
    setMessage(`Editing event: ${event.event_code}`);
  };

  const handleToggleStatus = (event: CloudEvent) => {
    const nextStatus = event.status === 'closed' ? 'open' : 'closed';
    const action = nextStatus === 'closed' ? 'close' : 'reopen';

    Alert.alert(
      nextStatus === 'closed' ? 'Close Event?' : 'Reopen Event?',
      `Are you sure you want to ${action} "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextStatus === 'closed' ? 'Close Event' : 'Reopen',
          onPress: async () => {
            setSaving(true);

            try {
              const result = await closeEvent(
                event.event_code,
                nextStatus
              );

              if (result.error) {
                Alert.alert('Unable to update event', result.error);
                return;
              }

              setMessage(
                nextStatus === 'closed'
                  ? 'Event closed successfully.'
                  : 'Event reopened successfully.'
              );

              await loadEvents();
            } catch (error) {
              console.error('Status update failed:', error);
              Alert.alert('Error', 'Could not update event status.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleGenerateQR = (event: CloudEvent) => {
    if (event.status === 'closed') {
      Alert.alert(
        'Event Closed',
        'Reopen this event before generating its QR code.'
      );
      return;
    }

    const qrEvent: Event = {
      eventId: event.event_code,
      title: event.title,
      start: event.start_time ?? '',
      end: event.end_time ?? '',
    };

    setPayload(buildQRPayload(qrEvent));
    setMessage(`QR code generated for ${event.title}.`);
    setViewingCode(null);
  };

  if (roleLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerTitle}>Checking your account...</Text>
      </View>
    );
  }

  if (!isTeacher) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons
          name="lock-closed-outline"
          size={48}
          color={COLORS.textSecondary}
        />
        <Text style={styles.centerTitle}>Teachers Only</Text>
        <Text style={styles.centerSubtitle}>
          Only teacher accounts can manage events.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        {editingCode ? 'Edit Event' : 'Create Event QR'}
      </Text>

      <Text style={styles.subtitle}>
        Create events, manage your events, and generate QR codes.
      </Text>

      <Text style={styles.label}>Event Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Founders Day Assembly"
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.label}>Event Code</Text>
      <TextInput
        style={[
          styles.input,
          editingCode ? styles.disabledInput : undefined,
        ]}
        value={eventId}
        onChangeText={setEventId}
        editable={!editingCode}
        autoCapitalize="characters"
        placeholder="e.g. EVT-2026-0002"
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.label}>Venue</Text>
      <TextInput
        style={styles.input}
        value={venue}
        onChangeText={setVenue}
        placeholder="e.g. School Gymnasium"
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
        value={description}
        onChangeText={setDescription}
        placeholder="Enter event details..."
        placeholderTextColor={COLORS.textSecondary}
        multiline
      />

      {Platform.OS === 'web' ? (
        <WebDateTimeFields
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
      ) : (
        <>
          <Text style={styles.label}>Starts</Text>
          <PickerField
            value={formatPickerDate(startDate)}
            icon="sunny-outline"
            onPress={() => openPicker('start')}
          />

          <Text style={styles.label}>Ends</Text>
          <PickerField
            value={formatPickerDate(endDate)}
            icon="moon-outline"
            onPress={() => openPicker('end')}
          />
        </>
      )}

      <View style={styles.chipRow}>
        {QUICK_END_OPTIONS.map((option) => (
          <Pressable
            key={option.label}
            style={styles.chip}
            onPress={() => handleQuickEnd(option.ms)}
          >
            <Text style={styles.chipText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.hint}>
        Choose a quick end time or set the date and time above.
      </Text>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <AppButton
        theme="primary"
        title={
          saving
            ? 'Saving...'
            : editingCode
              ? 'Save Changes'
              : 'Create Event'
        }
        icon={editingCode ? 'save-outline' : 'add-circle-outline'}
        onPress={handleSaveEvent}
      />

      {editingCode ? (
        <Pressable
          style={styles.cancelButton}
          onPress={resetForm}
          hitSlop={8}
        >
          <Text style={styles.cancelButtonText}>Cancel Editing</Text>
        </Pressable>
      ) : null}

      {Platform.OS !== 'web' && editTarget ? (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={editTarget === 'start' ? startDate : endDate}
            mode={isAndroid ? editingPart : 'datetime'}
            display={isAndroid ? 'default' : 'spinner'}
            onChange={onPickerChange}
          />
        </View>
      ) : null}

      {payload ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Event QR Code</Text>
          <View style={styles.qrBox}>
            <QRCode value={payload} size={200} />
          </View>
          <Text style={styles.payloadText}>{payload}</Text>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeadingText}>
          <Text style={styles.sectionTitle}>My Events</Text>
          <Text style={styles.subtitle}>
            View and manage all events, including events created by the administrator.
          </Text>
        </View>

        <Pressable
          style={styles.refreshButton}
          onPress={() => { void loadEvents(); void loadAttendance(); }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Refresh events"
        >
          <Ionicons
            name="refresh-outline"
            size={22}
            color={COLORS.primary}
          />
        </Pressable>
      </View>

      {loadingEvents ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loading}
        />
      ) : events.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons
            name="calendar-outline"
            size={34}
            color={COLORS.textSecondary}
          />
          <Text style={styles.emptyTitle}>No events yet</Text>
          <Text style={styles.emptyText}>
            Create an event using the form above.
          </Text>
        </View>
      ) : (
        events.map((event) => {
          const isClosed = event.status === 'closed';
          const isViewing = viewingCode === event.event_code;

          return (
            <View key={event.id} style={styles.eventCard}>
              <View style={styles.eventTopRow}>
                <View style={styles.eventTitleContainer}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventCode}>
                    {event.event_code}
                  </Text>
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

              <View style={styles.eventDateRow}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.eventDate}>
                  Starts: {formatDateTime(event.start_time)}
                </Text>
              </View>

              <View style={styles.eventDateRow}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.eventDate}>
                  Ends: {formatDateTime(event.end_time)}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                  onPress={() =>
                    setViewingCode(isViewing ? null : event.event_code)
                  }
                  hitSlop={6}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="eye-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.actionText}>
                    {isViewing ? 'Hide' : 'View'}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                  onPress={() => handleEditEvent(event)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${event.title}`}
                >
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                  onPress={() => handleGenerateQR(event)}
                  hitSlop={6}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.actionText}>QR</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                  onPress={() => handleToggleStatus(event)}
                  hitSlop={6}
                  accessibilityRole="button"
                  disabled={saving}
                >
                  <Ionicons
                    name={
                      isClosed
                        ? 'lock-open-outline'
                        : 'lock-closed-outline'
                    }
                    size={20}
                    color={isClosed ? '#16804A' : '#B45309'}
                  />
                  <Text
                    style={[
                      styles.actionText,
                      { color: isClosed ? '#16804A' : '#B45309' },
                    ]}
                  >
                    {isClosed ? 'Reopen' : 'Close'}
                  </Text>
                </Pressable>
              </View>

              {isViewing ? (
                <View style={styles.detailsBox}>
                  <Text style={styles.detailsTitle}>Event Details</Text>
                  <Text style={styles.detailsText}>Title: {event.title}</Text>
                  <Text style={styles.detailsText}>Code: {event.event_code}</Text>
                  <Text style={styles.detailsText}>Venue: {event.venue || 'Not specified'}</Text>
                  <Text style={styles.detailsText}>Description: {event.description || 'No description'}</Text>
                  <Text style={styles.detailsText}>Status: {isClosed ? 'Closed' : 'Open'}</Text>
                  <Text style={styles.detailsText}>Starts: {formatDateTime(event.start_time)}</Text>
                  <Text style={styles.detailsText}>Ends: {formatDateTime(event.end_time)}</Text>
                  <Text style={styles.detailsText}>Created: {formatDateTime(event.created_at)}</Text>

                  {(() => {
                    const eventAttendance = attendanceData.find(
                      (item) => item.eventId === event.id
                    );
                    const attendees = (eventAttendance?.attendees ?? []).filter((attendee) => {
                      const query = attendanceSearch.trim().toLowerCase();
                      return !query ||
                        attendee.studentName.toLowerCase().includes(query) ||
                        attendee.studentEmail.toLowerCase().includes(query);
                    });

                    return (
                      <View style={styles.attendanceSection}>
                        <View style={styles.attendanceHeader}>
                          <Text style={styles.detailsTitle}>Attendance</Text>
                          <Text style={styles.attendanceCount}>
                            {eventAttendance?.attendeeCount ?? 0} attendees
                          </Text>
                        </View>

                        <TextInput
                          style={styles.searchInput}
                          value={attendanceSearch}
                          onChangeText={setAttendanceSearch}
                          placeholder="Search student name or email"
                          placeholderTextColor={COLORS.textSecondary}
                          autoCapitalize="none"
                          accessibilityLabel="Search attendees"
                        />

                        {loadingAttendance ? (
                          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
                        ) : attendees.length === 0 ? (
                          <Text style={styles.emptyAttendanceText}>
                            {(eventAttendance?.attendeeCount ?? 0) === 0
                              ? 'No attendance recorded for this event yet.'
                              : 'No students match your search.'}
                          </Text>
                        ) : (
                          attendees.map((attendee) => (
                            <View key={`${attendee.studentId}-${attendee.scannedAt}`} style={styles.attendeeRow}>
                              <View style={styles.attendeeIcon}>
                                <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                              </View>
                              <View style={styles.attendeeInfo}>
                                <Text style={styles.attendeeName}>{attendee.studentName}</Text>
                                <Text style={styles.attendeeEmail}>{attendee.studentEmail}</Text>
                                <Text style={styles.attendeeTime}>
                                  Scanned: {formatDateTime(attendee.scannedAt)}
                                </Text>
                              </View>
                            </View>
                          ))
                        )}
                      </View>
                    );
                  })()}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({ value, icon, onPress }: PickerFieldProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pickerField,
        pressed && styles.pickerFieldPressed,
      ]}
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <Text style={styles.pickerValue}>{value}</Text>
      <Ionicons
        name="calendar-outline"
        size={18}
        color={COLORS.textSecondary}
      />
    </Pressable>
  );
}

function WebDateTimeFields({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  startDate: Date;
  endDate: Date;
  onStartChange: (date: Date) => void;
  onEndChange: (date: Date) => void;
}) {
  const toInputValue = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const renderDateTimeInput = (
    label: string,
    date: Date,
    onChange: (date: Date) => void
  ) =>
    createElement('input', {
      type: 'datetime-local',
      'aria-label': label,
      value: toInputValue(date),
      onChange: (event: { currentTarget: { value: string } }) => {
        const value = event.currentTarget.value;
        if (!value) return;
        const next = new Date(value);
        if (!Number.isNaN(next.getTime())) onChange(next);
      },
      style: {
        width: '100%',
        boxSizing: 'border-box',
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        backgroundColor: '#ffffff',
        color: COLORS.textPrimary,
        fontSize: 16,
        cursor: 'pointer',
        marginBottom: 12,
      },
    });

  return (
    <View style={{ marginTop: 12, marginBottom: 12 }}>
      <Text style={styles.label}>Start date and time</Text>
      {renderDateTimeInput('Start date and time', startDate, onStartChange)}
      <Text style={styles.label}>End date and time</Text>
      {renderDateTimeInput('End date and time', endDate, onEndChange)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  disabledInput: {
    opacity: 0.65,
  },
  pickerField: {
    minHeight: 50,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFieldPressed: {
    opacity: 0.75,
  },
  pickerValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    marginBottom: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  message: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    marginVertical: 12,
  },
  cancelButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  pickerContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
    elevation: 3,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  payloadText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 12,
  },
  sectionHeadingText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  refreshButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    marginVertical: 28,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 10,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 5,
  },
  eventCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  eventCode: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  openBadge: {
    backgroundColor: '#DCFCE7',
  },
  closedBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  openText: {
    color: '#166534',
  },
  closedText: {
    color: '#991B1B',
  },
  eventDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
  },
  eventDate: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 14,
    paddingTop: 10,
    gap: 6,
  },
  actionButton: {
    minHeight: 44,
    minWidth: 60,
    flexGrow: 1,
    flexBasis: '20%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: COLORS.surface,
  },
  actionButtonPressed: {
    opacity: 0.55,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 4,
  },
  detailsBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  detailsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  attendanceSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  attendanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  attendanceCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  searchInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 13,
    marginBottom: 10,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  attendeeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  attendeeEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  attendeeTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  emptyAttendanceText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 14,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  centerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 12,
    textAlign: 'center',
  },
  centerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
});
