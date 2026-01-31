// --- Chomka Main Script ---

document.addEventListener('DOMContentLoaded', () => {
    console.log('Chomka WebOS: Beginning Initialization (v1.14b)...');

    const initSteps = [
        { name: 'Start Menu', fn: initStartMenu },
        { name: 'Clock', fn: initClock },
        { name: 'Toolbelt', fn: initToolbelt },
        { name: 'Native Bridge', fn: initNativeBridge },
        { name: 'Settings Tray', fn: initSettingsTray },
        { name: 'Metrics', fn: initMetrics },
        { name: 'Search', fn: initSearch },
        { name: 'Desktop Manager', fn: () => { window.desktopManager = new DesktopManager('desktop-items-container'); } },
        { name: 'Notification Manager', fn: () => { window.notificationManager = new NotificationManager('notification-container'); } },
        { name: 'Tab Manager', fn: initTabManager },
        { name: 'Add Panel', fn: initAddPanel },
        { name: 'Move Mode', fn: initMoveMode },
        { name: 'Recording Manager', fn: () => { window.recordingManager = new RecordingManager(); } },
        { name: 'Keyboard Manager', fn: () => { window.keyboardManager = new KeyboardManager(); } },
        { name: 'AI Chat Bot', fn: initAIChatBot },
        { name: 'Passkeeper', fn: initPasskeeper },
        { name: 'Left Sidebar', fn: initLeftSidebar },
        { name: 'Uptime Clock', fn: initUptimeClock }
    ];

    const runInit = async () => {
        const splash = document.getElementById('startup-splash');
        const bar = document.getElementById('startup-progress-bar');
        const status = document.getElementById('splash-status');

        let progress = 0;
        const totalSteps = initSteps.length;

        // EMERGENCY SPLASH HIDE
        const emergencySplashTimeout = setTimeout(() => {
            if (splash && splash.parentNode) {
                console.warn('[BOOT] Emergency splash removal triggered after 15s');
                splash.classList.add('fade-out');
                setTimeout(() => splash.remove(), 1000);
            }
        }, 15000);

        for (const step of initSteps) {
            try {
                console.log(`[INIT] Running ${step.name}...`);
                if (status) status.textContent = `Loading ${step.name}...`;

                const stepPromise = (async () => {
                    return step.fn();
                })();

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout after 5s')), 5000)
                );

                await Promise.race([stepPromise, timeoutPromise]);

                progress++;
                if (bar) bar.style.width = `${(progress / totalSteps) * 100}%`;
            } catch (e) {
                console.error(`[CRITICAL] Failed to initialize ${step.name}:`, e);
                if (window.chomkaSafe && window.chomkaSafe.log) {
                    window.chomkaSafe.log(`[INIT_ERROR] ${step.name} failed/timed out: ${e.message}`, 'WARNING');
                }
            }
        }

        clearTimeout(emergencySplashTimeout);

        // Test Mode Check
        try {
            const isTestMode = await window.chomka.getState('is_test_mode');
            if (isTestMode && isTestMode.value) {
                const badge = document.createElement('div');
                badge.id = 'test-mode-badge';
                badge.innerHTML = 'TEST MODE';
                badge.style.cssText = 'position:fixed; bottom:50px; right:20px; background:rgba(255,165,0,0.8); color:black; padding:4px 10px; border-radius:15px; font-weight:bold; font-size:0.7rem; z-index:9999; pointer-events:none; border:1px solid orange;';
                document.body.appendChild(badge);
            }
        } catch (e) { console.warn("Test mode check failed", e); }

        // Initialize Base URL for assets
        try {
            const url = await window.chomka.getDataUrl();
            if (window.desktopManager) window.desktopManager.setBaseUrl(url);
        } catch (e) { console.warn("Base URL initialization failed", e); }

        console.log('Chomka WebOS: Initialization Sequence Complete.');

        if (splash) {
            splash.classList.add('fade-out');
            setTimeout(() => splash.remove(), 1000);
        }
    };

    runInit();
});


// --- Chomka AI Chat Bot ---
function initAIChatBot() {
    const btn = document.getElementById('btn-ai-bot');
    if (btn) {
        btn.onclick = () => {
            const html = `
                <div class="ai-chat-container">
                    <div class="ai-messages" id="ai-chat-messages">
                        <div class="ai-msg bot">Hello! I am Chomka AI. How can I assist you today? Try saying "fix bug" or "help me".</div>
                    </div>
                    <div class="ai-input-area">
                        <input type="text" id="ai-chat-input" placeholder="Type a message...">
                        <button class="ai-btn-send" id="ai-chat-send">➤</button>
                    </div>
                    <button class="antigravity-integration-btn" id="ai-antigravity-btn">
                        <span>🌌</span> Send Context to Antigravity
                    </button>
                </div>
            `;
            window.showModal('Chomka AI Assistant', html);

            // Chat logic
            const input = document.getElementById('ai-chat-input');
            const sendBtn = document.getElementById('ai-chat-send');
            const messages = document.getElementById('ai-chat-messages');
            const agBtn = document.getElementById('ai-antigravity-btn');

            const sendMessage = () => {
                const text = input.value.trim();
                if (!text) return;

                // User message
                const userMsg = document.createElement('div');
                userMsg.className = 'ai-msg user';
                userMsg.textContent = text;
                messages.appendChild(userMsg);
                input.value = '';

                // Bot Response logic
                setTimeout(() => {
                    const botMsg = document.createElement('div');
                    botMsg.className = 'ai-msg bot';

                    if (text.toLowerCase().includes('fix bug')) {
                        botMsg.textContent = "I've detected your request to fix a bug. I can prepare a technical report for the Antigravity Agent. Click the 'Send Context' button below to capture logs and code.";
                    } else if (text.toLowerCase().includes('code')) {
                        botMsg.textContent = "I can help with code snippets! Just paste what you're working on, or ask me for a template.";
                    } else {
                        botMsg.textContent = "I'm here to help! You can ask me about system status, themes, or use the Antigravity integration for advanced fixes.";
                    }

                    messages.appendChild(botMsg);
                    messages.scrollTop = messages.scrollHeight;
                }, 800);
            };

            sendBtn.onclick = sendMessage;
            input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };

            agBtn.onclick = async () => {
                agBtn.innerHTML = '<span>⏳</span> Capturing...';

                // Context Gathering
                const logs = await window.chomka.readFile('shared_data/chomka.log') || "No logs found.";
                const activeWindows = Array.from(document.querySelectorAll('.window')).map(w => w.querySelector('.window-title').textContent);
                const itemsCount = window.desktopManager ? window.desktopManager.items.length : 0;

                const contextReport = `
CHOMKA AI: ANTIGRAVITY CONTEXT REPORT
-------------------------------------
Desktop Items: ${itemsCount}
Active Windows: ${activeWindows.join(', ') || 'None'}
Resolution: ${window.innerWidth}x${window.innerHeight}
Theme: ${document.body.className || 'default'}
Logs Summary: ${logs.substring(0, 200)}...
-------------------------------------
USER REQUEST: Please fix the current rendering issues.
                `;

                setTimeout(() => {
                    agBtn.innerHTML = '<span>✅</span> Sent to Antigravity!';
                    const botMsg = document.createElement('div');
                    botMsg.className = 'ai-msg bot';
                    botMsg.style.fontStyle = 'italic';
                    botMsg.innerHTML = `<strong>Antigravity Link Established:</strong> I've packaged your system state and sent it to the Antigravity Agent. You can now describe the bug in your next message to me!`;
                    messages.appendChild(botMsg);
                    messages.scrollTop = messages.scrollHeight;

                    window.chomka.log("ANTIGRAVITY_INTEGRATION_TRIGGERED: " + contextReport);
                }, 1500);
            };
        };
    }
}

// --- Global Helpers ---
window.showModal = function (title, htmlContent) {
    const modal = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeBtn = document.getElementById('modal-close');

    if (modal && modalTitle && modalBody) {
        modalTitle.textContent = title;
        modalBody.innerHTML = htmlContent;
        modal.classList.remove('hidden');

        closeBtn.onclick = () => modal.classList.add('hidden');
        window.onclick = (event) => {
            if (event.target === modal) modal.classList.add('hidden');
        };
    }
};

