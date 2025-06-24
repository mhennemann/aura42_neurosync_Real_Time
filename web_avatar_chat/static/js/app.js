// NeuroSync Avatar Chat - Perfect Audio+LiveLink Synchronization
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

// Status Management
function setStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
}

function showAvatarActivity() {
    setStatus('🎭 Avatar spricht...', 'speaking');
}

function addMessage(sender, text, type = '') {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message ${type}`;

    const timestamp = new Date().toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });

    messageDiv.innerHTML = `
        <strong>${sender === 'user' ? 'Du' : 'Avatar'}</strong>
        ${text}
        <small>${timestamp}</small>
    `;

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Perfect Synchronized Message Sending
async function sendMessage() {
    const textInput = document.getElementById('textInput');
    const text = textInput.value.trim();

    if (!text) return;

    addMessage('user', text);
    textInput.value = '';
    setStatus('🎯 Perfekte Synchronisation wird vorbereitet...', 'processing');
    showAvatarActivity();

    try {
        // Sende Text an NeuroSync für Audio+LiveLink Generierung
        console.log('📤 Sende an NeuroSync:', text);
        const response = await fetch('/api/synthesize_and_blendshapes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, voice: 'franzi' })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('📥 NeuroSync Response:', result);

            // Prüfe ob Audio-Daten in Response enthalten sind
            if (result.audio_data && result.play_audio) {
                console.log(`🎯 Perfekte Sync: Audio ${result.audio_length}s + LiveLink gestartet`);

                // Audio aus Base64 dekodieren
                const audioBytes = atob(result.audio_data);
                const audioArray = new Uint8Array(audioBytes.length);
                for (let i = 0; i < audioBytes.length; i++) {
                    audioArray[i] = audioBytes.charCodeAt(i);
                }

                // Audio-Blob erstellen
                const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                // Audio-Event Listener
                audio.onloadstart = () => {
                    console.log('🔄 Audio wird geladen...');
                };

                audio.oncanplay = () => {
                    console.log('✅ Audio bereit zum Abspielen');
                };

                audio.onplay = () => {
                    console.log('🔊 Audio startet - LiveLink läuft parallel auf Server');
                    setStatus('🎊 Perfekte Synchronisation: Audio + LiveLink!', 'speaking');
                };

                audio.ontimeupdate = () => {
                    // Optional: Progress tracking
                    const progress = (audio.currentTime / audio.duration) * 100;
                    if (progress > 0) {
                        setStatus(`🎵 Synchron: ${Math.round(progress)}% | Audio + LiveLink`, 'speaking');
                    }
                };

                audio.onended = () => {
                    console.log('🔊 Audio beendet - Synchronisation komplett');
                    setStatus('✅ Perfekte Synchronisation beendet', 'success');
                    setTimeout(() => {
                        setStatus('Bereit • Perfekte Audio+LiveLink Sync aktiv', 'ready');
                    }, 2000);
                    URL.revokeObjectURL(audioUrl);
                };

                audio.onerror = (e) => {
                    console.error('❌ Audio Fehler:', e);
                    setStatus('Audio-Fehler - LiveLink läuft weiter', 'error');
                    URL.revokeObjectURL(audioUrl);
                };

                // Audio abspielen (gleichzeitig mit LiveLink auf Server)
                try {
                    await audio.play();
                    console.log('🚀 Audio erfolgreich gestartet');
                } catch (playError) {
                    console.error('❌ Audio play Fehler:', playError);
                    setStatus('Browser blockiert Audio - LiveLink aktiv', 'warning');

                    // Fallback: User Interaction erforderlich
                    addMessage('system', 'Klicken Sie hier um Audio zu aktivieren', 'warning');
                    document.addEventListener('click', async () => {
                        try {
                            await audio.play();
                            console.log('🔊 Audio nach User-Interaction gestartet');
                        } catch (e) {
                            console.error('Audio weiterhin blockiert:', e);
                        }
                    }, { once: true });
                }

            } else {
                console.log('✅ LiveLink Animation gesendet (ohne Audio-Sync)');
                setStatus('Avatar Animation gesendet', 'success');
                setTimeout(() => {
                    setStatus('Bereit • NeuroSync + ElevenLabs System verbunden', 'ready');
                }, 3000);
            }

            // Avatar-Antwort zur Chat-Historie hinzufügen
            addMessage('avatar', text, 'synchronized');

        } else {
            console.error('❌ NeuroSync Fehler:', response.status, response.statusText);
            setStatus('NeuroSync Server Fehler', 'error');
            addMessage('system', `Entschuldigung, Server-Fehler (${response.status}). Versuchen Sie es erneut.`, 'error');
        }

    } catch (error) {
        console.error('❌ Synchronisation Fehler:', error);
        setStatus('Verbindungsfehler - Prüfen Sie die Internetverbindung', 'error');
        addMessage('system', 'Verbindung zum Server fehlgeschlagen. Bitte versuchen Sie es erneut.', 'error');
    }
}

// Voice Recording Functions
async function toggleRecording() {
    const micButton = document.getElementById('micButton');

    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });

            mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                console.log('🎤 Aufnahme beendet, Chunks:', audioChunks.length);
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                console.log('🎤 Audio-Blob Größe:', audioBlob.size, 'bytes');
                await transcribeAudio(audioBlob);

                // Cleanup
                stream.getTracks().forEach(track => {
                    track.stop();
                    console.log('🔇 Audio-Track gestoppt');
                });
            };

            mediaRecorder.onerror = (event) => {
                console.error('❌ MediaRecorder Fehler:', event.error);
                setStatus('Aufnahme-Fehler', 'error');
            };

            mediaRecorder.start(1000); // 1 Sekunde Chunks
            isRecording = true;
            micButton.textContent = '🔴 Stop';
            micButton.classList.add('recording');
            setStatus('🎤 Aufnahme läuft... (Sprechen Sie jetzt)', 'recording');

            console.log('🎤 Aufnahme gestartet');

        } catch (error) {
            console.error('❌ Mikrofon Fehler:', error);
            if (error.name === 'NotAllowedError') {
                setStatus('Mikrofon-Berechtigung verweigert', 'error');
                addMessage('system', 'Bitte erlauben Sie Mikrofon-Zugriff für Spracheingabe.', 'error');
            } else if (error.name === 'NotFoundError') {
                setStatus('Kein Mikrofon gefunden', 'error');
                addMessage('system', 'Kein Mikrofon erkannt. Prüfen Sie Ihre Hardware.', 'error');
            } else {
                setStatus('Mikrofon-Fehler', 'error');
                addMessage('system', `Mikrofon-Fehler: ${error.message}`, 'error');
            }
        }
    } else {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            console.log('🎤 Stoppe Aufnahme...');
        }
        isRecording = false;
        micButton.textContent = '🎤 Aufnehmen';
        micButton.classList.remove('recording');
        setStatus('🔄 Transkribiere Sprache mit ElevenLabs...', 'processing');
    }
}

async function transcribeAudio(audioBlob) {
    try {
        console.log('📤 Sende Audio zur Transkription...');
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });

        console.log('📥 Transkriptions-Response:', response.status);

        if (response.ok) {
            const result = await response.json();
            console.log('📝 Transkriptions-Ergebnis:', result);
            const transcription = result.transcription || '';

            if (transcription.trim()) {
                document.getElementById('textInput').value = transcription;
                setStatus('✅ Sprache erkannt: "' + transcription.substring(0, 30) + '..."', 'success');
                addMessage('system', `Sprache erkannt: "${transcription}"`, 'transcription');

                // Automatisch senden nach kurzer Verzögerung
                setTimeout(() => {
                    sendMessage();
                }, 1000);
            } else {
                setStatus('Keine Sprache erkannt - Versuchen Sie es erneut', 'warning');
                addMessage('system', 'Keine Sprache erkannt. Sprechen Sie deutlicher oder versuchen Sie es erneut.', 'warning');
            }
        } else {
            const errorText = await response.text();
            console.error('❌ Transkriptions-Fehler:', response.status, errorText);
            setStatus('Transkription fehlgeschlagen', 'error');
            addMessage('system', 'Spracherkennung fehlgeschlagen. Versuchen Sie es erneut.', 'error');
        }

    } catch (error) {
        console.error('❌ Transkriptions-Fehler:', error);
        setStatus('Transkriptionsfehler', 'error');
        addMessage('system', 'Verbindungsfehler bei Spracherkennung.', 'error');
    }
}

// Utility Functions
function clearChat() {
    const messagesDiv = document.getElementById('chatMessages');
    messagesDiv.innerHTML = `
        <div class="message avatar-message">
            <strong>Avatar</strong>
            Hallo! Ich bin dein KI-Avatar mit perfekter Audio+LiveLink Synchronisation! 
            Schreibe eine Nachricht oder nutze das Mikrofon zum Chatten!
            <small>System bereit</small>
        </div>
    `;
    setStatus('Chat gelöscht • Bereit für perfekte Synchronisation', 'ready');
    console.log('🧹 Chat gelöscht');
}

function toggleStream() {
    const iframe = document.getElementById('pixelStreamIframe');
    if (iframe) {
        iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none';
        const visible = iframe.style.display !== 'none';
        setStatus(visible ? 'Avatar-Stream sichtbar' : 'Avatar-Stream ausgeblendet', 'info');
        console.log('👁️ Avatar-Stream:', visible ? 'sichtbar' : 'ausgeblendet');
    }
}

function resetStream() {
    const iframe = document.getElementById('pixelStreamIframe');
    if (iframe) {
        const originalSrc = iframe.src;
        iframe.src = '';
        setTimeout(() => {
            iframe.src = originalSrc;
        }, 100);
        setStatus('Avatar-Stream zurückgesetzt', 'info');
        console.log('🔄 Avatar-Stream zurückgesetzt');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function () {
    const textInput = document.getElementById('textInput');

    if (textInput) {
        // Enter-Taste für Senden
        textInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Focus auf Input-Feld
        textInput.focus();
    }

    // Health Check beim Laden
    checkSystemHealth();
    setStatus('System geladen • Bereit für perfekte Audio+LiveLink Synchronisation', 'ready');

    console.log('🎉 NeuroSync Avatar Chat mit perfekter Synchronisation geladen!');
    console.log('🎯 Features: Audio+LiveLink Sync, Deutsche Franzi TTS, Spracheingabe');
});

// System Health Check
async function checkSystemHealth() {
    try {
        console.log('🔍 Prüfe System-Status...');
        const response = await fetch('/health');
        if (response.ok) {
            const health = await response.json();
            console.log('💚 System Health:', health);

            if (health.neurosync_server === 'offline') {
                setStatus('⚠️ NeuroSync Server offline - Prüfen Sie die Verbindung', 'error');
                addMessage('system', 'NeuroSync AI Server ist nicht erreichbar.', 'error');
            } else if (health.sync_mode === 'perfect_audio_livelink_sync') {
                setStatus('✅ Perfekte Audio+LiveLink Synchronisation aktiv', 'ready');
            } else {
                setStatus('✅ NeuroSync System verbunden', 'ready');
            }
        } else {
            console.warn('⚠️ Health Check fehlgeschlagen:', response.status);
            setStatus('System-Status unbekannt', 'warning');
        }
    } catch (error) {
        console.error('❌ Health Check Fehler:', error);
        setStatus('System-Verbindung prüfen...', 'warning');
    }
}

// Auto-Health Check alle 30 Sekunden
setInterval(checkSystemHealth, 30000);

// Browser-Kompatibilität prüfen
function checkBrowserSupport() {
    const features = {
        'Web Audio API': 'AudioContext' in window || 'webkitAudioContext' in window,
        'Media Recorder': 'MediaRecorder' in window,
        'getUserMedia': navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
        'Fetch API': 'fetch' in window,
        'Promise': 'Promise' in window
    };

    console.log('🌐 Browser-Support:', features);

    const unsupported = Object.entries(features)
        .filter(([feature, supported]) => !supported)
        .map(([feature]) => feature);

    if (unsupported.length > 0) {
        console.warn('⚠️ Nicht unterstützte Features:', unsupported);
        addMessage('system', `Browser-Warnung: ${unsupported.join(', ')} nicht verfügbar.`, 'warning');
    }
}

// Browser-Support beim Laden prüfen
setTimeout(checkBrowserSupport, 1000);

// Global Error Handler
window.addEventListener('error', (event) => {
    console.error('🔥 Global Error:', event.error);
    setStatus('Unerwarteter Fehler aufgetreten', 'error');
});

// Unhandled Promise Rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('🔥 Unhandled Promise Rejection:', event.reason);
    setStatus('Asynchroner Fehler aufgetreten', 'error');
});

console.log('🚀 NeuroSync Avatar Chat System vollständig initialisiert');
console.log('🎭 Features: Perfekte Audio+LiveLink Sync, ElevenLabs v2, Deutsche Franzi');
console.log('🔧 Debug-Modus: Console-Logs aktiviert');