// ==========================================
// 1. INISIALISASI FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCAH6eVzeSLPHGROwceBspG_HqVyPF7uvI",
    databaseURL: "https://sistem-kontrol-rh-default-rtdb.asia-southeast1.firebasedatabase.app/"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// ==========================================
// 2. SISTEM AUTENTIKASI (LOGIN/REGISTER)
// ==========================================
function switchAuthView(view) {
    document.getElementById('form-login').style.display = view === 'login' ? 'block' : 'none';
    document.getElementById('form-register').style.display = view === 'register' ? 'block' : 'none';
    document.getElementById('form-reset').style.display = view === 'reset' ? 'block' : 'none';
}

function handleLogin(e) {
    e.preventDefault();
    const inputUsername = document.getElementById('login-username').value.trim();
    const pw = document.getElementById('login-pw').value;
    const btn = document.getElementById('btn-login'); 
    
    btn.innerText = "Mencari Akun..."; btn.disabled = true;

    database.ref('usernames/' + inputUsername).once('value')
        .then(snapshot => {
            if (!snapshot.exists()) throw new Error("Username tidak ditemukan di database.");
            const userEmail = snapshot.val();
            btn.innerText = "Memverifikasi...";
            return auth.signInWithEmailAndPassword(userEmail, pw);
        })
        .then((userCredential) => {
            if (!userCredential.user.emailVerified) {
                auth.signOut(); throw new Error("Verifikasi email Anda terlebih dahulu!");
            }
        })
        .catch((err) => { alert("Login Gagal: " + err.message); btn.innerText = "MASUK DASHBOARD"; btn.disabled = false; });
}

function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const pw = document.getElementById('reg-pw').value;
    const fullName = document.getElementById('reg-name').value;
    const username = document.getElementById('reg-username').value.trim();
    const btn = document.getElementById('btn-reg'); 
    
    btn.innerText = "Memeriksa Username..."; btn.disabled = true;

    database.ref('usernames/' + username).once('value')
        .then(snapshot => {
            if (snapshot.exists()) throw new Error("Username sudah dipakai.");
            btn.innerText = "Mendaftarkan...";
            return auth.createUserWithEmailAndPassword(email, pw);
        })
        .then((userCredential) => {
            const user = userCredential.user;
            database.ref('users/' + user.uid).set({ nama: fullName, username: username, email: email });
            database.ref('usernames/' + username).set(email);
            return user.sendEmailVerification();
        })
        .then(() => {
            alert("Pendaftaran berhasil! Link verifikasi dikirim ke email Anda.");
            auth.signOut(); switchAuthView('login');
        })
        .catch((err) => { alert("Gagal Daftar: " + err.message); })
        .finally(() => { btn.innerText = "BUAT AKUN"; btn.disabled = false; });
}

function handleReset(e) {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    const btn = document.getElementById('btn-reset'); btn.innerText = "Mengirim..."; btn.disabled = true;
    auth.sendPasswordResetEmail(email)
        .then(() => { alert("Instruksi reset dikirim ke email."); switchAuthView('login'); })
        .catch((err) => { alert("Error: " + err.message); })
        .finally(() => { btn.innerText = "KIRIM LINK RESET"; btn.disabled = false; });
}

function handleLogout() { auth.signOut().then(() => { location.reload(); }); }

auth.onAuthStateChanged((user) => {
    const authScreen = document.getElementById('auth-screen');
    const displayName = document.getElementById('user-display-name');

    if (user && user.emailVerified) {
        authScreen.classList.add('opacity-0', 'pointer-events-none');
        database.ref('users/' + user.uid).once('value').then(snap => {
            displayName.innerText = snap.exists() ? snap.val().nama : "Admin Sistem";
        }).catch(() => displayName.innerText = "Koneksi Bermasalah");
        startRealtimeListener(); 
    } else {
        authScreen.classList.remove('opacity-0', 'pointer-events-none');
        document.getElementById('btn-login').innerText = "MASUK DASHBOARD";
        document.getElementById('btn-login').disabled = false;
    }
});

// ==========================================
// 3. UI DASHBOARD & NAVIGASI
// ==========================================
const views = ['home', 'history', 'chart', 'about'];
const titles = { home: "Dashboard Real-Time", history: "Riwayat Log Data", chart: "Analisis Grafik Akademis TA", about: "Informasi Sistem" };

