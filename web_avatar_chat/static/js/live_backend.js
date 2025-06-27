class LiveBackendManager {
    constructor() {
        this.ws = null;
        this.reconnectDelay = 2000;
        this.currentConfig = {};
        this.isConnected = false;
        this.connect();
    }

    connect() {
        try {
            console.log('🔗 Verbinde zu Live Backend...');
            this.ws = new WebSocket('wss://backend.aura42.de/ws');

            this.ws.onopen = () => {
                console.log('✅ Live Backend verbunden!');
                this.isConnected = true;
                this.updateConnectionStatus('🟢 Live-Backend aktiv');
                this.sendPing();
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };

            this.ws.onclose = () => {
                console.log('❌ Live Backend getrennt');
                this.isConnected = false;
                this.updateConnectionStatus('🔴 Backend getrennt - Reconnecting...');
                setTimeout(() => this.connect(), this.reconnectDelay);
            };

            this.ws.onerror = (error) => {
                console.error('🚨 WebSocket Fehler:', error);
                this.updateConnectionStatus('🔴 Backend-Verbindungsfehler');
            };

        } catch (error) {
            console.error('🚨 WebSocket Connection Fehler:', error);
            setTimeout(() => this.connect(), this.reconnectDelay);
        }
    }

    handleMessage(message) {
        console.log('📨 Backend Message:', message.type);

        switch (message.type) {
            case 'initial_config':
                this.currentConfig = message.data;
                this.applyConfigToAvatar(message.data);
                this.showLiveNotification('✅ Backend-Konfiguration geladen!');
                break;

            case 'config_updated':
                this.currentConfig = message.data;
                this.applyConfigToAvatar(message.data);
                this.showLiveNotification('🔥 Avatar live aktualisiert!');
                break;
        }
    }

    applyConfigToAvatar(config) {
        console.log('🎭 Avatar Konfiguration live anwenden:', config);

        // ChatGPT Parameter SOFORT aktualisieren
        if (config.chat_parameter) {
            // Frontend-API aufrufen um Live-Config zu setzen
            fetch('/api/update_config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            }).then(response => {
                if (response.ok) {
                    console.log('🤖 ChatGPT Parameter live aktualisiert');
                }
            });
        }

        // Animation-Trigger aktualisieren
        if (config.animation_triggers) {
            window.ANIMATION_TRIGGERS = config.animation_triggers;
            console.log('⚡ Animation-Trigger aktualisiert:', config.animation_triggers);
        }
    }

    updateConnectionStatus(status) {
        const statusElements = document.querySelectorAll('.backend-status');
        statusElements.forEach(el => {
            el.textContent = status;
        });
    }

    showLiveNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg z-50';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    sendPing() {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'ping',
                timestamp: new Date().toISOString()
            }));
        }
        setTimeout(() => this.sendPing(), 30000);
    }
}

// Global initialisieren
console.log('🚀 Live Backend Manager wird gestartet...');
window.liveBackend = new LiveBackendManager();