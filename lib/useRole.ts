import { useEffect, useState } from 'react';

import { useAuth } from './auth';
import { getProfile, type Role } from './profiles';

export function useRole() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRole() {
      if (!user) {
        if (mounted) {
          setRole(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const profile = await getProfile(user.id);

      if (mounted) {
        setRole(profile?.role ?? 'student');
        setLoading(false);
      }
    }

    loadRole();

    return () => {
      mounted = false;
    };
  }, [user]);

  return {
    user,
    role,
    loading,
    isStudent: role === 'student',
    isTeacher: role === 'teacher',
  };
}