function toggleMobileMenu() { document.getElementById('sidebar').classList.toggle('-translate-x-full'); }

function switchView(targetView) {
    views.forEach(view => {
        document.getElementById(`view-${view}`).style.display = (view === targetView) ? 'block' : 'none';
        const btn = document.getElementById(`nav-${view}`);
        if(view === targetView) { btn.classList.add('active'); btn.classList.remove('text-slate-400', 'hover:bg-slate-700/50'); } 
        else { btn.classList.remove('active'); btn.classList.add('text-slate-400', 'hover:bg-slate-700/50'); }
    });
    document.getElementById('page-title').innerText = titles[targetView];
    if (window.innerWidth < 768) document.getElementById('sidebar').classList.add('-translate-x-full');
}

function switchChartTab(tab) {
    document.getElementById('area-realtime-chart').style.display = tab === 'realtime' ? 'block' : 'none';
    document.getElementById('area-historical-chart').style.display = tab === 'historical' ? 'block' : 'none';
    document.getElementById('tab-realtime').className = tab === 'realtime' ? "px-4 py-2 text-sm font-bold border-b-2 border-emerald-500 text-emerald-400" : "px-4 py-2 text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-white";
    document.getElementById('tab-historical').className = tab === 'historical' ? "px-4 py-2 text-sm font-bold border-b-2 border-emerald-500 text-emerald-400" : "px-4 py-2 text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-white";
}

// ==========================================
// 4. KONFIGURASI GRAFIK CHART.JS (7 GRAFIK)
// ==========================================
Chart.defaults.color = '#94a3b8';
Chart.defaults.scale.grid.color = '#334155';

// [GRAFIK 1] Respons Transien (RH In, RH Max, RH Min)
function createChart1(id) {
    return new Chart(document.getElementById(id).getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'RH In Aktual (%)', borderColor: '#3b82f6', backgroundColor: '#3b82f633', data: [], tension: 0.3, fill: true, borderWidth: 2 },
            { label: 'RH Max (60%)', borderColor: '#ef4444', data: [], borderDash: [5,5], borderWidth: 1, pointRadius: 0 },
            { label: 'RH Min (40%)', borderColor: '#eab308', data: [], borderDash: [5,5], borderWidth: 1, pointRadius: 0 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { min: 0, max: 100, title: {display: true, text: 'Kelembapan (RH %)'} } } }
    });
}

// [GRAFIK 2, 3, 4, 5] Aktuator Independen
function createActuatorChart(id, label, color) {
    return new Chart(document.getElementById(id).getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [{ label: label, borderColor: color, backgroundColor: color+'22', data: [], stepped: true, fill: true, borderWidth: 2 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, animation: false,
            scales: { y: { min: -0.1, max: 1.2, title: {display: true, text: 'Status Relay'}, ticks: { stepSize: 1, callback: (v) => v === 1 ? 'ON' : (v === 0 ? 'OFF' : '') } } } 
        }
    });
}

// [GRAFIK 6] Semua Parameter Sensor (Single Left Axis 0-100)
function createChart6(id) {
    return new Chart(document.getElementById(id).getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'RH In (%)', borderColor: '#3b82f6', data: [], tension: 0.3, borderWidth: 2 },
            { label: 'RH Out (%)', borderColor: '#94a3b8', data: [], tension: 0.3, borderDash: [5,5], borderWidth: 2 },
            { label: 'Temp In (°C)', borderColor: '#f59e0b', data: [], tension: 0.3, borderWidth: 2 },
            { label: 'Temp Out (°C)', borderColor: '#fb923c', data: [], tension: 0.3, borderDash: [5,5], borderWidth: 2 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { min: 0, max: 100, title: {display: true, text: 'Nilai Sensor (0-100)'} } } }
    });
}

// [GRAFIK 7] Siklus Regenerasi (RH Buang, Suhu Buang, Suhu Ruangan)
function createChart7(id) {
    return new Chart(document.getElementById(id).getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'RH Buang / Out (%)', borderColor: '#3b82f6', data: [], tension: 0.3, borderWidth: 2 },
            { label: 'Suhu Buang / Out (°C)', borderColor: '#f59e0b', data: [], tension: 0.3, borderWidth: 2 },
            { label: 'Suhu Ruangan / In (°C)', borderColor: '#ef4444', data: [], tension: 0.3, borderWidth: 2 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { min: 0, max: 100, title: {display: true, text: 'Nilai Sensor (0-100)'} } } }
    });
}

