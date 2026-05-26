# WebRTC Remote Desktop

Nama : Muhammad Sururi Ardan

NRP : 5324600011

Kelas / Program Studi : 2 Teknologi Rekayasa Multimedia A

Dosen Pengampu : Akhmad Alimudin S.ST, M.Kom, Ph.D

**POLITEKNIK ELEKTRONIKA NEGERI SURABAYA**

---
Aplikasi **WebRTC Remote Desktop** adalah platform berbasis web yang memungkinkan Anda membagikan layar komputer (*Host/Presenter*) dan mengontrolnya dari jarak jauh (*Viewer*) secara real-time melalui web browser tanpa memerlukan instalasi perangkat lunak pihak ketiga (seperti TeamViewer atau AnyDesk). 

Aplikasi ini menggunakan teknologi **WebRTC** untuk transmisi video berlatensi sangat rendah, **Socket.io** sebagai signaling server, dan **RobotJS** di sisi Host untuk mengeksekusi kontrol mouse serta keyboard.

---

## 🚀 Fitur Utama

- **Transmisi Layar Latensi Rendah (WebRTC)**: Streaming layar secara langsung dengan kecepatan tinggi dan latensi minimal.
- **Kontrol Mouse & Keyboard Penuh**: Mendukung gerakan mouse, drag-and-drop, klik kiri/kanan/tengah, scrolling, serta pengetikan keyboard jarak jauh.
- **P2P File Transfer (RTCDataChannel)**: Kirim berkas berukuran besar secara langsung antar browser (peer-to-peer) tanpa melalui server utama, menjamin keamanan dan kecepatan transfer yang tinggi.
- **Panggilan Suara VoIP**: Komunikasi suara real-time terintegrasi menggunakan mikrofon bawaan.
- **Fitur Chat Tertulis**: Kirim pesan instan antar Host dan Viewer secara langsung dilengkapi dengan notifikasi suara.
- **Arsitektur Agen Kontrol Lokal (Port 3001)**: Keamanan tambahan di mana browser Host meneruskan kontrol input ke agen kontrol lokal HTTP (`http://127.0.0.1:3001`) yang terisolasi.
- **Skrip Launcher Otomatis (`start_server.sh`)**: Mendeteksi lingkungan desktop (Xorg/Wayland) secara otomatis serta mengatur variabel lingkungan (`DISPLAY` & `XAUTHORITY`) di Linux.

---

## 🛠️ Persyaratan Sistem & Prasyarat

### 1. Kebutuhan Node.js
Pastikan Anda sudah menginstal **Node.js** (versi 16 atau yang lebih baru direkomendasikan) pada komputer Anda.

### 2. Kebutuhan Sistem Operasi (Khusus Linux)
Karena **RobotJS** melakukan simulasi input langsung pada sistem operasi, beberapa hal berikut harus diperhatikan jika Host berjalan pada sistem operasi Linux:
- **Sesi Desktop X11 / Xorg**: RobotJS **tidak mendukung Wayland**. Pastikan Anda masuk (*login*) menggunakan sesi Xorg (misalnya pilih *Ubuntu on Xorg* saat memasukkan kata sandi di layar login).
- **Pustaka Sistem yang Diperlukan**: Instal dependensi kompilasi berikut untuk mengompilasi RobotJS secara lokal:
  ```bash
  sudo apt update
  sudo apt install -y libxtst-dev libpng-dev build-essential
  ```

---

## ⚙️ Cara Instalasi & Konfigurasi

1. **Unduh atau Clone Repositori Ini**
   Masuk ke direktori proyek:
   ```bash
   cd webrtc-remote-desktop
   ```

2. **Instal Dependensi**
   Jalankan perintah npm untuk menginstal semua pustaka Node.js yang diperlukan:
   ```bash
   npm install
   ```

3. **Sertifikat SSL (Wajib)**
   Karena protokol WebRTC mewajibkan penggunaan konteks aman (**HTTPS**) agar fitur berbagi layar (`getDisplayMedia`) dan mikrofon dapat digunakan di browser modern, server utama dikonfigurasi menggunakan HTTPS.
   
   Jika Anda perlu memperbarui atau membuat sertifikat SSL *self-signed* baru, jalankan perintah ini di direktori root proyek:
   ```bash
   openssl req -nodes -new -x509 -keyout server.key -out server.cert
   ```

---

## 🖥️ Cara Penggunaan

### Langkah 1: Jalankan Server

#### A. Pada Linux (Direkomendasikan menggunakan Launcher otomatis)
Skrip ini akan mendeteksi sesi desktop Anda secara otomatis, mengonfigurasi variabel `DISPLAY` dan `XAUTHORITY`, serta mendeteksi jika Anda masih berada dalam sesi Wayland yang tidak didukung.
```bash
chmod +x start_server.sh
./start_server.sh
```

