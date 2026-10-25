
import { supabase } from '@/lib/supabase';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
  venue?: string;
  description?: string;
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

/**
 * Converts a local date/time string to UTC ISO format.
 *
 * Expected input example:
 * 2026-10-19T17:00
 *
 * This assumes the input represents the device's local time.
 */
function toUtcIso(value: string): string | null {
  if (!value.trim()) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export async function createEvent(
  event: Event
): Promise<{ error: string | null }> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { error: 'Please log in first.' };
  }

  if (!event.start || !event.end) {
    return { error: 'Please enter both start and end times.' };
  }

  const startTime = toUtcIso(event.start);
  const endTime = toUtcIso(event.end);

  if (!startTime || !endTime) {
    return { error: 'Invalid event date or time.' };
  }

  if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
    return { error: 'End time must be later than start time.' };
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
    start_time: startTime,
    end_time: endTime,
    venue: event.venue?.trim() || null,
    description: event.description?.trim() || null,
    created_by: userId,
    status: 'open',
  });

  return { error: error?.message ?? null };
}

export async function getEventsByTeacher(
  _teacherId: string
): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading available events:', error.message);
    throw error;
  }

  return (data ?? []) as CloudEvent[];
}

export async function getEventByCode(
  code: string
): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code.trim())
    .maybeSingle();

  if (error) {
    console.error('Error loading event:', error.message);
    return null;
  }

  return (data ?? null) as CloudEvent | null;
}

export async function updateEvent(
  event: Event,
  eventCode: string
): Promise<{ error: string | null }> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { error: 'Please log in first.' };
  }

  const startTime = toUtcIso(event.start);
  const endTime = toUtcIso(event.end);

  if (!startTime || !endTime) {
    return { error: 'Invalid event date or time.' };
  }

  if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
    return { error: 'End time must be later than start time.' };
  }

  const { data, error } = await supabase
    .from('events')
    .update({
      title: event.title.trim(),
      start_time: startTime,
      end_time: endTime,
      venue: event.venue?.trim() || null,
      description: event.description?.trim() || null,
    })
    .eq('event_code', eventCode)
    .eq('created_by', userId)
    .select('id');

  if (error) {
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return {
      error:
        'Event not found, or you do not have permission to manage it.',
    };
  }

  return { error: null };
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
      error:
        'Event not found, or you do not have permission to manage it.',
    };
  }

  return { error: null };
}
