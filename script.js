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
    
    btn.innerText = "Mencari Akun..."; 
    btn.disabled = true;

    // Trik Pemetaan: Mencari Email berdasarkan Username yang dimasukkan
    database.ref('usernames/' + inputUsername).once('value')
        .then(snapshot => {
            if (!snapshot.exists()) {
                throw new Error("Username tidak ditemukan di database kami.");
            }
            const userEmail = snapshot.val(); // Mendapatkan email asli
            btn.innerText = "Memverifikasi Kredensial...";
            // Login under the hood menggunakan email tersebut
            return auth.signInWithEmailAndPassword(userEmail, pw);
        })
        .then((userCredential) => {
            if (!userCredential.user.emailVerified) {
                auth.signOut();
                throw new Error("Harap verifikasi email Anda terlebih dahulu! Cek kotak masuk atau spam.");
            }
            // Jika berhasil masuk, tampilan akan diurus oleh onAuthStateChanged
            btn.innerText = "Berhasil Masuk!";
        })
        .catch((err) => { 
            alert("Login Gagal: " + err.message); 
            btn.innerText = "MASUK DASHBOARD"; 
            btn.disabled = false; 
        });
}

function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const pw = document.getElementById('reg-pw').value;
    const fullName = document.getElementById('reg-name').value;
    const username = document.getElementById('reg-username').value.trim();
    
    const btn = document.getElementById('btn-reg'); 
    btn.innerText = "Memeriksa Username..."; 
    btn.disabled = true;

    // Pastikan Username belum dipakai orang lain
    database.ref('usernames/' + username).once('value')
        .then(snapshot => {
            if (snapshot.exists()) throw new Error("Username sudah dipakai, silakan pilih username lain.");
            btn.innerText = "Mendaftarkan Akun...";
            return auth.createUserWithEmailAndPassword(email, pw);
        })
        .then((userCredential) => {
            const user = userCredential.user;
            // Menyimpan Profil Lengkap
            database.ref('users/' + user.uid).set({ nama: fullName, username: username, email: email });
            // Menyimpan tabel mapping Username (PENTING untuk fitur login)
            database.ref('usernames/' + username).set(email);
            
            return user.sendEmailVerification();
        })
        .then(() => {
            alert("Pendaftaran berhasil! Link verifikasi telah dikirim ke email Anda. Silakan verifikasi lalu Login.");
            auth.signOut();
            switchAuthView('login');
        })
        .catch((err) => { alert("Pendaftaran Ditolak: " + err.message); })
        .finally(() => { btn.innerText = "BUAT AKUN"; btn.disabled = false; });
}

function handleReset(e) {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    const btn = document.getElementById('btn-reset'); btn.innerText = "Mengirim..."; btn.disabled = true;

    auth.sendPasswordResetEmail(email)
        .then(() => { alert("Instruksi reset password telah dikirim ke email Anda."); switchAuthView('login'); })
        .catch((err) => { alert("Error: " + err.message); })
        .finally(() => { btn.innerText = "KIRIM LINK RESET"; btn.disabled = false; });
}

function handleLogout() { 
    auth.signOut().then(() => { location.reload(); }); // Refresh halaman saat logout agar bersih
}

// =======================================================
// Monitor Status Login & Perbaikan Text "Memuat..."
// =======================================================
auth.onAuthStateChanged((user) => {
    const authScreen = document.getElementById('auth-screen');
    const displayName = document.getElementById('user-display-name');

    if (user && user.emailVerified) {
        // Hilangkan tirai layar perlahan (fade out)
        authScreen.classList.add('opacity-0', 'pointer-events-none');
        
        // Panggil database untuk mengganti tulisan "Memuat..."
        database.ref('users/' + user.uid).once('value')
            .then(snap => {
                if(snap.exists()) {
                    displayName.innerText = snap.val().nama; // Menampilkan Nama Lengkap
                } else {
                    displayName.innerText = "Admin Sistem"; // Fallback jika data hilang
                }
            })
            .catch(err => {
                console.error("Gagal menarik nama profil:", err);
                displayName.innerText = "Koneksi Bermasalah";
            });

        // Jalankan sinkronisasi sensor setelah profil dimuat
        startRealtimeListener(); 
    } else {
        // Tampilkan tirai layar login jika belum masuk
        authScreen.classList.remove('opacity-0', 'pointer-events-none');
        document.getElementById('btn-login').innerText = "MASUK DASHBOARD";
        document.getElementById('btn-login').disabled = false;
    }
});

