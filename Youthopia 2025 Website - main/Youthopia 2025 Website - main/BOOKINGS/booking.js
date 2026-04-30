const SUPABASE_URL = 'https://fgzejzruaupvbbehjitm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_E9c-nQPGpchvgMkOqGql-A_1staD1u7';

// ===== RAZORPAY CONFIG =====
const RAZORPAY_KEY_ID = 'YOUR_RAZORPAY_KEY_ID_HERE';
const RAZORPAY_BUSINESS_NAME = 'Level Up Activities';
const RAZORPAY_THEME_COLOR = '#ff2e63';

// ===== SMS CONFIRMATION =====
const SMS_API_BASE = '';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
document.getElementById('navToggle')?.addEventListener('click', () => document.getElementById('navLinks').classList.toggle('lu-nav-open'));
document.getElementById('year').textContent = new Date().getFullYear();

const state = { activities:[], selectedActivity:null, selectedDate:null, selectedSlot:null, calMonth:new Date(), slotsData:[] };
state.calMonth.setDate(1);

const fmtDateDisplay = d => d ? d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'}) : '—';
const fmtDateISO = d => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';
const fmtTime = t => { if(!t) return '—'; const [h,m]=t.split(':').map(Number); const suf=h>=12?'PM':'AM'; const h12=h%12===0?12:h%12; return `${h12}:${String(m).padStart(2,'0')} ${suf}`; };

async function loadActivities() {
    const chipsEl = document.getElementById('activityChips');
    try {
        const { data, error } = await sb.from('activities').select('id, name, total_tables, price_per_slot').eq('is_active', true).order('name');
        if (!error && data && data.length) {
            state.activities = data.map(a => ({ id: a.id, slug: a.id, name: a.name, total_tables: a.total_tables ?? 1, price_per_slot: a.price_per_slot ?? 200 }));
        } else throw new Error();
    } catch(e) {
        state.activities = [
            {id:'8-ball-pool',slug:'8-ball-pool',name:'8-Ball Pool',total_tables:1,price_per_slot:200},
            {id:'fooseball',slug:'fooseball',name:'Foosball',total_tables:1,price_per_slot:150},
            {id:'airhockey',slug:'airhockey',name:'Air Hockey',total_tables:1,price_per_slot:180},
        ];
    }
    chipsEl.innerHTML = state.activities.map(a=>`<button class="chip" data-id="${a.id}">${a.name} · ₹${a.price_per_slot}</button>`).join('');
    chipsEl.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>selectActivity(c.dataset.id)));
    const qp = (new URLSearchParams(location.search).get('activity')||'').toLowerCase();
    if(qp){ const match=state.activities.find(a=>a.slug===qp||a.id===qp||a.name.toLowerCase().replace(/\s+/g,'-')===qp); if(match) selectActivity(match.id); }
}

function selectActivity(id) {
    const a = state.activities.find(x=>String(x.id)===String(id)); if(!a) return;
    state.selectedActivity = a;
    document.querySelectorAll('#activityChips .chip').forEach(c=>c.classList.toggle('active',String(c.dataset.id)===String(id)));
    document.getElementById('sumActivityName').textContent = a.name;
    document.getElementById('sumTable').textContent = `${a.total_tables} available`;
    updateSummary(); if(state.selectedDate) loadAvailability();
}

function renderCalendar() {
    const m = state.calMonth;
    document.getElementById('calTitle').textContent = m.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
    const today=new Date(); today.setHours(0,0,0,0);
    const firstDay=new Date(m.getFullYear(),m.getMonth(),1).getDay();
    const daysInMonth=new Date(m.getFullYear(),m.getMonth()+1,0).getDate();
    const prevDays=new Date(m.getFullYear(),m.getMonth(),0).getDate();
    const grid=document.getElementById('calGrid'); let html='';
    for(let i=firstDay-1;i>=0;i--) html+=`<div class="cal-day out">${prevDays-i}</div>`;
    for(let d=1;d<=daysInMonth;d++){
        const date=new Date(m.getFullYear(),m.getMonth(),d);
        const isToday=date.getTime()===today.getTime(), isPast=date<today, isSel=state.selectedDate&&date.getTime()===state.selectedDate.getTime();
        const cls=['cal-day']; if(isToday)cls.push('today'); if(isPast)cls.push('past'); if(isSel)cls.push('selected');
        html+=`<div class="${cls.join(' ')}" data-date="${fmtDateISO(date)}">${d}</div>`;
    }
    const trailing=(7-((firstDay+daysInMonth)%7))%7;
    for(let i=1;i<=trailing;i++) html+=`<div class="cal-day out">${i}</div>`;
    grid.innerHTML=html;
    grid.querySelectorAll('.cal-day:not(.out):not(.past)').forEach(el=>el.addEventListener('click',()=>{
        const [y,mo,da]=el.dataset.date.split('-').map(Number);
        state.selectedDate=new Date(y,mo-1,da); state.selectedSlot=null;
        renderCalendar(); updateSummary(); if(state.selectedActivity) loadAvailability();
    }));
    const now=new Date();
    document.getElementById('calPrev').disabled=(m.getFullYear()===now.getFullYear()&&m.getMonth()===now.getMonth());
}
document.getElementById('calPrev').addEventListener('click',()=>{state.calMonth.setMonth(state.calMonth.getMonth()-1);renderCalendar();});
document.getElementById('calNext').addEventListener('click',()=>{state.calMonth.setMonth(state.calMonth.getMonth()+1);renderCalendar();});

