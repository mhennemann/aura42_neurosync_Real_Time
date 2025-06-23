let isRecording = false;
let mediaRecorder;
let audioChunks = [];

// URL für verschiedene Umgebungen
const PIXEL_STREAM_URL = window.location.hostname === 'localhost'
    ? 'http://148.251.21.122/'
    : 'https://pixel.aura42.de/';

// Text-to-Avatar function with Franzi Audio (KORRIGIERT)
async function sendMessage() {
    const textInput = document.getElementById('textInput');
    const text = textInput.value.trim();

    if (!text) return;

    addMessage('user', text);
    textInput.value = '';
    setStatus('Verarbeitung mit ElevenLabs + NeuroSync...', 'processing');

    // Avatar Animation Hinweis
    showAvatarActivity();

    try {
        // 1. Text an NeuroSync senden (für Blendshapes)
        const neuroResponse = await fetch('/api/synthesize_and_blendshapes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, voice: 'franzi' })
        });

        if (neuroResponse.ok) {
            // 2. Audio separat holen und abspielen
            const audioResponse = await fetch('/api/get_audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, voice: 'franzi' })
            });

            if (audioResponse.ok) {
                // Audio-Blob erstellen und abspielen
                const audioBlob = await audioResponse.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                // Audio abspielen
                audio.play().then(() => {
                    console.log('🎵 Franzi Audio wird abgespielt');
                }).catch(error => {
                    console.error('Audio-Wiedergabe Fehler:', error);
                    addMessage('system', '⚠️ Audio-Wiedergabe fehlgeschlagen. Browser-Berechtigungen prüfen.');
                });

                addMessage('avatar', `🔊 Franzi spricht: "${text}"`);
                setStatus('🎵 Avatar spricht...', 'success');

                // Status nach Audio-Ende zurücksetzen
                audio.onended = () => {
                    setStatus('Bereit • ElevenLabs + NeuroSync System verbunden', '');
                };

                // Memory cleanup
                setTimeout(() => URL.revokeObjectURL(audioUrl), 10000);
            } else {
                throw new Error('Audio-Generierung fehlgeschlagen');
            }
        } else {
            throw new Error('NeuroSync-Verarbeitung fehlgeschlagen');
        }
    } catch (error) {
        console.error('Fehler:', error);
        setStatus('Fehler: ' + error.message, 'error');
        addMessage('system', '❌ Fehler: ' + error.message);
    }
}

// Pixel Stream Controls
function toggleStream() {
    const iframe = document.getElementById('pixelStreamIframe');
    const container = iframe.parentElement;

    if (iframe.style.display === 'none') {
        iframe.style.display = 'block';
        container.classList.remove('loading');
        console.log('🎮 Pixel Stream aktiviert');
    } else {
        iframe.style.display = 'none';
        container.classList.add('loading');
        console.log('🎮 Pixel Stream deaktiviert');
    }
}

function resetStream() {
    const iframe = document.getElementById('pixelStreamIframe');
    iframe.src = iframe.src; // Reload iframe
    console.log('🔄 Pixel Stream zurückgesetzt');
}

function showAvatarActivity() {
    const container = document.querySelector('.pixel-stream-container');
    if (container) {
        container.style.border = '2px solid #00aaff';

        setTimeout(() => {
            container.style.border = '2px solid #444';
        }, 3000);
    }
}

// Responsive iframe anpassen
function adjustStreamQuality() {
    const iframe = document.getElementById('pixelStreamIframe');
    if (iframe) {
        const width = iframe.offsetWidth;

        if (width < 600) {
            iframe.src = PIXEL_STREAM_URL + '?quality=low';
        } else {
            iframe.src = PIXEL_STREAM_URL + '?quality=high';
        }
    }
}

// Voice recording (Deutsch)
async function toggleRecording() {
    const micButton = document.getElementById('micButton');

    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                await sendAudio(audioBlob);
            };

            mediaRecorder.start();
            isRecording = true;
            micButton.textContent = '⏹️ Stopp';
            micButton.classList.add('recording');
            setStatus('Aufnahme läuft...', 'processing');

        } catch (error) {
            console.error('Mikrofon-Fehler:', error);
            alert('Mikrofon-Zugriff verweigert. Bitte Mikrofon-Berechtigung aktivieren und erneut versuchen.');
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;
        micButton.textContent = '🎤 Aufnehmen';
        micButton.classList.remove('recording');
        setStatus('Sprache wird verarbeitet...', 'processing');
    }
}