window.summarizeCurrentPage = async (url) => {
    if (window.notificationManager) {
        window.notificationManager.notify("Chomka AI", "Summarizing page... (Simulated AI)", "🐹");
    }
    setTimeout(() => {
        const summary = `Summary of ${url}: This page contains interesting content regarding its topic. Chomka recommends reading more!`;
        window.showModal('AI Summary', `<p>${summary}</p>`);
    }, 1500);
};

window.createStickyFromSelection = () => {
    const selection = window.getSelection().toString();
    if (selection && window.desktopManager) {
        window.desktopManager.addItem({
            id: `note-ai-${Date.now()}`,
            type: 'note',
            text: selection
        });
        if (window.notificationManager) {
            window.notificationManager.notify("Chomka AI", "Created a sticky note from your selection!", "✍️");
        }
    } else {
        alert("Please highlight some text first!");
    }
};

const YT_PROXIES = [
    'https://piped.video/embed',
    'https://yewtu.be/embed',
    'https://vid.puffyan.us/embed',
    'https://invidious.projectsegfau.lt/embed',
    'https://invidious.tiekoetter.com/embed'
];
let proxyIndex = 0;

window.repairYT = function (itemId, specificProxyIndex = -1) {
    if (!window.desktopManager) return;
    const item = window.desktopManager.items.find(i => i.id === itemId);
    if (!item) return;

    // Use specific index if provided, otherwise use global one
    const pIndex = specificProxyIndex >= 0 ? specificProxyIndex : proxyIndex;
    const proxyUrl = YT_PROXIES[pIndex % YT_PROXIES.length];

    if (window.notificationManager) {
        window.notificationManager.notify("Repairing", `Redirecting via ${new URL(proxyUrl).hostname}...`, "🔧");
    }

    const el = document.querySelector(`[data-id="${itemId}"]`);
    if (el) {
        const playerContainer = el.querySelector(`#yt-player-${itemId}`);
        if (playerContainer) {
            let videoId = '';
            const url = item.src;
            try {
                if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
                else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
                else if (url.includes('/embed/')) videoId = url.split('/embed/')[1].split('?')[0];
                else if (url && url.length === 11) videoId = url;
            } catch (e) { }

            if (videoId) {
                item.isRepaired = true; // Mark as repaired to prevent loop
                // Clear container and replace with proxy iframe
                playerContainer.innerHTML = '';
                const iframe = document.createElement('iframe');
                iframe.src = `${proxyUrl}/${videoId}?autoplay=1`;
                iframe.style.cssText = "width:100%; height:100%; border:none; pointer-events:auto; border-radius:8px;";
                iframe.allowFullscreen = true;
                iframe.referrerPolicy = "strict-origin-when-cross-origin";
                playerContainer.appendChild(iframe);

                // Proxy Switcher Mini Button (Always visible on hover)
                let controls = el.querySelector('.yt-repair-controls');
                if (!controls) {
                    controls = document.createElement('div');
                    controls.className = 'yt-repair-controls';
                    controls.style.cssText = "position:absolute; bottom:5px; right:5px; z-index:100; opacity:0; transition:opacity 0.2s; display:flex; gap:5px;";
                    el.appendChild(controls);
                    el.onmouseover = () => controls.style.opacity = 1;
                    el.onmouseout = () => controls.style.opacity = 0;
                }

                controls.innerHTML = `
                    <button onclick="window.rotateProxy('${itemId}')" title="Next Proxy" 
                        style="background:rgba(0,0,0,0.8); color:white; border:1px solid rgba(255,255,255,0.3); border-radius:4px; padding:4px 8px; font-size:0.8rem; cursor:pointer;">♻️</button>
                    <button onclick="window.chomka.openNativeWindow('${item.src}')" title="Open Externally"
                        style="background:rgba(0,0,0,0.8); color:white; border:1px solid rgba(255,255,255,0.3); border-radius:4px; padding:4px 8px; font-size:0.8rem; cursor:pointer;">🚀</button>
                `;

                const overlay = el.querySelector('.yt-status-overlay');
                if (overlay) overlay.remove();
                window.chomka.log(`[YT_REPAIR] Item ${itemId} using proxy: ${proxyUrl}`);
            }
        }
    }
};

window.rotateProxy = function (itemId) {
    proxyIndex = (proxyIndex + 1) % YT_PROXIES.length;
    window.repairYT(itemId);
};

// --- Left Sidebar & Antigravity ---
function initLeftSidebar() {
    const aiBtn = document.getElementById('btn-ai-bot');
    const agBtn = document.getElementById('btn-antigravity');
    const sgBtn = document.getElementById('btn-suggestions');

    if (agBtn) {
        agBtn.onclick = () => openAntigravityApp();
    }
    if (sgBtn) {
        sgBtn.onclick = () => openFeedbackModal();
    }
}

function openFeedbackModal() {
    const html = `
        <div style="padding:20px; color:white;">
            <h3>📩 Bugs & Suggestions</h3>
            <p style="font-size:0.85rem; opacity:0.7;">Your feedback helps Chomka grow! This will open your mail client.</p>
            
            <label style="display:block; margin-bottom:5px; font-size:0.8rem;">Category:</label>
            <select id="fb-category" style="width:100%; padding:8px; background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); border-radius:6px; color:white; margin-bottom:15px; outline:none;">
                <option value="Bug Report">🐛 Bug Report</option>
                <option value="Feature Suggestion">💡 Feature Suggestion</option>
                <option value="UI/Design">🎨 UI/Design</option>
                <option value="Other">❓ Other</option>
            </select>

            <textarea id="fb-text" placeholder="Tell us more..." style="width:100%; height:100px; background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); border-radius:6px; color:white; padding:10px; margin-bottom:15px; outline:none;"></textarea>
            
            <button id="fb-send-btn" class="theme-btn active" style="width:100%; padding:10px;">Send Feedback</button>
        </div>
    `;
    window.showModal('Bugs & Suggestions', html);

    document.getElementById('fb-send-btn').onclick = () => {
        const cat = document.getElementById('fb-category').value;
        const msg = document.getElementById('fb-text').value;
        if (!msg.trim()) return alert("Please enter a message.");

        const subject = `Chomka V1.14: ${cat}`;
        const body = encodeURIComponent(msg);
        window.location.href = `mailto:crabisoftcompany@gmail.com?subject=${subject}&body=${body}`;

        window.notificationManager.notify("Feedback", "Opening your email app...", "📩");
    };
}

function openAntigravityApp(prefillContext = "") {
    const html = `
        <div style="padding:20px; color:white; font-family:'Inter', sans-serif;">
            <div style="background:rgba(0,210,255,0.1); border:1px solid var(--accent-color); padding:15px; border-radius:10px; margin-bottom:20px;">
                <h3 style="margin-top:0; color:var(--accent-color);">🌌 Antigravity System Bridge</h3>
                <p style="font-size:0.9rem; opacity:0.8;">This tool sends a detailed diagnostic snapshot to the Antigravity AI Agent for deep code-level fixes.</p>
            </div>
            
            <label style="display:block; margin-bottom:8px; font-weight:600; font-size:0.85rem;">System Snapshot Context:</label>
            <textarea id="ag-context" style="width:100%; height:120px; background:rgba(0,0,0,0.3); border:1px solid #444; border-radius:8px; color:#aaa; padding:10px; font-family:monospace; font-size:0.75rem; margin-bottom:20px;" readonly>${prefillContext || "Scanning system state..."}</textarea>
            
            <label style="display:block; margin-bottom:8px; font-weight:600; font-size:0.85rem;">Additional Notes / Code Snippet:</label>
            <textarea id="ag-notes" placeholder="Paste error messages or describe the issue here..." style="width:100%; height:80px; background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); border-radius:8px; color:white; padding:10px; font-family:inherit; margin-bottom:20px; outline:none;"></textarea>
            
            <button id="ag-send-btn" style="width:100%; padding:12px; background:var(--accent-color); color:black; border:none; border-radius:8px; font-weight:700; cursor:pointer; transition:transform 0.2s;">TRANSFERENCE TO AGENT</button>
        </div>
    `;
    window.showModal('Antigravity Bug Reporter', html);

    // Context Generation
    if (!prefillContext) {
        setTimeout(async () => {
            const logs = await window.chomka.readFile('shared_data/chomka.log') || "Logs unavailable.";
            const items = window.desktopManager ? window.desktopManager.items.map(i => i.type).join(', ') : "None";
            const context = `OS: ${window.navigator.platform}\nResolution: ${window.innerWidth}x${window.innerHeight}\nActive Items: [${items}]\nRecent Logs: ${logs.slice(-300)}`;
            const textarea = document.getElementById('ag-context');
            if (textarea) textarea.value = context;
        }, 800);
    }

    const sendBtn = document.getElementById('ag-send-btn');
    sendBtn.onclick = () => {
        const notes = document.getElementById('ag-notes').value;
        const context = document.getElementById('ag-context').value;
        window.chomka.log(`[ANTIGRAVITY_SUBMISSION]\nCONTEXT:\n${context}\n\nUSER_NOTES:\n${notes}`);

        sendBtn.innerHTML = '✅ TRANSMISSION COMPLETE';
        sendBtn.style.background = '#2ecc71';
        sendBtn.disabled = true;

        setTimeout(() => {
            if (window.notificationManager) {
                window.notificationManager.notify("Antigravity", "Snapshot sent to the Agent!", "🌌");
            }
        }, 500);
    };
}

