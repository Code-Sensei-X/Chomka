class KeyboardManager {
    constructor() {
        this.isAltTabActive = false;
        this.altTabItems = [];
        this.altTabIdx = 0;
        this.switcherEl = null;

        this.initListeners();
    }

    initListeners() {
        document.addEventListener('keydown', (e) => {
            // Command Palette: Ctrl+K
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                this.showCommandPalette();
            }

            // Alt+Tab Switcher
            if (e.altKey && e.key === 'Tab') {
                e.preventDefault();
                this.handleAltTab();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Alt' && this.isAltTabActive) {
                this.completeAltTab();
            }
        });
    }

    handleAltTab() {
        if (!this.isAltTabActive) {
            this.isAltTabActive = true;
            this.altTabItems = this.getSwitchableItems();
            this.altTabIdx = 0;
            this.showSwitcherUI();
        }

        if (this.altTabItems.length > 0) {
            this.altTabIdx = (this.altTabIdx + 1) % this.altTabItems.length;
            this.updateSwitcherUI();
        }
    }

    getSwitchableItems() {
        // Combiner windows and desktop items
        const windows = Array.from(document.querySelectorAll('.window')).map(el => ({
            id: el.id,
            name: el.querySelector('.window-title').textContent,
            type: 'window',
            el: el
        }));

        const desktopItems = window.desktopManager ? window.desktopManager.items.map(i => ({
            id: i.id,
            name: i.name || i.text || i.type,
            type: 'item',
            el: document.querySelector(`[data-id="${i.id}"]`)
        })) : [];

        return [...windows, ...desktopItems];
    }

    showSwitcherUI() {
        if (this.switcherEl) this.switcherEl.remove();
        this.switcherEl = document.createElement('div');
        this.switcherEl.className = 'alt-tab-switcher';
        this.switcherEl.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(30,30,36,0.9); backdrop-filter: blur(20px);
            border: 1px solid var(--accent-color); border-radius: 16px;
            padding: 20px; z-index: 10000; display: flex; gap: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8);
        `;
        document.body.appendChild(this.switcherEl);
    }

    updateSwitcherUI() {
        if (!this.switcherEl) return;
        this.switcherEl.innerHTML = this.altTabItems.map((item, idx) => `
            <div class="switcher-item" style="
                padding: 15px; border-radius: 12px; border: 2px solid ${idx === this.altTabIdx ? 'var(--accent-color)' : 'transparent'};
                background: ${idx === this.altTabIdx ? 'rgba(255,255,255,0.1)' : 'transparent'};
                display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100px;
            ">
                <div style="font-size: 2rem;">${item.type === 'window' ? '🌐' : '📄'}</div>
                <div style="font-size: 0.7rem; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${item.name}</div>
            </div>
        `).join('');
    }

    completeAltTab() {
        this.isAltTabActive = false;
        const selected = this.altTabItems[this.altTabIdx];
        if (selected) {
            if (selected.type === 'window') {
                selected.el.style.zIndex = window.chomkaZIndex++;
                if (window.chomkaZIndex > 10000) window.chomkaZIndex = 110; // Simple reset to prevent overflow
            } else if (window.desktopManager) {
                window.desktopManager.selectItem(selected.id);
            }
        }
        if (this.switcherEl) {
            this.switcherEl.remove();
            this.switcherEl = null;
        }
    }

    showCommandPalette() {
        const html = `
            <div class="cmd-palette" style="padding: 20px;">
                <input type="text" id="cmd-input" placeholder="Type a command (e.g. /theme dark, /add note)..." 
                    style="width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid var(--accent-color); color: white; border-radius: 8px; outline: none;">
                <div id="cmd-hints" style="margin-top: 15px; font-size: 0.8rem; color: var(--text-secondary);">
                    <div>• <b>/theme [name]</b> - Quick switch style</div>
                    <div>• <b>/yt [url]</b> - Pin video to desktop</div>
                    <div>• <b>/add [type]</b> - Add new folder/note</div>
                </div>
            </div>
        `;
        if (window.showModal) {
            window.showModal('Command Palette', html);
            setTimeout(() => {
                const input = document.getElementById('cmd-input');
                if (input) {
                    input.focus();
                    input.onkeydown = (e) => {
                        if (e.key === 'Enter') {
                            this.executeCommand(input.value);
                            document.getElementById('modal-overlay').classList.add('hidden');
                        }
                    };
                }
            }, 100);
        }
    }

    executeCommand(cmd) {
        const parts = cmd.split(' ');
        const action = parts[0].toLowerCase();
        const arg = parts.slice(1).join(' ');

        if (action === '/theme') {
            const btns = Array.from(document.querySelectorAll('.theme-btn'));
            const match = btns.find(b => b.dataset.theme === arg);
            if (match) match.click();
        } else if (action === '/yt') {
            if (window.desktopManager) {
                window.desktopManager.addItem({ id: `yt-${Date.now()}`, type: 'video', src: arg });
            }
        } else if (action === '/add') {
            const opt = document.querySelector(`.add-option[data-type="${arg}"]`);
            if (opt) opt.click();
        }

        if (window.notificationManager) {
            window.notificationManager.notify("System", `Executed: ${cmd}`, "⌨️");
        }
    }
}

window.KeyboardManager = KeyboardManager;
