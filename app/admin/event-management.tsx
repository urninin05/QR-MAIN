import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/useRole';

type Event = {
  id: string;
  event_code: string;
  title: string;
  start_time: string;
  end_time: string;
  created_by: string | null;
  created_at: string;
};

export default function EventManagementScreen() {
  const { isAdmin, loading: roleLoading } = useRole();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] =
    useState<Event | null>(null);

  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // =========================
  // LOAD EVENTS
  // =========================

  async function loadEvents() {
    setLoading(true);

    const { data, error } = await supabase
      .from('events')
      .select(
        'id, event_code, title, start_time, end_time, created_by, created_at'
      )
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    setEvents((data ?? []) as Event[]);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) {
      loadEvents();
    }
  }, [isAdmin]);

  // =========================
  // OPEN ADD
  // =========================

  function openAddModal() {
    setEditingEvent(null);
    setTitle('');
    setStartTime('');
    setEndTime('');
    setModalVisible(true);
  }

  // =========================
  // OPEN EDIT
  // =========================

  function openEditModal(event: Event) {
    setEditingEvent(event);

    setTitle(event.title);

    setStartTime(
      event.start_time
        .replace('T', ' ')
        .slice(0, 16)
    );

    setEndTime(
      event.end_time
        .replace('T', ' ')
        .slice(0, 16)
    );

    setModalVisible(true);
  }

  // =========================
  // CLOSE MODAL
  // =========================

  function closeModal() {
    if (saving) return;

    setModalVisible(false);
    setEditingEvent(null);
    setTitle('');
    setStartTime('');
    setEndTime('');
  }

  // =========================
  // CONVERT DATE
  // =========================

  function convertToISO(value: string) {
    const cleaned = value
      .trim()
      .replace(' ', 'T');

    const date = new Date(cleaned);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  // =========================
  // GENERATE EVENT CODE
  // =========================

  function generateEventCode() {
    return `EVT-${Date.now()
      .toString(36)
      .toUpperCase()}`;
  }

  // =========================
  // SAVE EVENT
  // =========================

  async function saveEvent() {
    if (!title.trim()) {
      Alert.alert(
        'Missing Title',
        'Please enter an event title.'
      );
      return;
    }

    if (!startTime.trim()) {
      Alert.alert(
        'Missing Start Time',
        'Please enter the start time.'
      );
      return;
    }

    if (!endTime.trim()) {
      Alert.alert(
        'Missing End Time',
        'Please enter the end time.'
      );
      return;
    }

    const startISO = convertToISO(startTime);
    const endISO = convertToISO(endTime);

    if (!startISO || !endISO) {
      Alert.alert(
        'Invalid Date',
        'Use this format:\nYYYY-MM-DD HH:mm\n\nExample:\n2026-10-20 13:00'
      );
      return;
    }

    if (
      new Date(endISO).getTime() <=
      new Date(startISO).getTime()
    ) {
      Alert.alert(
        'Invalid Time',
        'End time must be later than start time.'
      );
      return;
    }

    setSaving(true);

    try {
      // =========================
      // EDIT
      // =========================

      if (editingEvent) {
        const { error } = await supabase
          .from('events')
          .update({
            title: title.trim(),
            start_time: startISO,
            end_time: endISO,
          })
          .eq('id', editingEvent.id);

        if (error) {
          throw new Error(error.message);
        }

        Alert.alert(
          'Success',
          'Event has been updated.'
        );
      }

      // =========================
      // ADD
      // =========================

      else {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error(
            'You are not currently logged in.'
          );
        }

        const { error } = await supabase
          .from('events')
          .insert({
            event_code: generateEventCode(),
            title: title.trim(),
            start_time: startISO,
            end_time: endISO,
            created_by: user.id,
          });

        if (error) {
          throw new Error(error.message);
        }

        Alert.alert(
          'Success',
          'New event has been created.'
        );
      }

      closeModal();
      await loadEvents();
    } catch (error: any) {
      Alert.alert(
        'Operation Failed',
        error?.message ||
          'Something went wrong.'
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================
  // DELETE
  // =========================

  function confirmDelete(event: Event) {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteEvent(event),
        },
      ]
    );
  }

  async function deleteEvent(event: Event) {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);

      if (error) {
        throw new Error(error.message);
      }

      Alert.alert(
        'Deleted',
        'The event has been deleted.'
      );

      await loadEvents();
    } catch (error: any) {
      Alert.alert(
        'Delete Failed',
        error?.message ||
          'Could not delete the event.'
      );
    }
  }

  // =========================
  // LOADING
  // =========================

  if (roleLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      </View>
    );
  }

  // =========================
  // ACCESS DENIED
  // =========================

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="lock-closed-outline"
          size={45}
          color={COLORS.danger}
        />

        <Text style={styles.deniedTitle}>
          Access Denied
        </Text>

        <Text style={styles.deniedText}>
          Administrator access is required.
        </Text>
      </View>
    );
  }

  // =========================
  // SCREEN
  // =========================

  return (
    <View style={styles.container}>

      {/* HEADER */}

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            Event Management
          </Text>

          <Text style={styles.subtitle}>
            Add, edit, delete, and manage school events.
          </Text>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={openAddModal}
        >
          <Ionicons
            name="add"
            size={22}
            color="#FFFFFF"
          />

          <Text style={styles.addButtonText}>
            Add
          </Text>
        </Pressable>
      </View>

      {/* EVENTS */}

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />

          <Text style={styles.loadingText}>
            Loading events...
          </Text>
        </View>
      ) : events.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons
            name="calendar-outline"
            size={45}
            color={COLORS.textSecondary}
          />

          <Text style={styles.emptyTitle}>
            No Events Found
          </Text>

          <Text style={styles.emptyText}>
            Click Add to create your first event.
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.eventCard}>

              {/* EVENT TITLE */}

              <View style={styles.eventHeader}>
                <View style={styles.eventIcon}>
                  <Ionicons
                    name="calendar"
                    size={27}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>
                    {item.title}
                  </Text>

                  <Text style={styles.eventCode}>
                    Event Code: {item.event_code}
                  </Text>
                </View>
              </View>

              {/* START */}

              <View style={styles.detailRow}>
                <Ionicons
                  name="play-circle-outline"
                  size={21}
                  color={COLORS.primary}
                />

                <View>
                  <Text style={styles.detailLabel}>
                    Start Time
                  </Text>

                  <Text style={styles.detailValue}>
                    {item.start_time}
                  </Text>
                </View>
              </View>

              {/* END */}

              <View style={styles.detailRow}>
                <Ionicons
                  name="stop-circle-outline"
                  size={21}
                  color={COLORS.primary}
                />

                <View>
                  <Text style={styles.detailLabel}>
                    End Time
                  </Text>

                  <Text style={styles.detailValue}>
                    {item.end_time}
                  </Text>
                </View>
              </View>

              {/* ACTIONS */}

              <View style={styles.actions}>

                <Pressable
                  style={styles.editButton}
                  onPress={() =>
                    openEditModal(item)
                  }
                >
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={COLORS.primary}
                  />

                  <Text style={styles.editText}>
                    Edit
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.deleteButton}
                  onPress={() =>
                    confirmDelete(item)
                  }
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={COLORS.danger}
                  />

                  <Text style={styles.deleteText}>
                    Delete
                  </Text>
                </Pressable>

              </View>
            </View>
          )}
        />
      )}

      {/* ADD / EDIT MODAL */}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>

            <Text style={styles.modalTitle}>
              {editingEvent
                ? 'Edit Event'
                : 'Add Event'}
            </Text>

            <Text style={styles.modalSubtitle}>
              {editingEvent
                ? 'Update the event information.'
                : 'Create a new school event.'}
            </Text>

            {/* TITLE */}

            <Text style={styles.label}>
              Event Title
            </Text>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Example: Teachers Day"
              placeholderTextColor={
                COLORS.textSecondary
              }
              style={styles.input}
              editable={!saving}
            />

            {/* START */}

            <Text style={styles.label}>
              Start Time
            </Text>

            <TextInput
              value={startTime}
              onChangeText={setStartTime}
              placeholder="YYYY-MM-DD HH:mm"
              placeholderTextColor={
                COLORS.textSecondary
              }
              style={styles.input}
              editable={!saving}
            />

            {/* END */}

            <Text style={styles.label}>
              End Time
            </Text>

            <TextInput
              value={endTime}
              onChangeText={setEndTime}
              placeholder="YYYY-MM-DD HH:mm"
              placeholderTextColor={
                COLORS.textSecondary
              }
              style={styles.input}
              editable={!saving}
            />

            {!editingEvent && (
              <Text style={styles.helper}>
                Event code will be generated automatically.
              </Text>
            )}

            {/* BUTTONS */}

            <View style={styles.modalButtons}>

              <Pressable
                style={styles.cancelButton}
                onPress={closeModal}
                disabled={saving}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={styles.saveButton}
                onPress={saveEvent}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.saveText}>
                    {editingEvent
                      ? 'Save Changes'
                      : 'Create Event'}
                  </Text>
                )}
              </Pressable>

            </View>
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
    padding: 20,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },

  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 5,
  },

  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  list: {
    paddingBottom: 100,
  },

  eventCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },

  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  eventIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eventInfo: {
    flex: 1,
    marginLeft: 14,
  },

  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  eventCode: {
    marginTop: 5,
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 13,
  },

  detailLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  detailValue: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: 2,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
    marginTop: 5,
  },

  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 9,
    backgroundColor: COLORS.background,
  },

  editText: {
    marginLeft: 6,
    color: COLORS.primary,
    fontWeight: '700',
  },

  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 9,
    backgroundColor: COLORS.background,
  },

  deleteText: {
    marginLeft: 6,
    color: COLORS.danger,
    fontWeight: '700',
  },

  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 30,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  emptyText: {
    marginTop: 5,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  loadingText: {
    marginTop: 10,
    color: COLORS.textSecondary,
  },

  deniedTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  deniedText: {
    marginTop: 5,
    color: COLORS.textSecondary,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  modal: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 24,
  },

  modalTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  modalSubtitle: {
    marginTop: 5,
    marginBottom: 22,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 7,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    marginBottom: 17,
  },

  helper: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 15,
  },

  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },

  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },

  cancelText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },

  saveButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});