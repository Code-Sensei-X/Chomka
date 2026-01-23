/**
 * ShutdownManager - Isolates the logic for closing the application safely.
 */
const ShutdownManager = {
    isProcessing: false,

    /**
     * Entry point for shutting down the application.
     * @param {boolean} triggerQuit - If true, calls the backend to destroy the window after save.
     */
    async start(triggerQuit = false) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        this.showOverlay();
        this.updateStatus('Step 1: Preparing shutdown sequence...', '⏳');

        window.chomka.logError('INFO', '[Shutdown] Initiating sequence (triggerQuit=' + triggerQuit + ')');

        // 1.5 Emergency Timeout: If shutdown hangs for > 15 seconds, force it.
        const fallback = setTimeout(() => {
            console.warn('[Shutdown] Emergency timeout reached. Forcing exit...');
            this.updateStatus('Emergency exit triggered (Save took too long)', '⚠️');
            window.chomka.logError('WARNING', '[Shutdown] Emergency timeout triggered');
            setTimeout(() => {
                if (triggerQuit && window.pywebview && window.pywebview.api) {
                    window.pywebview.api.quit_finally();
                } else if (window.pywebview && window.pywebview.api) {
                    window.pywebview.api.quit();
                }
            }, 1000);
        }, 15000);

        // Lag Detection timer
        let lagTimer = setTimeout(() => {
            this.updateStatus('Still saving configuration... This might take a moment if items are large.', '🕒');
        }, 3000);

        try {
            // 2. Collection
            this.updateStatus('Step 2: Collecting desktop items...', '📦');
            const items = window.desktopManager ? window.desktopManager.getItems() : [];
            const data = JSON.stringify(items, null, 2);

            // 3. Local Cache
            this.updateStatus('Step 3: Updating local cache...', '🖊️');
            localStorage.setItem('chomka_desktop', data);

            // 4. Native Disk Write
            if (window.chomka && window.chomka.saveFile) {
                this.updateStatus('Step 4: Writing to disk (desktop.json)...', '💾');
                const result = await window.chomka.saveFile('desktop.json', data, true);
                if (result && result.success) {
                    this.updateStatus('Step 5: Disk write complete!', '✅');
                } else {
                    throw new Error(result ? result.error : 'Unknown Disk Error');
                }
                clearTimeout(fallback);
                clearTimeout(lagTimer);
            }
        } catch (e) {
            clearTimeout(fallback);
            clearTimeout(lagTimer);
            console.error('[Shutdown] Critical failure:', e);
            this.updateStatus('Error: ' + e.message, '❌');
            window.chomka.logError('ERROR', '[Shutdown] Critical failure: ' + e.message);

            // Give user 3 seconds to read the error before exiting anyway (if triggerQuit is true)
            if (triggerQuit) {
                await new Promise(r => setTimeout(r, 3000));
            }
        }

        // 5. Final Exit
        if (triggerQuit) {
            this.updateStatus('Finalizing exit...', '🚀');
            if (window.pywebview && window.pywebview.api) {
                window.pywebview.api.quit_finally();
            }
        } else {
            if (window.pywebview && window.pywebview.api) {
                window.pywebview.api.quit();
            }
        }
    },

    updateStatus(text, icon = '') {
        console.log(`[Shutdown Status] ${text}`);
        const statusEl = document.getElementById('shutdown-status-text');
        const iconEl = document.getElementById('shutdown-status-icon');
        if (statusEl) statusEl.textContent = text;
        if (iconEl) iconEl.textContent = icon;
    },

    showOverlay() {
        let overlay = document.getElementById('shutdown-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'shutdown-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85); z-index: 99999;
                display: flex; align-items: center; justify-content: center;
                color: white; font-family: 'Inter', sans-serif;
                pointer-events: all;
                backdrop-filter: blur(5px);
            `;
            overlay.innerHTML = `
                <div style="text-align: center; background: rgba(255,255,255,0.1); padding: 2rem; border-radius: 15px; border: 1px solid rgba(255,255,255,0.2); width: 350px;">
                    <div id="shutdown-status-icon" style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
                    <div id="shutdown-status-text" style="font-size: 1.2rem; margin-bottom: 0.5rem;">Shutting down safely...</div>
                    <div style="font-size: 0.8rem; color: rgba(255,255,255,0.6);">Please do not close this window.</div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
    }
};

window.ShutdownManager = ShutdownManager;
