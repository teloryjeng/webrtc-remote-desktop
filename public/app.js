// Paksa halaman untuk selalu mulai dari atas saat dimuat ulang
if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; }
window.scrollTo(0, 0);

const socket = io();
const remoteVideo = document.getElementById('remoteVideo');
const hostStatusOverlay = document.getElementById('hostStatusOverlay');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');
const identityModal = document.getElementById('identityModal');
const userNameInput = document.getElementById('userNameInput');
const joinBtn = document.getElementById('joinBtn');
const inputCode = document.getElementById('inputCode');
const displayCode = document.getElementById('displayCode');
const micBtn = document.getElementById('micBtn');

// Pembersihan awal kotak masukan
inputCode.value = '';
userNameInput.value = '';
chatInput.value = '';

let peerConnection;
let myUserName = "Anonymous";
let currentRoomCode = null;
let localStream = null;
let localMicStream = null;

// Variabel Transfer Berkas
let dataChannel;
let receiveBuffer = [];
let receivedSize = 0;
let expectedSize = 0;
let expectedName = "";
let expectedType = "";
let expectedSender = "Anonymous";

const notifySound = new Audio('notif.mp3');
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// --- 1. IDENTITAS ---
joinBtn.onclick = () => {
    if (userNameInput.value.trim()) {
        myUserName = userNameInput.value.trim();
        identityModal.style.display = 'none';
    }
};

// --- 2. FITUR VOIP (MIKROFON) ---
micBtn.onclick = async () => {
    if (!localMicStream) {
        try {
            localMicStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            micBtn.innerHTML = '<i class="bi bi-mic-fill"></i>';
            micBtn.style.color = "#28a745";
            micBtn.title = "Mikrofon Menyala";

            if (peerConnection && currentRoomCode) {
                localMicStream.getTracks().forEach(track => peerConnection.addTrack(track, localMicStream));
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                socket.emit('webrtc_event', { room: currentRoomCode, event: { type: 'offer', offer: offer } });
            }
        } catch (err) { alert("Akses mikrofon ditolak!"); }
    } else {
        localMicStream.getTracks().forEach(track => track.stop());
        localMicStream = null;
        micBtn.innerHTML = '<i class="bi bi-mic-mute-fill"></i>';
        micBtn.style.color = "#e74c3c";
        micBtn.title = "Mikrofon Mati";
    }
};

// --- 3. PEMBUATAN KAMAR & BERBAGI LAYAR ---
document.getElementById('startBtn').onclick = async () => {
    try {
        localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });

        localStream.getVideoTracks()[0].onended = () => {
            hostStatusOverlay.style.display = 'none';
            remoteVideo.style.visibility = 'visible';
            displayCode.innerText = "";
            chatMessages.innerHTML = '';
            if (peerConnection) { peerConnection.close(); peerConnection = null; }
            localStream = null;
            currentRoomCode = null;
            updateFileTransferUI(false);
        };

        socket.emit('create_room');
    } catch (err) { alert("Akses layar ditolak!"); }
};

socket.on('room_created', (code) => {
    currentRoomCode = code;
    displayCode.innerText = "KODE: " + code;
    chatMessages.innerHTML = '';
    hostStatusOverlay.style.display = 'flex';
    remoteVideo.style.visibility = 'hidden';
    createPeerConnection();
});

document.getElementById('viewBtn').onclick = () => {
    const code = inputCode.value.trim();
    if (code.length === 6) socket.emit('join_room', code);
};

socket.on('room_joined', (data) => {
    if (data.success) {
        currentRoomCode = data.code;
        chatMessages.innerHTML = '';
        inputCode.value = '';
        hostStatusOverlay.style.display = 'none';
        remoteVideo.style.visibility = 'visible';
        createPeerConnection();
        remoteVideo.play();
    } else { alert("Kode salah!"); }
});

