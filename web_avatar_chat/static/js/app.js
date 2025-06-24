// NeuroSync Avatar Chat - Browser-Controlled Perfect Synchronization (Variant 2)
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
    setStatus('🎭 Avatar wird vorbereitet...', 'processing');
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

// Browser-Controlled Perfect Synchronization
async function sendMessage() {
    const textInput = document.getElementById('textInput');
    const text = textInput.value.trim();

    if (!text) return;

    addMessage('user', text);
    textInput.value = '';
    setStatus('🎬 Browser-Sync wird vorbereitet...', 'processing');
    showAvatarActivity();

    try {
        console.log('🎯 Variante 2: Browser-gesteuerte Synchronisation');
        console.log('📤 Schritt 1: Audio + Blendshapes generieren...');

        // SCHRITT 1: Audio + Blendshapes vom Server holen (OHNE zu starten)
        const response = await fetch('/api/generate_audio_and_blendshapes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, voice: 'franzi' })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('📥 Server Response:', result);

            if (result.ready_for_sync && result.audio_data) {
                console.log(`🎬 Bereit für Browser-Sync: ${result.audio_length}s Audio + ${result.blendshapes_count} frames`);
                setStatus(`🎬 Synchronisation vorbereitet: ${result.audio_length}s`, 'processing');

                // SCHRITT 2: Audio vorbereiten (aber noch nicht abspielen)
                const audioBytes = atob(result.audio_data);
                const audioArray = new Uint8Array(audioBytes.length);
                for (let i = 0; i < audioBytes.length; i++) {
                    audioArray[i] = audioBytes.charCodeAt(i);
                }

                const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                // Audio laden und bereit machen
                await new Promise((resolve, reject) => {
                    audio.oncanplaythrough = resolve;
                    audio.onerror = reject;
                    audio.load();
                });

                console.log('🔊 Audio bereit für simultanen Start');
                setStatus('🚀 Perfekte Synchronisation startet...', 'processing');

                // SCHRITT 3: SIMULTANER START - Audio + LiveLink zur EXAKT gleichen Zeit
                console.log('🎊 SIMULTANER START: Audio + LiveLink gleichzeitig!');

                // Audio-Events konfigurieren
                let syncStarted = false;
                audio.onplay = () => {
                    if (!syncStarted) {
                        console.log('🔊 Audio startet - LiveLink parallel getriggert');
                        setStatus('🎊 PERFEKTE SYNCHRONISATION LÄUFT!', 'speaking');
                        syncStarted = true;
                    }
                };

                let progressInterval;
                audio.ontimeupdate = () => {
                    const progress = (audio.currentTime / audio.duration) * 100;
                    if (progress > 0) {
                        setStatus(`🎵 Perfekt synchron: ${Math.round(progress)}%`, 'speaking');
                    }
                };

                audio.onended = () => {
                    console.log('🎊 Audio + LiveLink Synchronisation komplett!');
                    setStatus('✅ Perfekte Synchronisation beendet', 'success');
                    clearInterval(progressInterval);
                    setTimeout(() => {
                        setStatus('Bereit • Browser-gesteuerte Sync aktiv', 'ready');
                    }, 2000);
                    URL.revokeObjectURL(audioUrl);
                };

                audio.onerror = (e) => {
                    console.error('❌ Audio Fehler:', e);
                    setStatus('Audio-Fehler', 'error');
                    URL.revokeObjectURL(audioUrl);
                };

                // KRITISCHER MOMENT: SIMULTANER START
                try {
                    // Promise für Audio-Start
                    const audioStartPromise = audio.play();

                    // Promise für LiveLink-Trigger
                    const livelinkTriggerPromise = fetch('/api/trigger_livelink', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sync_with_audio: true })
                    });

                    // BEIDE GLEICHZEITIG WARTEN
                    const [audioResult, livelinkResult] = await Promise.all([
                        audioStartPromise,
                        livelinkTriggerPromise
                    ]);

                    if (livelinkResult.ok) {
                        const livelinkData = await livelinkResult.json();
                        console.log('🎭 LiveLink getriggert:', livelinkData);
                        console.log('🎊 PERFEKTE SYNCHRONISATION: Audio + LiveLink simultan gestartet!');
                    } else {
                        console.error('❌ LiveLink Trigger fehlgeschlagen:', livelinkResult.status);
                        setStatus('LiveLink-Fehler - Audio läuft weiter', 'warning');
                    }

                } catch (startError) {
                    console.error('❌ Simultaner Start fehlgeschlagen:', startError);
                    setStatus('Browser blockiert Audio - User-Interaction erforderlich', 'warning');

                    // Fallback: User-Click erforderlich
                    addMessage('system', '🔊 Klicken Sie hier um Audio zu aktivieren', 'warning');
                    document.addEventListener('click', async () => {
                        try {
                            const audioStartPromise = audio.play();
                            const livelinkTriggerPromise = fetch('/api/trigger_livelink', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sync_with_audio: true })
                            });

                            await Promise.all([audioStartPromise, livelinkTriggerPromise]);
                            console.log('🔊 Audio + LiveLink nach User-Interaction gestartet');
                        } catch (e) {
                            console.error('Audio weiterhin blockiert:', e);
                        }
                    }, { once: true });
                }

            } else {
                console.error('❌ Server nicht bereit für Sync:', result);
                setStatus('Server-Synchronisation fehlgeschlagen', 'error');
                addMessage('system', 'Synchronisation konnte nicht vorbereitet werden.', 'error');
            }

            // Avatar-Antwort zur Chat-Historie hinzufügen
            addMessage('avatar', text, 'browser-synced');

        } else {
            console.error('❌ Server Fehler:', response.status, response.statusText);
            setStatus('Server-Fehler', 'error');
            addMessage('system', `Server-Fehler (${response.status}). Versuchen Sie es erneut.`, 'error');
        }

    } catch (error) {
        console.error('❌ Browser-Sync Fehler:', error);
        setStatus('Browser-Synchronisation fehlgeschlagen', 'error');
        addMessage('system', 'Synchronisationsfehler. Bitte versuchen Sie es erneut.', 'error');
    }
}

