class DesktopManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.items = [];
        this.dragItem = null;
        this.selectedItemId = null;
        this.dragOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.baseUrl = ''; // To be set via setBaseUrl

        this.initEventListeners();

        this.players = {}; // Store YT players
        this.tracks = {};  // Store interval IDs
        this.unmutedPlayerId = null;

        this.initYTAPI();
        this.renderDebounceTimer = null;

        this.isResizing = false;
        this.resizeDir = null;
        this.snapPreview = this.createSnapPreview();
    }

    createSnapPreview() {
        const el = document.createElement('div');
        el.className = 'snap-preview';
        document.body.appendChild(el);
        return el;
    }

    initYTAPI() {
        if (window.onYouTubeIframeAPIReady) return;

        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
            console.log('Chomka: YouTube API Ready');
            this.render();
        };
    }

    setBaseUrl(url) {
        this.baseUrl = url;
        this.render();
    }

    loadItems(items) {
        this.items = Array.isArray(items) ? items : [];
        this.render();
    }

    getItems() {
        return this.items;
    }

    addItem(item) {
        // Default zIndex if not set
        if (item.zIndex === undefined) item.zIndex = 1;

        // Smart Placement if position is missing
        if (item.x === undefined || item.y === undefined) {
            const size = this.getItemSize(item.type);
            const pos = this.findEmptyPosition(size.w, size.h);
            item.x = pos.x;
            item.y = pos.y;
        }

        this.items.push(item);
        this.render();
        this.saveState();
    }

    removeItem(id) {
        if (this.players[id]) {
            this.destroyPlayer(id);
        }
        this.items = this.items.filter(i => i.id !== id);
        this.render();
        this.saveState();
    }

    destroyPlayer(id) {
        if (this.players[id]) {
            try {
                this.stopTracking(id);
                this.players[id].destroy();
            } catch (e) {
                console.warn(`Chomka: Failed to destroy player ${id}`, e);
            }
            delete this.players[id];
        }
    }

    render() {
        if (!this.container) return;

        // Use a Set to track which item elements should stay
        const activeIds = new Set(this.items.map(i => i.id));

        // Remove elements that are no longer in items
        Array.from(this.container.children).forEach(el => {
            const id = el.dataset.id;
            if (!activeIds.has(id)) {
                if (this.players[id]) {
                    this.destroyPlayer(id);
                }
                el.remove();
            }
        });

        this.items.forEach(item => {
            let el = this.container.querySelector(`[data-id="${item.id}"]`);
            const isNew = !el;

            if (isNew) {
                el = document.createElement('div');
                el.dataset.id = item.id;
                this.container.appendChild(el);
            }

            el.className = `desktop-item item-${item.type}`;
            el.style.left = `${item.x}px`;
            el.style.top = `${item.y}px`;
            if (item.w) el.style.width = `${item.w}px`;
            if (item.h) el.style.height = `${item.h}px`;
            el.style.zIndex = item.zIndex || 1;
            el.style.position = 'absolute';

            if (item.isYTPinned) {
                el.classList.add('yt-pinned');
            } else {
                el.classList.remove('yt-pinned');
            }

            if (this.selectedItemId === item.id) {
                el.classList.add('selected-item');
            } else {
                el.classList.remove('selected-item');
            }

            // Context Menu Handler
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Don't trigger desktop menu
                const event = new CustomEvent('item-context-menu', {
                    detail: {
                        id: item.id,
                        x: e.clientX,
                        y: e.clientY
                    }
                });
                window.dispatchEvent(event);
            });

            // Add Resize Handles if applicable
            if (item.type === 'video' || item.type === 'note' || item.type === 'browser') {
                if (el.querySelectorAll('.resize-handle').length === 0) {
                    this.addResizeHandles(el, item);
                }
            }

            // Content based on type
            if (item.type === 'folder') {
                el.innerHTML = `
                    <div class="folder-icon">📁</div>
                    <div class="folder-name">${item.name}</div>
                `;
                el.onclick = (e) => {
                    if (!this.isDragging) {
                        // Dispatch event for main script to handle opening
                        const event = new CustomEvent('open-folder', { detail: { id: item.id } });
                        window.dispatchEvent(event);
                    }
                };
            } else if (item.type === 'video') {
                // YouTube Embed
                let videoId = '';
                try {
                    const urlStr = item.src;
                    if (urlStr.includes('v=')) {
                        videoId = urlStr.split('v=')[1].split('&')[0];
                    } else if (urlStr.includes('youtu.be/')) {
                        videoId = urlStr.split('youtu.be/')[1].split('?')[0];
                    } else if (urlStr.includes('/embed/')) {
                        videoId = urlStr.split('/embed/')[1].split('?')[0];
                    } else if (urlStr && urlStr.length === 11) {
                        videoId = urlStr; // Direct ID
                    }
                } catch (e) {
                    console.error("Chomka: Video ID extraction failed", e);
                }

                if (!videoId) {
                    el.innerHTML = `<div style="padding:20px; color:#ff4757; font-size:0.8rem;">Invalid YouTube URL</div>`;
                    this.container.appendChild(el);
                    return;
                }

                el.classList.add('note-link-card'); // Reuse container style
                el.style.width = '320px';
                el.style.height = '240px';

                // Sound Focus Indicator
                let indicator = el.querySelector('.audio-focus-indicator');
                if (this.unmutedPlayerId === item.id) {
                    el.classList.add('audio-focus');
                    if (!indicator) {
                        indicator = document.createElement('div');
                        indicator.className = 'audio-focus-indicator';
                        el.appendChild(indicator);
                    }
                    indicator.textContent = '🔊 AUDIO ON';
                } else {
                    el.classList.remove('audio-focus');
                    if (indicator) indicator.remove();
                }

                // YouTube Player Initialization
                if (isNew) {
                    // Pin Button (New v1.08)
                    const pinBtn = document.createElement('div');
                    pinBtn.className = `yt-pin-btn ${item.isYTPinned ? 'active' : ''}`;
                    pinBtn.innerHTML = '📌';
                    pinBtn.title = "Pin to Desktop (Always Visible)";
                    pinBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.toggleYTPin(item.id);
                        pinBtn.classList.toggle('active');
                        // Visual notification
                        if (window.notificationManager) {
                            window.notificationManager.notify("Pin Mode", item.isYTPinned ? "Pinned to Desktop Surface" : "Unpinned", "📌");
                        }
                    };
                    el.appendChild(pinBtn);

                    const playerContainer = document.createElement('div');
                    playerContainer.id = `yt-player-${item.id}`;
                    playerContainer.style.width = '100%';
                    playerContainer.style.height = '100%';
                    playerContainer.style.borderRadius = '8px';
                    playerContainer.style.overflow = 'hidden';
                    el.appendChild(playerContainer);

                    const statusOverlay = document.createElement('div');
                    statusOverlay.className = 'yt-status-overlay';
                    statusOverlay.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:white; font-size:0.8rem; pointer-events:none; background:rgba(0,0,0,0.5); padding:4px 8px; border-radius:4px;';
                    statusOverlay.textContent = 'Initializing...';
                    el.appendChild(statusOverlay);

                    // If already repaired, trigger the heavy lift of the proxy immediately
                    if (item.isRepaired && window.repairYT) {
                        setTimeout(() => window.repairYT(item.id), 50);
                    }
                }

                const player = this.players[item.id];
                const isReady = window.YT && window.YT.Player;
                const needsPlayer = !player || player === 'error';

                if (needsPlayer && isReady) {
                    this.players[item.id] = 'loading';
                    console.log(`Chomka: Initializing Player for ${item.id} (VideoId: ${videoId})`);

                    try {
                        this.players[item.id] = new YT.Player(`yt-player-${item.id}`, {
                            height: '100%',
                            width: '100%',
                            videoId: videoId,
                            host: 'https://www.youtube.com',
                            playerVars: {
                                'enablejsapi': 1,
                                'origin': window.location.origin === "null" ? "https://www.youtube.com" : window.location.origin,
                                'widget_referrer': 'https://www.youtube.com',
                                'start': item.lastTimestamp || 0,
                                'autoplay': 0,
                                'mute': (this.unmutedPlayerId && this.unmutedPlayerId !== item.id) ? 1 : 0,
                                'playsinline': 1,
                                'modestbranding': 1
                            },
                            events: {
                                'onReady': (event) => {
                                    const iframe = event.target.getIframe();
                                    if (iframe) iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

                                    const overlay = el.querySelector('.yt-status-overlay');
                                    if (overlay) overlay.textContent = 'Ready';
                                    setTimeout(() => { if (overlay) overlay.remove(); }, 1000);

                                    if (this.unmutedPlayerId === item.id) {
                                        event.target.unMute();
                                    } else if (this.unmutedPlayerId !== null) {
                                        event.target.mute();
                                    }
                                },
                                'onStateChange': (event) => {
                                    if (event.data === YT.PlayerState.PLAYING) {
                                        this.startTracking(item.id);
                                        if (this.unmutedPlayerId === null) {
                                            this.setAudioFocus(item.id);
                                        }
                                    }
                                    else this.stopTracking(item.id);
                                },
                                'onError': (e) => {
                                    console.error(`Chomka: YouTube Error for ${item.id}:`, e.data);
                                    this.players[item.id] = 'error';
                                    const overlay = el.querySelector('.yt-status-overlay');

                                    // Auto-Repair for Restrictions (150/153)
                                    if (e.data === 153 || e.data === 150) {
                                        console.log(`Chomka: Usage Restriction (${e.data}) detected for ${item.id}. Auto-repairing...`);
                                        if (window.repairYT) {
                                            window.repairYT(item.id);
                                        } else {
                                            if (overlay) {
                                                overlay.innerHTML = `
                                                    <div style="text-align:center;">
                                                        <div>Restricted Video (${e.data})</div>
                                                        <button class="yt-error-repair-btn" onclick="window.repairYT('${item.id}')">Repair</button>
                                                    </div>
                                                `;
                                                overlay.style.background = 'rgba(255,0,0,0.8)';
                                            }
                                        }
                                    } else if (overlay) {
                                        overlay.textContent = `Error: ${e.data}`;
                                        overlay.style.background = 'rgba(255,0,0,0.8)';
                                    }
                                }
                            }
                        });
                    } catch (e) {
                        console.error(`Chomka: Failed to create YT.Player for ${item.id}:`, e);
                        this.players[item.id] = 'error';
                    }
                } else if (needsPlayer && !isReady) {
                    console.log(`Chomka: API not ready for ${item.id}, waiting...`);
                }

                // Click to focus sound
                el.onclick = (e) => {
                    if (!this.isDragging && !this.isResizing) {
                        this.setAudioFocus(item.id);
                    }
                };
            } else if (item.type === 'note') {
                // Check if content is a URL
                const isUrl = item.text && (item.text.startsWith('http') || item.text.startsWith('www.'));
                const isEditing = item.isEditing;

                if (isUrl && !isEditing) {
                    // Link Card View
                    el.classList.add('note-link-card');

                    // Branded Icon Logic
                    let displayIcon = '🔗';
                    let lowText = item.text.toLowerCase();
                    if (lowText.includes('youtube.com') || lowText.includes('youtu.be')) {
                        displayIcon = `<img src="assets/youtube.png" class="branded-link-icon" style="width:24px; height:24px; vertical-align:middle; margin-right:5px;">`;
                    } else if (lowText.includes('discord.com')) {
                        displayIcon = `<img src="assets/discord.png" class="branded-link-icon" style="width:24px; height:24px; vertical-align:middle; margin-right:5px;">`;
                    } else if (lowText.includes('minecraft.wiki')) {
                        displayIcon = `<img src="assets/minecraft.png" class="branded-link-icon" style="width:24px; height:24px; vertical-align:middle; margin-right:5px;">`;
                    }

                    el.innerHTML = `
                        <div class="link-icon">${displayIcon}</div>
                        <div class="link-content" title="${item.text}">${item.text}</div>
                        <div class="link-actions">
                            <button class="link-btn-open" title="Open Link">Open</button>
                            <button class="link-btn-edit" title="Edit Link">✎</button>
                        </div>
                    `;

                    // Handlers
                    el.querySelector('.link-btn-open').onclick = (e) => {
                        e.stopPropagation();
                        if (window.openBrowser) {
                            window.openBrowser(item.text);
                        } else {
                            window.open(item.text, '_blank');
                        }
                    };
                    el.querySelector('.link-btn-edit').onclick = (e) => {
                        e.stopPropagation();
                        item.isEditing = true;
                        this.render();
                    };

                } else {
                    // Standard Note / Edit Mode
                    el.innerHTML = `
                        <textarea placeholder="Type note...">${item.text || ''}</textarea>
                        ${isUrl ? '<button class="note-btn-done" title="Done">✓</button>' : ''}
                    `;
                    const textarea = el.querySelector('textarea');

                    // Use a timer to debounce calls to saveState during typing
                    textarea.addEventListener('input', (e) => {
                        item.text = e.target.value;
                        if (this.typingTimer) clearTimeout(this.typingTimer);
                        this.typingTimer = setTimeout(() => {
                            this.saveState();
                        }, 500);
                    });

                    // If it was a URL being edited, allow switching back to view
                    if (isUrl) {
                        el.querySelector('.note-btn-done').onclick = (e) => {
                            e.stopPropagation();
                            item.isEditing = false;
                            this.render();
                        }
                    }
                }
            } else if (item.type === 'image' || item.type === 'gif') {
                const isLocal = item.src && item.src.startsWith('assets/');
                const fullSrc = isLocal ? (this.baseUrl + item.src) : item.src;
                el.innerHTML = `<img src="${fullSrc}" draggable="false">`;
            } else if (item.type === 'app') {
                // Branded App Shortcut
                el.classList.add('note-link-card', 'app-shortcut');

                // Branded Icon Logic for Apps
                let appIcon = item.iconUrl;
                let lowUrl = (item.url || "").toLowerCase();
                if (lowUrl.includes('youtube.com') || lowUrl.includes('youtu.be')) {
                    appIcon = 'assets/youtube.png';
                } else if (lowUrl.includes('discord.com')) {
                    appIcon = 'assets/discord.png';
                } else if (lowUrl.includes('minecraft.wiki')) {
                    appIcon = 'assets/minecraft.png';
                }

                el.innerHTML = `
                    <div class="app-icon-container">
                        ${appIcon ? `<img src="${appIcon}" draggable="false" class="app-icon" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=&quot;app-icon-placeholder&quot;>🌐</div>';">` : `<div class="app-icon-placeholder">🌐</div>`}
                    </div>
                    <div class="app-name">${item.name || item.title || 'App'}</div>
                    <div class="app-actions">
                        <button class="app-btn-open">Open</button>
                    </div>
                `;

                const openBtn = el.querySelector('.app-btn-open');

                // Prevent drag start on button
                openBtn.onmousedown = (e) => e.stopPropagation();

                openBtn.onclick = (e) => {
                    e.stopPropagation();
                    console.log(`Chomka: Clicked Open for ${item.name} (${item.url})`);

                    if (window.openBrowser) {
                        console.log('Chomka: Delegating to window.openBrowser');
                        window.openBrowser(item.url);
                    } else if (window.chomka && window.chomka.openNativeWindow) {
                        console.log('Chomka: Delegating to Native Bridge directly');
                        window.chomka.openNativeWindow(item.url);
                    } else {
                        console.log('Chomka: Fallback window.open');
                        window.open(item.url, '_blank');
                    }
                };
            }

            // Drag handlers
            el.addEventListener('mousedown', (e) => this.onMouseDown(e, item, el));

            this.container.appendChild(el);
        });
    }

    addResizeHandles(el, item) {
        const dirs = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
        dirs.forEach(dir => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-${dir}`;
            handle.onmousedown = (e) => this.onResizeStart(e, item, el, dir);
            el.appendChild(handle);
        });
    }

    onResizeStart(e, item, el, dir) {
        e.preventDefault();
        e.stopPropagation();
        this.isResizing = true;
        this.resizeItem = item;
        this.resizeElement = el;
        this.resizeDir = dir;
        this.resizeStart = {
            x: e.clientX,
            y: e.clientY,
            w: el.offsetWidth,
            h: el.offsetHeight,
            left: el.offsetLeft,
            top: el.offsetTop
        };

        document.addEventListener('mousemove', this.onResizeMove);
        document.addEventListener('mouseup', this.onResizeEnd);
    }

    onResizeMove = (e) => {
        if (!this.isResizing) return;
        const dx = e.clientX - this.resizeStart.x;
        const dy = e.clientY - this.resizeStart.y;
        let { left, top, w, h } = this.resizeStart;

        if (this.resizeDir.includes('e')) w += dx;
        if (this.resizeDir.includes('w')) { w -= dx; left += dx; }
        if (this.resizeDir.includes('s')) h += dy;
        if (this.resizeDir.includes('n')) { h -= dy; top += dy; }

        // Min constraints
        const minW = 150, minH = 100;
        if (w < minW) { if (this.resizeDir.includes('w')) left -= (minW - w); w = minW; }
        if (h < minH) { if (this.resizeDir.includes('n')) top -= (minH - h); h = minH; }

        this.applySizeAndPos(this.resizeElement, this.resizeItem, left, top, w, h);
    };

    onResizeEnd = () => {
        this.isResizing = false;
        this.saveState();
        document.removeEventListener('mousemove', this.onResizeMove);
        document.removeEventListener('mouseup', this.onResizeEnd);
    };

    applySizeAndPos(el, item, x, y, w, h) {
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
        item.x = x;
        item.y = y;
        item.w = w;
        item.h = h;
    }

    onMouseDown(e, item, el) {
        // Prevent drag on inputs/textareas unless holding a modifier key? 
        // For notes, maybe a drag handle is better. For now, click anywhere on item.
        if (e.target.tagName === 'TEXTAREA') return;

        this.isDragging = false; // Will be set to true on move
        this.dragItem = item;
        this.dragElement = el;

        const rect = el.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        e.preventDefault(); // Prevent text selection
    }

    onMouseMove = (e) => {
        if (!this.dragItem) return;
        this.isDragging = true;

        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;

        this.dragElement.style.left = `${x}px`;
        this.dragElement.style.top = `${y}px`;

        this.dragItem.x = x;
        this.dragItem.y = y;

        this.checkSnapping(e);
    };

    checkSnapping(e) {
        const threshold = 50;
        const barHeight = 48;
        const winW = window.innerWidth;
        const winH = window.innerHeight - barHeight;

        let snap = null;

        // Edge Snapping
        if (e.clientX < threshold) {
            if (e.clientY < threshold) snap = { x: 0, y: 0, w: winW / 2, h: winH / 2 }; // Top-Left
            else if (e.clientY > winH - threshold) snap = { x: 0, y: winH / 2, w: winW / 2, h: winH / 2 }; // Bottom-Left
            else snap = { x: 0, y: 0, w: winW / 2, h: winH }; // Left Half
        }
        else if (e.clientX > winW - threshold) {
            if (e.clientY < threshold) snap = { x: winW / 2, y: 0, w: winW / 2, h: winH / 2 }; // Top-Right
            else if (e.clientY > winH - threshold) snap = { x: winW / 2, y: winH / 2, w: winW / 2, h: winH / 2 }; // Bottom-Right
            else snap = { x: winW / 2, y: 0, w: winW / 2, h: winH }; // Right Half
        }
        else if (e.clientY < threshold) {
            snap = { x: 0, y: 0, w: winW, h: winH / 2 }; // Top Half
        }

        if (snap) {
            this.snapPreview.style.left = `${snap.x}px`;
            this.snapPreview.style.top = `${snap.y}px`;
            this.snapPreview.style.width = `${snap.w}px`;
            this.snapPreview.style.height = `${snap.h}px`;
            this.snapPreview.classList.add('active');
            this.activeSnap = snap;
        } else {
            this.snapPreview.classList.remove('active');
            this.activeSnap = null;
        }
    }

    onMouseUp = (e) => {
        if (this.dragItem) {
            if (this.activeSnap) {
                const s = this.activeSnap;
                this.dragElement.classList.add('is-snapping');
                this.applySizeAndPos(this.dragElement, this.dragItem, s.x, s.y, s.w, s.h);
                setTimeout(() => {
                    if (this.dragElement) this.dragElement.classList.remove('is-snapping');
                }, 300);
                this.snapPreview.classList.remove('active');
                this.activeSnap = null;
            }
            // Check if dropped onto a folder
            const droppedOnFolder = this.items.find(i =>
                i.type === 'folder' &&
                i.id !== this.dragItem.id &&
                e.clientX > i.x && e.clientX < i.x + 100 &&
                e.clientY > i.y && e.clientY < i.y + 100
            );

            if (droppedOnFolder && this.dragItem.type !== 'folder') {
                // Add to folder
                if (!droppedOnFolder.tabs) droppedOnFolder.tabs = [];

                let title = this.dragItem.name || this.dragItem.text || 'Item';
                if (title.length > 20) title = title.substring(0, 20) + '...';

                droppedOnFolder.tabs.push({
                    type: this.dragItem.type === 'image' ? 'image' : 'link',
                    url: this.dragItem.src || this.dragItem.text || this.dragItem.url,
                    title: title
                });

                // Remove from desktop
                this.items = this.items.filter(i => i.id !== this.dragItem.id);

                if (window.notificationManager) {
                    window.notificationManager.notify("Folder", `Added item to "${droppedOnFolder.name}"`, "📁");
                }
            }

            this.saveState();
            this.render();
        }
        this.dragItem = null;
        this.dragElement = null;
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);

        // Small delay to prevent clearing isDragging before click event fires
        setTimeout(() => { this.isDragging = false; }, 100);
    };

    initEventListeners() {
        // Context menu integration could go here
    }

    changeZIndex(id, delta) {
        const item = this.items.find(i => i.id === id);
        if (item) {
            item.zIndex = (item.zIndex || 1) + delta;
            // Prevent going below 0 or crazy high, but keeping it flexible
            // UI is at 100+, so keep below 100 ideally, but user might want overlap.
            // Let's not hard limit, but UI should be safe at 1000 if we move it up.
            // Actually style.css toolbelt is 100.
            this.render();
            this.saveState();
        }
    }

    deleteItem(id) {
        this.items = this.items.filter(i => i.id !== id);
        this.render();
        this.saveState();
    }

    saveState() {
        const event = new CustomEvent('save-desktop', { detail: { items: this.items } });
        window.dispatchEvent(event);
    }

    selectItem(id) {
        this.selectedItemId = id;
        // Also bring to front when selected
        if (id && window.chomkaZIndex) {
            const item = this.items.find(i => i.id === id);
            if (item) {
                item.zIndex = window.chomkaZIndex++;
            }
        }
        this.render();
    }

    showLayerManager() {
        const layers = this.items.map(i => ({
            id: i.id,
            name: i.name || i.text || i.type,
            zIndex: i.zIndex || 1
        })).sort((a, b) => b.zIndex - a.zIndex);

        const html = `
            <div class="layer-manager-list" style="max-height: 400px; overflow-y: auto; padding: 10px;">
                ${layers.map(l => `
                    <div class="layer-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid rgba(255,255,255,0.1);">
                        <span style="font-size:0.9rem;">${l.name}</span>
                        <div class="layer-btns">
                            <button onclick="desktopManager.changeZIndex('${l.id}', 1); desktopManager.showLayerManager();" style="cursor:pointer; padding:2px 8px;">↑</button>
                            <button onclick="desktopManager.changeZIndex('${l.id}', -1); desktopManager.showLayerManager();" style="cursor:pointer; padding:2px 8px;">↓</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <p style="font-size:0.7rem; color:rgba(255,255,255,0.5); padding:10px;">Higher items overlap lower items.</p>
        `;

        if (window.showModal) {
            window.showModal('Z-Index Master', html);
        }
    }

    moveSelectedItem(dx, dy) {
        const item = this.items.find(i => i.id === this.selectedItemId);
        if (item) {
            item.x += dx;
            item.y += dy;
            this.render();
            this.saveState();
        }
    }

    getItemSize(type) {
        // Approximations based on CSS
        if (type === 'folder') return { w: 100, h: 100 };
        if (type === 'note') return { w: 220, h: 200 }; // Including padding/shadow
        if (type === 'image' || type === 'gif') return { w: 220, h: 220 }; // Max width + margin
        if (type === 'video') return { w: 320, h: 240 };
        return { w: 100, h: 100 };
    }

    findEmptyPosition(w, h) {
        const padding = 20;
        const gridStep = 20;
        const maxCols = Math.floor((window.innerWidth - w) / gridStep);
        const maxRows = Math.floor((window.innerHeight - h) / gridStep);

        // Start looking from top-left, with some margin
        for (let r = 2; r < maxRows; r++) {
            for (let c = 2; c < maxCols; c++) {
                const x = c * gridStep;
                const y = r * gridStep;

                if (!this.checkCollision(x, y, w, h)) {
                    return { x, y };
                }
            }
        }

        // Fallback: Random slight offset if full
        return { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 };
    }

    checkCollision(x, y, w, h) {
        const margin = 10; // Extra breathing room

        for (const item of this.items) {
            const size = this.getItemSize(item.type);

            // Check intersection logic
            if (x < item.x + size.w + margin &&
                x + w + margin > item.x &&
                y < item.y + size.h + margin &&
                y + h + margin > item.y) {
                return true; // Overlap detected
            }
        }
        return false;
    }
    toggleYTPin(id) {
        const item = this.items.find(i => i.id === id);
        if (item) {
            item.isYTPinned = !item.isYTPinned;
            this.render();
            this.saveState();
        }
    }

    startTracking(id) {
        if (this.tracks && this.tracks[id]) return;
        if (!this.tracks) this.tracks = {};

        this.tracks[id] = setInterval(() => {
            const player = this.players[id];
            const item = this.items.find(i => i.id === id);
            if (player && player.getCurrentTime && item) {
                item.lastTimestamp = Math.floor(player.getCurrentTime());
            }
        }, 5000);
    }

    stopTracking(id) {
        if (this.tracks && this.tracks[id]) {
            clearInterval(this.tracks[id]);
            delete this.tracks[id];
            this.saveState();
        }
    }

    saveAllTimestamps() {
        Object.keys(this.players).forEach(id => {
            const player = this.players[id];
            const item = this.items.find(i => i.id === id);
            if (player && player.getCurrentTime && item) {
                item.lastTimestamp = Math.floor(player.getCurrentTime());
            }
        });
        this.saveState();
    }

    setAudioFocus(id) {
        if (this.unmutedPlayerId === id) return;

        this.unmutedPlayerId = id;
        Object.keys(this.players).forEach(pId => {
            const player = this.players[pId];
            if (player && player.mute && player.unMute) {
                if (pId === id) {
                    player.unMute();
                    player.setVolume(100);
                } else {
                    player.mute();
                }
            }
        });
        this.render();
    }

    pinRandomFromPlaylist(folderName) {
        // 1. Find the folder
        const folder = this.items.find(i => i.type === 'folder' && i.name.toLowerCase() === folderName.toLowerCase());

        if (!folder) {
            alert(`Folder "${folderName}" not found! Make sure you created a folder with this name.`);
            return;
        }

        const videos = (folder.tabs || []).filter(t => {
            const isYT = t.url && (t.url.includes('youtube.com') || t.url.includes('youtu.be'));
            return isYT;
        });

        if (videos.length === 0) {
            alert(`No YouTube videos found in folder "${folder.name}".`);
            return;
        }

        // 2. Unpin current videos (remove type 'video' items that have a source)
        // But keep the manual ones if they are pinned... 
        // Actually, let's just clear all currently 'pinned' videos on the desktop
        this.items = this.items.filter(i => i.type !== 'video' || !i.isPinnedByPlaylist);

        // 3. Shuffle and pick 3
        const shuffled = videos.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);

        // 4. Add to desktop with special flag
        selected.forEach((v, idx) => {
            this.addItem({
                id: `v-playlist-${Date.now()}-${idx}`,
                type: 'video',
                src: v.url,
                isPinnedByPlaylist: true,
                x: 100 + (idx * 340),
                y: 100
            });
        });

        this.render();
        this.saveState();
        alert(`Shuffled playlist "${folder.name}"!`);
    }

    spawnTopMusicFolder() {
        const folderName = "Top Pop 2025";
        const existingFolder = this.items.find(i => i.type === 'folder' && i.name === folderName);

        if (existingFolder) {
            alert(`"${folderName}" folder already exists on your desktop!`);
            const event = new CustomEvent('open-folder', { detail: { id: existingFolder.id } });
            window.dispatchEvent(event);
            return;
        }

        const topHits = [
            { title: "The Weeknd - Blinding Lights", url: "https://www.youtube.com/watch?v=4NRXx6U8ABQ" },
            { title: "Dua Lipa - Levitating", url: "https://www.youtube.com/watch?v=TUVcZfQe-Kw" },
            { title: "Lofi Girl - Study Session", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk" },
            { title: "Taylor Swift - Anti-Hero", url: "https://www.youtube.com/watch?v=b1kbLwvqugk" }
        ];

        const folderId = `folder-music-${Date.now()}`;
        const newFolder = {
            id: folderId,
            type: 'folder',
            name: folderName,
            tabs: topHits,
            x: 100,
            y: 100
        };

        this.addItem(newFolder);
        this.saveState();

        // Open it immediately
        const event = new CustomEvent('open-folder', { detail: { id: folderId } });
        window.dispatchEvent(event);

        if (window.notificationManager) {
            window.notificationManager.notify("Featured Music", "Created a new folder with Top Pop hits! 🎵", "⭐");
        }
    }
}

window.DesktopManager = DesktopManager;
