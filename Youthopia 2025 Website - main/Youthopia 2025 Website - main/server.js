// =========================================================
// LEVEL UP — Booking API (Express + Supabase / local JSON fallback)
// =========================================================
// Run: node server.js   (or: npm run dev  with nodemon)
// =========================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const ADMIN_TOKEN  = process.env.ADMIN_TOKEN || 'change-me';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('YOUR_')) {
    try {
        const { createClient } = require('@supabase/supabase-js');
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✓ Supabase client initialised');
    } catch (e) {
        console.warn('Supabase init failed, using local JSON store:', e.message);
    }
}

// ---------- Local JSON fallback ----------
const DATA_FILE = path.resolve(__dirname, 'data.json');
function loadLocal() {
    if (!fs.existsSync(DATA_FILE)) {
        const seed = {
            activities: [
                { id: '8-ball-pool', name: '8-Ball Pool', total_tables: 1, price_per_slot: 200, is_active: true },
                { id: 'fooseball',   name: 'Foosball',   total_tables: 1, price_per_slot: 150, is_active: true },
                { id: 'airhockey',  name: 'Air Hockey',  total_tables: 1, price_per_slot: 180, is_active: true },
            ],
            bookings: [],
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function saveLocal(db) { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }

// ---------- Helpers ----------
function generateTimeSlots() {
    const slots = [];
    for (let h = 12; h <= 22; h++) {
        slots.push(`${String(h).padStart(2,'0')}:00:00`);
        slots.push(`${String(h).padStart(2,'0')}:30:00`);
    }
    return slots;
}
const TIME_SLOTS = generateTimeSlots();
const normalizeTime = t => (!t ? '' : t.length === 5 ? `${t}:00` : t);

function adminGuard(req, res, next) {
    if (req.header('x-admin-token') !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
    next();
}
function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// =========================================================
// PUBLIC
// =========================================================
app.get('/api/health', (req, res) => res.json({ ok: true, backend: supabase ? 'supabase' : 'local' }));

app.get('/api/activities', async (req, res) => {
    try {
        if (supabase) {
            const { data, error } = await supabase.from('activities').select('id,name,total_tables,price_per_slot,is_active').eq('is_active', true).order('name');
            if (error) throw error;
            return res.json({ activities: data });
        }
        const db = loadLocal();
        res.json({ activities: db.activities.filter(a => a.is_active !== false) });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/availability', async (req, res) => {
    try {
        const { date, activity_id } = req.query;
        if (!date || !activity_id) return res.status(400).json({ error: 'Missing date or activity_id' });
        let activity, bookings = [];
        if (supabase) {
            const { data: a, error: aErr } = await supabase.from('activities').select('id,total_tables,price_per_slot').eq('id', activity_id).single();
            if (aErr || !a) return res.status(404).json({ error: 'Activity not found' });
            activity = a;
            const { data: b } = await supabase.from('bookings').select('start_time').eq('activity_id', activity_id).eq('booking_date', date);
            bookings = b || [];
        } else {
            const db = loadLocal();
            activity = db.activities.find(x => x.id === activity_id);
            if (!activity) return res.status(404).json({ error: 'Activity not found' });
            bookings = db.bookings.filter(x => x.activity_id === activity_id && x.booking_date === date);
        }
        const counts = {};
        bookings.forEach(b => { counts[b.start_time] = (counts[b.start_time] || 0) + 1; });
        const availability = TIME_SLOTS.map(slot => {
            const booked = counts[slot] || 0;
            return { time: slot.substring(0,5), status: booked >= activity.total_tables ? 'Full' : 'Available', tablesAvailable: Math.max(0, activity.total_tables - booked) };
        });
        res.json({ date, activity_id, price_per_slot: activity.price_per_slot, availability });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/bookings', async (req, res) => {
    try {
        const { activity_id, booking_date, start_time, customer_name, customer_phone } = req.body;
        if (!activity_id || !booking_date || !start_time || !customer_name) return res.status(400).json({ error: 'Missing required fields' });
        const startFormatted = normalizeTime(start_time);
        if (!TIME_SLOTS.includes(startFormatted)) return res.status(400).json({ error: 'Invalid start_time' });
        if (supabase) {
            const { data: a } = await supabase.from('activities').select('total_tables').eq('id', activity_id).single();
            if (!a) return res.status(404).json({ error: 'Activity not found' });
            const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('activity_id', activity_id).eq('booking_date', booking_date).eq('start_time', startFormatted);
            if ((count || 0) >= a.total_tables) return res.status(400).json({ error: 'Slot full' });
            const { data: b, error } = await supabase.from('bookings').insert([{ activity_id, booking_date, start_time: startFormatted, customer_name, customer_phone }]).select().single();
            if (error) throw error;
            return res.status(201).json({ message: 'Booking created', booking: b });
        }
        const db = loadLocal();
        const a = db.activities.find(x => x.id === activity_id);
        if (!a) return res.status(404).json({ error: 'Activity not found' });
        if (db.bookings.filter(x => x.activity_id === activity_id && x.booking_date === booking_date && x.start_time === startFormatted).length >= a.total_tables) return res.status(400).json({ error: 'Slot full' });
        const booking = { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, activity_id, activity_name: a.name, booking_date, start_time: startFormatted, customer_name, customer_phone: customer_phone || null, created_at: new Date().toISOString() };
        db.bookings.push(booking); saveLocal(db);
        res.status(201).json({ message: 'Booking created', booking });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// =========================================================
// ADMIN
// =========================================================
app.get('/api/admin/ping', adminGuard, (req, res) => res.json({ ok: true }));

app.get('/api/admin/activities', adminGuard, async (req, res) => {
    try {
        if (supabase) { const { data, error } = await supabase.from('activities').select('*').order('name'); if (error) throw error; return res.json({ activities: data }); }
        res.json({ activities: loadLocal().activities });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/activities', adminGuard, async (req, res) => {
    try {
        const { name, total_tables = 1, price_per_slot = 200 } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });
        if (supabase) { const { data, error } = await supabase.from('activities').insert([{ name, total_tables, price_per_slot, is_active: true }]).select().single(); if (error) throw error; return res.status(201).json({ activity: data }); }
        const db = loadLocal();
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
        if (db.activities.find(a => a.id === id)) return res.status(400).json({ error: 'Activity already exists' });
        const activity = { id, name, total_tables: Number(total_tables), price_per_slot: Number(price_per_slot), is_active: true };
        db.activities.push(activity); saveLocal(db);
        res.status(201).json({ activity });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/activities/:id', adminGuard, async (req, res) => {
    try {
        const { id } = req.params;
        const patch = {};
        ['name','total_tables','price_per_slot','is_active'].forEach(k => { if (k in req.body) patch[k] = req.body[k]; });
        if (supabase) { const { data, error } = await supabase.from('activities').update(patch).eq('id', id).select().single(); if (error) throw error; return res.json({ activity: data }); }
        const db = loadLocal();
        const idx = db.activities.findIndex(a => a.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Not found' });
        db.activities[idx] = { ...db.activities[idx], ...patch }; saveLocal(db);
        res.json({ activity: db.activities[idx] });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/activities/:id', adminGuard, async (req, res) => {
    try {
        const { id } = req.params;
        if (supabase) { await supabase.from('activities').update({ is_active: false }).eq('id', id); return res.json({ ok: true }); }
        const db = loadLocal();
        const idx = db.activities.findIndex(a => a.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Not found' });
        db.activities[idx].is_active = false; saveLocal(db);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/bookings', adminGuard, async (req, res) => {
    try {
        if (supabase) {
            const { data, error } = await supabase.from('bookings').select('*,activities(name)').order('created_at', { ascending: false }).limit(15);
            if (error) throw error;
            return res.json({ bookings: (data||[]).map(b => ({ ...b, activity_name: b.activities?.name })) });
        }
        const rows = [...loadLocal().bookings].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0,15);
        res.json({ bookings: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/stats', adminGuard, async (req, res) => {
    try {
        const today = todayISO();
        if (supabase) {
            const { data: tb } = await supabase.from('bookings').select('activity_id,activities(price_per_slot)').eq('booking_date', today);
            const { count: upcoming } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).gte('booking_date', today);
            const revenue = (tb||[]).reduce((s,b) => s + (b.activities?.price_per_slot||0), 0);
            return res.json({ today_bookings: (tb||[]).length, today_revenue: revenue, upcoming_bookings: upcoming||0 });
        }
        const db = loadLocal();
        const tb = db.bookings.filter(b => b.booking_date === today);
        const actMap = Object.fromEntries(db.activities.map(a => [a.id, a.price_per_slot]));
        res.json({ today_bookings: tb.length, today_revenue: tb.reduce((s,b) => s+(actMap[b.activity_id]||0),0), upcoming_bookings: db.bookings.filter(b => b.booking_date >= today).length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Serve static site
app.use(express.static(path.resolve(__dirname)));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`\n🎮 Level Up API running → http://localhost:${PORT}\n`));