// Inisialisasi Grafik
const rtC = [
    createChart1('rtChart1'),
    createActuatorChart('rtChart2', 'Heater (ON/OFF)', '#ef4444'),
    createActuatorChart('rtChart3', 'Fan Dehum (ON/OFF)', '#10b981'),
    createActuatorChart('rtChart4', 'Fan In (ON/OFF)', '#3b82f6'),
    createActuatorChart('rtChart5', 'Fan Out (ON/OFF)', '#8b5cf6'),
    createChart6('rtChart6'),
    createChart7('rtChart7')
];

const histC = [
    createChart1('histChart1'),
    createActuatorChart('histChart2', 'Heater (ON/OFF)', '#ef4444'),
    createActuatorChart('histChart3', 'Fan Dehum (ON/OFF)', '#10b981'),
    createActuatorChart('histChart4', 'Fan In (ON/OFF)', '#3b82f6'),
    createActuatorChart('histChart5', 'Fan Out (ON/OFF)', '#8b5cf6'),
    createChart6('histChart6'),
    createChart7('histChart7')
];

function pushMultiData(chartObj, label, dataArray) {
    try {
        chartObj.data.labels.push(label); 
        for(let i=0; i < dataArray.length; i++) { 
            if (chartObj.data.datasets[i]) chartObj.data.datasets[i].data.push(dataArray[i]); 
        } 
        if (chartObj.data.labels.length > 20) { chartObj.data.labels.shift(); chartObj.data.datasets.forEach(ds => ds.data.shift()); }
        chartObj.update();
    } catch(e) { console.error(e); }
}

// ==========================================
// 5. LISTENER REALTIME
// ==========================================
function startRealtimeListener() {
    database.ref('/current').on('value', (snapshot) => {
        const data = snapshot.val(); if (!data) return;

        document.getElementById('txt-rh-in').innerText = data.rh_in != null ? data.rh_in.toFixed(1) : "0.0";
        document.getElementById('txt-rh-out').innerText = data.rh_out != null ? data.rh_out.toFixed(1) : "0.0";
        document.getElementById('txt-temp-in').innerText = data.temp_in != null ? data.temp_in.toFixed(1) : "0.0";
        document.getElementById('txt-temp-out').innerText = data.temp_out != null ? data.temp_out.toFixed(1) : "0.0";
        document.getElementById('txt-timestamp').innerText = data.timestamp || "-";

        const mode = data.mode || "STANDBY";
        document.getElementById('badge-mode').innerText = mode;
        document.getElementById('badge-mode').className = "badge-mode " + (mode === "STANDBY" ? "bg-slate-700 text-slate-200" : mode === "ADSORPSI" ? "bg-indigo-600 text-white" : mode === "HUMIDIFIKASI" ? "bg-cyan-600 text-white" : mode.includes("REG") ? "bg-rose-600 text-white" : "bg-amber-600 text-white");

        // RESET TIMER SEBELUM DIISI
        ['timer-tads', 'timer-treg', 'timer-forced', 'timer-cooldown'].forEach(id => { 
            document.getElementById(id).innerText = "--"; 
            document.getElementById(id).className = "timer-value text-slate-600"; 
        });

        // 1. Timer Loop selalu diisi (jika ada data dari ESP32)
        document.getElementById('timer-loop').innerText = data.timer_loop || "--";
        
        // 2. Timer Mode Spesifik
        const tMode = data.timer_mode || "--";
        if (mode === "ADSORPSI") { document.getElementById('timer-tads').innerText = tMode; document.getElementById('timer-tads').classList.add('text-indigo-400'); }
        else if (mode === "REG_RUTIN") { document.getElementById('timer-treg').innerText = tMode; document.getElementById('timer-treg').classList.add('text-rose-400'); }
        else if (mode === "REG_PAKSA") { document.getElementById('timer-forced').innerText = tMode; document.getElementById('timer-forced').classList.add('text-rose-400'); }
        else if (mode === "COOLDOWN") { document.getElementById('timer-cooldown').innerText = tMode; document.getElementById('timer-cooldown').classList.add('text-amber-400'); }

        const toggleActuator = (id, isOn) => { const el = document.getElementById(id); const text = el.querySelector('.status'); if (isOn) { el.classList.add('actuator-on'); text.innerText = "ON"; } else { el.classList.remove('actuator-on'); text.innerText = "OFF"; } };
        toggleActuator('act-heater', data.heater); toggleActuator('act-fan-dehum', data.fanDehum); toggleActuator('act-fan-in', data.fanIn); toggleActuator('act-fan-out', data.fanOut);

        const tLabel = data.timestamp ? data.timestamp.split(' ')[1] : '';
        pushMultiData(rtC[0], tLabel, [data.rh_in, 60, 40]); 
        pushMultiData(rtC[1], tLabel, [data.heater ? 1 : 0]);    
        pushMultiData(rtC[2], tLabel, [data.fanDehum ? 1 : 0]);    
        pushMultiData(rtC[3], tLabel, [data.fanIn ? 1 : 0]);    
        pushMultiData(rtC[4], tLabel, [data.fanOut ? 1 : 0]);    
        pushMultiData(rtC[5], tLabel, [data.rh_in, data.rh_out, data.temp_in, data.temp_out]); 
        pushMultiData(rtC[6], tLabel, [data.rh_out, data.temp_out, data.temp_in]); 
    });
}

