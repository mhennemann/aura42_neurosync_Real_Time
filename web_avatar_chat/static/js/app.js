// NeuroSync Avatar Chat - ChatGPT + Adjustable Audio Delay Slider
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let currentAudioDelayMs = 80; // Standard Delay

// Audio Delay Management
function initializeDelaySlider() {
    const slider = document.getElementById('audioDelaySlider');
    const delayValue = document.getElementById('delayValue');

    if (slider && delayValue) {
        // Slider Event Listener
        slider.addEventListener('input', function () {
            currentAudioDelayMs = parseInt(this.value);
            delayValue.textContent = currentAudioDelayMs + 'ms';
            console.log(`🎵 Audio-Delay geändert auf: ${currentAudioDelayMs}ms`);

            // Delay in LocalStorage speichern
            localStorage.setItem('audioSyncDelay', currentAudioDelayMs);
        });

        // Gespeicherten Delay laden
        const savedDelay = localStorage.getItem('audioSyncDelay');
        if (savedDelay) {
            currentAudioDelayMs = parseInt(savedDelay);
            slider.value = currentAudioDelayMs;
            delayValue.textContent = currentAudioDelayMs + 'ms';
            console.log(`🎵 Gespeicherter Audio-Delay geladen: ${currentAudioDelayMs}ms`);
        }
    }
}

