// NeuroSync Avatar Chat - Minimalistic Tailwind Design
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let currentAudioDelayMs = 40; // Standard Delay

// 🆕 EMOTION DETECTION SYSTEM - KORRIGIERT
class EmotionDetector {
    constructor() {
        this.emotionTriggers = {};
        this.loadTriggersFromBackend();
    }

    async loadTriggersFromBackend() {
        try {
            const response = await fetch('https://backend.aura42.de/api/config');
            const config = await response.json();
            this.emotionTriggers = config.config.animation_triggers || {};
            console.log('🎭 Emotion-Trigger geladen:', this.emotionTriggers);
        } catch (error) {
            console.error('❌ Fehler beim Laden der Trigger:', error);
            // Fallback-Trigger für Tests
            this.emotionTriggers = {
                'extrem': 'dummy',
                'mega': 'dummy',
                'glücklich': 'dummy',
                'traurig': 'dummy'
            };
        }
    }

    detectEmotion(text) {
        const textLower = text.toLowerCase();

        for (const [emotion, animationFile] of Object.entries(this.emotionTriggers)) {
            if (textLower.includes(emotion)) {
                console.log(`🎭 Emotion erkannt: "${emotion}" in "${text}"`);

                return {
                    detected: true,
                    emotion: emotion,
                    animationFile: animationFile,
                    triggerWord: emotion
                };
            }
        }

        return { detected: false };
    }

