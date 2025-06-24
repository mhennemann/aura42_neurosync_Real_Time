// NeuroSync Avatar Chat - Audio-Event Based Perfect Synchronization + Auto-Start
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

// Audio-Event Based Perfect Synchronization
async function sendMessage() {
    const textInput = document.getElementById('textInput');
    const text = textInput.value.trim();

    if (!text) return;

    addMessage('user', text);
    textInput.value = '';
    setStatus('🎬 Audio-Event Sync wird vorbereitet...', 'processing');
    showAvatarActivity();

    try {
        console.log('🎯 Option 3: Audio-Event basierte Synchronisation');
        console.log('📤 Schritt 1: Audio + Blendshapes generieren...');

        // SCHRITT 1: Audio + Blendshapes vom Server holen
        const response = await fetch('/api/generate_audio_and_blendshapes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, voice: 'franzi' })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('📥 Server Response:', result);

            if (result.ready_for_sync && result.audio_data) {
                console.log(`🎬 Bereit für Audio-Event Sync: ${result.audio_length}s Audio + ${result.blendshapes_count} frames`);
                setStatus(`🎬 Audio-Event Sync vorbereitet: ${result.audio_length}s`, 'processing');

                // SCHRITT 2: Audio vorbereiten
                const audioBytes = atob(result.audio_data);
                const audioArray = new Uint8Array(audioBytes.length);
                for (let i = 0; i < audioBytes.length; i++) {
                    audioArray[i] = audioBytes.charCodeAt(i);
                }

                const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                // SCHRITT 3: AUDIO-EVENT LISTENER KONFIGURIEREN
                let livelinkTriggered = false;

                audio.onloadstart = () => {
                    console.log('🔄 Audio lädt...');
                    setStatus('🔄 Audio wird geladen...', 'processing');
                };

                audio.oncanplay = () => {
                    console.log('✅ Audio bereit - wartet auf Play-Event');
                    setStatus('✅ Audio bereit - wartet auf Wiedergabe...', 'ready');
                };

                // KRITISCHER EVENT: Audio startet wirklich
                audio.addEventListener('playing', async () => {
                    if (!livelinkTriggered) {
                        livelinkTriggered = true;
                        console.log('🎊 AUDIO SPIELT WIRKLICH → LiveLink wird getriggert!');
                        setStatus('🎊 Audio spielt → LiveLink startet!', 'speaking');

                        try {
                            // LiveLink SOFORT triggern wenn Audio wirklich spielt
                            const livelinkResponse = await fetch('/api/trigger_livelink', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    audio_event_triggered: true,
                                    trigger_time: performance.now()
                                })
                            });

                            if (livelinkResponse.ok) {
                                const livelinkData = await livelinkResponse.json();
                                console.log('🎭 LiveLink durch Audio-Event getriggert:', livelinkData);
                                console.log('🎊 PERFEKTE AUDIO-EVENT SYNCHRONISATION!');
                            } else {
                                console.error('❌ LiveLink Trigger fehlgeschlagen:', livelinkResponse.status);
                            }

                        } catch (livelinkError) {
                            console.error('❌ LiveLink Trigger Fehler:', livelinkError);
                        }
                    }
                });

                // Progress-Tracking
                audio.ontimeupdate = () => {
                    const progress = (audio.currentTime / audio.duration) * 100;
                    if (progress > 0) {
                        setStatus(`🎵 Audio-Event Sync: ${Math.round(progress)}%`, 'speaking');
                    }
                };

                // Audio Ende
                audio.onended = () => {
                    console.log('🎊 Audio-Event Synchronisation komplett!');
                    setStatus('✅ Audio-Event Sync beendet', 'success');
                    setTimeout(() => {
                        setStatus('Bereit • Audio-Event basierte Sync aktiv', 'ready');
                    }, 2000);
                    URL.revokeObjectURL(audioUrl);
                };

                audio.onerror = (e) => {
                    console.error('❌ Audio Fehler:', e);
                    setStatus('Audio-Fehler', 'error');
                    URL.revokeObjectURL(audioUrl);
                };

                // SCHRITT 4: Audio vorbereiten und laden
                console.log('🔄 Audio wird für Event-Trigger vorbereitet...');
                setStatus('🔄 Audio wird für Event-basierte Sync vorbereitet...', 'processing');

                // Audio vollständig laden
                await new Promise((resolve, reject) => {
                    audio.oncanplaythrough = resolve;
                    audio.onerror = reject;
                    audio.load();
                });

                console.log('🚀 Audio bereit - starte Wiedergabe für Event-Trigger...');
                setStatus('🚀 Audio startet → Event-Trigger wartet...', 'processing');

                // SCHRITT 5: Audio starten - 'playing' Event wird LiveLink triggern
                try {
                    await audio.play();
                    console.log('🔊 Audio.play() aufgerufen - Event-Listener wartet auf "playing"');
                } catch (playError) {
                    console.error('❌ Audio play Fehler:', playError);
                    setStatus('Browser blockiert Audio - User-Interaction erforderlich', 'warning');

                    // Fallback: User-Click erforderlich
                    addMessage('system', '🔊 Klicken Sie hier um Audio zu aktivieren', 'warning');
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
                console.error('❌ Server nicht bereit für Sync:', result);
                setStatus('Server-Synchronisation fehlgeschlagen', 'error');
                addMessage('system', 'Synchronisation konnte nicht vorbereitet werden.', 'error');
            }

            // Avatar-Antwort zur Chat-Historie hinzufügen
            addMessage('avatar', text, 'audio-event-synced');

        } else {
            console.error('❌ Server Fehler:', response.status, response.statusText);
            setStatus('Server-Fehler', 'error');
            addMessage('system', `Server-Fehler (${response.status}). Versuchen Sie es erneut.`, 'error');
        }

    } catch (error) {
        console.error('❌ Audio-Event Sync Fehler:', error);
        setStatus('Audio-Event Synchronisation fehlgeschlagen', 'error');
        addMessage('system', 'Audio-Event Synchronisationsfehler. Bitte versuchen Sie es erneut.', 'error');
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
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await transcribeAudio(audioBlob);

                stream.getTracks().forEach(track => {
                    track.stop();
                });
            };

            mediaRecorder.start(1000);
            isRecording = true;
            micButton.textContent = '🔴 Stop';
            micButton.classList.add('recording');
            setStatus('🎤 Aufnahme läuft...', 'recording');

        } catch (error) {
            console.error('❌ Mikrofon Fehler:', error);
            setStatus('Mikrofon-Fehler', 'error');
        }
    } else {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        isRecording = false;
        micButton.textContent = '🎤 Aufnehmen';
        micButton.classList.remove('recording');
        setStatus('🔄 Transkribiere Sprache...', 'processing');
    }
}