// Test-Sync Funktion
function testSync() {
    const testText = "Dies ist ein Test der Audio-Synchronisation mit dem angepassten Delay.";
    console.log(`🔄 Teste Sync mit ${currentAudioDelayMs}ms Delay`);

    // Test-Nachricht in Input setzen
    const textInput = document.getElementById('textInput');
    if (textInput) {
        textInput.value = testText;
        sendMessage();
    }
}

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
        <small>${timestamp} ${type === 'chatgpt-response' ? `(Delay: ${currentAudioDelayMs}ms)` : ''}</small>
    `;

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ChatGPT + Audio-Event Based Perfect Synchronization mit Delay-Slider
async function sendMessage() {
    const textInput = document.getElementById('textInput');
    const text = textInput.value.trim();

    if (!text) return;

    addMessage('user', text);
    textInput.value = '';
    setStatus(`🤖 ChatGPT denkt nach (Delay: ${currentAudioDelayMs}ms)...`, 'processing');
    showAvatarActivity();

    try {
        console.log(`🤖 ChatGPT Integration mit ${currentAudioDelayMs}ms Audio-Delay`);
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

                setStatus(`🤖 ChatGPT: "${result.ai_response.substring(0, 40)}..." (${currentAudioDelayMs}ms)`, 'processing');

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
                    setStatus(`🔄 Franzis Antwort wird vorbereitet (${currentAudioDelayMs}ms Delay)...`, 'processing');
                };

                audio.oncanplay = () => {
                    console.log('✅ ChatGPT Audio bereit - wartet auf optimiertes Timing');
                    setStatus(`✅ Franzi bereit - startet in ${currentAudioDelayMs}ms...`, 'ready');
                };

                // KRITISCHER EVENT: Audio startet wirklich → LiveLink triggern
                audio.addEventListener('playing', async () => {
                    if (!livelinkTriggered) {
                        livelinkTriggered = true;
                        console.log(`🎊 CHATGPT AUDIO SPIELT (${currentAudioDelayMs}ms Delay) → LiveLink getriggert!`);
                        setStatus('🎊 Franzi spricht → LiveLink synchron!', 'speaking');

                        try {
                            const livelinkResponse = await fetch('/api/trigger_livelink', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    chatgpt_response: true,
                                    ai_text: result.ai_response,
                                    audio_delay: currentAudioDelayMs,
                                    trigger_time: performance.now()
                                })
                            });

                            if (livelinkResponse.ok) {
                                const livelinkData = await livelinkResponse.json();
                                console.log(`🎭 ChatGPT LiveLink getriggert (${currentAudioDelayMs}ms):`, livelinkData);
                                console.log('🎊 PERFEKTE CHATGPT AUDIO-EVENT SYNCHRONISATION!');
                            } else {
                                console.error('❌ ChatGPT LiveLink Trigger fehlgeschlagen:', livelinkResponse.status);
                            }

                        } catch (livelinkError) {
                            console.error('❌ ChatGPT LiveLink Trigger Fehler:', livelinkError);
                        }
                    }
                });

                // Progress-Tracking mit Delay-Info
                audio.ontimeupdate = () => {
                    const progress = (audio.currentTime / audio.duration) * 100;
                    if (progress > 0) {
                        setStatus(`🎵 Franzi spricht: ${Math.round(progress)}% (${currentAudioDelayMs}ms)`, 'speaking');
                    }
                };

                // Audio Ende
                audio.onended = () => {
                    console.log(`🎊 ChatGPT Audio-Event Synchronisation komplett (${currentAudioDelayMs}ms)!`);
                    setStatus(`✅ Franzi hat geantwortet (Delay: ${currentAudioDelayMs}ms)`, 'success');
                    setTimeout(() => {
                        setStatus(`Bereit für die nächste Frage • Delay: ${currentAudioDelayMs}ms`, 'ready');
                    }, 2000);
                    URL.revokeObjectURL(audioUrl);
                };

                audio.onerror = (e) => {
                    console.error('❌ ChatGPT Audio Fehler:', e);
                    setStatus('Audio-Fehler - Franzi hat geantwortet (stumm)', 'error');
                    URL.revokeObjectURL(audioUrl);
                };

                // SCHRITT 4: Audio laden und vorbereiten
                console.log(`🔄 ChatGPT Audio wird für Event-Trigger vorbereitet (${currentAudioDelayMs}ms Delay)...`);
                setStatus(`🔄 Franzis Antwort wird für Synchronisation vorbereitet (${currentAudioDelayMs}ms)...`, 'processing');

                // Audio vollständig laden
                await new Promise((resolve, reject) => {
                    audio.oncanplaythrough = resolve;
                    audio.onerror = reject;
                    audio.load();
                });

                console.log(`🚀 ChatGPT Audio bereit - starte mit ${currentAudioDelayMs}ms Delay...`);
                setStatus(`🚀 Franzi startet in ${currentAudioDelayMs}ms...`, 'processing');

                // SCHRITT 5: Audio mit anpassbarem Delay starten
                try {
                    // ANPASSBARER AUDIO-DELAY für perfekte Synchronisation
                    setTimeout(async () => {
                        try {
                            await audio.play();
                            console.log(`🔊 ChatGPT Audio.play() mit ${currentAudioDelayMs}ms Delay - optimierte Sync!`);
                        } catch (delayedPlayError) {
                            console.error('❌ ChatGPT Audio play nach Delay Fehler:', delayedPlayError);
                            setStatus('Browser blockiert Audio - Klicken Sie irgendwo', 'warning');

                            // Fallback: User-Click
                            addMessage('system', '🔊 Klicken Sie irgendwo um Franzis Audio zu aktivieren', 'warning');
                            document.addEventListener('click', async () => {
                                try {
                                    await audio.play();
                                    console.log(`🔊 ChatGPT Audio nach User-Interaction + ${currentAudioDelayMs}ms Delay gestartet`);
                                } catch (e) {
                                    console.error('ChatGPT Audio weiterhin blockiert:', e);
                                }
                            }, { once: true });
                        }
                    }, currentAudioDelayMs); // ← ANPASSBARER DELAY VOM SLIDER!

                } catch (playError) {
                    console.error('❌ ChatGPT Audio Timing-Setup Fehler:', playError);
                    setStatus('Audio-Timing Fehler', 'error');
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
            setStatus(`🎤 Aufnahme läuft (Delay: ${currentAudioDelayMs}ms)...`, 'recording');

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
            Hallo! Ich bin Franzi mit anpassbarer Audio-Synchronisation! 
            Nutzen Sie den Delay-Slider oben um die perfekte Lippensynchronisation einzustellen.
            Frag mich einfach etwas!
            <small>ChatGPT + Audio-Delay-Slider bereit (${currentAudioDelayMs}ms)</small>
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

    setStatus(`Chat gelöscht • Audio-Delay: ${currentAudioDelayMs}ms`, 'ready');
    console.log(`🧹 Chat gelöscht - ChatGPT + Delay-Slider (${currentAudioDelayMs}ms) aktiv`);
}

function toggleStream() {
    const iframe = document.getElementById('pixelStreamIframe');
    if (iframe) {
        iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none';
        const visible = iframe.style.display !== 'none';
        setStatus(visible ? 'Avatar-Stream sichtbar' : 'Avatar-Stream ausgeblendet', 'info');
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
        textInput.placeholder = "Stellen Sie Franzi eine Frage...";
    }

    // Delay-Slider initialisieren
    initializeDelaySlider();

    checkSystemHealth();
    setStatus(`ChatGPT + Delay-Slider geladen • Audio-Delay: ${currentAudioDelayMs}ms`, 'ready');

    console.log('🎉 NeuroSync Avatar Chat - ChatGPT + Audio-Delay-Slider geladen!');
    console.log(`🤖 Features: ChatGPT + Audio-Event Sync + Anpassbarer Delay (${currentAudioDelayMs}ms)`);
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
                setStatus(`✅ ChatGPT + Audio-Delay aktiv (${currentAudioDelayMs}ms)`, 'ready');
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

console.log('🚀 NeuroSync Avatar Chat - ChatGPT + Anpassbarer Audio-Delay-Slider');
console.log('🤖 ChatGPT: Intelligente Antworten mit Conversation Memory');
console.log('🎭 LiveLink: Audio-Event basierte Synchronisation');
console.log('🎵 Audio-Delay: Anpassbar von 0-200ms für perfekte Lippensync');
console.log('🎊 Franzi: Deutsche KI-Avatar mit optimaler Synchronisation!');