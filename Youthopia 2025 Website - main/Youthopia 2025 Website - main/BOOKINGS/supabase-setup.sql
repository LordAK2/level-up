-- Run this in Supabase SQL Editor.
-- It creates the tables used by BOOKINGS/index.html.

create extension if not exists "pgcrypto";

create table if not exists public.activities (
    id text primary key,
    name text not null unique,
    time_slots text[] not null default array[
        '12:00','12:30','13:00','13:30','14:00','14:30',
        '15:00','15:30','16:00','16:30','17:00','17:30',
        '18:00','18:30','19:00','19:30','20:00','20:30',
        '21:00','21:30','22:00','22:30'
    ],
    max_tables integer not null default 8,
    created_at timestamptz not null default now()
);

create table if not exists public.bookings (
    id uuid primary key default gen_random_uuid(),
    activity_id text not null references public.activities(id) on delete cascade,
    booking_date date not null,
    start_time text not null,
    customer_name text not null,
    payment_id text,
    payment_order_id text,
    payment_signature text,
    payment_status text not null default 'pending',
    created_at timestamptz not null default now()
);

alter table public.bookings
    add column if not exists payment_id text,
    add column if not exists payment_order_id text,
    add column if not exists payment_signature text,
    add column if not exists payment_status text not null default 'pending';

alter table public.bookings
    drop constraint if exists bookings_one_per_slot,
    add constraint bookings_one_per_slot unique (activity_id, booking_date, start_time);

alter table public.bookings
    drop constraint if exists bookings_start_time_half_hour_range,
    add constraint bookings_start_time_half_hour_range
    check (
        start_time ~ '^([01][0-9]|2[0-3]):(00|30)$'
        and start_time >= '12:00'
        and start_time <= '22:30'
    );

create index if not exists idx_bookings_activity_date_time
    on public.bookings(activity_id, booking_date, start_time);

-- Allow read access for loading activities and checking availability.
alter table public.activities enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "Public can read activities" on public.activities;
create policy "Public can read activities"
    on public.activities for select
    to anon
    using (true);

drop policy if exists "Public can read bookings" on public.bookings;
create policy "Public can read bookings"
    on public.bookings for select
    to anon
    using (true);

-- Client can read bookings for availability.
drop policy if exists "Public can create bookings" on public.bookings;

-- Keep only requested activities.
delete from public.activities
where id not in ('8-ball-pool', 'fooseball', 'airhockey');

-- Seed activities (safe to run multiple times).
insert into public.activities (id, name, time_slots, max_tables) values
('8-ball-pool', '8-ball pool', array[
    '12:00','12:30','13:00','13:30','14:00','14:30',
    '15:00','15:30','16:00','16:30','17:00','17:30',
    '18:00','18:30','19:00','19:30','20:00','20:30',
    '21:00','21:30','22:00','22:30'
], 1),
('fooseball', 'fooseball', array[
    '12:00','12:30','13:00','13:30','14:00','14:30',
    '15:00','15:30','16:00','16:30','17:00','17:30',
    '18:00','18:30','19:00','19:30','20:00','20:30',
    '21:00','21:30','22:00','22:30'
], 1),
('airhockey', 'airhockey', array[
    '12:00','12:30','13:00','13:30','14:00','14:30',
    '15:00','15:30','16:00','16:30','17:00','17:30',
    '18:00','18:30','19:00','19:30','20:00','20:30',
    '21:00','21:30','22:00','22:30'
], 1)
on conflict (id) do update
set
    name = excluded.name,
    time_slots = excluded.time_slots,
    max_tables = excluded.max_tables;
