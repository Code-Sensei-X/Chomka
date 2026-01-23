

let desktopManager;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Chomka WebOS: Beginning Initialization...');

    const initSteps = [
        { name: 'Start Menu', fn: initStartMenu },
        { name: 'Clock', fn: initClock },
        { name: 'Toolbelt', fn: initToolbelt },
        { name: 'Native Bridge', fn: initNativeBridge },
        { name: 'Search', fn: initSearch },
        { name: 'Desktop Manager', fn: () => { desktopManager = new DesktopManager('desktop-items-container'); } },
        { name: 'Tab Manager', fn: initTabManager },
        { name: 'Add Panel', fn: initAddPanel },
        { name: 'Move Mode', fn: initMoveMode }
    ];

    initSteps.forEach(async step => {
        try {
            console.log(`[INIT] Running ${step.name}...`);
            await step.fn();
        } catch (e) {
            console.error(`[CRITICAL] Failed to initialize ${step.name}:`, e);
        }
    });

    // Initialize Base URL for assets
    window.chomka.getDataUrl().then(url => {
        if (desktopManager) desktopManager.setBaseUrl(url);
    });

    console.log('Chomka WebOS: Initialization Sequence Complete.');
});


// ... existing initClock and initToolbelt ... 

function initNativeBridge() {
    // Check if running in pywebview
    window.addEventListener('pywebviewready', function () {
        console.log('Chomka Native Bridge Ready');
    });
}

// Global API Wrapper
window.chomka = {
    saveFile: async function (filename, content, sync = false) {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.save_file(filename, content, sync);
            } catch (e) {
                console.error('Chomka: Critical Bridge Error (saveFile):', e);
                return { success: false, error: e.toString() };
            }
        } else {
            console.warn('Native API not available. Running in browser mode.');
            // Fallback for browser testing (download)
            const blob = new Blob([content], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            return { success: true, mode: 'browser_download' };
        }
    },
    readFile: async function (filename) {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.read_file(filename);
            } catch (e) {
                console.error('Chomka: Critical Bridge Error (readFile):', e);
                return null; // Or throw, depending on desired error handling
            }
        } else {
            return "Read API not available in browser mode.";
        }
    },
    sendFeedback: async function (message) {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.send_feedback(message);
            } catch (e) {
                console.error('Chomka: Critical Bridge Error (sendFeedback):', e);
                return { success: false, error: e.toString() };
            }
        } else {
            console.warn('Native API not available. Simulating mailto.');
            window.location.href = `mailto:crabisoftcompany@gmail.com?subject=Chomka%20Feedback&body=${encodeURIComponent(message)}`;
            return { success: true };
        }
    },
    chooseFolder: async function () {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.choose_folder();
            } catch (e) {
                console.error('Chomka: Critical Bridge Error (chooseFolder):', e);
                return { success: false, error: e.toString() };
            }
        } else {
            alert("Folder selection is only available in the desktop app.");
            return { success: false };
        }
    },
    saveAsset: async function (base64, originalId) {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.save_asset(base64, originalId);
            } catch (e) {
                console.error('Chomka: Critical Bridge Error (saveAsset):', e);
                return { success: false, error: e.toString() };
            }
        } else {
            return { success: true, path: base64 }; // Fallback for browser
        }
    },
    getDataUrl: async function () {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.get_data_url();
            } catch (e) {
                console.error('Chomka: Critical Bridge Error (getDataUrl):', e);
                return ""; // Fallback for browser
            }
        } else {
            return ""; // Browser mode
        }
    },
    updateCoords: function (id, x, y) {
        if (window.pywebview && window.pywebview.api.update_coords) {
            window.pywebview.api.update_coords(id, x, y);
        }
    },
    logError: function (message, stack) {
        if (window.pywebview && window.pywebview.api.log_js_error) {
            window.pywebview.api.log_js_error(message, stack);
        }
    }
};

// Global Error Handler for Deep Research
window.onerror = function (message, source, lineno, colno, error) {
    const stack = error ? error.stack : '';
    console.error('Chomka Critical:', message, stack);
    window.chomka.logError(message, stack);
};

