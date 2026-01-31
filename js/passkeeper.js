/**
 * Passkeeper - Simple Password Manager for Chomka WebOS
 * Saves credentials to credentials.json via Native Bridge
 */
class Passkeeper {
    constructor() {
        this.credentials = [];
        this.isOpen = false;
        this.init();
    }

    async init() {
        // Load credentials on startup
        const data = await window.chomka.readFile('credentials.json');
        if (data) {
            try {
                this.credentials = JSON.parse(data);
            } catch (e) {
                console.error("Passkeeper: Corrupt data", e);
            }
        }
    }

    save() {
        window.chomka.saveFile('credentials.json', JSON.stringify(this.credentials, null, 2));
    }

    open() {
        this.isOpen = true;
        this.renderModal();
    }

    addEntry(service, username, password) {
        this.credentials.push({
            id: Date.now(),
            service,
            username,
            password, // In a real app, encrypt this!
            timestamp: new Date().toISOString()
        });
        this.save();
        this.renderModal();
        if (window.notificationManager) {
            window.notificationManager.notify("Passkeeper", "Credentials saved!", "🔑");
        }
    }

    deleteEntry(id) {
        this.credentials = this.credentials.filter(c => c.id !== id);
        this.save();
        this.renderModal();
    }

    renderModal() {
        const listHtml = this.credentials.map(c => `
            <div class="pk-entry" style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:bold; color:var(--accent-color);">${c.service}</div>
                    <div style="font-size:0.8rem; opacity:0.8;">${c.username}</div>
                    <div style="font-size:0.8rem; font-family:monospace; margin-top:2px;">${'•'.repeat(8)} 
                        <span style="font-size:0.7rem; cursor:pointer; color:var(--accent-color); margin-left:5px;" onclick="navigator.clipboard.writeText('${c.password}'); alert('Copied!');">Copy</span>
                    </div>
                </div>
                <button onclick="window.passkeeper.deleteEntry(${c.id})" style="background:transparent; border:none; color:#ff4757; cursor:pointer;">🗑️</button>
            </div>
        `).join('') || '<div style="opacity:0.5; text-align:center; padding:20px;">No saved passwords.</div>';

        const html = `
            <div class="pk-container" style="color:white; font-family:'Inter', sans-serif;">
                <div class="pk-add-form" style="background:rgba(0,0,0,0.3); padding:15px; border-radius:10px; margin-bottom:20px; border:1px solid var(--glass-border);">
                    <h4 style="margin-top:0; margin-bottom:10px; color:var(--accent-color);">Add New Login</h4>
                    <input type="text" id="pk-service" placeholder="Service (e.g. Discord, Chrome)" style="width:100%; margin-bottom:8px; padding:8px; background:rgba(255,255,255,0.1); border:none; color:white; border-radius:4px;">
                    <input type="text" id="pk-username" placeholder="Username / Email" style="width:100%; margin-bottom:8px; padding:8px; background:rgba(255,255,255,0.1); border:none; color:white; border-radius:4px;">
                    <input type="password" id="pk-password" placeholder="Password" style="width:100%; margin-bottom:10px; padding:8px; background:rgba(255,255,255,0.1); border:none; color:white; border-radius:4px;">
                    <button id="pk-save-btn" class="theme-btn active" style="width:100%;">Save Credentials</button>
                </div>
                
                <h4 style="border-bottom:1px solid var(--glass-border); padding-bottom:5px; margin-bottom:10px;">Saved Logins</h4>
                <div class="pk-list" style="max-height:300px; overflow-y:auto;">
                    ${listHtml}
                </div>
            </div>
        `;

        if (window.showModal) {
            window.showModal('Passkeeper Vault', html);

            // Re-bind save button since innerHTML replaces elements
            setTimeout(() => {
                const btn = document.getElementById('pk-save-btn');
                if (btn) btn.onclick = () => {
                    const s = document.getElementById('pk-service').value;
                    const u = document.getElementById('pk-username').value;
                    const p = document.getElementById('pk-password').value;
                    if (s && u && p) {
                        this.addEntry(s, u, p);
                    } else {
                        alert("Please fill all fields.");
                    }
                };
            }, 100);
        }
    }
}

// Initialized via script.js initSteps
// window.passkeeper = new Passkeeper();
