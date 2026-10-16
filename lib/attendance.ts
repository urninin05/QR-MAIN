
import { supabase } from './supabase';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  studentId: string;
  eventTitle: string;
  eventCode: string;
  scannedAt: string;
};

export type TeacherAttendee = {
  studentId: string;
  scannedAt: string;
};

export type TeacherEventAttendance = {
  eventId: string;
  title: string;
  eventCode: string;
  startTime: string | null;
  endTime?: string | null;
  attendeeCount: number;
  attendees: TeacherAttendee[];
};

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, event_id, student_id, scanned_at')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error) {
    console.error('Error loading attendance history:', error);
    throw error;
  }

  const rows = data ?? [];
  const eventIds = [...new Set(rows.map((row) => row.event_id))];

  const eventDetails = new Map<
    string,
    { title: string; eventCode: string }
  >();

  if (eventIds.length > 0) {
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, event_code')
      .in('id', eventIds);

    if (eventsError) {
      console.error('Error loading event details:', eventsError);
      throw eventsError;
    }

    for (const event of events ?? []) {
      eventDetails.set(event.id, {
        title: event.title,
        eventCode: event.event_code,
      });
    }
  }

  return rows.map((row) => {
    const event = eventDetails.get(row.event_id);

    return {
      id: row.id,
      eventId: row.event_id,
      studentId: row.student_id,
      eventTitle: event?.title ?? 'Unknown Event',
      eventCode: event?.eventCode ?? 'Unknown Code',
      scannedAt: row.scanned_at,
    };
  });
}

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, title, event_code, start_time')
    .eq('created_by', teacherId)
    .order('start_time', { ascending: false });

  if (eventsError) {
    console.error('Error loading teacher events:', eventsError);
    throw eventsError;
  }

  const eventRows = events ?? [];

  if (eventRows.length === 0) {
    return [];
  }

  const eventIds = eventRows.map((event) => event.id);

  const { data: attendanceRows, error: attendanceError } =
    await supabase
      .from('attendance')
      .select('id, event_id, student_id, scanned_at')
      .in('event_id', eventIds)
      .order('scanned_at', { ascending: false });

  if (attendanceError) {
    console.error('Error loading teacher attendance:', attendanceError);
    throw attendanceError;
  }

  const attendeesByEvent = new Map<string, TeacherAttendee[]>();

  for (const row of attendanceRows ?? []) {
    const attendees = attendeesByEvent.get(row.event_id) ?? [];

    attendees.push({
      studentId: row.student_id,
      scannedAt: row.scanned_at,
    });

    attendeesByEvent.set(row.event_id, attendees);
  }

  return eventRows.map((event) => {
    const attendees = attendeesByEvent.get(event.id) ?? [];

    return {
      eventId: event.id,
      title: event.title,
      eventCode: event.event_code,
      startTime: event.start_time,
      attendeeCount: attendees.length,
      attendees,
    };
  });
}