// ==========================================
// 3. UI DASHBOARD LAMA
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
    document.getElementById('tab-realtime').className = tab === 'realtime' ? "px-4 py-2 text-sm font-bold border-b-2 border-emerald-500 text-emerald-400 whitespace-nowrap" : "px-4 py-2 text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-white whitespace-nowrap";
    document.getElementById('tab-historical').className = tab === 'historical' ? "px-4 py-2 text-sm font-bold border-b-2 border-emerald-500 text-emerald-400 whitespace-nowrap" : "px-4 py-2 text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-white whitespace-nowrap";
}

// ==========================================
// 4. KONFIGURASI GRAFIK CHART.JS
// ==========================================
Chart.defaults.color = '#94a3b8';
Chart.defaults.scale.grid.color = '#334155';

function createLineChart(ctxId, label1, color1, label2, color2, yTitleText) {
    return new Chart(document.getElementById(ctxId).getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: label1, borderColor: color1, backgroundColor: color1+'33', data: [], tension: 0.3, borderWidth: 2 },
            { label: label2, borderColor: color2, backgroundColor: 'transparent', data: [], tension: 0.3, borderWidth: 2, borderDash: label2.includes('Target') ? [5,5] : [] }
        ]},
        options: { 
            responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
            scales: { 
                x: { title: { display: true, text: 'Waktu' } },
                // Sumbu Y dikunci absolut dari 0 - 100
                y: { min: 0, max: 100, title: { display: true, text: yTitleText } } 
            } 
        }
    });
}

function createDualAxisChart(ctxId) {
    return new Chart(document.getElementById(ctxId).getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'RH In (%)', borderColor: '#3b82f6', data: [], yAxisID: 'y', tension: 0.3 },
            { label: 'Heater (ON/OFF)', borderColor: '#ef4444', data: [], yAxisID: 'y1', stepped: true },
            { label: 'Fan Dehum (ON/OFF)', borderColor: '#10b981', data: [], yAxisID: 'y1', stepped: true }
        ]},
        options: { 
            responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
            scales: { 
                x: { title: { display: true, text: 'Waktu' } },
                // Sumbu Y untuk RH dikunci 0 - 100
                y: { position: 'left', min: 0, max: 100, title: { display: true, text: 'Kelembapan (RH %)' } }, 
                y1: { position: 'right', min: -0.1, max: 1.2, title: { display: true, text: 'Status Digital' }, grid: {drawOnChartArea: false} } 
            } 
        }
    });
}

function createVentilationChart(ctxId) {
    return new Chart(document.getElementById(ctxId).getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'RH In (%)', borderColor: '#3b82f6', data: [], yAxisID: 'y', tension: 0.3 },
            { label: 'RH Luar (%)', borderColor: '#94a3b8', data: [], yAxisID: 'y', tension: 0.3, borderDash: [5,5] },
            { label: 'Ventilasi (ON/OFF)', borderColor: '#14b8a6', backgroundColor: 'rgba(20,184,166,0.15)', data: [], yAxisID: 'y1', stepped: true, fill: true }
        ]},
        options: { 
            responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
            scales: { 
                x: { title: { display: true, text: 'Waktu' } },
                // Sumbu Y untuk RH dikunci 0 - 100
                y: { position: 'left', min: 0, max: 100, title: { display: true, text: 'Kelembapan (RH %)' } }, 
                y1: { position: 'right', min: -0.1, max: 1.2, title: { display: true, text: 'Status Digital' }, grid: {drawOnChartArea: false} } 
            } 
        }
    });
}