window.onunhandledrejection = function (event) {
    console.error('Chomka Bridge Rejection:', event.reason);
    window.chomka.logError('Unhandled Promise Rejection: ' + event.reason, event.reason ? event.reason.stack : '');
};

function initClock() {
    const clockElement = document.getElementById('clock');

    function updateTime() {
        const now = new Date();
        clockElement.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    updateTime();
    setInterval(updateTime, 1000);
}

function initToolbelt() {
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

    const gridBtn = document.querySelector('.tool-icon[title="Tab Grid"]');
    // const tabGrid = document.getElementById('tab-grid'); // Removed

    if (gridBtn) {
        gridBtn.addEventListener('click', () => {
            // For now, toggle visibility of desktop items or maybe show a "launcher" overlay
            // Since we moved to desktop items, maybe this button adds a new item?
            const container = document.getElementById('desktop-items-container');
            container.classList.toggle('hidden');
        });

        loadToolbeltPosition();
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

    // Modal Logic
    const modal = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

    if (modal && closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        window.showModal = (title, htmlContent) => {
            document.getElementById('modal-title').textContent = title;
            document.getElementById('modal-body').innerHTML = htmlContent;
            modal.classList.remove('hidden');

        }
    }
}

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

    if (shutdownBtn) {
        shutdownBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Shut down Chomka WebOS? All progress will be saved.")) {
                await shutDown();
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
}

async function shutDown(silent = false, triggerQuit = false) {
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
                    let url;
                    // Check if input looks like a URL
                    if (query.match(/^https?:\/\//) || query.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/)) {
                        url = query.startsWith('http') ? query : `https://${query}`;
                    } else {
                        // Use Google with iframe hack
                        url = `https://www.google.com/search?igu=1&z=2&q=${encodeURIComponent(query)}`;
                    }

                    // Open in Internal Browser
                    openBrowser(url);
                    input.value = '';
                }
            }
        });
    }
}

// --- Multi-Window Browser Logic ---
let browserWindows = [];
let windowZIndex = 110;

function createBrowserWindow(url = 'https://google.com') {
    const winId = `win-${Date.now()}`;
    const win = document.createElement('div');
    win.className = 'window';
    win.id = winId;
    win.style.left = `${100 + (browserWindows.length * 30)}px`;
    win.style.top = `${50 + (browserWindows.length * 30)}px`;
    win.style.width = '900px';
    win.style.height = '600px';
    win.style.zIndex = windowZIndex++;

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

    // Make Draggable
    makeDraggable(win, header);

    // Focus on click
    win.onmousedown = () => {
        win.style.zIndex = windowZIndex++;
    };

    browserWindows.push({ id: winId, element: win });
    return win;
}

function openBrowser(url) {
    createBrowserWindow(url);
}

function navigateTo(win, url) {
    const frame = win.querySelector('.browser-frame');
    const urlBar = win.querySelector('.browser-url-bar');
    let finalUrl = url;
    if (!url.startsWith('http') && !url.startsWith('about:')) {
        finalUrl = `https://${url}`;
    }
    frame.src = finalUrl;
    urlBar.value = finalUrl;
}