// --- Chomka Native Bridge & Utilities ---
// Bridge logic moved to bridge.js for stability



function toggleYTMode(isActive) {
    const ytBtn = document.getElementById('btn-youtube');
    if (isActive) {
        document.body.classList.add('yt-mode-active');
        if (ytBtn) ytBtn.classList.add('active');
        console.log('Chomka: YouTube Mode Activated');
    } else {
        document.body.classList.remove('yt-mode-active');
        if (ytBtn) ytBtn.classList.remove('active');
        console.log('Chomka: YouTube Mode Deactivated');
    }
}
window.toggleYTMode = toggleYTMode;

function initPasskeeper() {
    window.passkeeper = new Passkeeper();
}

function initNativeBridge() {
    return window.chomka.init();
}

// Global Error Handler for Deep Research
window.onerror = function (message, source, lineno, colno, error) {
    const stack = error ? error.stack : '';
    console.error('Chomka Critical:', message, stack);
    window.chomkaSafe.logError(message, stack);
};

// Native error handlers updated above

function initClock() {
    const clockElement = document.getElementById('clock');
    if (!clockElement) return;

    function updateTime() {
        try {
            const now = new Date();
            // Try fancy formatting, fallback to basic formatting, then ultimate fallback
            let timeStr = "";
            try {
                timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            } catch (inner) {
                timeStr = now.toLocaleTimeString() || now.toString().split(' ')[4].slice(0, 5);
            }
            clockElement.textContent = timeStr;
        } catch (e) {
            console.warn("Clock update failed", e);
        }
    }

    try {
        updateTime();
        setInterval(updateTime, 1000);
    } catch (e) {
        console.error("Failed to start clock interval", e);
    }
}
window.initClock = initClock;

function initToolbelt() {
    // Settings Button (Choose Folder)
    // Settings Button (Choose Folder)
    const settingsBtn = document.querySelector('.tool-icon[title="Settings"]');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', async () => {
            const result = await window.chomka.chooseFolder();
            if (result && result.success) {
                alert(`Data folder changed to:\n${result.path}\n\nNote: Existing data won't move, but new files will be saved here.`);
                // Force a reload to load items from new path
                location.reload();
            }
        });
    }

    // YouTube Button
    const ytBtn = document.getElementById('btn-youtube');
    if (ytBtn) {
        ytBtn.addEventListener('click', async () => {
            const isActive = !document.body.classList.contains('yt-mode-active');
            toggleYTMode(isActive);
            if (isActive) {
                // Try to load last URL
                const lastUrlObj = await window.chomka.getState('last_yt_url');
                const url = (lastUrlObj && lastUrlObj.value) ? lastUrlObj.value : 'https://www.youtube.com';
                window.chomka.openNativeWindow(url);
            }
        });
    }

    // Shuffle Playlist Button
    const shuffleBtn = document.getElementById('btn-shuffle-playlist');
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            const folderName = prompt("Enter Folder Name to use as Playlist:", "Vibes");
            if (folderName && window.desktopManager) {
                window.desktopManager.pinRandomFromPlaylist(folderName);
            }
        });
    }

    // Notifications Toggle Button
    const notifBtn = document.getElementById('btn-notifications');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            if (window.notificationManager) {
                const isActive = window.notificationManager.toggle();
                notifBtn.classList.toggle('active', isActive);
            }
        });
    }

    // Top Music Button
    const topMusicBtn = document.getElementById('btn-top-music');
    if (topMusicBtn) {
        topMusicBtn.addEventListener('click', () => {
            if (window.desktopManager) {
                window.desktopManager.spawnTopMusicFolder();
            }
        });
    }

    const gridBtn = document.querySelector('.tool-icon[title="Tab Grid"]');
    // const tabGrid = document.getElementById('tab-grid'); // Removed

    if (gridBtn) {
        gridBtn.addEventListener('click', () => {
            if (window.desktopManager) {
                window.desktopManager.showLayerManager();
            }
        });

        loadToolbeltPosition();
    }

    // Recording Button
    const recordBtn = document.getElementById('btn-record');
    if (recordBtn) {
        recordBtn.addEventListener('click', async () => {
            if (!window.recordingManager) return;

            if (window.recordingManager.isRecording) {
                window.recordingManager.stop();
                recordBtn.classList.remove('active', 'recording-blink');
            } else {
                const started = await window.recordingManager.start();
                if (started) {
                    recordBtn.classList.add('active', 'recording-blink');
                }
            }
        });
    }

    // Feedback Button
    const feedbackBtn = document.getElementById('btn-feedback');
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', async () => {
            const msg = prompt("Enter message for developers (opens email):");
            if (msg) {
                // Use new send_feedback API
                const result = await window.chomka.sendFeedback(msg);
                if (!result || !result.success) {
                    // Fallback or error
                    console.error("Feedback error", result);
                    alert("Could not open mail client. Please email crabisoftcompany@gmail.com manually.");
                }
            }
        });
    }

    // Passkeeper Button
    const pkBtn = document.getElementById('btn-passkeeper');
    if (pkBtn) {
        pkBtn.addEventListener('click', () => {
            if (window.passkeeper) window.passkeeper.open();
            else alert("Passkeeper module not loaded.");
        });
    }

    // Info Button
    const infoBtn = document.getElementById('btn-info');
    if (infoBtn) {
        infoBtn.addEventListener('click', async () => {
            const content = await window.chomka.readFile('readme.txt');
            if (window.showModal) {
                window.showModal('About Chomka', `<pre style="white-space: pre-wrap;">${content}</pre>`);
            } else {
                alert(content);
            }
        });
    }

    // --- Standard Video Injection (User Request) ---
    // Auto-executes once if needed
    setTimeout(() => {
        if (window.desktopManager) {
            const targetUrl = "https://www.youtube.com/watch?v=jQHok8S4nDY";
            const exists = window.desktopManager.items.find(i => i.src && i.src.includes('jQHok8S4nDY'));

            if (!exists) {
                console.log("Chomka: Spawning requested standard video.");
                window.desktopManager.addItem({
                    id: `yt-std-${Date.now()}`,
                    type: 'video',
                    src: targetUrl,
                    x: (window.innerWidth / 2) - 160,
                    y: 120, // "under search" roughly
                    zIndex: 10
                });
                window.notificationManager.notify("Chomka", "Added Standard Video", "📺");
            }
        }
    }, 2000);

    // Context Menu Handler (Copy Link)
    window.addEventListener('item-context-menu-action', (e) => {
        const { action, id } = e.detail;
        if (action === 'copy-link') {
            const item = window.desktopManager.items.find(i => i.id === id);
            if (item) {
                const text = item.url || item.src || item.text || "";
                if (text) {
                    navigator.clipboard.writeText(text).then(() => {
                        window.notificationManager.notify("Clipboard", "Link copied to clipboard!", "📋");
                    });
                } else {
                    window.notificationManager.notify("Clipboard", "No link to copy!", "⚠️");
                }
            }
        }
    });

    window.showModal = (title, htmlContent) => {
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');

        content.innerHTML = `
                <div class="modal-header">
                    <h2 id="modal-title">${title}</h2>
                    <span id="modal-header-close" style="cursor:pointer; font-size:1.5rem;">&times;</span>
                </div>
                <div id="modal-body">${htmlContent}</div>
                <div class="modal-footer">
                    <button id="modal-close-btn" class="theme-btn active">Close</button>
                </div>
            `;

        overlay.classList.remove('hidden');

        // Re-bind close buttons
        const closeBtn = document.getElementById('modal-header-close');
        const closeBtnFooter = document.getElementById('modal-close-btn');
        const hide = () => overlay.classList.add('hidden');

        closeBtn.onclick = hide;
        closeBtnFooter.onclick = hide;

        // Make Draggable
        const header = content.querySelector('.modal-header');
        makeDraggable(content, header);
    }
}

