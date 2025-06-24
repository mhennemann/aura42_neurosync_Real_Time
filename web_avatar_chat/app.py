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
        const response = await fetch('/api/synthesize_and_blendshapes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, voice: 'franzi' })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // Prüfe ob Audio-Daten in Response enthalten sind
            if (result.audio_data && result.play_audio) {
                console.log(`🎯 Perfekte Sync: Audio ${result.audio_length}s + LiveLink`);
                
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
                audio.onplay = () => {
                    console.log('🔊 Audio startet - LiveLink läuft parallel');
                    setStatus('🎊 Perfekte Synchronisation: Audio + LiveLink!', 'speaking');
                };
                
                audio.onended = () => {
                    console.log('🔊 Audio beendet');
                    setStatus('Bereit • Perfekte Synchronisation aktiv', 'ready');
                    URL.revokeObjectURL(audioUrl);
                };
                
                audio.onerror = (e) => {
                    console.error('❌ Audio Fehler:', e);
                    setStatus('Audio-Fehler - Fallback aktiv', 'error');
                };
                
                // Audio abspielen (gleichzeitig mit LiveLink auf Server)
                audio.play().catch(e => {
                    console.error('❌ Audio play Fehler:', e);
                    setStatus('Audio-Wiedergabe fehlgeschlagen', 'error');
                });
                
            } else {
                console.log('✅ LiveLink Animation gesendet (ohne Audio-Sync)');
                setStatus('Avatar Animation gesendet', 'success');
            }
            
            // Avatar-Antwort zur Chat-Historie hinzufügen
            addMessage('avatar', text, 'synchronized');
            
        } else {
            console.error('❌ NeuroSync Fehler:', response.status);
            setStatus('NeuroSync Server Fehler', 'error');
            addMessage('system', 'Entschuldigung, es gab einen Fehler beim Verarbeiten.', 'error');
        }
        
    } catch (error) {
        console.error('❌ Synchronisation Fehler:', error);
        setStatus('Verbindungsfehler', 'error');
        addMessage('system', 'Verbindung zum Server fehlgeschlagen.', 'error');
    }
}

// Voice Recording Functions
async function toggleRecording() {
    const micButton = document.getElementById('micButton');
    
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                await transcribeAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            isRecording = true;
            micButton.textContent = '🔴 Stop';
            micButton.classList.add('recording');
            setStatus('🎤 Aufnahme läuft...', 'recording');
            
        } catch (error) {
            console.error('❌ Mikrofon Fehler:', error);
            setStatus('Mikrofon-Zugriff verweigert', 'error');
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        micButton.textContent = '🎤 Aufnehmen';
        micButton.classList.remove('recording');
        setStatus('🔄 Transkribiere...', 'processing');
    }
}

async function transcribeAudio(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
        
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            const transcription = result.transcription || '';
            
            if (transcription.trim()) {
                document.getElementById('textInput').value = transcription;
                setStatus('✅ Transkription erfolgreich', 'success');
                // Automatisch senden nach Transkription
                setTimeout(() => sendMessage(), 500);
            } else {
                setStatus('Keine Sprache erkannt', 'warning');
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
            Hallo! Ich bin dein KI-Avatar mit perfekter Audio+LiveLink Synchronisation!
            <small>Chat gelöscht</small>
        </div>
    `;
    setStatus('Bereit • Perfekte Synchronisation aktiv', 'ready');
}

function toggleStream() {
    const iframe = document.getElementById('pixelStreamIframe');
    iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none';
    setStatus(iframe.style.display === 'none' ? 'Avatar-Stream ausgeblendet' : 'Avatar-Stream sichtbar');
}

function resetStream() {
    const iframe = document.getElementById('pixelStreamIframe');
    iframe.src = iframe.src; // Reload iframe
    setStatus('Avatar-Stream zurückgesetzt', 'info');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    const textInput = document.getElementById('textInput');
    
    // Enter-Taste für Senden
    textInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Health Check beim Laden
    checkSystemHealth();
    setStatus('Bereit • Perfekte Audio+LiveLink Synchronisation aktiv', 'ready');
});

// System Health Check
async function checkSystemHealth() {
    try {
        const response = await fetch('/health');
        if (response.ok) {
            const health = await response.json();
            if (health.neurosync_server === 'offline') {
                setStatus('⚠️ NeuroSync Server offline', 'error');
            }
        }
    } catch (error) {
        console.error('Health Check Fehler:', error);
    }
}

// Auto-Health Check alle 30 Sekunden
setInterval(checkSystemHealth, 30000);

console.log('🎉 NeuroSync Avatar Chat mit perfekter Audio+LiveLink Synchronisation geladen!');