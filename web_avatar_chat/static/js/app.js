// NeuroSync Avatar Chat - ChatGPT Integration + Audio-Event Synchronization
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
    setStatus('🤖 ChatGPT denkt nach...', 'processing');
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
        <strong>${sender === 'user' ? 'Du' : 'Franzi (KI)'}</strong>
        ${text}
        <small>${timestamp}</small>
    `;

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ChatGPT + Audio-Event Based Perfect Synchronization
async function sendMessage() {
    const textInput = document.getElementById('textInput');
    const text = textInput.value.trim();

    if (!text) return;

    addMessage('user', text);
    textInput.value = '';
    setStatus('🤖 ChatGPT generiert Antwort...', 'processing');
    showAvatarActivity();

    try {
        console.log('🤖 ChatGPT Integration: Sende Nachricht...');
        console.log('📤 User Input:', text);

        // SCHRITT 1: ChatGPT Antwort + Audio + Blendshapes generieren
        const response = await fetch('/api/generate_audio_and_blendshapes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, voice: 'franzi' })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('📥 ChatGPT Server Response:', result);

            if (result.ready_for_sync && result.audio_data && result.ai_response) {
                console.log(`🤖 ChatGPT Antwort: "${result.ai_response}"`);
                console.log(`🎬 Audio-Event Sync bereit: ${result.audio_length}s Audio + ${result.blendshapes_count} frames`);

                setStatus(`🤖 ChatGPT: "${result.ai_response.substring(0, 50)}..."`, 'processing');

                // ChatGPT Antwort zum Chat hinzufügen (BEVOR Audio startet)
                addMessage('avatar', result.ai_response, 'chatgpt-response');

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
                    console.log('🔄 ChatGPT Audio lädt...');
                    setStatus('🔄 Franzis Antwort wird vorbereitet...', 'processing');
                };

                audio.oncanplay = () => {
                    console.log('✅ ChatGPT Audio bereit - wartet auf Play-Event');
                    setStatus('✅ Franzi bereit - Audio startet gleich...', 'ready');
                };

                // KRITISCHER EVENT: Audio startet wirklich → LiveLink triggern
                audio.addEventListener('playing', async () => {
                    if (!livelinkTriggered) {
                        livelinkTriggered = true;
                        console.log('🎊 CHATGPT AUDIO SPIELT → LiveLink wird getriggert!');
                        setStatus('🎊 Franzi spricht → LiveLink synchron!', 'speaking');

                        try {
                            const livelinkResponse = await fetch('/api/trigger_livelink', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    chatgpt_response: true,
                                    ai_text: result.ai_response,
                                    trigger_time: performance.now()
                                })
                            });

                            if (livelinkResponse.ok) {
                                const livelinkData = await livelinkResponse.json();
                                console.log('🎭 ChatGPT LiveLink getriggert:', livelinkData);
                                console.log('🎊 PERFEKTE CHATGPT AUDIO-EVENT SYNCHRONISATION!');
                            } else {
                                console.error('❌ ChatGPT LiveLink Trigger fehlgeschlagen:', livelinkResponse.status);
                            }

                        } catch (livelinkError) {
                            console.error('❌ ChatGPT LiveLink Trigger Fehler:', livelinkError);
                        }
                    }
                });

                // Progress-Tracking
                audio.ontimeupdate = () => {
                    const progress = (audio.currentTime / audio.duration) * 100;
                    if (progress > 0) {
                        setStatus(`🎵 Franzi spricht: ${Math.round(progress)}%`, 'speaking');
                    }
                };

                // Audio Ende
                audio.onended = () => {
                    console.log('🎊 ChatGPT Audio-Event Synchronisation komplett!');
                    setStatus('✅ Franzi hat geantwortet', 'success');
                    setTimeout(() => {
                        setStatus('Bereit für die nächste Frage • ChatGPT + Audio-Event Sync', 'ready');
                    }, 2000);
                    URL.revokeObjectURL(audioUrl);
                };

                audio.onerror = (e) => {
                    console.error('❌ ChatGPT Audio Fehler:', e);
                    setStatus('Audio-Fehler - Franzi hat geantwortet (stumm)', 'error');
                    URL.revokeObjectURL(audioUrl);
                };

                // SCHRITT 4: Audio laden und vorbereiten
                console.log('🔄 ChatGPT Audio wird für Event-Trigger vorbereitet...');
                setStatus('🔄 Franzis Antwort wird für Synchronisation vorbereitet...', 'processing');

                // Audio vollständig laden
                await new Promise((resolve, reject) => {
                    audio.oncanplaythrough = resolve;
                    audio.onerror = reject;
                    audio.load();
                });

                console.log('🚀 ChatGPT Audio bereit - starte Wiedergabe...');
                setStatus('🚀 Franzi startet zu sprechen...', 'processing');

                // SCHRITT 5: Audio starten - 'playing' Event wird LiveLink triggern
                try {
                    await audio.play();
                    console.log('🔊 ChatGPT Audio.play() aufgerufen - Event-Listener wartet auf "playing"');
                } catch (playError) {
                    console.error('❌ ChatGPT Audio play Fehler:', playError);
                    setStatus('Browser blockiert Audio - Klicken Sie irgendwo zum Aktivieren', 'warning');

                    // Fallback: User-Click erforderlich
                    addMessage('system', '🔊 Klicken Sie irgendwo um Franzis Audio zu aktivieren', 'warning');
                    document.addEventListener('click', async () => {
                        try {
                            await audio.play();
                            console.log('🔊 ChatGPT Audio nach User-Interaction gestartet');
                        } catch (e) {
                            console.error('ChatGPT Audio weiterhin blockiert:', e);
                        }
                    }, { once: true });
                }

            } else {
                console.error('❌ ChatGPT Server nicht bereit für Sync:', result);
                setStatus('ChatGPT-Synchronisation fehlgeschlagen', 'error');
                addMessage('system', 'ChatGPT Antwort konnte nicht verarbeitet werden.', 'error');
            }

        } else {
            console.error('❌ ChatGPT Server Fehler:', response.status, response.statusText);
            setStatus('ChatGPT Server-Fehler', 'error');
            addMessage('system', `ChatGPT Server-Fehler (${response.status}). Versuchen Sie es erneut.`, 'error');
        }

    } catch (error) {
        console.error('❌ ChatGPT Integration Fehler:', error);
        setStatus('ChatGPT Integration fehlgeschlagen', 'error');
        addMessage('system', 'ChatGPT Verbindungsfehler. Bitte versuchen Sie es erneut.', 'error');
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
            setStatus('🎤 Aufnahme läuft... (Sprechen Sie Ihre Frage)', 'recording');

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
        setStatus('🔄 Transkribiere Ihre Frage...', 'processing');
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
                setStatus('✅ Frage erkannt: "' + transcription.substring(0, 30) + '..."', 'success');
                addMessage('system', `Frage erkannt: "${transcription}"`, 'transcription');

                setTimeout(() => {
                    sendMessage();
                }, 1000);
            } else {
                setStatus('Keine Frage erkannt', 'warning');
            }
        } else {
            setStatus('Spracherkennung fehlgeschlagen', 'error');
        }

    } catch (error) {
        console.error('❌ Transkriptions-Fehler:', error);
        setStatus('Spracherkennungs-Fehler', 'error');
    }
}

// Utility Functions
function clearChat() {
    const messagesDiv = document.getElementById('chatMessages');
    messagesDiv.innerHTML = `
        <div class="message avatar-message">
            <strong>Franzi (KI)</strong>
            Hallo! Ich bin Franzi, dein intelligenter KI-Avatar mit ChatGPT Integration! 
            Ich kann Fragen beantworten und halte ein Gespräch mit dir. 
            Frag mich einfach etwas!
            <small>ChatGPT + Audio-Event Sync bereit</small>
        </div>
    `;

    // Conversation History löschen
    fetch('/api/clear_conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }).then(response => {
        if (response.ok) {
            console.log('🧹 Conversation History gelöscht');
        }
    });

    setStatus('Chat gelöscht • ChatGPT + Audio-Event Sync bereit', 'ready');
    console.log('🧹 Chat gelöscht - ChatGPT Integration aktiv');
}

function toggleStream() {
    const iframe = document.getElementById('pixelStreamIframe');
    if (iframe) {
        iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none';
        const visible = iframe.style.display !== 'none';
        setStatus(visible ? 'Avatar-Stream sichtbar' : 'Avatar-Stream ausgeblendet', 'info');

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
            setTimeout(autoStartPixelStreaming, 2000);
        }, 100);
        setStatus('Avatar-Stream zurückgesetzt', 'info');
    }
}

// Auto-Start Pixel Streaming (vereinfacht)
function autoStartPixelStreaming() {
    console.log('🎮 Auto-Start Pixel Streaming für ChatGPT Avatar...');

    setTimeout(() => {
        const iframe = document.querySelector('#pixelStreamIframe');
        if (iframe) {
            try {
                iframe.focus();
                iframe.click();
                console.log('🎮 Auto-Start Versuche für ChatGPT Avatar');
            } catch (e) {
                console.log('🎮 Auto-Start blockiert - User-Click auf Avatar erforderlich');
                addMessage('system', '🎮 Klicken Sie auf den Avatar-Stream um ihn zu starten', 'info');
            }
        }
    }, 3000);
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
        textInput.placeholder = "Stellen Sie Franzi eine Frage...";
    }

    // Auto-Start für Avatar
    autoStartPixelStreaming();

    checkSystemHealth();
    setStatus('ChatGPT Integration geladen • Franzi bereit für Gespräche', 'ready');

    console.log('🎉 NeuroSync Avatar Chat - ChatGPT Integration geladen!');
    console.log('🤖 Features: ChatGPT Antworten + Audio-Event Sync + Franzi Avatar');
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
            } else if (health.ai_integration === 'ChatGPT (OpenAI)') {
                setStatus('✅ ChatGPT + Audio-Event Sync aktiv', 'ready');
            } else {
                setStatus('✅ NeuroSync System verbunden', 'ready');
            }
        }
    } catch (error) {
        console.error('❌ Health Check Fehler:', error);
        setStatus('System-Verbindung prüfen...', 'warning');
    }
}

setInterval(checkSystemHealth, 30000);

console.log('🚀 NeuroSync Avatar Chat - ChatGPT Integration');
console.log('🤖 ChatGPT: Intelligente Antworten mit Conversation Memory');
console.log('🎭 LiveLink: Audio-Event basierte perfekte Synchronisation');
console.log('🎊 Franzi: Deutsche KI-Avatar mit natürlicher Sprache!');