function initThemes() {
    const btns = document.querySelectorAll('.theme-btn');
    const saved = localStorage.getItem('chomka_theme') || 'default';

    const applyTheme = (theme) => {
        document.body.className = theme === 'default' ? '' : `theme-${theme}`;
        btns.forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
        localStorage.setItem('chomka_theme', theme);
    };
    window.setTheme = applyTheme;

    applyTheme(saved);

    btns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            applyTheme(btn.dataset.theme);
        };
    });

    // Extract Wallpaper Accents
    extractWallpaperAccents();
}

function extractWallpaperAccents() {
    // Simulated extraction for now - will be connected to actual wallpaper later
    // Real logic would use a Canvas to sample the background image.
    const root = document.documentElement;
    const currentTheme = document.body.className;

    if (currentTheme.includes('sakura')) {
        root.style.setProperty('--accent-glow', 'rgba(255, 71, 87, 0.5)');
    } else if (currentTheme.includes('cyberpunk')) {
        root.style.setProperty('--accent-glow', 'rgba(0, 255, 204, 0.7)');
    } else {
        root.style.setProperty('--accent-glow', 'rgba(0, 210, 255, 0.5)');
    }
}

function initMetrics() {
    const cpu = document.getElementById('cpu-load');
    const ram = document.getElementById('ram-load');

    setInterval(() => {
        // CPU based on active players
        let activePlayers = 0;
        if (window.desktopManager && window.desktopManager.players) {
            activePlayers = Object.values(window.desktopManager.players).filter(p => p.getPlayerState && p.getPlayerState() === 1).length;
        }

        const cBase = 5 + (activePlayers * 15);
        const cVal = Math.min(95, cBase + Math.random() * 5);

        // RAM based on total desktop items
        const itemCount = window.desktopManager ? window.desktopManager.items.length : 5;
        const rBase = 20 + (itemCount * 3);
        const rVal = Math.min(95, rBase + Math.random() * 5);

        cpu.style.width = `${cVal}%`;
        ram.style.width = `${rVal}%`;

        // Color feedback
        cpu.style.background = cVal > 80 ? '#ff4757' : (cVal > 50 ? '#ffeb3b' : 'var(--accent-color)');
        ram.style.background = rVal > 80 ? '#ff4757' : (rVal > 50 ? '#ffeb3b' : 'var(--accent-color)');
    }, 2000);
}

function initUptimeClock() {
    const uptimeEl = document.getElementById('tray-uptime');
    if (!uptimeEl) return;

    const startTime = Date.now();

    setInterval(() => {
        try {
            const diff = Date.now() - startTime;
            const hours = Math.floor(diff / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            const secs = Math.floor((diff % 60000) / 1000);

            const pad = (n) => n.toString().padStart(2, '0');
            uptimeEl.textContent = `UP: ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
        } catch (e) {
            console.warn("Uptime clock update failed", e);
        }
    }, 1000);
}
window.initUptimeClock = initUptimeClock;

function initStartMenu() {
    console.log('[DEBUG] initStartMenu: Initializing Robust Version...');
    const startMenu = document.getElementById('start-menu');
    const startBtn = document.getElementById('start-btn');

    // Use a single global listener for efficiency and to avoid propagation race conditions
    document.addEventListener('click', (e) => {
        const isStartBtn = e.target.closest('#start-btn');
        const isInsideMenu = e.target.closest('#start-menu');

        if (isStartBtn) {
            console.log('[DEBUG] Start Button Clicked!');
            e.preventDefault();
            const isHidden = startMenu.classList.contains('hidden');
            if (isHidden) {
                console.log('[DEBUG] Opening menu');
                startMenu.classList.remove('hidden');
            } else {
                console.log('[DEBUG] Closing menu');
                startMenu.classList.add('hidden');
            }
        } else if (!isInsideMenu) {
            if (!startMenu.classList.contains('hidden')) {
                console.log('[DEBUG] Clicking outside, hiding menu');
                startMenu.classList.add('hidden');
            }
        }
    });

    // Dedicated listeners for internal buttons
    const shutdownBtn = document.getElementById('shutdown-btn');
    const readmeBtn = document.getElementById('menu-btn-readme');
    const settingsBtn = document.getElementById('menu-btn-settings');
    const menuRecordBtn = document.getElementById('menu-btn-record');

    if (shutdownBtn) {
        shutdownBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Shut down Chomka WebOS? All progress will be saved.")) {
                await shutDown(false, true);
            }
        };
    }

    if (readmeBtn) {
        readmeBtn.onclick = (e) => {
            e.stopPropagation();
            startMenu.classList.add('hidden');
            const infoBtn = document.getElementById('btn-info');
            if (infoBtn) infoBtn.click();
        };
    }

    if (settingsBtn) {
        settingsBtn.onclick = (e) => {
            e.stopPropagation();
            startMenu.classList.add('hidden');
            const settingsIcon = document.querySelector('.tool-icon[title="Settings"]');
            if (settingsIcon) settingsIcon.click();
        };
    }

    if (menuRecordBtn) {
        menuRecordBtn.onclick = (e) => {
            e.stopPropagation();
            startMenu.classList.add('hidden');
            const toolbeltRecordBtn = document.getElementById('btn-record');
            if (toolbeltRecordBtn) toolbeltRecordBtn.click();
        };
    }
}

async function shutDown(silent = false, triggerQuit = false) {
    if (triggerQuit && window.chomka && window.chomka.setShutdownFlag) {
        window.chomka.setShutdownFlag(true);
    }

    // Snapshot all video timestamps
    if (window.desktopManager) {
        window.desktopManager.saveAllTimestamps();
    }

    if (window.ShutdownManager) {
        await window.ShutdownManager.start(triggerQuit);
    } else {
        console.error('Chomka: ShutdownManager not found!');
        // Fallback for safety
        if (triggerQuit && window.pywebview) window.pywebview.api.quit_finally();
        else if (window.pywebview) window.pywebview.api.quit();
    }
}

window.shutDown = shutDown; // Expose to backend


function initSearch() {
    const input = document.getElementById('search-input');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = input.value.trim();
                if (query) {
                    const lowerQuery = query.toLowerCase();
                    let url;

                    // Direct shortcuts for iframe-unfriendly sites
                    if (isNativeOnlyUrl(lowerQuery)) {
                        url = lowerQuery === 'yt' || lowerQuery === 'youtube' ? 'https://www.youtube.com' :
                            lowerQuery === 'discord' ? 'https://discord.com' :
                                'https://minecraft.wiki';
                        window.chomka.openNativeWindow(url);
                        input.value = '';
                        return;
                    }
                    // Check if input looks like a URL
                    else if (query.match(/^https?:\/\//) || query.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/)) {
                        url = query.startsWith('http') ? query : `https://${query}`;
                        if (isNativeOnlyUrl(url)) {
                            window.chomka.openNativeWindow(url);
                            input.value = '';
                            return;
                        }
                    } else {
                        // Use Google with iframe hack
                        url = `https://www.google.com/search?igu=1&z=2&q=${encodeURIComponent(query)}`;
                    }

                    // Open in Internal Browser (Unless it matched native-only above)
                    window.openBrowser(url);
                    input.value = '';
                }
            }
        });
    }
}


