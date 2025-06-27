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
        }
    }

    detectEmotion(text) {
        const textLower = text.toLowerCase();

        for (const [emotion, animationFile] of Object.entries(this.emotionTriggers)) {
            if (textLower.includes(emotion)) {
                console.log(`🎭 Emotion erkannt: "${emotion}" in "${text}"`);
                console.log(`📁 Animation-Datei: ${animationFile}`);

                // Emotion gefunden
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

    async triggerEmotionAnimation(emotion, animationFile) {
        try {
            console.log(`🎬 Triggere Animation: ${emotion} → ${animationFile}`);

            // API-Call zum Abspielen der spezifischen Animation
            const response = await fetch('/api/trigger_emotion_animation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    emotion: emotion,
                    animationFile: animationFile
                })
            });

            if (response.ok) {
                this.showEmotionNotification(`🎭 ${emotion.charAt(0).toUpperCase() + emotion.slice(1)}-Animation abgespielt`);
            }

        } catch (error) {
            console.error('❌ Fehler beim Triggern der Animation:', error);
        }
    }

    showEmotionNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-16 right-4 bg-purple-500 text-white px-4 py-2 rounded-lg z-50';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Global initialisieren
window.emotionDetector = new EmotionDetector();

// Chat-Integration
window.addEventListener('beforeChatSend', (event) => {
    const userText = event.detail.text;
    const emotionResult = window.emotionDetector.detectEmotion(userText);

    if (emotionResult.detected) {
        console.log(`🎯 Emotion vor Chat-Send erkannt: ${emotionResult.emotion}`);

        // Animation parallel zum Chat-Response triggern
        setTimeout(() => {
            window.emotionDetector.triggerEmotionAnimation(
                emotionResult.emotion,
                emotionResult.animationFile
            );
        }, 1000); // Nach ChatGPT-Response
    }
});