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
import { router } from 'expo-router';

import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/useRole';

type UserRole = 'student' | 'teacher' | 'admin';

type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
};

export default function UserManagementScreen() {
  const { isAdmin, loading: roleLoading } = useRole();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editVisible, setEditVisible] = useState(false);
  const [selectedUser, setSelectedUser] =
    useState<UserProfile | null>(null);

  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] =
    useState<UserRole>('student');

  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .order('full_name', {
          ascending: true,
        });

      if (error) {
        throw new Error(error.message);
      }

      setUsers((data ?? []) as UserProfile[]);
    } catch (err: any) {
      setError(
        err?.message || 'Failed to load users.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  function openEdit(user: UserProfile) {
    setSelectedUser(user);
    setEditName(user.full_name || '');
    setEditRole(user.role);
    setEditVisible(true);
  }

  function closeEdit() {
    if (saving) return;

    setEditVisible(false);
    setSelectedUser(null);
    setEditName('');
    setEditRole('student');
  }

  async function saveUser() {
    if (!selectedUser) return;

    if (!editName.trim()) {
      Alert.alert(
        'Missing Name',
        "Please enter the user's full name."
      );
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editName.trim(),
          role: editRole,
        })
        .eq('id', selectedUser.id);

      if (error) {
        throw new Error(error.message);
      }

      Alert.alert(
        'Success',
        'User information has been updated.'
      );

      closeEdit();
      await loadUsers();
    } catch (err: any) {
      Alert.alert(
        'Update Failed',
        err?.message || 'Could not update user.'
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(user: UserProfile) {
    // Prevent accidentally deleting the currently
    // logged-in administrator.
    if (user.role === 'admin') {
      Alert.alert(
        'Cannot Delete Administrator',
        'Administrator accounts should not be deleted from this screen.'
      );
      return;
    }

    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${user.full_name || user.email}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteUser(user),
        },
      ]
    );
  }

  async function deleteUser(user: UserProfile) {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (error) {
        throw new Error(error.message);
      }

      Alert.alert(
        'Deleted',
        'The user profile has been deleted.'
      );

      await loadUsers();
    } catch (err: any) {
      Alert.alert(
        'Delete Failed',
        err?.message || 'Could not delete user.'
      );
    }
  }

  function addUser() {
    Alert.alert(
      'Add User',
      'Create the account through registration first. After registration, the administrator can edit the user role here.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Register User',
          onPress: () => router.push('/register'),
        },
      ]
    );
  }

  if (roleLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons
          name="lock-closed-outline"
          size={40}
          color={COLORS.danger}
        />

        <Text style={styles.accessDenied}>
          Access denied.
        </Text>

        <Text style={styles.accessSubtext}>
          Administrator access is required.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            User Management
          </Text>

          <Text style={styles.subtitle}>
            Manage students, teachers, and administrators.
          </Text>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={addUser}
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

      {loading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loader}
        />
      ) : error ? (
        <View style={styles.messageCard}>
          <Ionicons
            name="alert-circle-outline"
            size={32}
            color={COLORS.danger}
          />

          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.messageCard}>
          <Ionicons
            name="people-outline"
            size={40}
            color={COLORS.textSecondary}
          />

          <Text style={styles.emptyTitle}>
            No Users Found
          </Text>

          <Text style={styles.emptyText}>
            No registered users are available.
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.iconContainer}>
                <Ionicons
                  name={
                    item.role === 'admin'
                      ? 'shield-checkmark-outline'
                      : item.role === 'teacher'
                      ? 'school-outline'
                      : 'person-outline'
                  }
                  size={26}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {item.full_name || 'No name'}
                </Text>

                <Text style={styles.userEmail}>
                  {item.email}
                </Text>

                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>
                    {item.role.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={styles.editButton}
                  onPress={() => openEdit(item)}
                >
                  <Ionicons
                    name="create-outline"
                    size={21}
                    color={COLORS.primary}
                  />
                </Pressable>

                {item.role !== 'admin' && (
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() =>
                      confirmDelete(item)
                    }
                  >
                    <Ionicons
                      name="trash-outline"
                      size={21}
                      color={COLORS.danger}
                    />
                  </Pressable>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* EDIT USER MODAL */}
      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Edit User
            </Text>

            <Text style={styles.modalEmail}>
              {selectedUser?.email}
            </Text>

            <Text style={styles.inputLabel}>
              Full Name
            </Text>

            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Full name"
              placeholderTextColor={
                COLORS.textSecondary
              }
              style={styles.input}
              editable={!saving}
            />

            <Text style={styles.inputLabel}>
              Role
            </Text>

            <View style={styles.roleOptions}>
              <Pressable
                style={[
                  styles.roleOption,
                  editRole === 'student' &&
                    styles.roleOptionActive,
                ]}
                onPress={() =>
                  setEditRole('student')
                }
                disabled={saving}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    editRole === 'student' &&
                      styles.roleOptionTextActive,
                  ]}
                >
                  Student
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.roleOption,
                  editRole === 'teacher' &&
                    styles.roleOptionActive,
                ]}
                onPress={() =>
                  setEditRole('teacher')
                }
                disabled={saving}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    editRole === 'teacher' &&
                      styles.roleOptionTextActive,
                  ]}
                >
                  Teacher
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.roleOption,
                  editRole === 'admin' &&
                    styles.roleOptionActive,
                ]}
                onPress={() =>
                  setEditRole('admin')
                }
                disabled={saving}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    editRole === 'admin' &&
                      styles.roleOptionTextActive,
                  ]}
                >
                  Admin
                </Text>
              </Pressable>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={closeEdit}
                disabled={saving}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={styles.saveButton}
                onPress={saveUser}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.saveText}>
                    Save Changes
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

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  headerText: {
    flex: 1,
    paddingRight: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 5,
  },

  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  loader: {
    marginTop: 40,
  },

  list: {
    paddingBottom: 100,
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },

  userEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },

  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: COLORS.background,
  },

  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  actions: {
    flexDirection: 'row',
    gap: 8,
  },

  editButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  messageCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 24,
    marginTop: 20,
  },

  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },

  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 10,
  },

  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },

  accessDenied: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },

  accessSubtext: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 24,
  },

  modalTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  modalEmail: {
    marginTop: 5,
    marginBottom: 22,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  inputLabel: {
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
    marginBottom: 18,
  },

  roleOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },

  roleOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },

  roleOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  roleOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  roleOptionTextActive: {
    color: '#FFFFFF',
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
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