// Send audio to server
async function sendAudio(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob);

        // Zuerst mit Whisper transkribieren
        const transcribeResponse = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });

        if (transcribeResponse.ok) {
            const transcription = await transcribeResponse.json();
            const text = transcription.transcription;

            if (text && text.trim()) {
                // Transkribierten Text zum Chat hinzufügen und verarbeiten
                addMessage('user', `🎤 ${text}`);

                // An NeuroSync mit Franzi Audio senden
                await sendMessageWithText(text);
            } else {
                setStatus('Keine Sprache erkannt. Erneut versuchen.', 'error');
            }
        } else {
            throw new Error('Spracherkennung fehlgeschlagen');
        }
    } catch (error) {
        console.error('Audio-Verarbeitungsfehler:', error);
        setStatus('Fehler bei Audio-Verarbeitung: ' + error.message, 'error');
        addMessage('system', '❌ Audio-Verarbeitungsfehler: ' + error.message);
    }
}

// Helper function for audio processing with Franzi
async function sendMessageWithText(text) {
    setStatus('Verarbeitung mit ElevenLabs + NeuroSync...', 'processing');

    // Avatar Animation Hinweis
    showAvatarActivity();

    try {
        // An NeuroSync senden
        const neuroResponse = await fetch('/api/synthesize_and_blendshapes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, voice: 'franzi' })
        });

        if (neuroResponse.ok) {
            // Audio holen und abspielen
            const audioResponse = await fetch('/api/get_audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, voice: 'franzi' })
            });

            if (audioResponse.ok) {
                const audioBlob = await audioResponse.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                audio.play().then(() => {
                    console.log('🎵 Franzi Audio wird abgespielt');
                }).catch(error => {
                    console.error('Audio-Wiedergabe Fehler:', error);
                });

                addMessage('avatar', `🔊 Franzi spricht: "${text}"`);
                setStatus('🎵 Avatar spricht...', 'success');

                audio.onended = () => {
                    setStatus('Bereit • ElevenLabs + NeuroSync System verbunden', '');
                };

                setTimeout(() => URL.revokeObjectURL(audioUrl), 10000);
            } else {
                throw new Error('Audio-Generierung fehlgeschlagen');
            }
        } else {
            throw new Error('NeuroSync-Verarbeitung fehlgeschlagen');
        }
    } catch (error) {
        console.error('Fehler:', error);
        setStatus('Fehler: ' + error.message, 'error');
        addMessage('system', '❌ Fehler: ' + error.message);
    }
}

// Add message to chat (Deutsch)
function addMessage(sender, text) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    const timestamp = new Date().toLocaleTimeString('de-DE');
    const senderName = sender === 'user' ? 'Du' : sender === 'avatar' ? 'Avatar' : 'System';

    messageDiv.innerHTML = `
        <strong>${senderName}</strong>
        ${text}
        <small>${timestamp}</small>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Set status with styling
function setStatus(message, type = '') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
}

// Clear chat (Deutsch)
function clearChat() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = `
        <div class="message avatar-message">
            <strong>Avatar</strong>
            Chat gelöscht! Bereit für eine neue Unterhaltung.
            <small>System zurückgesetzt</small>
        </div>
    `;
}

// Enter key support
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('textInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Initialize
    console.log('🚀 NeuroSync Avatar Chat Interface geladen');

    // Server-Gesundheit prüfen
    fetch('/health')
        .then(response => response.json())
        .then(data => {
            if (data.neurosync_server === 'online') {
                setStatus('Bereit • ElevenLabs + NeuroSync System verbunden', 'success');
            } else {
                setStatus('Warnung: NeuroSync Server offline', 'error');
            }
        })
        .catch(() => {
            setStatus('Warnung: Verbindung zum Backend nicht möglich', 'error');
        });
});