// Voice Recording Functions (unverändert)
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

                stream.getTracks().forEach(track => {
                    track.stop();
                    console.log('🔇 Audio-Track gestoppt');
                });
            };

            mediaRecorder.onerror = (event) => {
                console.error('❌ MediaRecorder Fehler:', event.error);
                setStatus('Aufnahme-Fehler', 'error');
            };

            mediaRecorder.start(1000);
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
        setStatus('🔄 Transkribiere Sprache...', 'processing');
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

        if (response.ok) {
            const result = await response.json();
            const transcription = result.transcription || '';

            if (transcription.trim()) {
                document.getElementById('textInput').value = transcription;
                setStatus('✅ Sprache erkannt: "' + transcription.substring(0, 30) + '..."', 'success');
                addMessage('system', `Sprache erkannt: "${transcription}"`, 'transcription');

                setTimeout(() => {
                    sendMessage();
                }, 1000);
            } else {
                setStatus('Keine Sprache erkannt', 'warning');
                addMessage('system', 'Keine Sprache erkannt. Versuchen Sie es erneut.', 'warning');
            }
        } else {
            console.error('❌ Transkriptions-Fehler:', response.status);
            setStatus('Transkription fehlgeschlagen', 'error');
        }

    } catch (error) {
        console.error('❌ Transkriptions-Fehler:', error);
        setStatus('Transkriptionsfehler', 'error');
    }
}

// Utility Functions
function clearChat() {
    const messagesDiv = document.getElementById('chatMessages');
    messagesDiv.innerHTML = `
        <div class="message avatar-message">
            <strong>Avatar</strong>
            Hallo! Ich bin dein KI-Avatar mit Browser-gesteuerter perfekter Synchronisation! 
            Audio und LiveLink werden vom Browser zur exakt gleichen Zeit gestartet!
            <small>Variante 2 aktiv</small>
        </div>
    `;
    setStatus('Chat gelöscht • Browser-Sync bereit', 'ready');
    console.log('🧹 Chat gelöscht - Variante 2 aktiv');
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
        textInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        textInput.focus();
    }

    checkSystemHealth();
    setStatus('Variante 2 geladen • Browser-gesteuerte Synchronisation bereit', 'ready');

    console.log('🎉 NeuroSync Avatar Chat - Variante 2 (Browser-gesteuert) geladen!');
    console.log('🎯 Features: Browser kontrolliert Audio + LiveLink simultan');
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
                setStatus('⚠️ NeuroSync Server offline', 'error');
                addMessage('system', 'NeuroSync AI Server ist nicht erreichbar.', 'error');
            } else if (health.sync_mode === 'browser_controlled_sync') {
                setStatus('✅ Browser-gesteuerte Synchronisation aktiv', 'ready');
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
        'Promise.all': 'Promise' in window && typeof Promise.all === 'function'
    };

    console.log('🌐 Browser-Support:', features);

    const unsupported = Object.entries(features)
        .filter(([feature, supported]) => !supported)
        .map(([feature]) => feature);

    if (unsupported.length > 0) {
        console.warn('⚠️ Nicht unterstützte Features:', unsupported);
        addMessage('system', `Browser-Warnung: ${unsupported.join(', ')} nicht verfügbar.`, 'warning');
    } else {
        console.log('✅ Alle Browser-Features für perfekte Synchronisation verfügbar');
    }
}

setTimeout(checkBrowserSupport, 1000);

// Global Error Handler
window.addEventListener('error', (event) => {
    console.error('🔥 Global Error:', event.error);
    setStatus('Unerwarteter Fehler aufgetreten', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('🔥 Unhandled Promise Rejection:', event.reason);
    setStatus('Asynchroner Fehler aufgetreten', 'error');
});

console.log('🚀 NeuroSync Avatar Chat - Variante 2 (Browser-gesteuerte Synchronisation) vollständig initialisiert');
console.log('🎭 Konzept: Browser startet Audio + LiveLink simultan via Promise.all()');
console.log('🎊 Erwartung: Perfekte Synchronisation durch Browser-Timing-Kontrolle');
console.log('🔧 Debug-Modus: Alle Timing-Events werden geloggt');