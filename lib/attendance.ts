
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
  studentName: string;
  studentEmail: string;
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
    .select('id, title, event_code, start_time, end_time')
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

  const rows = attendanceRows ?? [];
  const studentIds = [...new Set(rows.map((row) => row.student_id))];

  const studentDetails = new Map<
    string,
    { fullName: string; email: string }
  >();

  if (studentIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', studentIds);

    if (profilesError) {
      console.error('Error loading student profiles:', profilesError);
      throw profilesError;
    }

    for (const profile of profiles ?? []) {
      studentDetails.set(profile.id, {
        fullName: profile.full_name?.trim() || 'Unknown Student',
        email: profile.email ?? '',
      });
    }
  }

  const attendeesByEvent = new Map<string, TeacherAttendee[]>();

  for (const row of rows) {
    const student = studentDetails.get(row.student_id);
    const attendees = attendeesByEvent.get(row.event_id) ?? [];

    attendees.push({
      studentId: row.student_id,
      studentName: student?.fullName ?? 'Unknown Student',
      studentEmail: student?.email ?? '',
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
      endTime: event.end_time,
      attendeeCount: attendees.length,
      attendees,
    };
  });
}

export async function registerAttendance(
  qrData: string,
  studentId: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!studentId || studentId === 'unknown') {
      return {
        success: false,
        message: 'Please log in again before scanning.',
      };
    }

    // Accept either a plain event code or a JSON QR payload.
    let eventCode = qrData.trim();

    try {
      const parsed: unknown = JSON.parse(qrData);

      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'event' in parsed &&
        typeof parsed.event === 'string'
      ) {
        eventCode = parsed.event.trim();
      } else if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'event_code' in parsed &&
        typeof parsed.event_code === 'string'
      ) {
        eventCode = parsed.event_code.trim();
      }
    } catch {
      // The QR contains a plain event code.
    }

    if (!eventCode) {
      return {
        success: false,
        message: 'Invalid QR code. No event code found.',
      };
    }

    // Confirm the currently authenticated user.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || user.id !== studentId) {
      return {
        success: false,
        message: 'Your session is invalid. Please log in again.',
      };
    }

    // Always use the event schedule stored in Supabase.
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, event_code, start_time, end_time, status')
      .eq('event_code', eventCode)
      .maybeSingle();

    if (eventError) {
      console.error('Error finding event:', eventError.message);

      return {
        success: false,
        message: `Could not verify event: ${eventError.message}`,
      };
    }

    if (!event) {
      return {
        success: false,
        message: `Event "${eventCode}" was not found.`,
      };
    }

    if (!event.start_time || !event.end_time) {
      return {
        success: false,
        message: 'This event has no valid start or end time.',
      };
    }

    if (event.status === 'closed') {
      return {
        success: false,
        message: 'This event is closed by the teacher.',
      };
    }

    const now = Date.now();
    const start = new Date(event.start_time).getTime();
    const end = new Date(event.end_time).getTime();

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start
    ) {
      return {
        success: false,
        message: 'This event has an invalid time schedule.',
      };
    }

    if (now < start) {
      return {
        success: false,
        message: `Attendance opens at ${new Date(start).toLocaleString()}.`,
      };
    }

    if (now > end) {
      return {
        success: false,
        message: 'This event has already ended. Attendance is closed.',
      };
    }

    // Check for an existing attendance record.
    const { data: existing, error: duplicateError } = await supabase
      .from('attendance')
      .select('id')
      .eq('event_id', event.id)
      .eq('student_id', studentId)
      .maybeSingle();

    if (duplicateError) {
      console.error(
        'Error checking existing attendance:',
        duplicateError.message
      );

      return {
        success: false,
        message: `Could not check attendance: ${duplicateError.message}`,
      };
    }

    if (existing) {
      return {
        success: false,
        message: 'You have already recorded attendance for this event.',
      };
    }

    // Save the attendance record.
    const { error: insertError } = await supabase
      .from('attendance')
      .insert({
        event_id: event.id,
        student_id: studentId,
        scanned_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error saving attendance:', insertError);

      if (insertError.code === '23505') {
        return {
          success: false,
          message: 'You have already recorded attendance for this event.',
        };
      }

      return {
        success: false,
        message: `Could not save attendance: ${insertError.message}`,
      };
    }

    return {
      success: true,
      message: `Attendance recorded successfully for ${event.title}!`,
    };
  } catch (error: unknown) {
    console.error('registerAttendance failed:', error);

    const details =
      error instanceof Error ? error.message : String(error);

    return {
      success: false,
      message: `Attendance error: ${details}`,
    };
  }
}
