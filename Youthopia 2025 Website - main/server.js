const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SUPABASE_SERVICE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// ---------- Twilio (SMS confirmation) ----------
const TWILIO_ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER
    && !TWILIO_ACCOUNT_SID.includes('YOUR_')) {
    try {
        const twilio = require('twilio');
        twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        console.log('✓ Twilio client initialised');
    } catch (e) {
        console.warn('Twilio init failed, SMS confirmations will be skipped:', e.message);
    }
} else {
    console.log('ℹ Twilio not configured — SMS confirmations will be skipped (booking flow unaffected)');
}

// Utility function to generate 30-min time slots from 12:00 PM to 10:30 PM
const generateTimeSlots = () => {
  const slots = [];
  // 12 to 22 (12 PM to 10 PM)
  for (let hour = 12; hour <= 22; hour++) {
    const formattedHour = hour.toString().padStart(2, '0');
    slots.push(`${formattedHour}:00:00`);
    slots.push(`${formattedHour}:30:00`);
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

/**
 * GET /api/activities
 * Fetch all available activities
 */
app.get('/api/activities', async (req, res) => {
  try {
    const { data: activities, error } = await supabase
      .from('activities')
      .select('id, name');

    if (error) throw error;

    res.json({ activities });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
/**
 * GET /api/availability
 * Fetch availability for a specific date and activity
 * Query Params: ?date=YYYY-MM-DD&activity_id=UUID
 */
app.get('/api/availability', async (req, res) => {
  try {
    const { date, activity_id } = req.query;

    if (!date || !activity_id) {
      return res.status(400).json({ error: 'Missing date or activity_id query parameter' });
    }

    // 1. Get the activity details (to know total_tables)
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select('total_tables')
      .eq('id', activity_id)
      .single();

    if (activityError || !activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const totalTables = activity.total_tables;

    // 2. Get all bookings for this activity on this date
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('start_time')
      .eq('activity_id', activity_id)
      .eq('booking_date', date);

    if (bookingsError) {
      throw bookingsError;
    }

    // 3. Calculate bookings per slot
    const bookingCounts = {};
    bookings.forEach(b => {
      // Supabase time might be returned as "HH:mm:ss"
      const time = b.start_time;
      bookingCounts[time] = (bookingCounts[time] || 0) + 1;
    });

    // 4. Map the slots to availability status
    const availability = TIME_SLOTS.map(slot => {
      const bookedCount = bookingCounts[slot] || 0;
      const isFull = bookedCount >= totalTables;

      // Formatting time nicely for the response (e.g., "12:00", "12:30")
      const formattedSlot = slot.substring(0, 5);

      return {
        time: formattedSlot,
        status: isFull ? 'Full' : 'Available',
        tablesAvailable: Math.max(0, totalTables - bookedCount)
      };
    });

    res.json({
      date,
      activity_id,
      availability
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/bookings
 * Create a new booking
 * Body: { activity_id, booking_date, start_time, customer_name }
 */
app.post('/api/bookings', async (req, res) => {
  try {
    const { activity_id, booking_date, start_time, customer_name } = req.body;

    if (!activity_id || !booking_date || !start_time || !customer_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Ensure start_time has seconds for DB matching
    let formattedStartTime = start_time;
    if (formattedStartTime.length === 5) {
      formattedStartTime += ':00'; // Append seconds if "HH:mm"
    }

    // Validation: Check if time is within allowed operating hours (12 PM to 10:30 PM)
    if (!TIME_SLOTS.includes(formattedStartTime)) {
      return res.status(400).json({ 
        error: 'Invalid start_time. Must be a 30-min slot between 12:00 and 22:30.' 
      });
    }

    // 1. Get activity details
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select('total_tables')
      .eq('id', activity_id)
      .single();

    if (activityError || !activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const totalTables = activity.total_tables;

    // 2. Count current bookings for this exact slot
    const { count, error: countError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('activity_id', activity_id)
      .eq('booking_date', booking_date)
      .eq('start_time', formattedStartTime);

    if (countError) {
      throw countError;
    }

    // 3. Check if tables are available
    if (count >= totalTables) {
      return res.status(400).json({ error: 'Slot is Full. No tables available for this time.' });
    }

    // 4. Create the booking
    const { data: newBooking, error: insertError } = await supabase
      .from('bookings')
      .insert([
        {
          activity_id,
          booking_date,
          start_time: formattedStartTime,
          customer_name
        }
      ])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    res.status(201).json({
      message: 'Booking created successfully',
      booking: newBooking
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =========================================================
// SMS CONFIRMATION (Twilio)
// =========================================================
app.post('/api/send-confirmation', async (req, res) => {
    try {
        const { phone, message } = req.body || {};
        if (!phone || !message) {
            return res.status(400).json({ sent: false, error: 'phone and message are required' });
        }
        const e164 = String(phone).trim();
        if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
            return res.status(400).json({ sent: false, error: 'phone must be in E.164 format e.g. +919876543210' });
        }
        if (!twilioClient) {
            return res.json({ sent: false, skipped: true, reason: 'Twilio not configured on server' });
        }
        const result = await twilioClient.messages.create({
            body: String(message).slice(0, 1500),
            from: TWILIO_PHONE_NUMBER,
            to: e164,
        });
        return res.json({ sent: true, sid: result.sid, status: result.status });
    } catch (e) {
        console.error('Twilio send error:', e?.message);
        return res.status(500).json({ sent: false, error: e?.message || 'SMS send failed' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Booking API server running on port ${PORT}`);
});