socket.on('local_execute', async (data) => {
    try {
        await fetch('http://127.0.0.1:3001/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (err) {
        console.warn("Gagal meneruskan ke local control agent:", err.message);
    }
});

// --- 4. KONEKSI WEBRTC & TRANSFER BERKAS ---
function updateFileTransferUI(enabled) {
    const fileArea = document.getElementById('fileTransferArea');
    const fileInput = document.getElementById('fileInput');
    const badge = document.getElementById('connectionBadge');

    if (!fileArea || !fileInput) return;

    if (enabled) {
        fileArea.classList.remove('disabled');
        fileInput.removeAttribute('disabled');
        if (badge) {
            badge.style.color = '#28a745';
            badge.style.background = 'rgba(40, 167, 69, 0.1)';
            badge.innerHTML = '<i class="bi bi-unlock-fill"></i> Terhubung';
        }
    } else {
        fileArea.classList.add('disabled');
        fileInput.setAttribute('disabled', 'true');
        if (badge) {
            badge.style.color = '#e74c3c';
            badge.style.background = 'rgba(231, 76, 60, 0.1)';
            badge.innerHTML = '<i class="bi bi-lock-fill"></i> Belum Terhubung';
        }
        fileInput.value = '';
        fileInput.dispatchEvent(new Event('change'));
    }
}

function setupDataChannel(channel) {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
        updateFileTransferUI(true);
    };

    channel.onclose = () => {
        updateFileTransferUI(false);
    };

    channel.onmessage = (event) => {
        if (typeof event.data === 'string') {
            const meta = JSON.parse(event.data);
            if (meta.type === 'file_meta') {
                expectedSize = meta.size;
                expectedName = meta.name;
                expectedType = meta.fileType;
                expectedSender = meta.senderName || "Pengguna Lain";
                receiveBuffer = [];
                receivedSize = 0;
                appendMessage(expectedSender, `Menerima file: ${expectedName}...`, 'remote');
            }
        } else {
            receiveBuffer.push(event.data);
            receivedSize += event.data.byteLength;
            if (receivedSize === expectedSize) {
                const blob = new Blob(receiveBuffer, { type: expectedType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = expectedName;
                a.click();
                URL.revokeObjectURL(url);
                appendMessage(expectedSender, `File ${expectedName} berhasil didownload.`, 'remote');
                receiveBuffer = [];
            }
        }
    };
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE Connection State Change:", peerConnection.iceConnectionState);
    };

    peerConnection.onconnectionstatechange = () => {
        console.log("Connection State Change:", peerConnection.connectionState);
        if (peerConnection.connectionState === 'disconnected' ||
            peerConnection.connectionState === 'failed' ||
            peerConnection.connectionState === 'closed') {
            updateFileTransferUI(false);
        }
    };

    peerConnection.ondatachannel = (e) => {
        dataChannel = e.channel;
        setupDataChannel(dataChannel);
    };

    peerConnection.ontrack = (e) => {
        console.log("ontrack event triggered:", e);
        if (e.streams && e.streams[0]) {
            remoteVideo.srcObject = e.streams[0];
        } else {
            if (!remoteVideo.srcObject) {
                remoteVideo.srcObject = new MediaStream();
            }
            remoteVideo.srcObject.addTrack(e.track);
        }

        remoteVideo.play().catch(err => {
            console.warn("Auto-play failed, video might need user interaction to unmute:", err);
        });
    };

    peerConnection.onicecandidate = (e) => {
        if (e.candidate) socket.emit('webrtc_event', { room: currentRoomCode, event: { type: 'candidate', candidate: e.candidate } });
    };
}

socket.on('viewer_ready', async () => {
    if (!peerConnection) createPeerConnection();

    dataChannel = peerConnection.createDataChannel('fileTransfer');
    setupDataChannel(dataChannel);

    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('webrtc_event', { room: currentRoomCode, event: { type: 'offer', offer: offer } });
    }
});

