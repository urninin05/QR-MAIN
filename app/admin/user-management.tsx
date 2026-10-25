
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
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

type UserRole = 'student' | 'teacher' | 'admin';

type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  avatar_display_url?: string | null;
  created_at?: string;
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setError('');

    const { data, error: queryError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url, created_at')
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setUsers([]);
    } else {
      const profiles = (data ?? []) as UserProfile[];

      const usersWithAvatarUrls = await Promise.all(
        profiles.map(async (profile) => {
          if (!profile.avatar_url) {
            return { ...profile, avatar_display_url: null };
          }

          const { data: signedData, error: signedError } =
            await supabase.storage
              .from('profile-pictures')
              .createSignedUrl(profile.avatar_url, 3600);

          if (signedError) {
            console.error(
              `Could not load avatar for ${profile.email}:`,
              signedError.message,
            );

            return { ...profile, avatar_display_url: null };
          }

          return {
            ...profile,
            avatar_display_url: signedData?.signedUrl ?? null,
          };
        }),
      );

      setUsers(usersWithAvatarUrls);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();

    return (
      (user.full_name ?? '').toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    );
  });

  function openAddModal() {
    setEditingUser(null);
    setFullName('');
    setRole('student');
    setModalVisible(true);
  }

  function openEditModal(user: UserProfile) {
    setEditingUser(user);
    setFullName(user.full_name ?? '');
    setRole(user.role);
    setModalVisible(true);
  }

  async function saveUser() {
    if (!fullName.trim()) {
      Alert.alert('Missing Name', 'Please enter the user’s full name.');
      return;
    }

    if (!editingUser) {
      Alert.alert(
        'Create User',
        'A profile alone cannot create a Supabase Auth account. Please register the user through your app first, then edit their profile here.',
      );
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        role,
      })
      .eq('id', editingUser.id);

    setSaving(false);

    if (updateError) {
      Alert.alert(
        'Update Failed',
        `${updateError.message}\n\nCheck your Supabase RLS policies and role-protection trigger.`,
      );
      return;
    }

    setModalVisible(false);
    await loadUsers();
    Alert.alert('Success', 'User details updated successfully.');
  }

  function confirmDelete(user: UserProfile) {
    Alert.alert(
      'Delete Profile',
      `Delete the profile for ${user.email}? This does not delete their Supabase Auth account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteProfile(user),
        },
      ],
    );
  }

  async function deleteProfile(user: UserProfile) {
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (deleteError) {
      Alert.alert('Delete Failed', deleteError.message);
      return;
    }

    await loadUsers();
    Alert.alert('Success', 'Profile deleted.');
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Loading users...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>User Management</Text>
          <Text style={styles.muted}>
            Manage students, teachers, and administrators.
          </Text>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={openAddModal}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={21} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add</Text>
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
          placeholder="Search name, email, or role..."
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

      <Text style={styles.resultCount}>
        {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.addButton}
            onPress={() => void loadUsers()}
          >
            <Text style={styles.addButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadUsers();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No matching users found.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.avatar}>
                {item.avatar_display_url ? (
                  <Image
                    source={{ uri: item.avatar_display_url }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons
                    name={
                      item.role === 'admin'
                        ? 'shield-checkmark-outline'
                        : item.role === 'teacher'
                          ? 'school-outline'
                          : 'person-outline'
                    }
                    size={25}
                    color={COLORS.primary}
                  />
                )}
              </View>

              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {item.full_name?.trim() || 'No name'}
                </Text>
                <Text style={styles.email}>{item.email}</Text>

                <View
                  style={[
                    styles.roleBadge,
                    item.role === 'admin' && styles.adminBadge,
                  ]}
                >
                  <Text style={styles.roleText}>
                    {item.role.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.iconActions}>
                <Pressable
                  style={styles.iconButton}
                  onPress={() => openEditModal(item)}
                  accessibilityLabel={`Edit ${item.email}`}
                >
                  <Ionicons
                    name="create-outline"
                    size={21}
                    color={COLORS.primary}
                  />
                </Pressable>

                <Pressable
                  style={styles.iconButton}
                  onPress={() => confirmDelete(item)}
                  accessibilityLabel={`Delete ${item.email}`}
                >
                  <Ionicons
                    name="trash-outline"
                    size={21}
                    color={COLORS.danger}
                  />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingUser ? 'Edit User' : 'Add User'}
            </Text>

            {editingUser && (
              <Text style={styles.modalEmail}>{editingUser.email}</Text>
            )}

            {!editingUser && (
              <Text style={styles.modalHint}>
                Register the account through your app first. This form can
                create a profile only for an existing account.
              </Text>
            )}

            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              style={styles.nameInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter full name"
              placeholderTextColor="#888888"
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.roleOptions}>
              {(['student', 'teacher', 'admin'] as UserRole[]).map(
                (itemRole) => (
                  <Pressable
                    key={itemRole}
                    style={[
                      styles.roleOption,
                      role === itemRole && styles.selectedRole,
                    ]}
                    onPress={() => setRole(itemRole)}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        role === itemRole && styles.selectedRoleText,
                      ]}
                    >
                      {itemRole.charAt(0).toUpperCase() +
                        itemRole.slice(1)}
                    </Text>
                  </Pressable>
                ),
              )}
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
                style={[
                  styles.saveButton,
                  saving && styles.disabledButton,
                ]}
                onPress={() => void saveUser()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save Changes</Text>
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
    color: COLORS.textSecondary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
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
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    color: COLORS.textPrimary,
    outlineStyle: 'none',
  } as any,
  resultCount: {
    marginTop: 12,
    marginBottom: 10,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  list: {
    paddingBottom: 20,
    gap: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  email: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: COLORS.background,
  },
  adminBadge: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  iconActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    padding: 24,
    textAlign: 'center',
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 22,
  },
  modalTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalEmail: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  modalHint: {
    marginTop: 8,
    marginBottom: 18,
    lineHeight: 19,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  fieldLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    color: COLORS.textPrimary,
  },
  roleOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 4,
  },
  selectedRole: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleOptionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  selectedRoleText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    minHeight: 44,
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
    minHeight: 44,
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
  disabledButton: {
    opacity: 0.6,
  },
});
