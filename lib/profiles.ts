
import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  avatar_url: string | null;
};

export async function getProfile(
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load profile:', error.message);
    return null;
  }

  return (data as Profile | null) ?? null;
}

export async function updateProfile(
  userId: string,
  updates: {
    full_name?: string;
    avatar_url?: string | null;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return { error: error?.message ?? null };
}