socket.on('webrtc_event', async (event) => {
    if (!peerConnection) createPeerConnection();
    if (event.type === 'offer') {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(event.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('webrtc_event', { room: currentRoomCode, event: { type: 'answer', answer: answer } });

            // Process queued candidates
            if (peerConnection.iceCandidatesQueue) {
                for (const candidate of peerConnection.iceCandidatesQueue) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
                        console.error("Error adding queued ice candidate:", err);
                    });
                }
                peerConnection.iceCandidatesQueue = [];
            }
        } catch (err) {
            console.error("Error during offer handling:", err);
        }
    } else if (event.type === 'answer') {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(event.answer));

            // Process queued candidates
            if (peerConnection.iceCandidatesQueue) {
                for (const candidate of peerConnection.iceCandidatesQueue) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
                        console.error("Error adding queued ice candidate:", err);
                    });
                }
                peerConnection.iceCandidatesQueue = [];
            }
        } catch (err) {
            console.error("Error during answer handling:", err);
        }
    } else if (event.type === 'candidate') {
        if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(event.candidate)).catch(err => {
                console.error("Error adding ice candidate:", err);
            });
        } else {
            if (!peerConnection.iceCandidatesQueue) {
                peerConnection.iceCandidatesQueue = [];
            }
            peerConnection.iceCandidatesQueue.push(event.candidate);
        }
    }
});

// Event listener untuk memperbarui label nama berkas saat berkas dipilih
const fileInput = document.getElementById('fileInput');
const fileNameLabel = document.getElementById('fileNameLabel');
if (fileInput && fileNameLabel) {
    fileInput.addEventListener('change', () => {
        const sendBtn = document.getElementById('sendBtn');
        if (fileInput.files.length > 0) {
            fileNameLabel.textContent = fileInput.files[0].name;
            fileNameLabel.style.color = '#fff';

            // Ubah ikon input file kustom
            const icon = fileInput.parentElement.querySelector('.custom-file-label i');
            if (icon) {
                icon.className = 'bi bi-file-earmark-check';
                icon.style.color = '#28a745';
            }

            // Ubah tombol kirim chat menjadi tombol kirim berkas (Hijau + Ikon Berkas)
            if (sendBtn) {
                sendBtn.style.color = '#28a745';
                const sendIcon = sendBtn.querySelector('i');
                if (sendIcon) sendIcon.className = 'bi bi-file-earmark-arrow-up-fill';
            }
        } else {
            fileNameLabel.textContent = 'Pilih File...';
            fileNameLabel.style.color = '#ccc';

            // Kembalikan ikon kustom input file
            const icon = fileInput.parentElement.querySelector('.custom-file-label i');
            if (icon) {
                icon.className = 'bi bi-folder2-open';
                icon.style.color = '#0078d4';
            }

            // Kembalikan tombol kirim chat semula (Biru + Ikon Kirim Chat)
            if (sendBtn) {
                sendBtn.style.color = '#0078d4';
                const sendIcon = sendBtn.querySelector('i');
                if (sendIcon) sendIcon.className = 'bi bi-send-fill';
            }
        }
    });
}