// --- Multi-Window Browser Logic ---
let browserWindows = [];
window.chomkaZIndex = 110;
window.windowZIndex = window.chomkaZIndex; // Legacy support

function createBrowserWindow(url = 'https://google.com') {
    const winId = `win-${Date.now()}`;
    const win = document.createElement('div');
    win.className = 'window';
    win.id = winId;
    win.style.left = `${100 + (browserWindows.length * 30)}px`;
    win.style.top = `${50 + (browserWindows.length * 30)}px`;
    win.style.width = '900px';
    win.style.height = '600px';
    win.style.zIndex = window.chomkaZIndex++;

    win.innerHTML = `
        <div class="window-header">
            <span class="window-title">Chomka Browser</span>
            <div class="window-controls">
                <button class="win-btn minimize"></button>
                <button class="win-btn maximize"></button>
                <button class="win-btn close"></button>
            </div>
        </div>
        <div class="window-content">
            <div class="browser-toolbar">
                <button class="browser-back">←</button>
                <button class="browser-forward">→</button>
                <button class="browser-reload">↻</button>
                <input type="text" class="browser-url-bar" value="${url}">
                <button class="browser-go">Go</button>
                <button class="browser-native" title="Open in Native Window (Use for YouTube/Blocked sites)">🚀</button>
                <button class="browser-summarize" title="AI Summarize Page">🐹</button>
                <button class="browser-sticky" title="Create Sticky from Selection">✍️</button>
            </div>
            <iframe class="browser-frame" src="${url}"></iframe>
        </div>
    `;

    document.body.appendChild(win);

    const frame = win.querySelector('.browser-frame');
    const urlBar = win.querySelector('.browser-url-bar');
    const header = win.querySelector('.window-header');

    // Controls
    win.querySelector('.close').onclick = () => {
        win.remove();
        browserWindows = browserWindows.filter(w => w.id !== winId);
    };

    win.querySelector('.maximize').onclick = () => {
        if (win.style.width === '100%') {
            win.style.width = '900px';
            win.style.height = '600px';
            win.style.top = '50px';
            win.style.left = '100px';
        } else {
            win.style.width = '100%';
            win.style.height = 'calc(100% - 40px)'; // Account for taskbar
            win.style.top = '0';
            win.style.left = '0';
        }
    };

    win.querySelector('.browser-back').onclick = () => {
        try { frame.contentWindow.history.back(); } catch (e) { }
    };
    win.querySelector('.browser-forward').onclick = () => {
        try { frame.contentWindow.history.forward(); } catch (e) { }
    };
    win.querySelector('.browser-reload').onclick = () => {
        frame.src = frame.src;
    };
    win.querySelector('.browser-go').onclick = () => {
        navigateTo(win, urlBar.value);
    };
    urlBar.onkeydown = (e) => {
        if (e.key === 'Enter') navigateTo(win, urlBar.value);
    };

    win.querySelector('.browser-native').onclick = () => {
        const currentUrl = urlBar.value;
        if (currentUrl) {
            window.chomka.openNativeWindow(currentUrl);
        }
    };

    win.querySelector('.browser-summarize').onclick = () => {
        if (window.summarizeCurrentPage) {
            window.summarizeCurrentPage(urlBar.value);
        }
    };

    win.querySelector('.browser-sticky').onclick = () => {
        if (window.createStickyFromSelection) {
            window.createStickyFromSelection();
        }
    };

    // Make Draggable
    makeDraggable(win, header);

    // Focus on click
    win.onmousedown = () => {
        win.style.zIndex = window.chomkaZIndex++;
    };

    browserWindows.push({ id: winId, element: win });
    return win;
}

function isNativeOnlyUrl(url) {
    if (!url) return false;
    const low = url.toLowerCase();

    // Exact site matches or domain patterns
    const blockedDomains = [
        'youtube.com', 'youtu.be', 'discord.com', 'minecraft.wiki',
        'github.com', 'twitter.com', 'x.com', 'twitch.tv', 'facebook.com',
        'instagram.com', 'tiktok.com'
    ];

    // Direct term matches
    const blockedTerms = ['discord', 'minecraft wiki', 'yt', 'youtube', 'mc wiki'];

    if (blockedTerms.includes(low)) return true;

    return blockedDomains.some(domain => low.includes(domain));
}

// --- Browser Operations ---
window.openBrowser = function (url) {
    console.log('Chomka: Requesting open browser for:', url);
    if (isNativeOnlyUrl(url)) {
        window.chomka.openNativeWindow(url);
    } else {
        createBrowserWindow(url);
    }
};

function isNativeOnlyUrl(url) {
    const u = url.toLowerCase();
    const blockedDomains = [
        'youtube.com', 'youtu.be', 'discord.com', 'minecraft.wiki'
    ];
    return blockedDomains.some(domain => u.includes(domain));
}

function navigateTo(win, url) {
    const frame = win.querySelector('.browser-frame');
    const urlBar = win.querySelector('.browser-url-bar');
    let finalUrl = url;
    if (!url.startsWith('http') && !url.startsWith('about:')) {
        finalUrl = `https://${url}`;
    }

    if (isNativeOnlyUrl(finalUrl)) {
        console.log('Chomka: Navigation target is native-only, closing browser and opening native window');
        win.remove();
        browserWindows = browserWindows.filter(w => w.id !== win.id);
        window.chomka.openNativeWindow(finalUrl);
    } else {
        frame.src = finalUrl;
        urlBar.value = finalUrl;
    }
}


function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;

        // Bring to front
        element.style.zIndex = window.chomkaZIndex++;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        // Reset z-index or handle layering system
    }
}


// --- Tab & Folder Management ---
window.desktopItems = [];
window.saveTimeout = null;
let desktopItems = window.desktopItems; // Legacy local reference