// ==========================================
// 6. HISTORY TABLE & PLAYBACK
// ==========================================
function loadHistoryTable() {
    const date = document.getElementById('history-date').value;
    if(!date) return alert("Pilih tanggal terlebih dahulu!");
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-emerald-400 animate-pulse">Memuat data dari server Firebase...</td></tr>';

    database.ref('/history').orderByChild('timestamp').startAt(date).endAt(date + "\uf8ff").once('value').then(snapshot => {
        const data = snapshot.val(); tbody.innerHTML = ''; let count = 0;
        if(data) {
            Object.keys(data).reverse().forEach(key => {
                const row = data[key]; count++;
                const tr = document.createElement('tr'); tr.className = "hover:bg-slate-800 border-b border-slate-700/50";
                tr.innerHTML = `<td class="px-4 py-3">${row.timestamp ? row.timestamp.split(' ')[1] : '-'}</td><td class="px-4 py-3 text-emerald-400 text-xs font-bold">${row.mode || '-'}</td><td class="px-4 py-3">${row.rh_in || 0}</td><td class="px-4 py-3">${row.rh_out || 0}</td><td class="px-4 py-3">${row.temp_in || 0}</td><td class="px-4 py-3 text-xs text-slate-400">${row.heater?'ON':'OFF'} / ${row.fanDehum?'ON':'OFF'} / ${row.fanIn?'ON':'OFF'} / ${row.fanOut?'ON':'OFF'}</td>`;
                tbody.appendChild(tr);
            });
        }
        if(count === 0) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-500">Tidak ada data di tanggal tersebut.</td></tr>`;
    }).catch(e => tbody.innerHTML = `<tr><td colspan="6" class="text-rose-500 text-center py-4">Error: ${e.message}</td></tr>`);
}

let playbackInterval = null; let playbackData = []; let playbackIndex = 0; let isPaused = false;

function togglePlayHistory() {
    const btnPlay = document.getElementById('btn-play-history');
    if (playbackInterval) { clearInterval(playbackInterval); playbackInterval = null; isPaused = true; btnPlay.innerText = "▶ Lanjutkan"; btnPlay.classList.replace('bg-emerald-600', 'bg-amber-500'); return; }
    if (isPaused && playbackData.length > 0) { isPaused = false; btnPlay.innerText = "⏸ Jeda"; btnPlay.classList.replace('bg-amber-500', 'bg-emerald-600'); startPlaybackEngine(); return; }

    const date = document.getElementById('chart-date').value; const tStart = document.getElementById('chart-time-start').value; const tEnd = document.getElementById('chart-time-end').value;
    if (!date || !tStart || !tEnd) return alert("Harap lengkapi Tanggal & Jam Mulai/Akhir!");

    btnPlay.innerText = "⏳ Memuat..."; btnPlay.disabled = true;
    database.ref('/history').orderByChild('timestamp').startAt(`${date} ${tStart}:00`).endAt(`${date} ${tEnd}:59`).once('value').then(snapshot => {
        const data = snapshot.val(); playbackData = []; 
        if (data) Object.keys(data).forEach(key => playbackData.push(data[key]));
        if (playbackData.length === 0) { btnPlay.innerText = "▶ Putar"; btnPlay.disabled = false; return alert("Tidak ada data ditemukan."); }

        playbackIndex = 0; isPaused = false; 
        histC.forEach(chart => { if(chart.data.labels) chart.data.labels = []; chart.data.datasets.forEach(ds => ds.data = []); chart.update(); });
        btnPlay.innerText = "⏸ Jeda"; btnPlay.disabled = false; startPlaybackEngine();
    }).catch(e => { console.error(e); alert("Gagal memuat history"); btnPlay.innerText = "▶ Putar"; btnPlay.disabled = false; });
}