// INISIALISASI GRAFIK REALTIME (Hanya 5 Grafik)
const rtC = [
    createLineChart('rtChart1', 'RH In Aktual (%)', '#3b82f6', 'Target (55%)', '#22c55e', 'Kelembapan (RH %)'),
    createDualAxisChart('rtChart2'),
    createVentilationChart('rtChart3'),
    createLineChart('rtChart4', 'Suhu Buang (°C)', '#f59e0b', 'RH Buang (%)', '#8b5cf6', 'Suhu (°C) & RH (%)'),
    // Grafik 5: Siklus Adsorpsi (Suhu Dalam vs RH Dalam)
    createLineChart('rtChart5', 'Suhu Dalam (°C)', '#eab308', 'RH Dalam (%)', '#3b82f6', 'Suhu (°C) & RH (%)')
];

// INISIALISASI GRAFIK HISTORY (Hanya 5 Grafik)
const histC = [
    createLineChart('histChart1', 'RH In Aktual (%)', '#3b82f6', 'Target (55%)', '#22c55e', 'Kelembapan (RH %)'),
    createDualAxisChart('histChart2'),
    createVentilationChart('histChart3'),
    createLineChart('histChart4', 'Suhu Buang (°C)', '#f59e0b', 'RH Buang (%)', '#8b5cf6', 'Suhu (°C) & RH (%)'),
    // Grafik 5: Siklus Adsorpsi
    createLineChart('histChart5', 'Suhu Dalam (°C)', '#eab308', 'RH Dalam (%)', '#3b82f6', 'Suhu (°C) & RH (%)')
];

// FUNGSI INJEKSI DATA (Sudah Dibersihkan dari logika Scatter)
function pushMultiData(chartObj, label, dataArray) {
    try {
        chartObj.data.labels.push(label); 
        for(let i=0; i < dataArray.length; i++) { 
            if (chartObj.data.datasets[i]) { 
                chartObj.data.datasets[i].data.push(dataArray[i]); 
            }
        } 
        
        const MAX_PTS = 20; 
        if (chartObj.data.labels && chartObj.data.labels.length > MAX_PTS) {
            chartObj.data.labels.shift(); 
            chartObj.data.datasets.forEach(ds => ds.data.shift());
        }
        chartObj.update();
    } catch(e) {
        console.error("Error injeksi grafik:", e);
    }
}

// ==========================================
// 5. LISTENER REALTIME (Baru dipanggil setelah Login)
// ==========================================
let rtModeStats = { 'STANDBY': 0, 'ADSORPSI': 0, 'HUMIDIFIKASI': 0, 'REGENERASI': 0 };

