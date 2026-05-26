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
const fileInput = document.getElementById('fileInput');
const fileUploadText = document.querySelector('.file-upload-text');

// Fungsi Aktif/Nonaktifkan Fitur Kirim Berkas
function setFileTransferActive(active) {
    const fileLabel = document.querySelector('.file-upload-label');
    const iconUpload = document.querySelector('.icon-upload');
    if (!fileLabel || !fileInput || !fileUploadText) return;

    if (active) {
        fileInput.disabled = false;
        fileLabel.style.pointerEvents = 'auto';
        fileLabel.style.opacity = '1';
        fileLabel.style.cursor = 'pointer';
        fileUploadText.innerText = "Pilih File...";
        if (iconUpload) iconUpload.style.color = "#0078d4";
    } else {
        fileInput.disabled = true;
        fileInput.value = '';
        fileLabel.style.pointerEvents = 'none';
        fileLabel.style.opacity = '0.5';
        fileLabel.style.cursor = 'not-allowed';
        fileUploadText.innerText = "Belum Terhubung...";
        if (iconUpload) iconUpload.style.color = "#666";
    }
}

// Pembersihan awal kotak masukan
inputCode.value = '';
userNameInput.value = '';
chatInput.value = '';
setFileTransferActive(false);

let peerConnection;
let myUserName = "Anonim";
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
let expectedSender = "";

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
            setFileTransferActive(false);
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

// --- 4. KONEKSI WEBRTC & TRANSFER BERKAS ---
function setupDataChannel(channel) {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
        setFileTransferActive(true);
    };

    channel.onclose = () => {
        setFileTransferActive(false);
    };

    channel.onmessage = (event) => {
        if (typeof event.data === 'string') {
            const meta = JSON.parse(event.data);
            if (meta.type === 'file_meta') {
                expectedSize = meta.size;
                expectedName = meta.name;
                expectedType = meta.fileType;
                expectedSender = meta.senderName || "Anonim";
                receiveBuffer = [];
                receivedSize = 0;
                appendMessage(expectedSender, `Menerima File: ${expectedName}...`, 'remote');
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

    peerConnection.ondatachannel = (e) => {
        dataChannel = e.channel;
        setupDataChannel(dataChannel);
    };

    peerConnection.ontrack = (e) => {
        if (!remoteVideo.srcObject) remoteVideo.srcObject = new MediaStream();
        remoteVideo.srcObject.addTrack(e.track);
    };

    peerConnection.onicecandidate = (e) => {
        if (e.candidate) socket.emit('webrtc_event', { room: currentRoomCode, event: { type: 'candidate', candidate: e.candidate } });
    };

    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'disconnected' ||
            peerConnection.connectionState === 'failed' ||
            peerConnection.connectionState === 'closed') {
            setFileTransferActive(false);
        }
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
        await peerConnection.setRemoteDescription(new RTCSessionDescription(event.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('webrtc_event', { room: currentRoomCode, event: { type: 'answer', answer: answer } });
    } else if (event.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(event.answer));
    } else if (event.type === 'candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
    }
});

function sendFile() {
    const file = fileInput.files[0];
    if (!file || !dataChannel || dataChannel.readyState !== 'open') return;

    dataChannel.send(JSON.stringify({ type: 'file_meta', name: file.name, size: file.size, fileType: file.type, senderName: myUserName }));

    const chunkSize = 16384;
    const reader = new FileReader();
    let offset = 0;

    reader.onload = (e) => {
        dataChannel.send(e.target.result);
        offset += e.target.result.byteLength;
        if (offset < file.size) readSlice(offset);
        else {
            appendMessage("Saya", `Berkas ${file.name} berhasil dikirim.`, 'local');
            fileInput.value = '';
            fileUploadText.innerText = "Pilih berkas...";
            fileUploadText.title = "";
        }
    };
    const readSlice = (o) => reader.readAsArrayBuffer(file.slice(o, o + chunkSize));
    readSlice(0);
}