async function initTabManager() {
    // CRITICAL: Wait for bridge before loading
    await window.chomka.init();

    loadItems();

    // Event Listeners from DesktopManager
    window.addEventListener('save-desktop', (e) => {
        desktopItems = e.detail.items;
        saveItems();
    });

    // --- Desktop Drag & Drop (Drop files onto desktop) ---
    const desktopContainer = document.getElementById('desktop-items-container');
    if (desktopContainer) {
        desktopContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Show potential drop feedback here if desired
        });

        desktopContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const x = e.clientX;
            const y = e.clientY;

            // Handle Files (Images)
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                        const id = `image-${Date.now()}`;
                        const base64 = evt.target.result;
                        updateSaveStatus('saving');
                        const result = await window.chomka.saveAsset(base64, id);

                        desktopManager.addItem({
                            id: id,
                            type: 'image',
                            src: result.success ? result.path : base64,
                            x: x - 50, // Center on cursor
                            y: y - 50
                        });
                        saveItems();
                    };
                    reader.readAsDataURL(file);
                }
            } else {
                // Handle Text/URL
                const data = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
                if (data) {
                    const isYouTube = data.includes('youtube.com') || data.includes('youtu.be');

                    if (isYouTube) {
                        window.desktopManager.addItem({
                            id: `video-${Date.now()}`,
                            type: 'video',
                            src: data,
                            x: x - 160,
                            y: y - 120
                        });
                        saveItems();
                    } else if (data.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i) || data.startsWith('data:image')) {
                        window.desktopManager.addItem({
                            id: `image-${Date.now()}`,
                            type: 'image',
                            src: data,
                            x: x - 50,
                            y: y - 50
                        });
                        saveItems();
                    } else if (data.startsWith('http') || data.startsWith('www.')) {
                        // Assume it's a link -> Create Note
                        window.desktopManager.addItem({
                            id: `note-${Date.now()}`,
                            type: 'note',
                            text: data,
                            x: x - 110,
                            y: y - 100
                        });
                        saveItems();
                    }
                }
            }
        });
    }

    window.addEventListener('open-folder', (e) => {
        const item = desktopItems.find(i => i.id === e.detail.id);
        if (item) openFolder(item);
    });

    // Context Menu Logic
    const contextMenu = document.getElementById('context-menu');
    const container = document.getElementById('desktop-items-container');

    // Item Context Menu Logic
    const itemContextMenu = document.getElementById('item-context-menu');
    let currentItemId = null;

    window.addEventListener('item-context-menu', (e) => {
        if (itemContextMenu) {
            // Hide main menu if open
            if (contextMenu) contextMenu.classList.add('hidden');

            currentItemId = e.detail.id;
            itemContextMenu.style.left = `${e.detail.x}px`;
            itemContextMenu.style.top = `${e.detail.y}px`;
            itemContextMenu.classList.remove('hidden');
        }
    });

    // Hide menus on click
    window.addEventListener('click', (e) => {
        if (contextMenu) contextMenu.classList.add('hidden');
        if (itemContextMenu) itemContextMenu.classList.add('hidden');

        // Selection logic for Move Mode
        const item = e.target.closest('.desktop-item');
        if (item && isMoveModeActive) {
            desktopManager.selectItem(item.dataset.id);
        } else if (!item && isMoveModeActive && !e.target.closest('#toolbelt')) {
            desktopManager.selectItem(null);
        }
    });

    // Handle Item Menu Actions
    if (itemContextMenu) {
        itemContextMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action && currentItemId && window.desktopManager) {
                if (action === 'layer-up') window.desktopManager.changeZIndex(currentItemId, 1);
                else if (action === 'layer-down') window.desktopManager.changeZIndex(currentItemId, -1);
                else if (action === 'toggle-yt-pin') window.desktopManager.toggleYTPin(currentItemId);
                else if (action === 'delete-item') {
                    if (confirm('Delete this item?')) window.desktopManager.deleteItem(currentItemId);
                } else {
                    // Dispatch generic event for other actions (e.g. copy-link)
                    window.dispatchEvent(new CustomEvent('item-context-menu-action', {
                        detail: { action: action, id: currentItemId }
                    }));
                }
            }
        });
    }

    // Show menu on right click
    window.addEventListener('contextmenu', (e) => {
        // Prevent default only if clicking on desktop or own items (not inputs, not browser iframe)
        const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

        if (!isInput) {
            e.preventDefault();

            // Only show custom menu if configured
            if (contextMenu) {
                contextMenu.style.left = `${e.clientX}px`;
                contextMenu.style.top = `${e.clientY}px`;
                contextMenu.classList.remove('hidden');
            }
        }
    });

    // Handle Menu Actions
    if (contextMenu) {
        contextMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                if (action === 'add-folder') createItemFromPanel('folder');
                else if (action === 'add-note') createItemFromPanel('note');
                else if (action === 'add-image') createItemFromPanel('image');
                else if (action === 'move-toolbelt') toggleToolbeltPosition();
            }
        });
    }
    // Add Tab to Toolbelt (Global Add) - Refactored to Add Item
    // Add Tab to Toolbelt (Global Add) - Handled by initAddPanel

}

async function loadItems() {
    let storedData = null;

    // 1. Try Native Bridge (Config/State)
    try {
        const state = await window.chomka.getState('desktop_items');
        if (state && state.success && state.value) {
            storedData = state.value;
            console.log(`Chomka: Loaded ${Array.isArray(storedData) ? storedData.length : 'object'} items from config.json`);
        }
    } catch (e) {
        console.warn('Chomka: Could not parse from native bridge, trying localStorage...', e);
    }

    // 2. Fallback to LocalStorage
    if (!storedData) {
        const stored = localStorage.getItem('chomka_desktop');
        if (stored) {
            storedData = JSON.parse(stored);
            console.log('Chomka: Loaded items from localStorage');
        }
    }

    if (storedData) {
        // Ensure array
        desktopItems = Array.isArray(storedData) ? storedData : (storedData.length ? Array.from(storedData) : []);
    } else {
        // Default items for new installs
        desktopItems = [
            { id: 'welcome-note', type: 'note', x: 20, y: 20, text: 'Welcome to Chomka WebOS! Enjoy your stay.' },
            {
                id: 'app-youtube',
                type: 'app',
                url: 'https://www.youtube.com',
                name: 'YouTube',
                iconUrl: 'assets/youtube.png', // Using local asset if available
                x: 20,
                y: 150
            },
            {
                id: 'app-discord',
                type: 'app',
                url: 'https://discord.com/app',
                name: 'Discord',
                iconUrl: 'assets/discord.png', // Using local asset if available
                x: 20,
                y: 350
            },
            {
                id: 'app-minecraft-wiki',
                type: 'app',
                url: 'https://minecraft.wiki',
                name: 'Minecraft Wiki',
                iconUrl: 'https://minecraft.wiki/images/Wiki.png',
                x: 20,
                y: 550
            },
            {
                id: 'default-video',
                type: 'video',
                src: 'https://www.youtube.com/watch?v=jQHok8S4nDY',
                x: 400,
                y: 150,
                zIndex: 2
            }
        ];
        // Save defaults immediately so they exist in config.json
        saveItems();

        // Set initial audio focus to the default video
        setTimeout(() => {
            if (window.desktopManager) {
                window.desktopManager.setAudioFocus('default-video');
            }
        }, 1000);
    }

    // Migration: Extract large Base64 images to assets
    if (storedData) {
        console.log('Chomka: Checking for assets to migrate...');
        let migratedCount = 0;

        // Count how many need migration
        const toMigrate = (Array.isArray(desktopItems) ? desktopItems : []).filter(item =>
            (item.type === 'image' || item.type === 'gif') && item.src && item.src.startsWith('data:image')
        );

        if (toMigrate.length > 0) {
            updateSaveStatus('migrating');
            for (const item of toMigrate) {
                console.log(`Chomka: Migrating asset ${item.id}...`);
                try {
                    const result = await window.chomka.saveAsset(item.src, item.id);
                    if (result && result.success) {
                        item.src = result.path;
                        migratedCount++;
                    }
                } catch (err) {
                    console.warn(`Chomka: Failed to migrate ${item.id}`, err);
                }
            }
        }

        // New Migration: Ensure core apps exist and use 'app' type
        const coreApps = [
            { id: 'app-youtube', url: 'https://www.youtube.com', name: 'YouTube', iconUrl: 'assets/youtube.png' },
            { id: 'app-discord', url: 'https://discord.com/app', name: 'Discord', iconUrl: 'assets/discord.png' },
            { id: 'app-minecraft-wiki', url: 'https://minecraft.wiki', name: 'Minecraft Wiki', iconUrl: 'assets/minecraft.png' }
        ];

        window.chomka.log('Chomka: Checking for core app migration...');
        let coreMigrated = false;
        coreApps.forEach((app) => {
            let existing = desktopItems.find((i) => i.id === app.id);
            if (!existing) {
                window.chomka.log(`Chomka: Core app ${app.id} missing, adding...`);
                desktopItems.push({
                    id: app.id,
                    type: 'app',
                    url: app.url,
                    name: app.name,
                    iconUrl: app.iconUrl,
                    x: 20,
                    y: 150 + (coreApps.indexOf(app) * 200)
                });
                coreMigrated = true;
            } else if (existing.type !== 'app' || !existing.iconUrl) {
                window.chomka.log(`Chomka: Upgrading core app ${app.id} to new branded type...`);
                existing.type = 'app';
                existing.url = app.url;
                existing.name = app.name;
                existing.iconUrl = app.iconUrl;
                coreMigrated = true;
            }
        });

        if (migratedCount > 0 || coreMigrated) {
            window.chomka.log('Chomka: Migrated ' + migratedCount + ' assets and core apps, updating config.json');
            updateSaveStatus('saved');
            localStorage.setItem('chomka_desktop', JSON.stringify(desktopItems));
            window.chomka.saveState('desktop_items', desktopItems);
        } else if (toMigrate.length > 0) {
            updateSaveStatus('hidden');
        }
    }

    // Finalize UI
    const baseUrl = await window.chomka.getDataUrl();
    window.desktopManager.setBaseUrl(baseUrl); // This renders
    window.desktopManager.loadItems(desktopItems); // This also renders, wait
}

