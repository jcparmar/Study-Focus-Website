const socket = io();

// UI Elements
const statusMessage = document.getElementById('status-message');
const deviceIdDisplay = document.getElementById('device-id-display');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const pairingCodeInput = document.getElementById('pairing-code');
const pairingSection = document.getElementById('pairing-section');
const focusModeSection = document.getElementById('focus-mode');
const statusDisplay = document.getElementById('status-display');
const endSessionBtn = document.getElementById('end-session-btn');
const soloModeBtn = document.getElementById('solo-mode-btn');
const volumeSlider = document.getElementById('bg-volume');
const breakBtn = document.getElementById('break-btn');

let currentRoomId = null;
let isFocusModeActive = false;
let isCreator = false;
let isSoloMode = false;
let isBreakActive = false;
let timerInterval;
let seconds = 0;

// Constants (in seconds)
const UNLOCK_BREAK_TIME = 30 * 60; // 30 minutes
// const UNLOCK_BREAK_TIME = 10; // Debug: 10 seconds
const BREAK_DURATION = 10 * 60; // 10 minutes

let audio = new Audio('./assets/boom.mp3'); // Default sound
audio.loop = true;

let bgMusic = new Audio('./assets/theme.webm');
bgMusic.loop = true;
bgMusic.volume = 0.2; // Low volume background music

function startTimer() {
    seconds = 0;
    const timerElement = document.getElementById('timer');
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        seconds++;
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        timerElement.textContent =
            `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// Helper: Show/Hide sections
function showFocusMode() {
    pairingSection.style.display = 'none';
    focusModeSection.style.display = 'block';
    isFocusModeActive = true;
    startTimer();
    updateStatus('Session Active. Stay focused!');
}

function updateStatus(msg, isError = false) {
    statusDisplay.textContent = msg;
    statusDisplay.style.color = isError ? 'red' : 'green';
    statusMessage.textContent = msg;
}

// Socket Events
socket.on('connect', () => {
    console.log('Connected to server');
    statusMessage.textContent = 'Connected. Create or Join a room.';
});

socket.on('room_created', (roomId) => {
    currentRoomId = roomId;
    isCreator = true;
    deviceIdDisplay.textContent = `Your Room Code: ${roomId}`;
    statusMessage.textContent = `Room created. Waiting for peer to join...`;
    // We don't hide the pairing section yet, peer needs to join
    createRoomBtn.disabled = true;
    joinRoomBtn.disabled = true;
    pairingCodeInput.disabled = true;
});

socket.on('paired', () => {
    console.log('Device Paired!');
    showFocusMode();
    if (isCreator) {
        bgMusic.play().catch(e => console.log('Bg music play failed', e));
    }
});

socket.on('peer_focus_status', (isFocused) => {
    if (!isFocused) {
        updateStatus('PEER LOST FOCUS!', true);
        // Optional: Pause bg music while alarm plays? Or keep it?
        // User said "it should just be there", so we leave it running.
        audio.play().catch(e => console.log('Audio play failed', e));
        document.body.style.backgroundColor = '#fee2e2'; // Light red
    } else {
        updateStatus('Peer is focused.', false);
        audio.pause();
        audio.currentTime = 0;
        // Ensure bg music is playing if it was paused or interrupted
        if (isCreator) {
            bgMusic.play().catch(e => console.log('Bg music play failed', e));
        }
        document.body.style.backgroundColor = '#f8fafc'; // Reset
    }
});

socket.on('peer_disconnected', () => {
    updateStatus('Peer disconnected. Session ended.', true);
    isFocusModeActive = false;
    audio.pause();
    bgMusic.pause();
    stopTimer();
    document.body.style.backgroundColor = '#f8fafc';
    alert('Peer disconnected');
    location.reload();
});

socket.on('error', (msg) => {
    alert(msg);
});

// User Actions
createRoomBtn.addEventListener('click', () => {
    socket.emit('create_room');
});

joinRoomBtn.addEventListener('click', () => {
    const code = pairingCodeInput.value;
    if (code) {
        currentRoomId = code;
        socket.emit('join_room', code);
    } else {
        alert('Please enter a code');
    }
});

endSessionBtn.addEventListener('click', () => {
    if (confirm('End session?')) {
        location.reload();
    }
});

soloModeBtn.addEventListener('click', () => {
    isSoloMode = true;
    showFocusMode();
    bgMusic.play().catch(e => console.log('Bg music play failed', e));
    updateStatus('Solo Session Active. Stay focused!');
});

volumeSlider.addEventListener('input', (e) => {
    bgMusic.volume = e.target.value;
});

breakBtn.addEventListener('click', () => {
    isBreakActive = true;
    breakBtn.disabled = true;
    breakBtn.style.backgroundColor = '#94a3b8';
    breakBtn.style.cursor = 'not-allowed';
    breakBtn.textContent = "Break Timer: 10:00";

    updateStatus('Break Time! Relax.', false);
    document.body.style.backgroundColor = '#e0f2fe'; // Light blue for break

    // Pause Alarm/Check Logic handled in visibilitychange

    let breakSeconds = BREAK_DURATION;
    const breakInterval = setInterval(() => {
        breakSeconds--;
        const bMins = Math.floor(breakSeconds / 60);
        const bSecs = breakSeconds % 60;
        breakBtn.textContent = `Break Timer: ${bMins}:${bSecs.toString().padStart(2, '0')}`;

        if (breakSeconds <= 0) {
            clearInterval(breakInterval);
            endBreak();
        }
    }, 1000);

    // Allow user to end break early? Maybe clicking button again? For now, automatic end.
    // Store interval to clear if session ends
    breakBtn.dataset.intervalId = breakInterval;
});

function endBreak() {
    isBreakActive = false;
    document.body.style.backgroundColor = '#f8fafc';
    updateStatus('Break Over. Back to Focus!', false);
    breakBtn.textContent = "Take Break (Locked)";
    clearInterval(parseInt(breakBtn.dataset.intervalId));
    // Reset unlock timer? Yes, usually resets cycle.
    timeSinceStart = 0;
}

// Page Visibility API
document.addEventListener('visibilitychange', () => {
    if (!isFocusModeActive) return;
    if (isBreakActive) return; // IGNORE focus loss during break

    const isFocused = !document.hidden;

    // Solo Mode Logic
    if (isSoloMode) {
        if (!isFocused) {
            statusDisplay.textContent = "You lost focus!";
            audio.play().catch(e => console.log('Audio play failed', e));
            document.body.style.backgroundColor = '#fee2e2'; // Light red
        } else {
            statusDisplay.textContent = "Welcome back.";
            audio.pause();
            audio.currentTime = 0;
            document.body.style.backgroundColor = '#f8fafc'; // Reset
            // Ensure bg music keeps playing
            bgMusic.play().catch(e => console.log('Bg music play failed', e));
        }
        return;
    }

    // Pair Mode Logic
    if (!currentRoomId) return;

    socket.emit('focus_status', {
        roomId: currentRoomId,
        focused: isFocused
    });

    if (!isFocused) {
        statusDisplay.textContent = "You lost focus!";
        // In pair mode, we don't play local sound for self, only for peer
    } else {
        statusDisplay.textContent = "Welcome back.";
    }
});