async function transcribeAudio(audioBlob) {
    try {
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
                setStatus('✅ Sprache erkannt', 'success');
                addMessage('system', `Sprache erkannt: "${transcription}"`, 'transcription');

                setTimeout(() => {
                    sendMessage();
                }, 1000);
            } else {
                setStatus('Keine Sprache erkannt', 'warning');
            }
        } else {
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
            Hallo! Ich bin dein KI-Avatar mit Audio-Event basierter perfekter Synchronisation! 
            LiveLink startet erst wenn Audio wirklich spielt - bei jeder Internetgeschwindigkeit!
            <small>Auto-Start aktiviert</small>
        </div>
    `;
    setStatus('Chat gelöscht • Audio-Event Sync + Auto-Start bereit', 'ready');
    console.log('🧹 Chat gelöscht - Option 3 (Audio-Event) + Auto-Start aktiv');
}

function toggleStream() {
    const iframe = document.getElementById('pixelStreamIframe');
    if (iframe) {
        iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none';
        const visible = iframe.style.display !== 'none';
        setStatus(visible ? 'Avatar-Stream sichtbar' : 'Avatar-Stream ausgeblendet', 'info');

        // Auto-Start nach Toggle wieder aktivieren
        if (visible) {
            setTimeout(autoStartPixelStreaming, 1000);
        }
    }
}

function resetStream() {
    const iframe = document.getElementById('pixelStreamIframe');
    if (iframe) {
        const originalSrc = iframe.src;
        iframe.src = '';
        setTimeout(() => {
            iframe.src = originalSrc;
            // Auto-Start nach Reset
            setTimeout(autoStartPixelStreaming, 2000);
        }, 100);
        setStatus('Avatar-Stream zurückgesetzt', 'info');
    }
}

// ========== AUTO-START PIXEL STREAMING ==========
function autoStartPixelStreaming() {
    console.log('🎮 Auto-Start Pixel Streaming initialisiert...');

    let attempts = 0;
    const maxAttempts = 10;

    function tryAutoStart() {
        attempts++;
        console.log(`🎮 Auto-Start Versuch ${attempts}/${maxAttempts}`);

        const iframe = document.getElementById('pixelStreamIframe');
        if (!iframe) {
            console.log('❌ Iframe nicht gefunden');
            return;
        }

        try {
            // Methode 1: Iframe Content Window Access
            if (iframe.contentWindow && iframe.contentDocument) {
                const iframeDoc = iframe.contentDocument;

                // Suche nach "Click to Start" Elementen
                const possibleStartElements = [
                    iframeDoc.querySelector('button'),
                    iframeDoc.querySelector('[onclick]'),
                    iframeDoc.querySelector('.start-button'),
                    iframeDoc.querySelector('#start'),
                    iframeDoc.querySelector('canvas'),
                    iframeDoc.querySelector('div[style*="cursor"]'),
                    iframeDoc.querySelector('*[role="button"]'),
                    iframeDoc.body
                ];

                for (let element of possibleStartElements) {
                    if (element) {
                        console.log('🎯 Gefundenes Element für Auto-Click:', element.tagName, element.className);

                        // Verschiedene Click-Events probieren
                        element.click();

                        const events = ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup'];
                        events.forEach(eventType => {
                            const event = new MouseEvent(eventType, {
                                bubbles: true,
                                cancelable: true,
                                view: iframe.contentWindow,
                                clientX: 100,
                                clientY: 100
                            });
                            element.dispatchEvent(event);
                        });

                        // Touch Events für mobile Kompatibilität
                        const touchEvent = new TouchEvent('touchstart', {
                            bubbles: true,
                            cancelable: true,
                            view: iframe.contentWindow
                        });
                        element.dispatchEvent(touchEvent);

                        console.log('🎮 Auto-Click Events gesendet');
                        return true;
                    }
                }
            }

            // Methode 2: PostMessage an iframe
            iframe.contentWindow.postMessage({
                type: 'autostart',
                action: 'click',
                x: 100,
                y: 100
            }, '*');

            // Methode 3: Direct iframe click (Fallback)
            const iframeClickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: 100,
                clientY: 100
            });
            iframe.dispatchEvent(iframeClickEvent);

            // Methode 4: Focus + Enter/Space
            iframe.focus();
            setTimeout(() => {
                const keyEvents = ['Enter', 'Space', ' '];
                keyEvents.forEach(key => {
                    const keyEvent = new KeyboardEvent('keydown', {
                        key: key,
                        bubbles: true,
                        cancelable: true
                    });
                    iframe.dispatchEvent(keyEvent);
                });
            }, 100);

            console.log('🎮 Alternative Auto-Start Methoden versucht');

        } catch (error) {
            console.log('⚠️ Auto-Start blockiert (CORS/Security):', error.message);
        }

        // Retry nach 2 Sekunden wenn noch Versuche übrig
        if (attempts < maxAttempts) {
            setTimeout(tryAutoStart, 2000);
        } else {
            console.log('🎮 Auto-Start Versuche beendet - User-Click erforderlich');
            addMessage('system', '🎮 Klicken Sie auf den Avatar-Stream um ihn zu starten', 'info');
        }
    }

    // Ersten Versuch nach 3 Sekunden starten
    setTimeout(tryAutoStart, 3000);
}

// Event Listener für iframe load
function setupIframeAutoStart() {
    const iframe = document.getElementById('pixelStreamIframe');
    if (iframe) {
        iframe.onload = () => {
            console.log('🎮 Iframe geladen - starte Auto-Start...');
            setTimeout(autoStartPixelStreaming, 1000);
        };

        iframe.onerror = () => {
            console.log('❌ Iframe Ladefehler');
        };

        // Fallback falls onload nicht feuert
        setTimeout(autoStartPixelStreaming, 5000);

        // Event Listener für postMessage (falls iframe kommuniziert)
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'pixelStreamingReady') {
                console.log('🎮 Pixel Streaming bereit - starte Auto-Start');
                autoStartPixelStreaming();
            }
        });
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

    // Auto-Start Pixel Streaming initialisieren
    console.log('🎮 Auto-Start Pixel Streaming wird initialisiert...');
    setupIframeAutoStart();

    checkSystemHealth();
    setStatus('Option 3 + Auto-Start geladen • Audio-Event Sync + Auto-Stream bereit', 'ready');

    console.log('🎉 NeuroSync Avatar Chat - Option 3 (Audio-Event) + Auto-Start geladen!');
    console.log('🎯 Features: Audio-Event Sync + Automatischer Pixel Stream Start');
});

// System Health Check
async function checkSystemHealth() {
    try {
        const response = await fetch('/health');
        if (response.ok) {
            const health = await response.json();

            if (health.neurosync_server === 'offline') {
                setStatus('⚠️ NeuroSync Server offline', 'error');
                addMessage('system', 'NeuroSync AI Server ist nicht erreichbar.', 'error');
            } else {
                setStatus('✅ Audio-Event Sync + Auto-Start aktiv', 'ready');
            }
        }
    } catch (error) {
        console.error('❌ Health Check Fehler:', error);
        setStatus('System-Verbindung prüfen...', 'warning');
    }
}

setInterval(checkSystemHealth, 30000);

// Global Error Handler
window.addEventListener('error', (event) => {
    console.error('🔥 Global Error:', event.error);
    setStatus('Unerwarteter Fehler aufgetreten', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('🔥 Unhandled Promise Rejection:', event.reason);
    setStatus('Asynchroner Fehler aufgetreten', 'error');
});

console.log('🚀 NeuroSync Avatar Chat - Audio-Event Sync + Auto-Start Pixel Streaming');
console.log('🎭 LiveLink: Wartet auf Audio "playing" Event für perfekte Synchronisation');
console.log('🎮 Auto-Start: Versucht automatisch Pixel Streaming zu starten');
console.log('🎊 Optimiert für alle Internetgeschwindigkeiten und Browser!');