function saveItems() {
    // Save to localStorage immediately
    localStorage.setItem('chomka_desktop', JSON.stringify(desktopItems));

    // UI Feedback
    updateSaveStatus('saving');

    // Debounce Save
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        // Visual "Save Realization"
        triggerSaveRealization();

        const result = await window.chomka.saveState('desktop_items', desktopItems);

        // Also save a raw text version as requested: "screenlayout.txt"
        const layoutText = desktopItems.map(i => `${i.id}: ${i.x},${i.y} [${i.type}]`).join('\n');
        await window.chomka.saveFile('saves/screenlayout.txt', layoutText);

        if (result && result.success) {
            console.log('Chomka: Save state (config.json) updated');
            updateSaveStatus('saved');
        } else {
            updateSaveStatus('error');
        }
    }, 1500); // Slightly longer debounce for animation
}

function triggerSaveRealization() {
    const asset = document.getElementById('save-file-asset');
    if (!asset) return;

    asset.classList.remove('hidden', 'animate-save-drop');
    void asset.offsetWidth; // Trigger reflow
    asset.classList.add('animate-save-drop');

    setTimeout(() => {
        asset.classList.add('hidden');
        asset.classList.remove('animate-save-drop');
    }, 1300);
}

// --- Save Feedback UI ---
function updateSaveStatus(state) {
    const el = document.getElementById('save-status');
    const text = el.querySelector('.status-text');
    const icon = el.querySelector('.status-icon');

    el.classList.remove('hidden', 'saving', 'saved', 'error');

    if (state === 'saving') {
        el.classList.add('saving');
        text.textContent = 'Saving...';
        icon.textContent = '💾';
    } else if (state === 'migrating') {
        el.classList.add('saving');
        text.textContent = 'Migrating...';
        icon.textContent = '📦';
    } else if (state === 'saved') {
        el.classList.add('saved');
        text.textContent = 'Saved';
        icon.textContent = '✅';
        setTimeout(() => el.classList.add('hidden'), 2000);
    } else if (state === 'error') {
        el.classList.add('error');
        text.textContent = 'Save Error';
        icon.textContent = '⚠️';
        setTimeout(() => el.classList.add('hidden'), 5000);
    }
}

window.onSaveComplete = (filename) => {
    console.log(`Chomka: Save complete for ${filename}`);
    if (filename === 'desktop.json') {
        updateSaveStatus('saved');
    }
};

window.onSaveError = (filename, error) => {
    console.error(`Chomka: Save error for ${filename}:`, error);
    updateSaveStatus('error');
};



// --- Add Panel Logic ---
function initAddPanel() {
    console.log('Chomka: Initializing Add Panel...');
    const panel = document.getElementById('add-panel');
    const closeBtn = document.getElementById('add-panel-close');
    const options = document.querySelectorAll('.add-option');
    const addBtn = document.getElementById('btn-add-tab');

    if (!panel) {
        console.error('Chomka: Add Panel not found!');
        return;
    }

    // Close Button
    if (closeBtn) {
        closeBtn.onclick = () => panel.classList.add('hidden'); // Simple onclick is fine here
    }

    // Grid Options
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            const type = opt.dataset.type;
            console.log('Chomka: Selected option:', type);
            panel.classList.add('hidden');
            createItemFromPanel(type);
        });
    });

    // Plus Button (Toolbelt) - Critical Logic
    if (addBtn) {
        // Remove old 'onclick' if any
        addBtn.onclick = null;

        // Add new listener
        addBtn.addEventListener('click', (e) => {
            console.log('Chomka: Plus Button Clicked!');
            e.stopPropagation();
            panel.classList.remove('hidden');
            console.log('Chomka: Panel Hidden Class Removed:', !panel.classList.contains('hidden'));
        });
        console.log('Chomka: Plus Button Listener Attached');
    } else {
        console.error('Chomka: Plus Button (btn-add-tab) not found!');
    }
}

function createItemFromPanel(type) {
    if (type === 'folder') {
        const name = prompt("Folder Name:", "New Folder");
        if (name) {
            window.desktopManager.addItem({
                id: `folder-${Date.now()}`,
                type: 'folder',
                name: name,
                tabs: []
            });
            saveItems();
        }
    } else if (type === 'note') {
        window.desktopManager.addItem({
            id: `note-${Date.now()}`,
            type: 'note',
            text: ''
        });
        saveItems();
    } else if (type === 'image') {
        const src = prompt("Image URL (leave empty to pick a file from Windows):");
        if (src) {
            const isYouTube = src.includes('youtube.com') || src.includes('youtu.be');
            window.desktopManager.addItem({
                id: `${isYouTube ? 'video' : 'image'}-${Date.now()}`,
                type: isYouTube ? 'video' : 'image',
                src: src
            });
            saveItems();
        } else {
            // Native Pick & Save flow
            (async () => {
                updateSaveStatus('saving');
                const result = await window.chomka.pickAndSaveImage();
                if (result && result.success) {
                    const id = `image-${Date.now()}`;
                    window.desktopManager.addItem({
                        id: id,
                        type: 'image',
                        src: result.path
                    });
                    saveItems();
                } else {
                    updateSaveStatus('hidden');
                }
            })();
        }
    } else if (type === 'browser') {
        const url = prompt("Enter URL:", "https://bing.com");
        if (url) {
            const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
            if (isYouTube) {
                window.desktopManager.addItem({
                    id: `video-${Date.now()}`,
                    type: 'video',
                    src: url
                });
                saveItems();
            } else {
                openBrowser(url);
            }
        }
    }
}

// Helper to trigger hidden file input
function triggerFileUpload(callback) {
    let input = document.getElementById('global-file-input');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'global-file-input';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
    }

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => callback(evt.target.result);
            reader.readAsDataURL(file);
        }
        input.value = ''; // Reset
    };

    input.click();
}


// Toolbelt Positioning Logic
function toggleToolbeltPosition() {
    const toolbelt = document.getElementById('toolbelt');
    const positions = ['right', 'bottom', 'left', 'top'];
    let current = 'right';

    positions.forEach(p => {
        if (toolbelt.classList.contains(p)) current = p;
    });

    const nextIndex = (positions.indexOf(current) + 1) % positions.length;
    const next = positions[nextIndex];

    toolbelt.classList.remove(...positions);
    toolbelt.classList.add(next);

    // Save preference
    localStorage.setItem('chomka_toolbelt_pos', next);
}

// Initial Load of Toolbelt Position
function loadToolbeltPosition() {
    const toolbelt = document.getElementById('toolbelt');
    const saved = localStorage.getItem('chomka_toolbelt_pos') || 'right';
    toolbelt.classList.add(saved);

    // Add context menu to move it
    toolbelt.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (confirm("Rotate Toolbelt Position?")) {
            toggleToolbeltPosition();
        }
    });
}

// --- Move Mode Logic ---
let isMoveModeActive = false;

function initMoveMode() {
    const moveBtn = document.getElementById('btn-move-mode');
    if (!moveBtn) return;

    moveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isMoveModeActive = !isMoveModeActive;
        moveBtn.classList.toggle('active', isMoveModeActive);

        if (!isMoveModeActive) {
            desktopManager.selectItem(null);
        }
        console.log('Chomka: Move Mode:', isMoveModeActive);
    });

    // Keyboard Listeners
    window.addEventListener('keydown', (e) => {
        if (!isMoveModeActive || !desktopManager.selectedItemId) return;

        // Prevent scrolling with arrows
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key.toLowerCase())) {
            e.preventDefault();
        }

        const step = e.shiftKey ? 50 : 10;
        let dx = 0, dy = 0;

        switch (e.key.toLowerCase()) {
            case 'arrowup':
            case 'w':
                dy = -step;
                break;
            case 'arrowdown':
            case 's':
                dy = step;
                break;
            case 'arrowleft':
            case 'a':
                dx = -step;
                break;
            case 'arrowright':
            case 'd':
                dx = step;
                break;
            case 'escape':
                desktopManager.selectItem(null);
                break;
        }

        if (dx !== 0 || dy !== 0) {
            desktopManager.moveSelectedItem(dx, dy);
        }
    });

    // Global shortcut for stopping recording
    window.addEventListener('keydown', (e) => {
        if (e.key === '~' || e.key === '`') {
            const recordBtn = document.getElementById('btn-record');
            if (window.recordingManager && window.recordingManager.isRecording) {
                window.recordingManager.stop();
                if (recordBtn) recordBtn.classList.remove('active', 'recording-blink');
                if (window.notificationManager) {
                    window.notificationManager.notify("Recording", "Stopped via shortcut", "📹");
                }
            }
        }
    });
}