function generateSlotTimes(){const s=[];for(let m=12*60;m<23*60;m+=30){s.push(`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`);}return s;}
const ALL_SLOTS = generateSlotTimes();

async function loadAvailability(){
    if(!state.selectedActivity||!state.selectedDate) return;
    const section=document.getElementById('slotsSection');
    const select=document.getElementById('slotSelect');
    const empty=document.getElementById('slotsEmpty');
    section.style.display='block';
    empty.style.display='none';
    select.disabled=true;
    select.innerHTML='<option value="">Loading availability…</option>';
    try {
        const dateStr = fmtDateISO(state.selectedDate);
        const { data: existingBookings, error } = await sb.from('bookings').select('start_time').eq('activity_id', state.selectedActivity.id).eq('booking_date', dateStr);
        if (error) throw error;
        const counts = {};
        (existingBookings || []).forEach(b => {
            const key = (b.start_time || '').substring(0, 5);
            counts[key] = (counts[key] || 0) + 1;
        });
        const maxTables = state.selectedActivity.total_tables || 1;
        state.slotsData = ALL_SLOTS.map(t => ({
            time: t,
            status: (counts[t] || 0) >= maxTables ? 'Full' : 'Available',
            tablesAvailable: Math.max(0, maxTables - (counts[t] || 0)),
        }));
    } catch(e) {
        state.slotsData = ALL_SLOTS.map(t => ({ time: t, status: 'Available', tablesAvailable: 1 }));
    }
    renderSlots();
}

function renderSlots(){
    const select=document.getElementById('slotSelect');
    const empty=document.getElementById('slotsEmpty');
    if(!state.slotsData.length){
        empty.style.display='block';
        select.innerHTML='<option value="">No slots available</option>';
        select.disabled=true;
        return;
    }
    empty.style.display='none';
    select.disabled=false;
    const opts=['<option value="">Select a time slot…</option>'];
    state.slotsData.forEach(s=>{
        const full=s.status==='Full'||s.tablesAvailable===0;
        const sel=s.time===state.selectedSlot?' selected':'';
        const label=full?`${fmtTime(s.time)} — Full`:`${fmtTime(s.time)} — ${s.tablesAvailable} table(s) open`;
        opts.push(`<option value="${s.time}"${full?' disabled':''}${sel}>${label}</option>`);
    });
    select.innerHTML=opts.join('');
    select.onchange=()=>{
        state.selectedSlot=select.value||null;
        updateSummary();
        document.getElementById('detailsSection').style.display=state.selectedSlot?'block':'none';
    };
}

function updateSummary(){
    document.getElementById('sumDate').textContent=fmtDateDisplay(state.selectedDate);
    document.getElementById('sumTime').textContent=fmtTime(state.selectedSlot);
    const price=state.selectedActivity?state.selectedActivity.price_per_slot:0;
    document.getElementById('sumTotal').innerHTML=`₹${price}<small>/ slot</small>`;
}

