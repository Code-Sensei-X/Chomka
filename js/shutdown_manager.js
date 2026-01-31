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
        this.updateStatus('Step 1: Preparing shutdown sequence...', '⏳', 10);

        if (window.chomkaSafe && window.chomkaSafe.log) {
            window.chomkaSafe.log('[Shutdown] Initiating sequence (triggerQuit=' + triggerQuit + ')');
        } else {
            console.log('[Shutdown-Local] [INFO] Initiating sequence (triggerQuit=' + triggerQuit + ')');
        }

        // 1.5 Emergency Timeout: If shutdown hangs for > 15 seconds, force it.
        const fallback = setTimeout(() => {
            console.warn('[Shutdown] Emergency timeout reached. Forcing exit...');
            this.updateStatus('Emergency exit triggered (Save took too long)', '⚠️');
            window.chomka.log('[Shutdown] Emergency timeout triggered', 'WARNING');
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
            this.updateStatus('Step 2: Collecting desktop items...', '📦', 30);

            let items = [];
            if (window.desktopManager) {
                items = window.desktopManager.getItems();
                window.chomkaSafe.log(`[Shutdown] Collected ${items.length} items`);
            } else {
                window.chomka.log('[Shutdown] Warning: DesktopManager not found, skipping item collection', 'WARNING');
            }

            // 3. Local Cache (only if items available or to clear it)
            this.updateStatus('Step 3: Updating local cache...', '🖊️', 50);
            localStorage.setItem('chomka_desktop', JSON.stringify(items));

            // 4. Native Disk Write
            if (window.chomka && window.chomka.saveState) {
                this.updateStatus('Step 4: Writing to config.json...', '💾', 70);
                const result = await window.chomka.saveState('desktop_items', items);
                if (result && result.success) {
                    this.updateStatus('Step 5: Disk write complete!', '✅', 90);
                } else {
                    throw new Error(result ? result.error : 'Unknown Disk Error');
                }
            }

            clearTimeout(fallback);
            clearTimeout(lagTimer);
        } catch (e) {
            clearTimeout(fallback);
            clearTimeout(lagTimer);
            console.error('[Shutdown] Critical failure:', e);
            this.updateStatus('Error: ' + e.message, '❌');
            window.chomkaSafe.log('[Shutdown] Critical failure: ' + e.message, 'ERROR');

            // Give user 2 seconds to read the error before exiting anyway
            await new Promise(r => setTimeout(r, 2000));
        }

        // 5. Final Exit - ALWAYS quit if we attempted to start
        this.updateStatus('Finalizing exit...', '🚀', 100);
        if (triggerQuit && window.pywebview && window.pywebview.api) {
            window.pywebview.api.quit_finally();
        } else if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.quit();
        }
    },

    updateStatus(text, icon = '', progress = null) {
        console.log(`[Shutdown Status] ${text}`);
        const statusEl = document.getElementById('shutdown-status-text');
        const iconEl = document.getElementById('shutdown-status-icon');
        const progressEl = document.getElementById('shutdown-progress-bar');

        if (statusEl) statusEl.textContent = text;
        if (iconEl) iconEl.textContent = icon;
        if (progressEl && progress !== null) {
            progressEl.style.width = `${progress}%`;
        }
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
                    <div id="shutdown-status-text" style="font-size: 1.2rem; margin-bottom: 1.5rem;">Shutting down safely...</div>
                    <div class="shutdown-progress-container">
                        <div id="shutdown-progress-bar" class="shutdown-progress-bar"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
    }
};

window.ShutdownManager = ShutdownManager;
