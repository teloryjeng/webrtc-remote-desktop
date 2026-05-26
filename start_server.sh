#!/bin/bash
echo "=== Remote Desktop Server Launcher ==="

# 1. Mendeteksi Tipe Sesi Desktop
SESSION_TYPE=$XDG_SESSION_TYPE
if [ -z "$SESSION_TYPE" ]; then
    # Fallback cek menggunakan loginctl
    SESSION_TYPE=$(loginctl show-session $(loginctl | grep $(whoami) | awk '{print $1}') -p Type | cut -d= -f2)
fi

echo "Tipe Sesi Saat Ini: ${SESSION_TYPE^^}"

if [ "$SESSION_TYPE" = "wayland" ]; then
    echo "⚠️ PERINGATAN: Sesi Anda terdeteksi WAYLAND."
    echo "robotjs (kontrol kursor) TIDAK AKAN berfungsi pada sesi Wayland."
    echo "Silakan logout dan pilih 'Ubuntu on Xorg' pada layar login!"
    echo "--------------------------------------"
fi

# 2. Cek dan atur DISPLAY secara otomatis
if [ -z "$DISPLAY" ]; then
    export DISPLAY=:0
    echo "DISPLAY belum diatur, menggunakan default: DISPLAY=:0"
else
    echo "DISPLAY saat ini: $DISPLAY"
fi

# 3. Cek dan cari XAUTHORITY aktif secara dinamis
# Jika variabel XAUTHORITY sudah terisi dan file-nya ada serta bisa dibaca oleh user aktif
if [ -n "$XAUTHORITY" ] && [ -r "$XAUTHORITY" ]; then
    echo "Menggunakan XAUTHORITY aktif: $XAUTHORITY"
else
    USER_ID=$(id -u)
    # Cari file xauth milik user aktif di /run/user/UID/
    XAUTH_FIND=$(find /run/user/$USER_ID/ -name "xauth_*" 2>/dev/null | head -n 1)
    
    if [ -n "$XAUTH_FIND" ]; then
        export XAUTHORITY=$XAUTH_FIND
        echo "Menemukan XAUTHORITY aktif pengguna: $XAUTHORITY"
    elif [ -f "$HOME/.Xauthority" ]; then
        export XAUTHORITY="$HOME/.Xauthority"
        echo "Menggunakan XAUTHORITY default pengguna: $XAUTHORITY"
    else
        echo "⚠️ XAUTHORITY tidak ditemukan. Kontrol kursor mungkin gagal."
    fi
fi

echo "Menjalankan node server.js..."
echo "======================================"
node server.js
