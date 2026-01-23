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
    }

    setBaseUrl(url) {
        this.baseUrl = url;
        this.render();
    }

    loadItems(items) {
        this.items = items || [];
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
    }

    removeItem(id) {
        this.items = this.items.filter(i => i.id !== id);
        this.render();
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        this.items.forEach(item => {
            const el = document.createElement('div');
            el.className = `desktop-item item-${item.type}`;
            el.dataset.id = item.id;
            el.style.left = `${item.x}px`;
            el.style.top = `${item.y}px`;
            el.style.zIndex = item.zIndex || 1;

            if (this.selectedItemId === item.id) {
                el.classList.add('selected-item');
            }

            el.style.position = 'absolute';

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
                if (item.src.includes('v=')) {
                    videoId = item.src.split('v=')[1].split('&')[0];
                } else if (item.src.includes('youtu.be/')) {
                    videoId = item.src.split('youtu.be/')[1].split('?')[0];
                } else if (item.src.includes('/embed/')) {
                    videoId = item.src.split('/embed/')[1].split('?')[0];
                } else {
                    videoId = item.src; // Assume ID if no URL pattern matched
                }

                el.classList.add('note-link-card'); // Reuse container style
                el.style.width = '320px';
                el.style.height = '240px';
                el.innerHTML = `
                    <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" 
                        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen style="border-radius:8px;"></iframe>
                `;
            } else if (item.type === 'note') {
                // Check if content is a URL
                const isUrl = item.text && (item.text.startsWith('http') || item.text.startsWith('www.'));
                const isEditing = item.isEditing;

                if (isUrl && !isEditing) {
                    // Link Card View
                    el.classList.add('note-link-card');
                    el.innerHTML = `
                        <div class="link-icon">🔗</div>
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
            }

            // Drag handlers
            el.addEventListener('mousedown', (e) => this.onMouseDown(e, item, el));

            this.container.appendChild(el);
        });
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

        // Optional: Real-time coord update (throttle recommended)
        // window.chomka.updateCoords(this.dragItem.id, x, y);
    };

    onMouseUp = () => {
        if (this.dragItem) {
            // Save ONLY coordinates to the fast .txt file
            if (window.chomka && window.chomka.updateCoords) {
                window.chomka.updateCoords(this.dragItem.id, this.dragItem.x, this.dragItem.y);
            }
            // We don't call saveState() here anymore to avoid bridge flooding with heavy JSON
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
        this.render();
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
}

window.DesktopManager = DesktopManager;