    async triggerEmotionAnimation(emotion, animationFile = null) {
        try {
            console.log(`🎬 Triggere Emotion-Animation: ${emotion}`);

            const response = await fetch('/api/trigger_emotion_animation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    emotion: emotion
                    // KEINE animationFile mehr!
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Emotion-Offset gesetzt: ${emotion}`, result);
                this.showEmotionNotification(`🎭 ${emotion.charAt(0).toUpperCase() + emotion.slice(1)}-Emotion beim nächsten Sprechen aktiv`);
            } else {
                console.error(`❌ Emotion-API Fehler:`, response.status);
            }

        } catch (error) {
            console.error('❌ Fehler beim Triggern der Emotion-Animation:', error);
        }
    }

    showEmotionNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-16 right-4 bg-purple-500 text-white px-4 py-2 rounded-lg z-50 fade-in';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// 🆕 GLOBAL EMOTION DETECTOR INITIALISIEREN
window.emotionDetector = new EmotionDetector();

// Audio Delay Management
function initializeDelaySlider() {
    const slider = document.getElementById('audioDelaySlider');
    const delayValue = document.getElementById('delayValue');

    if (slider && delayValue) {
        slider.addEventListener('input', function () {
            currentAudioDelayMs = parseInt(this.value);
            delayValue.textContent = currentAudioDelayMs + 'ms';
            console.log(`🎵 Audio-Delay geändert auf: ${currentAudioDelayMs}ms`);

            localStorage.setItem('audioSyncDelay', currentAudioDelayMs);
        });

        const savedDelay = localStorage.getItem('audioSyncDelay');
        if (savedDelay) {
            currentAudioDelayMs = parseInt(savedDelay);
            slider.value = currentAudioDelayMs;
            delayValue.textContent = currentAudioDelayMs + 'ms';
            console.log(`🎵 Gespeicherter Audio-Delay geladen: ${currentAudioDelayMs}ms`);
        }
    }
}

function testSync() {
    const testText = "Test der minimalistischen Audio-Synchronisation.";
    console.log(`🔄 Teste Sync mit ${currentAudioDelayMs}ms Delay`);

    const textInput = document.getElementById('textInput');
    if (textInput) {
        textInput.value = testText;
        sendMessage();
    }
}

function setStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    const statusMobileEl = document.getElementById('statusMobile');

    // Update both desktop and mobile status
    if (statusEl) statusEl.textContent = message;
    if (statusMobileEl) statusMobileEl.textContent = message;

    // Set status colors using Tailwind classes
    const elements = [statusEl, statusMobileEl].filter(el => el);

    elements.forEach(el => {
        // Remove all status classes
        el.classList.remove('text-text-secondary', 'text-green-400', 'text-red-400', 'text-yellow-400', 'text-text-primary');

        // Add appropriate class based on type
        switch (type) {
            case 'success':
                el.classList.add('text-green-400');
                break;
            case 'error':
                el.classList.add('text-red-400');
                break;
            case 'warning':
                el.classList.add('text-yellow-400');
                break;
            case 'processing':
            case 'speaking':
            case 'ready':
                el.classList.add('text-text-primary');
                break;
            default:
                el.classList.add('text-text-secondary');
        }
    });
}

function addMessage(sender, text, type = '') {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');

    const timestamp = new Date().toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Apply Tailwind classes based on message type
    if (sender === 'user') {
        messageDiv.className = 'mb-4 p-3 rounded-lg bg-bg-quaternary text-right ml-5 text-text-primary border border-border-custom fade-in';
    } else if (type === 'chatgpt-response') {
        messageDiv.className = 'mb-4 p-3 rounded-lg bg-bg-secondary mr-5 border border-border-custom fade-in';
    } else if (type === 'system') {
        messageDiv.className = 'mb-4 p-3 rounded-lg bg-bg-quaternary mx-2.5 text-center text-text-secondary border border-border-custom fade-in';
    } else {
        messageDiv.className = 'mb-4 p-3 rounded-lg bg-bg-secondary mr-5 border border-border-custom fade-in';
    }

    messageDiv.innerHTML = `
        <strong class="block mb-1 text-xs opacity-80 text-text-primary">${sender === 'user' ? 'Du' : 'Franzi (KI)'}</strong>
        <div class="text-text-primary">${text}</div>
        <small class="text-xs opacity-60 block mt-1 text-text-muted">${timestamp} ${type === 'chatgpt-response' ? `(Delay: ${currentAudioDelayMs}ms)` : ''}</small>
    `;

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Also add to mobile chat if exists
    addMessageMobile(sender, text, type);
}

function addMessageMobile(sender, message, type = 'user') {
    const mobileMessages = document.getElementById('chatMessagesMobile');
    if (!mobileMessages) return;

    const messageDiv = document.createElement('div');

    if (type === 'user') {
        messageDiv.className = 'bg-bg-quaternary/90 text-text-primary rounded-lg p-3 ml-4 text-sm fade-in border border-border-custom';
    } else {
        messageDiv.className = 'bg-bg-tertiary/90 p-3 rounded-lg border border-border-custom text-sm fade-in';
    }

    messageDiv.innerHTML = `
        <div class="font-semibold text-xs mb-1 text-text-primary">${sender === 'user' ? 'Du' : 'Avatar'}</div>
        <div class="break-words text-text-primary">${message}</div>
        <div class="text-xs opacity-60 mt-1 text-text-muted">${new Date().toLocaleTimeString()}</div>
    `;

    mobileMessages.appendChild(messageDiv);
    mobileMessages.scrollTop = mobileMessages.scrollHeight;

    // Limit mobile chat history
    while (mobileMessages.children.length > 10) {
        mobileMessages.removeChild(mobileMessages.firstChild);
    }
}

// 🆕 ERWEITERTE SENDMESSAGE MIT EMOTION-DETECTION
async function sendMessage() {
    const textInput = document.getElementById('textInput');
    const text = textInput.value.trim();

    if (!text) return;

    // 🎭 EMOTION-DETECTION VOR CHAT-SEND
    const emotionResult = window.emotionDetector.detectEmotion(text);
    if (emotionResult.detected) {
        console.log(`🎯 Emotion erkannt vor Chat-Send: ${emotionResult.emotion}`);
        setStatus(`🎭 Emotion "${emotionResult.emotion}" erkannt!`, 'processing');
    }

    addMessage('user', text);
    textInput.value = '';
    setStatus(`🤖 ChatGPT denkt nach (Delay: ${currentAudioDelayMs}ms)...`, 'processing');

    try {
        console.log(`🤖 ChatGPT Integration mit ${currentAudioDelayMs}ms Audio-Delay`);
        console.log('📤 User Input:', text);

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
                setStatus(`🤖 ChatGPT: "${result.ai_response.substring(0, 40)}..." (${currentAudioDelayMs}ms)`, 'processing');

                addMessage('avatar', result.ai_response, 'chatgpt-response');

                // 🎭 EMOTION-ANIMATION NACH CHATGPT-RESPONSE TRIGGERN
                if (emotionResult.detected) {
                    console.log(`🎬 Triggere Emotion-Animation: ${emotionResult.emotion}`);
                    setTimeout(() => {
                        window.emotionDetector.triggerEmotionAnimation(
                            emotionResult.emotion,
                            emotionResult.animationFile
                        );
                    }, 1500); // Nach ChatGPT-Response
                }

                // Audio processing (unchanged)
                const audioBytes = atob(result.audio_data);
                const audioArray = new Uint8Array(audioBytes.length);
                for (let i = 0; i < audioBytes.length; i++) {
                    audioArray[i] = audioBytes.charCodeAt(i);
                }

                const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                let livelinkTriggered = false;

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
                                    trigger_time: performance.now(),
                                    emotion_detected: emotionResult.detected ? emotionResult.emotion : null
                                })
                            });

                            if (livelinkResponse.ok) {
                                const livelinkData = await livelinkResponse.json();
                                console.log(`🎭 ChatGPT LiveLink getriggert (${currentAudioDelayMs}ms):`, livelinkData);
                            }
                        } catch (livelinkError) {
                            console.error('❌ ChatGPT LiveLink Trigger Fehler:', livelinkError);
                        }
                    }
                });

                audio.ontimeupdate = () => {
                    const progress = (audio.currentTime / audio.duration) * 100;
                    if (progress > 0) {
                        const statusText = emotionResult.detected
                            ? `🎵 Franzi spricht (${emotionResult.emotion}): ${Math.round(progress)}%`
                            : `🎵 Franzi spricht: ${Math.round(progress)}% (${currentAudioDelayMs}ms)`;
                        setStatus(statusText, 'speaking');
                    }
                };

                audio.onended = () => {
                    console.log(`🎊 ChatGPT Audio-Event Synchronisation komplett (${currentAudioDelayMs}ms)!`);
                    const endStatus = emotionResult.detected
                        ? `✅ Franzi hat emotional geantwortet (${emotionResult.emotion})`
                        : `✅ Franzi hat geantwortet (Delay: ${currentAudioDelayMs}ms)`;
                    setStatus(endStatus, 'success');
                    setTimeout(() => {
                        setStatus(`Bereit für die nächste Frage • Emotion-Detection aktiv`, 'ready');
                    }, 2000);
                    URL.revokeObjectURL(audioUrl);
                };

                console.log(`🔄 ChatGPT Audio wird für Event-Trigger vorbereitet (${currentAudioDelayMs}ms Delay)...`);
                setStatus(`🔄 Franzis Antwort wird für Synchronisation vorbereitet (${currentAudioDelayMs}ms)...`, 'processing');

                await new Promise((resolve, reject) => {
                    audio.oncanplaythrough = resolve;
                    audio.onerror = reject;
                    audio.load();
                });

                setTimeout(async () => {
                    try {
                        await audio.play();
                        console.log(`🔊 ChatGPT Audio.play() mit ${currentAudioDelayMs}ms Delay`);
                    } catch (delayedPlayError) {
                        console.error('❌ ChatGPT Audio play nach Delay Fehler:', delayedPlayError);
                        setStatus('Browser blockiert Audio - Klicken Sie irgendwo', 'warning');
                        addMessage('system', '🔊 Klicken Sie irgendwo um Franzis Audio zu aktivieren', 'warning');

                        document.addEventListener('click', async () => {
                            try {
                                await audio.play();
                                console.log(`🔊 ChatGPT Audio nach User-Interaction gestartet`);
                            } catch (e) {
                                console.error('ChatGPT Audio weiterhin blockiert:', e);
                            }
                        }, { once: true });
                    }
                }, currentAudioDelayMs);

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

// Recording Functions (unchanged)
async function toggleRecording() {
    const micButton = document.getElementById('micButton');
    const micButtonMobile = document.getElementById('micButtonMobile');

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

            // Update both buttons
            if (micButton) {
                micButton.textContent = '🔴 Stop';
                micButton.classList.add('pulse-pink');
            }
            if (micButtonMobile) {
                micButtonMobile.textContent = '⏹️ Stoppen';
                micButtonMobile.classList.add('pulse-pink');
            }

            setStatus(`🎤 Aufnahme läuft (Delay: ${currentAudioDelayMs}ms)...`, 'processing');

        } catch (error) {
            console.error('❌ Mikrofon Fehler:', error);
            setStatus('Mikrofon-Fehler', 'error');
        }
    } else {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        isRecording = false;

        // Update both buttons
        if (micButton) {
            micButton.textContent = '🎤 Aufnehmen';
            micButton.classList.remove('pulse-pink');
        }
        if (micButtonMobile) {
            micButtonMobile.textContent = '🎤 Aufnehmen';
            micButtonMobile.classList.remove('pulse-pink');
        }

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
                const mobileInput = document.getElementById('textInputMobile');
                if (mobileInput) mobileInput.value = transcription;

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

// Utility Functions (unchanged)
function clearChat() {
    const messagesDiv = document.getElementById('chatMessages');
    const mobileMessages = document.getElementById('chatMessagesMobile');

    const welcomeMessage = `
        <div class="mb-4 p-3 rounded-lg bg-bg-secondary mr-5 border border-border-custom fade-in">
            <strong class="block mb-1 text-xs opacity-80 text-text-primary">Franzi (KI)</strong>
            <div class="text-text-primary">Hallo! Minimalistisches Design mit Emotion-Detection aktiv!</div>
            <small class="text-xs opacity-60 block mt-1 text-text-muted">ChatGPT + Emotion-Trigger + Audio-Delay-Slider bereit (${currentAudioDelayMs}ms)</small>
        </div>
    `;

    if (messagesDiv) messagesDiv.innerHTML = welcomeMessage;
    if (mobileMessages) mobileMessages.innerHTML = `
        <div class="bg-bg-tertiary/90 p-3 rounded-lg border border-border-custom text-sm fade-in">
            <div class="font-semibold text-xs mb-1 text-text-primary">Avatar</div>
            <div>Bereit zum Chatten mit Emotion-Detection!</div>
        </div>
    `;

    fetch('/api/clear_conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }).then(response => {
        if (response.ok) {
            console.log('🧹 Conversation History gelöscht');
        }
    });

    setStatus(`Chat gelöscht • Emotion-Detection aktiv`, 'ready');
    console.log(`🧹 Chat gelöscht - ChatGPT + Emotion-Detection + Delay-Slider (${currentAudioDelayMs}ms) aktiv`);
}

function toggleStream() {
    const iframe = document.getElementById('pixelStreamIframe');
    const iframeMobile = document.getElementById('pixelStreamIframeMobile');

    [iframe, iframeMobile].forEach(el => {
        if (el) {
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
        }
    });

    const visible = iframe && iframe.style.display !== 'none';
    setStatus(visible ? 'Avatar-Stream sichtbar' : 'Avatar-Stream ausgeblendet', 'info');
}

function resetStream() {
    const iframe = document.getElementById('pixelStreamIframe');
    const iframeMobile = document.getElementById('pixelStreamIframeMobile');

    [iframe, iframeMobile].forEach(el => {
        if (el) {
            const originalSrc = el.src;
            el.src = '';
            setTimeout(() => {
                el.src = originalSrc;
            }, 100);
        }
    });

    setStatus('Avatar-Stream zurückgesetzt', 'info');
}

// Mobile Functions (unchanged)
function sendMessageMobile() {
    const input = document.getElementById('textInputMobile');
    const desktopInput = document.getElementById('textInput');
    if (input && desktopInput) {
        desktopInput.value = input.value;
        sendMessage();
        input.value = '';
    }
}

function toggleRecordingMobile() {
    toggleRecording();
}

function clearChatMobile() {
    clearChat();
}

function resetStreamMobile() {
    resetStream();
}

function toggleStreamMobile() {
    toggleStream();
}

function testSyncMobile() {
    testSync();
}

function toggleMobilePanel() {
    const panel = document.getElementById('mobilePanel');
    const overlay = document.getElementById('mobilePanelOverlay');
    if (panel && overlay) {
        const isOpen = !panel.classList.contains('translate-x-full');

        if (isOpen) {
            panel.classList.add('translate-x-full');
            overlay.classList.add('opacity-0', 'pointer-events-none');
        } else {
            panel.classList.remove('translate-x-full');
            overlay.classList.remove('opacity-0', 'pointer-events-none');
        }
    }
}

function toggleMobileChat() {
    const chatMessages = document.getElementById('chatMessagesMobile');
    if (chatMessages) {
        chatMessages.classList.toggle('hidden');
    }
}

// Sync mobile and desktop sliders
function syncDelaySliders() {
    const desktopSlider = document.getElementById('audioDelaySlider');
    const mobileSlider = document.getElementById('audioDelaySliderMobile');
    const delayValue = document.getElementById('delayValue');
    const delayValueMobile = document.getElementById('delayValueMobile');
    const currentDelayInfo = document.getElementById('currentDelayInfo');

    function updateValues(value) {
        currentAudioDelayMs = parseInt(value);

        if (delayValue) delayValue.textContent = value + 'ms';
        if (delayValueMobile) delayValueMobile.textContent = value + 'ms';
        if (currentDelayInfo) currentDelayInfo.textContent = value + 'ms';

        localStorage.setItem('audioSyncDelay', currentAudioDelayMs);
    }

    if (desktopSlider) {
        desktopSlider.addEventListener('input', function () {
            updateValues(this.value);
            if (mobileSlider) mobileSlider.value = this.value;
        });
    }

    if (mobileSlider) {
        mobileSlider.addEventListener('input', function () {
            updateValues(this.value);
            if (desktopSlider) desktopSlider.value = this.value;
        });
    }
}

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
                setStatus(`✅ ChatGPT + Emotion-Detection aktiv (${currentAudioDelayMs}ms)`, 'ready');
            } else {
                setStatus('✅ NeuroSync System verbunden', 'ready');
            }
        }
    } catch (error) {
        console.error('❌ Health Check Fehler:', error);
        setStatus('System-Verbindung prüfen...', 'warning');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function () {
    const textInput = document.getElementById('textInput');
    const textInputMobile = document.getElementById('textInputMobile');

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

    if (textInputMobile) {
        textInputMobile.addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessageMobile();
            }
        });
    }

    // Initialize all components
    initializeDelaySlider();
    syncDelaySliders();
    checkSystemHealth();

    setStatus(`Emotion-Detection geladen • Audio-Delay: ${currentAudioDelayMs}ms`, 'ready');

    console.log('🎉 NeuroSync Avatar Chat - Emotion-Detection loaded!');
    console.log(`🎨 Design: Schwarz-Weiß minimalistisch + Pink Action-Buttons`);
    console.log(`🎭 Features: ChatGPT + Emotion-Detection + Audio-Event Sync + Delay (${currentAudioDelayMs}ms)`);
});

// Mobile optimizations
window.addEventListener('resize', function () {
    if (window.innerWidth >= 1024) {
        const panel = document.getElementById('mobilePanel');
        const overlay = document.getElementById('mobilePanelOverlay');
        if (panel) panel.classList.add('translate-x-full');
        if (overlay) overlay.classList.add('opacity-0', 'pointer-events-none');
    }
});

// Mobile viewport fix
function setMobileVH() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', setMobileVH);
setMobileVH();

// Regular health checks
setInterval(checkSystemHealth, 30000);

console.log('🚀 NeuroSync Avatar Chat - Emotion-Detection System');
console.log('🎨 Schwarz-Weiß Palette + Pink Action-Buttons');
console.log('📱 Responsive Desktop + Mobile Layout');
console.log('🎭 ChatGPT + Emotion-Detection + Avatar Integration');