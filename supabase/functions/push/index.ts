
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const authorization = request.headers.get('Authorization');
    const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');

    if (
      !webhookSecret ||
      authorization !== `Bearer ${webhookSecret}`
    ) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    const payload = await request.json();
    const notification = payload.record;

    if (
      payload.type !== 'INSERT' ||
      payload.table !== 'notifications' ||
      payload.schema !== 'public' ||
      !notification?.user_id ||
      !notification?.title ||
      !notification?.body
    ) {
      return Response.json(
        { skipped: true },
        { headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Server configuration is missing.');
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: preferences, error: preferenceError } =
      await admin
        .from('notification_preferences')
        .select(
          'event_updates_enabled, attendance_reminders_enabled, push_enabled'
        )
        .eq('user_id', notification.user_id)
        .maybeSingle();

    if (preferenceError) throw preferenceError;

    if (preferences?.push_enabled === false) {
      return Response.json(
        { sent: 0, reason: 'Push notifications are disabled.' },
        { headers: corsHeaders }
      );
    }

    if (
      notification.type === 'event_update' &&
      preferences?.event_updates_enabled === false
    ) {
      return Response.json(
        { sent: 0, reason: 'Event updates are disabled.' },
        { headers: corsHeaders }
      );
    }

    if (
      notification.type === 'attendance_reminder' &&
      preferences?.attendance_reminders_enabled === false
    ) {
      return Response.json(
        { sent: 0, reason: 'Attendance reminders are disabled.' },
        { headers: corsHeaders }
      );
    }

    const { data: devices, error: tokenError } = await admin
      .from('expo_push_tokens')
      .select('expo_push_token')
      .eq('user_id', notification.user_id);

    if (tokenError) throw tokenError;

    if (!devices?.length) {
      return Response.json(
        { sent: 0, reason: 'No registered push devices.' },
        { headers: corsHeaders }
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (expoAccessToken) {
      headers.Authorization = `Bearer ${expoAccessToken}`;
    }

    const messages = devices.map((device) => ({
      to: device.expo_push_token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      channelId: 'default',
      data: {
        notificationId: notification.id,
        type: notification.type,
      },
    }));

    const expoResponse = await fetch(
      'https://exp.host/--/api/v2/push/send',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      }
    );

    const result = await expoResponse.json();

    if (!expoResponse.ok) {
      console.error('Expo Push Service error:', result);

      return Response.json(
        { error: 'Expo rejected the push request.' },
        { status: 502, headers: corsHeaders }
      );
    }

    console.log('Expo push response:', result);

    return Response.json(
      { sent: messages.length, result },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Push function failed:', error);

    return Response.json(
      { error: 'Push delivery failed.' },
      { status: 500, headers: corsHeaders }
    );
  }
});
