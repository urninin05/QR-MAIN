
import { useEffect, useState } from 'react';

import { useAuth } from './auth';
import { getProfile, type Role } from './profiles';

export function useRole() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRole() {
      if (!userId) {
        setRole(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const profile = await getProfile(userId);

        if (mounted) {
          setRole(profile?.role ?? null);
        }
      } catch (error) {
        console.error('Failed to load user role:', error);

        if (mounted) {
          setRole(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadRole();

    return () => {
      mounted = false;
    };
  }, [userId]);

  return {
    user,
    role,
    loading,
    isStudent: role === 'student',
    isTeacher: role === 'teacher',
    isAdmin: role === 'admin',
  };
}