// --- 5. CHAT TERTULIS ---
function appendMessage(sender, text, type) {
    const div = document.createElement('div');
    div.className = `msg ${type === 'local' ? 'msg-local' : 'msg-remote'}`;
    div.innerHTML = `<span class="sender-tag">${sender}</span>${text}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if (type === 'remote') notifySound.play().catch(() => { });
}

function handleSend() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput ? fileInput.files[0] : null;

    let hasFile = file && dataChannel && dataChannel.readyState === 'open';
    let hasText = chatInput.value.trim() && currentRoomCode;

    if (!hasFile && !hasText) return;

    // 1. Jika ada berkas, kirim berkas
    if (hasFile) {
        dataChannel.send(JSON.stringify({ type: 'file_meta', name: file.name, size: file.size, fileType: file.type, senderName: myUserName }));

        const chunkSize = 16384;
        const reader = new FileReader();
        let offset = 0;

        reader.onload = (e) => {
            dataChannel.send(e.target.result);
            offset += e.target.result.byteLength;
            if (offset < file.size) readSlice(offset);
            else {
                appendMessage("Saya", `File ${file.name} berhasil terkirim.`, 'local');
                fileInput.value = '';
                fileInput.dispatchEvent(new Event('change'));
            }
        };
        const readSlice = (o) => reader.readAsArrayBuffer(file.slice(o, o + chunkSize));
        readSlice(0);
    }

    // 2. Jika ada teks pesan, kirim teks pesan
    if (hasText) {
        socket.emit('chat_message', { room: currentRoomCode, sender: myUserName, text: chatInput.value.trim() });
        appendMessage("Saya", chatInput.value.trim(), 'local');
        chatInput.value = '';
    }
}

sendBtn.onclick = handleSend;
chatInput.onkeydown = (e) => { if (e.key === 'Enter') { handleSend(); e.stopPropagation(); } };
socket.on('chat_message', (data) => appendMessage(data.sender, data.text, 'remote'));

// --- 6. KONTROL TETIKUS & PAPAN KETIK ---
let isDragging = false;
let dragButton = 'left';

function getRelativeCoordinates(e) {
    if (remoteVideo.videoWidth === 0 || remoteVideo.videoHeight === 0) return null;

    const rect = remoteVideo.getBoundingClientRect();

    const videoWidth = remoteVideo.videoWidth;
    const videoHeight = remoteVideo.videoHeight;
    const elementWidth = rect.width;
    const elementHeight = rect.height;

    // Hitung skala pengisian 'contain'
    const scale = Math.min(elementWidth / videoWidth, elementHeight / videoHeight);

    // Dimensi gambar video render sebenarnya
    const renderedWidth = videoWidth * scale;
    const renderedHeight = videoHeight * scale;

    // Offset bilah hitam
    const offsetX = (elementWidth - renderedWidth) / 2;
    const offsetY = (elementHeight - renderedHeight) / 2;

    // Posisi relatif terhadap area video aktif
    const activeX = (e.clientX - rect.left - offsetX) / renderedWidth;
    const activeY = (e.clientY - rect.top - offsetY) / renderedHeight;

    // Batasi dalam rentang [0, 1] dan abaikan jika di luar area video aktif
    if (activeX >= 0 && activeX <= 1 && activeY >= 0 && activeY <= 1) {
        return { x: activeX, y: activeY };
    }
    return null;
}

remoteVideo.addEventListener('mousedown', (e) => {
    if (currentRoomCode) {
        isDragging = true;
        dragButton = e.button === 2 ? 'right' : (e.button === 1 ? 'middle' : 'left');
        socket.emit('mouse_down', { room: currentRoomCode, button: dragButton });
    }
});

remoteVideo.addEventListener('mouseup', (e) => {
    if (currentRoomCode) {
        isDragging = false;
        let btn = e.button === 2 ? 'right' : (e.button === 1 ? 'middle' : 'left');
        socket.emit('mouse_up', { room: currentRoomCode, button: btn });
    }
});

remoteVideo.addEventListener('mouseleave', () => {
    if (isDragging && currentRoomCode) {
        isDragging = false;
        socket.emit('mouse_up', { room: currentRoomCode, button: dragButton });
    }
});

remoteVideo.addEventListener('mousemove', (e) => {
    if (currentRoomCode) {
        const coords = getRelativeCoordinates(e);
        if (coords) {
            console.log(`Mouse Move: x=${coords.x.toFixed(3)}, y=${coords.y.toFixed(3)}`);

            if (isDragging) {
                socket.emit('mouse_drag', { room: currentRoomCode, x: coords.x, y: coords.y });
            } else {
                socket.emit('mouse_move', { room: currentRoomCode, x: coords.x, y: coords.y });
            }
        }
    }
});

remoteVideo.addEventListener('wheel', (e) => {
    if (currentRoomCode) {
        socket.emit('mouse_scroll', { room: currentRoomCode, deltaX: e.deltaX, deltaY: e.deltaY });
        e.preventDefault();
    }
}, { passive: false });

remoteVideo.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', (e) => {
    const isInput = document.activeElement.tagName === 'INPUT';
    if (!isInput && currentRoomCode) {
        const maps = { " ": "space", "arrowup": "up", "arrowdown": "down", "arrowleft": "left", "arrowright": "right" };
        socket.emit('keyboard_input', { room: currentRoomCode, key: maps[e.key.toLowerCase()] || e.key.toLowerCase() });
        e.preventDefault();
    }
});