#### B. Pada Windows / macOS (Atau Menjalankan Secara Manual)
```bash
node server.js
```
*Server akan berjalan di port **3000** (untuk HTTPS utama) dan agen kontrol lokal di port **3001** (hanya di localhost 127.0.0.1).*

---

### Langkah 2: Hubungkan Melalui Browser

1. Buka peramban/browser (Chrome, Edge, Firefox, dll.) dan akses:
   - **`https://localhost:3000`** (jika berada di komputer yang sama), atau
   - **`https://[IP_ADDRESS_HOST]:3000`** (jika diakses dari komputer lain dalam satu jaringan).
2. **Peringatan Keamanan SSL**: Karena menggunakan sertifikat *self-signed*, peramban Anda akan menampilkan peringatan "Your connection is not private" atau "Koneksi tidak aman".
   - **Cara mengatasi**: Klik tombol **Advanced** (Lanjutan) lalu pilih **Proceed to ... (unsafe)** / **Lanjutkan ke ... (tidak aman)**.
3. Masukkan **Nama** panggilan Anda pada jendela pop-up awal, lalu klik **Masuk**.

---

### Langkah 3: Alur Berbagi & Mengontrol

#### A. Sebagai Host (Komputer yang Ingin Dikontrol)
1. Klik tombol **Buat Kode Akses** (di sebelah kiri).
2. Browser akan memunculkan pilihan layar/jendela yang ingin dibagikan. **Pilihlah layar penuh (Entire Screen) Anda**.
3. Klik **Share**.
4. Sebuah kode unik 6-digit (misalnya: `834927`) akan muncul berwarna kuning di atas layar. 
5. Berikan kode 6-digit tersebut kepada orang yang akan mengontrol komputer Anda (Viewer).
6. *Catatan: Biarkan tab browser tetap terbuka dan aktif selama proses remote berlangsung.*

#### B. Sebagai Viewer (Komputer yang Mengontrol)
1. Masukkan kode 6-digit unik milik Host ke dalam kolom **6 Digit Kode** (di sebelah kanan).
2. Klik tombol **Hubungkan**.
3. Layar komputer Host akan langsung muncul di browser Anda!
4. **Mulai Kontrol**:
   - Klik di dalam area video untuk mulai menggerakkan mouse, mengeklik, dan mengetik keyboard di komputer Host secara real-time.
   - Gunakan area obrolan (*chatbox*) di sebelah kanan untuk berkirim pesan teks atau melakukan panggilan suara via mikrofon dengan mengeklik ikon mikrofon.
   - Untuk mengirim berkas P2P, pastikan indikator berstatus **"Terhubung"** (berwarna hijau), klik **Pilih berkas...**, lalu klik tombol kirim berkas di sebelah kanan kolom pesan.

---

## 📁 Struktur File Proyek

```plaintext
webrtc-remote-desktop/
├── server.js              # Server utama (Express, Socket.io signaling & Local Agent)
├── start_server.sh        # Skrip launcher otomatis untuk Linux (Xorg/Wayland detector)
├── package.json           # Dependensi proyek & metadata NPM
├── server.key             # Kunci SSL Private Key (HTTPS)
├── server.cert            # Sertifikat SSL Certificate (HTTPS)
└── public/                # Direktori statis client-side
    ├── index.html         # Struktur UI Aplikasi (Presenter, Viewer, Chat, & File Transfer)
    ├── app.js             # Logika utama WebRTC & interaksi event mouse/keyboard
    ├── logo.png           # Aset logo aplikasi
    └── notif.mp3          # Efek suara pemberitahuan obrolan masuk
```

---

## ⚠️ Troubleshooting & Tips

1. **Kursor / Klik Tidak Berfungsi di Host Linux**:
   Pastikan Host tidak menggunakan sesi Wayland. Lakukan *logout*, lalu pada layar login klik ikon gerigi di pojok kanan bawah, pilih **"Ubuntu on Xorg"** atau **"GNOME on Xorg"**, dan masuk kembali.
2. **Kamera / Layar atau Mikrofon Tidak Mau Dimuat**:
   Pastikan Anda mengakses server menggunakan tautan **`https://`** bukan `http://`. Fitur media browser modern diblokir pada konteks HTTP biasa.
3. **P2P File Transfer Gagal**:
   Pastikan koneksi WebRTC (ICE Connection) berstatus sukses dan indikator status transfer file berubah menjadi hijau (**"Terhubung"**). Ini menandakan *RTCDataChannel* telah terbentuk sempurna.