function startRealtimeListener() {
    database.ref('/current').on('value', (snapshot) => {
        const data = snapshot.val(); if (!data) return;

        document.getElementById('txt-rh-in').innerText = data.rh_in != null ? data.rh_in.toFixed(1) : "0.0";
        document.getElementById('txt-rh-out').innerText = data.rh_out != null ? data.rh_out.toFixed(1) : "0.0";
        document.getElementById('txt-temp-in').innerText = data.temp_in != null ? data.temp_in.toFixed(1) : "0.0";
        document.getElementById('txt-temp-out').innerText = data.temp_out != null ? data.temp_out.toFixed(1) : "0.0";
        document.getElementById('txt-timestamp').innerText = data.timestamp || "-";

        const mode = data.mode || "STANDBY";
        const badgeMode = document.getElementById('badge-mode');
        badgeMode.innerText = mode;
        badgeMode.className = "badge-mode " + (mode === "STANDBY" ? "bg-slate-700 text-slate-200" : mode === "ADSORPSI" ? "bg-indigo-600 text-white" : mode === "HUMIDIFIKASI" ? "bg-cyan-600 text-white" : mode.includes("REG") ? "bg-rose-600 text-white" : "bg-amber-600 text-white");

        const sisa = data.sisa_waktu || "0m";
        ['timer-standby', 'timer-tads', 'timer-treg', 'timer-tdar'].forEach(id => { document.getElementById(id).innerText = "--"; document.getElementById(id).className = "timer-value text-slate-600"; });
        if (mode === "STANDBY") { document.getElementById('timer-standby').innerText = sisa; document.getElementById('timer-standby').classList.add('text-emerald-400'); }
        else if (mode === "ADSORPSI") { document.getElementById('timer-tads').innerText = sisa; document.getElementById('timer-tads').classList.add('text-indigo-400'); }
        else if (mode.includes("REG")) { document.getElementById('timer-treg').innerText = sisa; document.getElementById('timer-treg').classList.add('text-rose-400'); }

        const toggleActuator = (id, isOn) => { const el = document.getElementById(id); const text = el.querySelector('.status'); if (isOn) { el.classList.add('actuator-on'); text.innerText = "ON"; } else { el.classList.remove('actuator-on'); text.innerText = "OFF"; } };
        toggleActuator('act-heater', data.heater); toggleActuator('act-fan-dehum', data.fanDehum); toggleActuator('act-fan-in', data.fanIn); toggleActuator('act-fan-out', data.fanOut);

        // Update 5 Grafik Realtime
        const tLabel = data.timestamp ? data.timestamp.split(' ')[1] : '';
        pushMultiData(rtC[0], tLabel, [data.rh_in, 55]); 
        pushMultiData(rtC[1], tLabel, [data.rh_in, data.heater?1:0, data.fanDehum?1:0]);    
        pushMultiData(rtC[2], tLabel, [data.rh_in, data.rh_out, data.fanIn?1:0]); 
        pushMultiData(rtC[3], tLabel, [data.temp_out, data.rh_out]); 
        // Perbaikan Data Grafik 5
        pushMultiData(rtC[4], tLabel, [data.temp_in, data.rh_in]); 
    });
}

// ==========================================
// 6. FITUR HISTORY DATA & PLAYBACK (FIXED)
// ==========================================