document.getElementById('confirmBtn').addEventListener('click', async () => {
    const msg = document.getElementById('msg'); msg.className = 'message';
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    if(!state.selectedActivity) return showMsg('Pick an activity first.','error');
    if(!state.selectedDate) return showMsg('Pick a date.','error');
    if(!state.selectedSlot) return showMsg('Pick a time slot.','error');
    if(!name) return showMsg('Please enter your name.','error');

    const dateStr = fmtDateISO(state.selectedDate);
    const startTime = state.selectedSlot + ':00';

    try {
        const { data: check } = await sb.from('bookings').select('id')
            .eq('activity_id', state.selectedActivity.id)
            .eq('booking_date', dateStr)
            .eq('start_time', startTime);
        if ((check || []).length >= (state.selectedActivity.total_tables || 1))
            return showMsg('This slot just got taken! Please pick another.', 'error');
    } catch(e) {
        return showMsg(e.message || 'Could not verify slot availability.', 'error');
    }

    if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID === 'YOUR_RAZORPAY_KEY_ID_HERE') {
        return showMsg('Razorpay key not configured yet. Please add RAZORPAY_KEY_ID in BOOKINGS/booking.js.', 'error');
    }
    if (typeof Razorpay === 'undefined') {
        return showMsg('Razorpay checkout failed to load. Check your internet connection.', 'error');
    }

    const amountPaise = Math.round((state.selectedActivity.price_per_slot || 0) * 100);
    if (amountPaise <= 0) return showMsg('Invalid amount. Please try again.', 'error');

    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Opening payment…';

    const options = {
        key: RAZORPAY_KEY_ID,
        amount: amountPaise,
        currency: 'INR',
        name: RAZORPAY_BUSINESS_NAME,
        description: `${state.selectedActivity.name} · ${fmtDateDisplay(state.selectedDate)} · ${fmtTime(state.selectedSlot)}`,
        image: '../assets/activities/pool.png',
        prefill: { name: name, contact: phone || '' },
        notes: {
            activity_id: String(state.selectedActivity.id),
            booking_date: dateStr,
            start_time: startTime,
            customer_name: name
        },
        theme: { color: RAZORPAY_THEME_COLOR },
        modal: {
            ondismiss: function(){
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirm Booking →';
                showMsg('Payment cancelled. Your slot is not yet booked.', 'error');
            }
        },
        handler: async function(response){
            confirmBtn.textContent = 'Confirming booking…';
            try {
                const insertPayload = {
                    activity_id: state.selectedActivity.id,
                    booking_date: dateStr,
                    start_time: startTime,
                    customer_name: name,
                    customer_phone: phone || null,
                };
                if (response && response.razorpay_payment_id) {
                    insertPayload.razorpay_payment_id = response.razorpay_payment_id;
                }
                let { error } = await sb.from('bookings').insert([insertPayload]);
                if (error) {
                    if (insertPayload.razorpay_payment_id) {
                        delete insertPayload.razorpay_payment_id;
                        const retry = await sb.from('bookings').insert([insertPayload]);
                        error = retry.error;
                    }
                }
                if (error) throw new Error(error.message || 'Booking save failed');

                sendSmsConfirmation({
                    phone: phone,
                    activityName: state.selectedActivity.name,
                    dateLabel: fmtDateDisplay(state.selectedDate),
                    timeLabel: fmtTime(state.selectedSlot),
                    paymentId: response.razorpay_payment_id,
                });

                showMsg(`Payment successful! ${state.selectedActivity.name} booked on ${fmtDateDisplay(state.selectedDate)} at ${fmtTime(state.selectedSlot)}. Payment ID: ${response.razorpay_payment_id}`, 'success');
                confirmBtn.textContent = '✓ Confirmed';
                confirmBtn.disabled = true;
                loadAvailability();
            } catch(e) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirm Booking →';
                showMsg(`Payment received (ID: ${response.razorpay_payment_id}) but booking save failed: ${e.message}. Please contact support.`, 'error');
            }
        }
    };

    try {
        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function(resp){
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Booking →';
            showMsg(`Payment failed: ${resp.error?.description || 'Unknown error'}`, 'error');
        });
        rzp.open();
        confirmBtn.textContent = 'Awaiting payment…';
    } catch(e) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Booking →';
        showMsg(e.message || 'Could not open payment window.', 'error');
    }
});

function showMsg(text,kind){const m=document.getElementById('msg');m.textContent=text;m.className=`message show ${kind}`;}

async function sendSmsConfirmation({ phone, activityName, dateLabel, timeLabel, paymentId }) {
    try {
        if (!phone) return;
        let e164 = String(phone).replace(/[\s\-()]/g, '');
        if (/^\d{10}$/.test(e164)) e164 = '+91' + e164;
        if (!/^\+[1-9]\d{6,14}$/.test(e164)) { console.warn('SMS skipped: phone not in E.164'); return; }
        const message = `Level Up Activities · Booking confirmed!\n${activityName} on ${dateLabel} at ${timeLabel}.\nPayment ID: ${paymentId}\nSee you there!`;
        const resp = await fetch(`${SMS_API_BASE}/api/send-confirmation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: e164, message }),
        });
        const data = await resp.json().catch(() => ({}));
        if (data.skipped) console.info('SMS skipped:', data.reason);
        else if (data.sent) console.info('SMS sent, sid:', data.sid);
        else console.warn('SMS not sent:', data.error || resp.status);
    } catch (e) { console.warn('SMS request failed (booking still confirmed):', e?.message); }
}

loadActivities(); renderCalendar();