function initBrowser() {
    // Legacy support or initial setup if needed
    console.log('Chomka: Multi-Window Browser System Initialized');
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
        element.style.zIndex = 1000;
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
let desktopItems = [];
let saveTimeout = null;

function initTabManager() {
    loadItems();
    initBrowser(); // Initialize browser logic 

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
                        desktopManager.addItem({
                            id: `video-${Date.now()}`,
                            type: 'video',
                            src: data,
                            x: x - 160,
                            y: y - 120
                        });
                        saveItems();
                    } else if (data.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i) || data.startsWith('data:image')) {
                        desktopManager.addItem({
                            id: `image-${Date.now()}`,
                            type: 'image',
                            src: data,
                            x: x - 50,
                            y: y - 50
                        });
                        saveItems();
                    } else if (data.startsWith('http') || data.startsWith('www.')) {
                        // Assume it's a link -> Create Note
                        desktopManager.addItem({
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
            if (action && currentItemId && desktopManager) {
                if (action === 'layer-up') desktopManager.changeZIndex(currentItemId, 1);
                else if (action === 'layer-down') desktopManager.changeZIndex(currentItemId, -1);
                else if (action === 'delete-item') {
                    if (confirm('Delete this item?')) desktopManager.deleteItem(currentItemId);
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

    // 1. Try Native Bridge
    try {
        const fileContent = await window.chomka.readFile('desktop.json');
        if (fileContent && typeof fileContent === 'string' && fileContent.trim().startsWith('{')) {
            storedData = JSON.parse(fileContent);
            console.log('Chomka: Loaded items from desktop.json');
        } else {
            console.warn('Chomka: Invalid or missing JSON from native bridge');
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
        desktopItems = storedData;
    } else {
        // ... default items ...
        desktopItems = [
            { id: 'welcome-note', type: 'note', x: 400, y: 100, text: 'Welcome to Chomka WebOS!' }
        ];
    }

    // Migration: Extract large Base64 images to assets
    if (storedData) {
        console.log('Chomka: Checking for assets to migrate...');
        let migratedCount = 0;

        // Count how many need migration
        const toMigrate = desktopItems.filter(item =>
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

        if (migratedCount > 0) {
            console.log(`Chomka: Migrated ${migratedCount} assets, updating desktop.json`);
            updateSaveStatus('saved');
            localStorage.setItem('chomka_desktop', JSON.stringify(desktopItems));
            window.chomka.saveFile('desktop.json', JSON.stringify(desktopItems, null, 2));
        } else if (toMigrate.length > 0) {
            updateSaveStatus('hidden'); // Hide if nothing migrated but tried
        }
    }

    // Finalize UI
    const baseUrl = await window.chomka.getDataUrl();
    desktopManager.setBaseUrl(baseUrl); // This renders
    desktopManager.loadItems(desktopItems); // This also renders, wait
}

function saveItems() {
    // Save to localStorage immediately
    localStorage.setItem('chomka_desktop', JSON.stringify(desktopItems));

    // UI Feedback
    updateSaveStatus('saving');

    // Debounce Save to File
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        window.chomka.saveFile('desktop.json', JSON.stringify(desktopItems, null, 2));
        console.log('Chomka: Save request sent to backend');
    }, 1000); // 1 second debounce
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
            desktopManager.addItem({
                id: `folder-${Date.now()}`,
                type: 'folder',
                name: name,
                tabs: []
            });
            saveItems();
        }
    } else if (type === 'note') {
        desktopManager.addItem({
            id: `note-${Date.now()}`,
            type: 'note',
            text: ''
        });
        saveItems();
    } else if (type === 'image') {
        const src = prompt("Image URL (leave empty to upload):");
        if (src) {
            const isYouTube = src.includes('youtube.com') || src.includes('youtu.be');
            desktopManager.addItem({
                id: `${isYouTube ? 'video' : 'image'}-${Date.now()}`,
                type: isYouTube ? 'video' : 'image',
                src: src
            });
            saveItems();
        } else {
            // Upload flow
            triggerFileUpload(async (base64) => {
                const id = `image-${Date.now()}`;
                updateSaveStatus('saving');
                const result = await window.chomka.saveAsset(base64, id);

                desktopManager.addItem({
                    id: id,
                    type: 'image',
                    src: result.success ? result.path : base64
                });
                saveItems();
            });
        }
    } else if (type === 'browser') {
        const url = prompt("Enter URL:", "https://bing.com");
        if (url) {
            const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
            if (isYouTube) {
                desktopManager.addItem({
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
        document.getElementById('folder-upload-img').onclick = () => {
            triggerFileUpload((base64) => {
                addItemToFolder(folder.id, 'image', base64);
            });
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

window.openBrowser = openBrowser; // Expose for modal clicks