// --- Folder Interaction (Upload/Paste) ---

let currentOpenFolderId = null;

function openFolder(folder) {
    currentOpenFolderId = folder.id;
    let html = `<h3>${folder.name}</h3>`;

    // Render Items
    if (folder.tabs && folder.tabs.length > 0) {
        html += `<div class="folder-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:10px; max-height:400px; overflow-y:auto;">`;
        folder.tabs.forEach((item, index) => {
            if (item.type === 'image') {
                html += `
                <div style="position:relative; border:1px solid #444; padding:5px; border-radius:8px; background:rgba(0,0,0,0.3);">
                    <img src="${item.url}" style="width:100%; height:80px; object-fit:cover; border-radius:4px; display:block;">
                    <div style="font-size:0.8rem; margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title || 'Image'}</div>
                    <button onclick="window.chomkaDeleteFolderItem('${folder.id}', ${index})" style="position:absolute; top:2px; right:2px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer;">&times;</button>
                    <button onclick="window.openBrowser('${item.url}')" style="width:100%; margin-top:5px; cursor:pointer; background:#333; color:white; border:none; padding:4px;">View</button>
                </div>`;
            } else {
                // Link
                html += `
                <div style="position:relative; border:1px solid #444; padding:10px; border-radius:8px; background:rgba(0,0,0,0.3); display:flex; flex-direction:column; justify-content:center; align-items:center;">
                    <div style="font-size:2rem;">🔗</div>
                    <div style="font-size:0.8rem; margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;">${item.title || 'Link'}</div>
                    <button onclick="window.chomkaDeleteFolderItem('${folder.id}', ${index})" style="position:absolute; top:2px; right:2px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer;">&times;</button>
                    <button onclick="window.openBrowser('${item.url}')" style="width:100%; margin-top:5px; cursor:pointer; background:var(--accent-color); color:black; border:none; padding:4px; border-radius:4px;">Open</button>
                </div>`;
            }
        });
        html += `</div>`;
    } else {
        html += `<div style="padding:20px; text-align:center; color:#888;">Empty Folder<br><small>Paste images (Ctrl+V) or click 'Upload'</small></div>`;
    }

    // Controls
    html += `
    <div style="margin-top:20px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1); display:flex; gap:10px; flex-wrap:wrap;">
        <button id="folder-add-link" style="padding:8px 12px; background:var(--accent-color); border:none; border-radius:4px; cursor:pointer; font-weight:600;">+ Link</button>
        <button id="folder-upload-img" style="padding:8px 12px; background:#e91e63; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:600;">↑ Upload Image</button>
        <button id="folder-paste-hint" style="padding:8px 12px; background:transparent; border:1px solid #555; color:#aaa; border-radius:4px; cursor:default;">Paste enabled (Ctrl+V)</button>
    </div>
    `;

    window.showModal(folder.name, html);

    // Bind Actions
    setTimeout(() => {
        document.getElementById('folder-add-link').onclick = () => addItemToFolder(folder.id, 'link');
        document.getElementById('folder-upload-img').onclick = async () => {
            updateSaveStatus('saving');
            const result = await window.chomka.pickAndSaveImage();
            if (result && result.success) {
                addItemToFolder(folder.id, 'image', result.path);
            } else {
                updateSaveStatus('hidden');
            }
        };
    }, 0);
}

// Listen for Paste (Global, but filtered by modal existence)
// Listen for Paste (Global)
document.addEventListener('paste', (e) => {
    const modal = document.getElementById('modal-overlay');
    const isModalOpen = !modal.classList.contains('hidden');

    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let hasHandled = false;

    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                if (isModalOpen && currentOpenFolderId) {
                    addItemToFolder(currentOpenFolderId, 'image', event.target.result);
                } else if (!isModalOpen) {
                    // Paste to Desktop
                    desktopManager.addItem({
                        id: `image-${Date.now()}`,
                        type: 'image',
                        src: event.target.result,
                        x: 200, // Default Position
                        y: 200
                    });
                    saveItems();
                }
            };
            reader.readAsDataURL(blob);
            hasHandled = true;
        }
    }
});

// Update addItemToFolder to handle direct content (base64)
function addItemToFolder(folderId, type, content = null) {
    const folder = desktopItems.find(i => i.id === folderId);
    if (!folder) return;

    if (type === 'link') {
        const url = prompt("Enter URL:");
        if (url) {
            const title = prompt("Enter Title (optional):") || url;
            folder.tabs.push({ type: 'link', url: url, title: title });
            saveItems();
            openFolder(folder);
        }
    } else if (type === 'image') {
        let url = content;
        let title = "Uploaded Image";

        if (!url) {
            url = prompt("Enter Image URL:");
            title = "Image Link";
        }

        if (url) {
            folder.tabs.push({ type: 'image', url: url, title: title });
            saveItems();
            openFolder(folder);
        }
    }
}

// Global helper for delete (needs to be on window to be called from string HTML)
window.chomkaDeleteFolderItem = function (folderId, itemIndex) {
    const folder = desktopItems.find(i => i.id === folderId);
    if (folder && folder.tabs) {
        folder.tabs.splice(itemIndex, 1);
        saveItems();
        openFolder(folder); // Re-render
    }
};


// --- Settings Tray & Themes ---
function initSettingsTray() {
    const settingsBtn = document.getElementById('tray-settings');
    if (!settingsBtn) return;

    // Load saved theme
    const savedTheme = localStorage.getItem('chomka_theme') || 'default';
    setTheme(savedTheme);

    settingsBtn.onclick = () => {
        // Toggle rotation animation
        settingsBtn.style.transform = settingsBtn.style.transform === 'rotate(90deg)' ? 'rotate(0deg)' : 'rotate(90deg)';

        const html = `
        <div style="padding:20px; color:white;">
            <h3>⚙️ System Settings</h3>
            <div class="divider"></div>
            
            <h4 style="margin-bottom:10px;">🎨 Theme</h4>
            <div class="theme-grid" style="grid-template-columns: repeat(3, 1fr); gap:10px;">
                <button class="theme-btn" data-theme="default">Night</button>
                <button class="theme-btn" data-theme="sakura">Sakura</button>
                <button class="theme-btn" data-theme="cyberpunk">Cyber</button>
                <button class="theme-btn" data-theme="classic">Classic</button>
                <button class="theme-btn" data-theme="solarized">Solar</button>
            </div>

            <div class="divider"></div>
            <h4 style="margin-bottom:10px;">🖥️ Display</h4>
            <label style="display:flex; align-items:center; cursor:pointer;">
                <input type="checkbox" id="setting-show-fps" style="margin-right:10px;"> Show FPS Counter
            </label>
            <div style="margin-top:10px; font-size:0.8rem; opacity:0.6;">Resolution: ${window.innerWidth}x${window.innerHeight}</div>
        </div>
    `;

        if (window.showModal) {
            window.showModal('Settings', html);
        }

        // Attach theme listeners inside modal
        setTimeout(() => {
            document.querySelectorAll('.theme-btn').forEach(btn => {
                btn.onclick = () => {
                    const theme = btn.getAttribute('data-theme');
                    setTheme(theme);
                    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    localStorage.setItem('chomka_theme', theme);
                };
                if (btn.getAttribute('data-theme') === (localStorage.getItem('chomka_theme') || 'default')) {
                    btn.classList.add('active');
                }
            });
        }, 100);
    };
}

// --- Theme Manager ---
function setTheme(themeName) {
    document.body.className = ''; // Reset
    if (themeName !== 'default') {
        document.body.classList.add(`theme-${themeName}`);
    }
    // Update button states if UI is open
    const buttons = document.querySelectorAll('.theme-btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('data-theme') === themeName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    console.log(`Chomka: Theme set to ${themeName}`);
}

window.setTheme = setTheme;
