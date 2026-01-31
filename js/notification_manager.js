class NotificationManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.isActive = true;
        this.mockUsers = [
            { name: "Lofi Girl", avatar: "🎧" },
            { name: "SynthWave Fan", avatar: "🕶️" },
            { name: "Code Master", avatar: "🖥️" },
            { name: "Pixel Art Enthusiast", avatar: "🎨" },
            { name: "Chomka Lover", avatar: "🐹" },
            { name: "Chill Bot", avatar: "🤖" },
            { name: "Sakura Dreamer", avatar: "🌸" }
        ];
        this.mockComments = [
            "This beat is literally saving my project right now.",
            "Who's listening to this in 2026? 🔥",
            "Chomka WebOS actually looks insane.",
            "Can we get a dark mode version of this wallpaper?",
            "Subscribed! Love the vibes.",
            "This is so relaxing, perfect for coding.",
            "Does anyone know the track at 5:20?",
            "Wait, how is this running in a browser?",
            "Greetings from the future! Chomka is the best OS.",
            "Loving the sakura theme. 🌸",
            "I need a tutorial on how to set this up.",
            "Found this from a random recommendation, not disappointed."
        ];

        this.simulationInterval = null;
        this.startSimulation();
    }

    notify(title, message, avatar = "🔔", meta = "") {
        if (!this.isActive || !this.container) return;

        const toast = document.createElement('div');
        toast.className = 'notification-toast';

        toast.innerHTML = `
            <div class="notif-avatar">${avatar}</div>
            <div class="notif-body">
                <div class="notif-header">${title}</div>
                <div class="notif-text">${message}</div>
                ${meta ? `<div class="notif-meta">${meta}</div>` : ''}
            </div>
        `;

        toast.addEventListener('click', () => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        });

        // Auto-remove
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('fade-out');
                setTimeout(() => toast.remove(), 300);
            }
        }, 8000);

        this.container.appendChild(toast);

        // Native Windows Notification Trigger
        if (window.chomka && window.chomka.show_notification) {
            window.chomka.show_notification(title, message);
        }
    }

    startSimulation() {
        if (this.simulationInterval) return;

        this.simulationInterval = setInterval(() => {
            if (!this.isActive) return;

            // Only simulate if there are videos playing or on desktop
            const videos = (window.desktopManager && window.desktopManager.items || []).filter(i => i.type === 'video');
            if (videos.length === 0) return;

            // Random chance to show a notification (e.g., 20% every 15 seconds)
            if (Math.random() > 0.3) return;

            const user = this.mockUsers[Math.floor(Math.random() * this.mockUsers.length)];
            const comment = this.mockComments[Math.floor(Math.random() * this.mockComments.length)];

            this.notify(
                `${user.name} commented:`,
                comment,
                user.avatar,
                "Just now • YouTube"
            );
        }, 15000); // Check every 15s
    }

    toggle() {
        this.isActive = !this.isActive;
        if (!this.isActive) {
            // Clear existing notifications
            if (this.container) this.container.innerHTML = '';
        }
        return this.isActive;
    }
}

window.NotificationManager = NotificationManager;
