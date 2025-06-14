// JavaScript source code
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

// Text-to-Avatar function with Audio
async function sendMessage() {
    const textInput = document.getElementById('textInput');
    const text = textInput.value.trim();

    if (!text) return;

    addMessage('user', text);
    textInput.value = '';
    setStatus('Processing with ElevenLabs + NeuroSync...', 'processing');

    try {
        // 1. Text an NeuroSync senden (für Blendshapes)
        const neuroResponse = await fetch('/api/synthesize_and_blendshapes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        if (neuroResponse.ok) {
            // 2. Audio separat holen und abspielen
            const audioResponse = await fetch('/api/get_audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });

            if (audioResponse.ok) {
                // Audio-Blob erstellen und abspielen
                const audioBlob = await audioResponse.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                // Audio abspielen
                audio.play().then(() => {
                    console.log('🎵 Audio playing successfully');
                }).catch(error => {
                    console.error('Audio playback error:', error);
                    addMessage('system', '⚠️ Audio playback failed. Check browser permissions.');
                });

                addMessage('avatar', `🔊 Speaking: "${text}"`);
                setStatus('🎵 Avatar speaking...', 'success');

                // Status nach Audio-Ende zurücksetzen
                audio.onended = () => {
                    setStatus('Ready • ElevenLabs + NeuroSync System Connected', '');
                };

                // Memory cleanup
                setTimeout(() => URL.revokeObjectURL(audioUrl), 10000);
            } else {
                throw new Error('Audio generation failed');
            }
        } else {
            throw new Error('NeuroSync processing failed');
        }
    } catch (error) {
        console.error('Error:', error);
        setStatus('Error: ' + error.message, 'error');
        addMessage('system', '❌ Error: ' + error.message);
    }
}

// Voice recording
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
            micButton.textContent = '⏹️ Stop';
            micButton.classList.add('recording');
            setStatus('Recording...', 'processing');

        } catch (error) {
            console.error('Microphone error:', error);
            alert('Microphone access denied. Please allow microphone access and try again.');
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;
        micButton.textContent = '🎤 Record';
        micButton.classList.remove('recording');
        setStatus('Processing speech...', 'processing');
    }
}

// Send audio to server
async function sendAudio(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob);

        // First transcribe with Whisper
        const transcribeResponse = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });

        if (transcribeResponse.ok) {
            const transcription = await transcribeResponse.json();
            const text = transcription.transcription;

            if (text && text.trim()) {
                // Add transcribed text to chat and process
                addMessage('user', `🎤 ${text}`);

                // Send to NeuroSync with audio playback
                await sendMessageWithText(text);
            } else {
                setStatus('No speech detected. Try again.', 'error');
            }
        } else {
            throw new Error('Speech recognition failed');
        }
    } catch (error) {
        console.error('Audio processing error:', error);
        setStatus('Error processing audio: ' + error.message, 'error');
        addMessage('system', '❌ Audio processing error: ' + error.message);
    }
}

// Helper function for audio processing
async function sendMessageWithText(text) {
    setStatus('Processing with ElevenLabs + NeuroSync...', 'processing');

    try {
        // Send to NeuroSync
        const neuroResponse = await fetch('/api/synthesize_and_blendshapes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        if (neuroResponse.ok) {
            // Get and play audio
            const audioResponse = await fetch('/api/get_audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });

            if (audioResponse.ok) {
                const audioBlob = await audioResponse.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                audio.play().then(() => {
                    console.log('🎵 Audio playing successfully');
                }).catch(error => {
                    console.error('Audio playback error:', error);
                });

                addMessage('avatar', `🔊 Speaking: "${text}"`);
                setStatus('🎵 Avatar speaking...', 'success');

                audio.onended = () => {
                    setStatus('Ready • ElevenLabs + NeuroSync System Connected', '');
                };

                setTimeout(() => URL.revokeObjectURL(audioUrl), 10000);
            } else {
                throw new Error('Audio generation failed');
            }
        } else {
            throw new Error('NeuroSync processing failed');
        }
    } catch (error) {
        console.error('Error:', error);
        setStatus('Error: ' + error.message, 'error');
        addMessage('system', '❌ Error: ' + error.message);
    }
}

// Add message to chat
function addMessage(sender, text) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    const timestamp = new Date().toLocaleTimeString();
    const senderName = sender === 'user' ? 'You' : sender === 'avatar' ? 'Avatar' : 'System';

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

// Clear chat
function clearChat() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = `
        <div class="message avatar-message">
            <strong>Avatar</strong>
            Chat cleared! Ready for a new conversation.
            <small>System reset</small>
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
    console.log('🚀 NeuroSync Avatar Chat Interface loaded');

    // Check server health
    fetch('/health')
        .then(response => response.json())
        .then(data => {
            if (data.neurosync_server === 'online') {
                setStatus('Ready • ElevenLabs + NeuroSync System Connected', 'success');
            } else {
                setStatus('Warning: NeuroSync server offline', 'error');
            }
        })
        .catch(() => {
            setStatus('Warning: Cannot connect to backend', 'error');
        });
});