// A. Fungsi Memuat Tabel Riwayat
function loadHistoryTable() {
    const date = document.getElementById('history-date').value;
    if(!date) return alert("Pilih tanggal terlebih dahulu!");
    
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-emerald-400 animate-pulse">Memuat data dari server Firebase...</td></tr>';

    database.ref('/history').orderByChild('timestamp').startAt(date).endAt(date + "\uf8ff").once('value')
        .then(snapshot => {
            const data = snapshot.val(); tbody.innerHTML = ''; let count = 0;
            if(data) {
                // Urutkan data dari yang terbaru (reverse)
                Object.keys(data).reverse().forEach(key => {
                    const row = data[key]; count++;
                    const tr = document.createElement('tr'); tr.className = "hover:bg-slate-800 border-b border-slate-700/50";
                    tr.innerHTML = `
                        <td class="px-4 py-3">${row.timestamp ? row.timestamp.split(' ')[1] : '-'}</td>
                        <td class="px-4 py-3 text-emerald-400 text-xs font-bold">${row.mode || '-'}</td>
                        <td class="px-4 py-3">${row.rh_in || 0}</td>
                        <td class="px-4 py-3">${row.rh_out || 0}</td>
                        <td class="px-4 py-3">${row.temp_in || 0}</td>
                        <td class="px-4 py-3 text-xs text-slate-400">${row.heater?'ON':'OFF'} / ${row.fanDehum?'ON':'OFF'} / ${row.fanIn?'ON':'OFF'} / ${row.fanOut?'ON':'OFF'}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            if(count === 0) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-500">Tidak ada data di tanggal tersebut.</td></tr>`;
        })
        .catch(e => tbody.innerHTML = `<tr><td colspan="6" class="text-rose-500 text-center py-4">Error: ${e.message}</td></tr>`);
}

// Variabel Global Playback
let playbackInterval = null; 
let playbackData = []; 
let playbackIndex = 0; 
let isPaused = false;
let histModeStats = { 'STANDBY': 0, 'ADSORPSI': 0, 'HUMIDIFIKASI': 0, 'REGENERASI': 0 };

function clearHistCharts() {
    histC.forEach(chart => {
        if(chart.data.labels) chart.data.labels = [];
        chart.data.datasets.forEach(ds => ds.data = []);
        chart.update();
    });
}

// B. Fungsi Tombol Play/Jeda
function togglePlayHistory() {
    const btnPlay = document.getElementById('btn-play-history');
    
    // Jika sedang main -> Pause
    if (playbackInterval) { 
        clearInterval(playbackInterval); 
        playbackInterval = null; 
        isPaused = true; 
        btnPlay.innerText = "▶ Lanjutkan"; 
        btnPlay.classList.replace('bg-emerald-600', 'bg-amber-500'); 
        return; 
    }
    
    // Jika sedang Pause -> Lanjut
    if (isPaused && playbackData.length > 0) { 
        isPaused = false; 
        btnPlay.innerText = "⏸ Jeda"; 
        btnPlay.classList.replace('bg-amber-500', 'bg-emerald-600'); 
        startPlaybackEngine(); 
        return; 
    }

    // Jika belum jalan -> Tarik data dari database
    const date = document.getElementById('chart-date').value;
    const tStart = document.getElementById('chart-time-start').value;
    const tEnd = document.getElementById('chart-time-end').value;
    
    if (!date || !tStart || !tEnd) return alert("Harap lengkapi Tanggal & Jam Mulai/Akhir!");

    btnPlay.innerText = "⏳ Memuat..."; btnPlay.disabled = true;
    
    const startTimestamp = `${date} ${tStart}:00`;
    const endTimestamp = `${date} ${tEnd}:59`;

    database.ref('/history').orderByChild('timestamp').startAt(startTimestamp).endAt(endTimestamp).once('value')
        .then(snapshot => {
            const data = snapshot.val(); 
            playbackData = []; 
            histModeStats = { 'STANDBY': 0, 'ADSORPSI': 0, 'HUMIDIFIKASI': 0, 'REGENERASI': 0 };
            
            if (data) Object.keys(data).forEach(key => playbackData.push(data[key]));
            if (playbackData.length === 0) { 
                btnPlay.innerText = "▶ Putar"; btnPlay.disabled = false; 
                return alert("Tidak ada data ditemukan pada rentang jam tersebut."); 
            }

            playbackIndex = 0; isPaused = false; clearHistCharts();
            btnPlay.innerText = "⏸ Jeda"; btnPlay.disabled = false; 
            startPlaybackEngine();
        })
        .catch(e => { console.error(e); alert("Gagal memuat history"); btnPlay.innerText = "▶ Putar"; btnPlay.disabled = false; });
}

// C. Fungsi Engine Penggerak Grafik (1 Detik/Data)
function startPlaybackEngine() {
    playbackInterval = setInterval(() => {
        try {
            if (playbackIndex >= playbackData.length) { 
                clearInterval(playbackInterval); 
                playbackInterval = null; 
                isPaused = false; 
                document.getElementById('btn-play-history').innerText = "🔄 PUTAR ULANG"; 
                return; 
            }
            
            const row = playbackData[playbackIndex]; 
            const tLabel = row.timestamp ? row.timestamp.split(' ')[1] : '';
            
            const htr = row.heater ? 1 : 0; 
            const fd = row.fanDehum ? 1 : 0; 
            const vent = row.fanIn ? 1 : 0;

            // Mendorong data ke 5 Canvas Grafik Playback
            pushMultiData(histC[0], tLabel, [row.rh_in, 55]);
            pushMultiData(histC[1], tLabel, [row.rh_in, htr, fd]);
            pushMultiData(histC[2], tLabel, [row.rh_in, row.rh_out, vent]);
            pushMultiData(histC[3], tLabel, [row.temp_out, row.rh_out]);
            // Perbaikan Data Grafik 5
            pushMultiData(histC[4], tLabel, [row.temp_in, row.rh_in]);

        } catch(error) {
            console.error("Data terlewati akibat corrupt:", error);
        } finally {
            playbackIndex++; // Paksa index naik agar grafik tidak nyangkut (Stuck)
        }
    }, 1000);
}

// D. Fungsi Stop Tombol Merah
function stopHistoryChart() {
    clearInterval(playbackInterval); 
    playbackInterval = null; 
    isPaused = false; 
    playbackData = []; 
    playbackIndex = 0;
    
    const btnPlay = document.getElementById('btn-play-history'); 
    btnPlay.innerText = "▶ Putar";
    if(btnPlay.classList.contains('bg-amber-500')) btnPlay.classList.replace('bg-amber-500', 'bg-emerald-600');
    
    clearHistCharts();
}

// ==========================================
// 7. DOWNLOAD DATA CSV (FIXED & OPTIMIZED)
// ==========================================
function downloadCSV() {
    // 1. Ambil nilai tanggal dari kotak input
    const date = document.getElementById('history-date').value;
    
    // 2. Blokir jika tanggal belum dipilih
    if (!date) {
        alert("Peringatan: Silakan pilih tanggal terlebih dahulu sebelum mengunduh data CSV.");
        return; 
    }
    
    // 3. Efek visual tombol memuat
    const btns = document.querySelectorAll('button');
    let btnDownload = null;
    btns.forEach(b => { if(b.innerText.includes("Unduh CSV")) btnDownload = b; });
    
    const originalText = btnDownload ? btnDownload.innerText : "Unduh CSV";
    if (btnDownload) { btnDownload.innerText = "Merekap Data..."; btnDownload.disabled = true; }

    // 4. Minta Firebase HANYA mengirimkan data pada tanggal yang dipilih
    database.ref('/history')
        .orderByChild('timestamp')
        .startAt(date)
        .endAt(date + "\uf8ff")
        .once('value')
        .then(snapshot => {
            const data = snapshot.val();
            
            // Jika Firebase merespons kosong
            if (!data) {
                alert(`Tidak ada rekaman data yang tersimpan pada tanggal ${date}.`);
                return;
            }

            let csvData = ["Waktu (Timestamp),Mode Sistem,RH In (%),RH Out (%),Temp In (C),Temp Out (C),Heater,Fan Sirkulasi (Dehum),Fan In (Vent),Fan Out (Vent)"];
            
            // Urutkan data berdasarkan waktu dari pagi ke malam
            const keys = Object.keys(data).sort((a, b) => {
                return (data[a].timestamp > data[b].timestamp) ? 1 : -1;
            });

            // Susun baris CSV
            keys.forEach(key => {
                const row = data[key];
                
                const htr = row.heater ? 'ON' : 'OFF';
                const fDehum = row.fanDehum ? 'ON' : 'OFF';
                const fIn = row.fanIn ? 'ON' : 'OFF';
                const fOut = row.fanOut ? 'ON' : 'OFF';
                
                // Tambahkan tanda kutip pada timestamp agar format waktu tidak rusak di Microsoft Excel
                csvData.push(`"${row.timestamp || '-'}","${row.mode || '-'}",${row.rh_in || 0},${row.rh_out || 0},${row.temp_in || 0},${row.temp_out || 0},${htr},${fDehum},${fIn},${fOut}`);
            });

            // 5. Proses perakitan file Blob
            const blob = new Blob([csvData.join("\n")], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Log_Data_TA_Tanggal_${date}.csv`);
            
            // Eksekusi klik unduh otomatis
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Bersihkan memori Cache
            setTimeout(() => URL.revokeObjectURL(url), 100);
        })
        .catch(err => {
            console.error("Gagal Download:", err);
            alert("Gagal mengunduh: Pastikan koneksi internet stabil. Pesan error: " + err.message);
        })
        .finally(() => {
            // Kembalikan kondisi tombol seperti semula
            if (btnDownload) { btnDownload.innerText = originalText; btnDownload.disabled = false; }
        });
}