if (fileInput) {
    fileInput.onchange = () => {
        const file = fileInput.files[0];
        if (file) {
            fileUploadText.innerText = file.name;
            fileUploadText.title = file.name;
        } else {
            fileUploadText.innerText = "Pilih berkas...";
            fileUploadText.title = "";
        }
    };
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

function sendMsg() {
    const file = fileInput ? fileInput.files[0] : null;
    if (file && dataChannel && dataChannel.readyState === 'open') {
        sendFile();
    }

    if (chatInput.value.trim() && currentRoomCode) {
        socket.emit('chat_message', { room: currentRoomCode, sender: myUserName, text: chatInput.value.trim() });
        appendMessage("Saya", chatInput.value.trim(), 'local');
        chatInput.value = '';
    }
}
sendBtn.onclick = sendMsg;
chatInput.onkeydown = (e) => { if (e.key === 'Enter') { sendMsg(); e.stopPropagation(); } };
socket.on('chat_message', (data) => appendMessage(data.sender, data.text, 'remote'));

// --- 6. KONTROL TETIKUS & PAPAN KETIK ---

// Fungsi bantuan untuk mendapatkan koordinat presisi pada object-fit: contain
function getNormalizedCoordinates(e, videoElement) {
    const rect = videoElement.getBoundingClientRect();
    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;
    const cw = rect.width;
    const ch = rect.height;

    // Hitung skala video yang dirender
    const scale = Math.min(cw / vw, ch / vh);
    const displayedWidth = vw * scale;
    const displayedHeight = vh * scale;

    // Hitung area kosong (black bars)
    const offsetX = (cw - displayedWidth) / 2;
    const offsetY = (ch - displayedHeight) / 2;

    // Hitung posisi relatif terhadap piksel asli video
    let posX = (e.clientX - rect.left - offsetX) / displayedWidth;
    let posY = (e.clientY - rect.top - offsetY) / displayedHeight;

    // Batasi koordinat agar selalu berada di antara 0.0 hingga 1.0
    posX = Math.max(0, Math.min(1, posX));
    posY = Math.max(0, Math.min(1, posY));

    return { x: posX, y: posY };
}

let isDragging = false;
let dragButton = 'left';

remoteVideo.addEventListener('mousedown', (e) => {
    if (currentRoomCode) {
        isDragging = true;
        dragButton = e.button === 2 ? 'right' : (e.button === 1 ? 'middle' : 'left');
        socket.emit('mouse_down', { button: dragButton });
    }
});

remoteVideo.addEventListener('mouseup', (e) => {
    if (currentRoomCode) {
        isDragging = false;
        let btn = e.button === 2 ? 'right' : (e.button === 1 ? 'middle' : 'left');
        socket.emit('mouse_up', { button: btn });
    }
});

remoteVideo.addEventListener('mouseleave', () => {
    if (isDragging && currentRoomCode) {
        isDragging = false;
        socket.emit('mouse_up', { button: dragButton });
    }
});

remoteVideo.addEventListener('mousemove', (e) => {
    if (remoteVideo.videoWidth > 0 && currentRoomCode) {
        // Gunakan fungsi normalisasi baru di sini
        const pos = getNormalizedCoordinates(e, remoteVideo);

        if (isDragging) {
            socket.emit('mouse_drag', { x: pos.x, y: pos.y });
        } else {
            socket.emit('mouse_move', { x: pos.x, y: pos.y });
        }
    }
});

remoteVideo.addEventListener('wheel', (e) => {
    if (currentRoomCode) {
        socket.emit('mouse_scroll', { deltaX: e.deltaX, deltaY: e.deltaY });
        e.preventDefault();
    }
}, { passive: false });

remoteVideo.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', (e) => {
    const isInput = document.activeElement.tagName === 'INPUT';
    if (!isInput && currentRoomCode) {
        const maps = { " ": "space", "arrowup": "up", "arrowdown": "down", "arrowleft": "left", "arrowright": "right" };
        socket.emit('keyboard_input', { key: maps[e.key.toLowerCase()] || e.key.toLowerCase() });
        e.preventDefault();
    }
});