function startPlaybackEngine() {
    playbackInterval = setInterval(() => {
        try {
            if (playbackIndex >= playbackData.length) { clearInterval(playbackInterval); playbackInterval = null; isPaused = false; document.getElementById('btn-play-history').innerText = "🔄 Selesai"; return; }
            
            const row = playbackData[playbackIndex]; const tLabel = row.timestamp ? row.timestamp.split(' ')[1] : '';
            
            pushMultiData(histC[0], tLabel, [row.rh_in, 60, 40]);
            pushMultiData(histC[1], tLabel, [row.heater ? 1 : 0]);
            pushMultiData(histC[2], tLabel, [row.fanDehum ? 1 : 0]);
            pushMultiData(histC[3], tLabel, [row.fanIn ? 1 : 0]);
            pushMultiData(histC[4], tLabel, [row.fanOut ? 1 : 0]);
            pushMultiData(histC[5], tLabel, [row.rh_in, row.rh_out, row.temp_in, row.temp_out]);
            pushMultiData(histC[6], tLabel, [row.rh_out, row.temp_out, row.temp_in]);
        } catch(error) { console.error("Error Frame", error); } finally { playbackIndex++; }
    }, 1000);
}

function stopHistoryChart() {
    clearInterval(playbackInterval); playbackInterval = null; isPaused = false; playbackData = []; playbackIndex = 0;
    const btnPlay = document.getElementById('btn-play-history'); btnPlay.innerText = "▶ Putar";
    if(btnPlay.classList.contains('bg-amber-500')) btnPlay.classList.replace('bg-amber-500', 'bg-emerald-600');
    histC.forEach(chart => { if(chart.data.labels) chart.data.labels = []; chart.data.datasets.forEach(ds => ds.data = []); chart.update(); });
}

// ==========================================
// 7. DOWNLOAD DATA CSV
// ==========================================
function downloadCSV() {
    const date = document.getElementById('history-date').value;
    if (!date) return alert("Silakan pilih tanggal terlebih dahulu.");
    
    const btn = document.querySelector('button[onclick="downloadCSV()"]'); const orig = btn.innerText; btn.innerText = "Merekap..."; btn.disabled = true;

    database.ref('/history').orderByChild('timestamp').startAt(date).endAt(date + "\uf8ff").once('value').then(snapshot => {
        const data = snapshot.val(); if (!data) return alert(`Tidak ada rekaman pada ${date}.`);
        
        let csvData = ["Waktu,Mode,RH In (%),RH Out (%),Temp In (C),Temp Out (C),Heater,Fan Sirkulasi,Fan In,Fan Out"];
        Object.keys(data).sort((a, b) => data[a].timestamp > data[b].timestamp ? 1 : -1).forEach(key => {
            const row = data[key];
            csvData.push(`"${row.timestamp || '-'}","${row.mode || '-'}",${row.rh_in||0},${row.rh_out||0},${row.temp_in||0},${row.temp_out||0},${row.heater?'ON':'OFF'},${row.fanDehum?'ON':'OFF'},${row.fanIn?'ON':'OFF'},${row.fanOut?'ON':'OFF'}`);
        });

        const blob = new Blob([csvData.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url; link.download = `Log_TA_${date}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }).catch(err => alert("Gagal unduh: " + err.message)).finally(() => { btn.innerText = orig; btn.disabled = false; });
}