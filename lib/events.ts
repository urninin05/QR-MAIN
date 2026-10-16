
import { supabase } from '@/lib/supabase';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
  status?: 'open' | 'closed';
  venue?: string | null;
  description?: string | null;
};

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user.id;
}

export async function createEvent(
  event: Event
): Promise<{ error: string | null }> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { error: 'Please log in first.' };
  }

  const { data: existing, error: lookupError } = await supabase
    .from('events')
    .select('id')
    .eq('event_code', event.eventId.trim())
    .maybeSingle();

  if (lookupError) {
    return { error: lookupError.message };
  }

  if (existing) {
    return {
      error: 'This event code already exists. Please use another code.',
    };
  }

  const { error } = await supabase.from('events').insert({
    event_code: event.eventId.trim(),
    title: event.title.trim(),
    start_time: event.start || null,
    end_time: event.end || null,
    created_by: userId,
    status: 'open',
  });

  return { error: error?.message ?? null };
}

export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('Error loading teacher events:', error?.message);
    return [];
  }

  return data as CloudEvent[];
}

export async function getEventByCode(
  code: string
): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();

  if (error || !data) return null;

  return data as CloudEvent;
}

export async function updateEvent(
  event: Event,
  eventCode: string
): Promise<{ error: string | null }> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { error: 'Please log in first.' };
  }

  const { error } = await supabase
    .from('events')
    .update({
      title: event.title.trim(),
      start_time: event.start || null,
      end_time: event.end || null,
    })
    .eq('event_code', eventCode)
    .eq('created_by', userId);

  return { error: error?.message ?? null };
}

export async function closeEvent(
  eventCode: string,
  status: 'open' | 'closed'
): Promise<{ error: string | null }> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { error: 'Please log in first.' };
  }

  const { data, error } = await supabase
    .from('events')
    .update({ status })
    .eq('event_code', eventCode)
    .eq('created_by', userId)
    .select('id');

  if (error) {
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return {
      error: 'Event not found, or you do not have permission to manage it.',
    };
  }

  return { error: null };
}
