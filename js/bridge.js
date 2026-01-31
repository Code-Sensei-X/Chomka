// Chomka Native Bridge & Safety Wrapper
// This file MUST be loaded before any other Chomka scripts.

window.chomka = window.chomka || {};

window.chomkaSafe = {
    log: (msg, level = 'INFO') => {
        if (window.chomka && window.chomka.log) window.chomka.log(msg, level);
        else console.log(`[Bridge-Local] [${level}] ${msg}`);
    },
    logError: (msg, stack = '') => {
        if (window.chomka && window.chomka.logError) window.chomka.logError(msg, stack);
        else console.error(`[Bridge-Local] [ERROR] ${msg}`, stack);
    },
    getState: async (key) => {
        if (window.chomka && window.chomka.getState) return await window.chomka.getState(key);
        return null;
    }
};

window.onerror = function (message, source, lineno, colno, error) {
    const stack = error ? error.stack : '';
    window.chomkaSafe.logError(message, stack);
};

window.onunhandledrejection = function (event) {
    window.chomkaSafe.logError('Unhandled Promise Rejection: ' + event.reason, event.reason ? event.reason.stack : '');
};

// Simple Bridge Init (to be expanded in script.js if needed, or kept here)
// Simple Bridge Init
window.chomka.init = function () {
    if (this._bridgeReadyPromise) return this._bridgeReadyPromise;

    this._bridgeReadyPromise = new Promise((resolve) => {
        if (window.pywebview) {
            this._bridgeReady = true;
            resolve();
        } else {
            window.addEventListener('pywebviewready', () => {
                this._bridgeReady = true;
                console.log('Chomka Native Bridge Ready (Event)');
                resolve();
            });
            setTimeout(() => {
                if (!this._bridgeReady) {
                    console.warn('Chomka Bridge Init Timeout - Falling back to browser mode');
                    resolve();
                }
            }, 5000);
        }
    });
    return this._bridgeReadyPromise;
};

// --- Bridge Methods ---
Object.assign(window.chomka, {
    saveFile: async function (filename, content, sync = false) {
        if (window.pywebview) {
            try {
                if (sync) return await window.pywebview.api.save_file_sync(filename, content);
                return await window.pywebview.api.save_file(filename, content);
            } catch (e) {
                console.error("Bridge Error: saveFile", e);
                return { success: false, error: e.toString() };
            }
        } else {
            console.warn('Native API not available. Simulating download fallback.');
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
                console.error("Bridge Error: readFile", e);
                return null;
            }
        }
        return null;
    },

    saveState: async function (key, value) {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.save_state(key, value);
            } catch (e) {
                console.error("Bridge Error: saveState", e);
                return { success: false };
            }
        }
        return { success: false };
    },

    getState: async function (key) {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.get_state(key);
            } catch (e) {
                console.error("Bridge Error: getState", e);
                return null;
            }
        }
        return null;
    },

    saveAsset: async function (base64, suggestedName) {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.save_asset(base64, suggestedName);
            } catch (e) {
                console.error("Bridge Error: saveAsset", e);
                return { success: false };
            }
        }
        return { success: true, path: base64 };
    },

    getDataUrl: async function () {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.get_data_url();
            } catch (e) {
                console.error("Bridge Error: getDataUrl", e);
                return "";
            }
        }
        return "";
    },

    log: function (message, level = "INFO") {
        console.log(`[${level}] ${message}`);
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.log(message, level);
        }
    },

    logError: function (message, stack) {
        console.error(`[CRITICAL] ${message}\n${stack}`);
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.log_js_error(message, stack);
        }
    },

    chooseFolder: async function () {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.choose_folder();
            } catch (e) {
                console.error("Bridge Error: chooseFolder", e);
                return null;
            }
        }
        return null;
    },

    pickAndSaveImage: async function () {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.pick_and_save_image();
            } catch (e) {
                console.error("Bridge Error: pickAndSaveImage", e);
                return null;
            }
        } else {
            return new Promise((resolve) => {
                if (window.triggerFileUpload) {
                    window.triggerFileUpload((base64) => {
                        resolve({ success: true, path: base64, isBase64: true });
                    });
                } else {
                    resolve({ success: false, error: 'Upload trigger missing' });
                }
            });
        }
    },

    sendFeedback: async function (message) {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.send_feedback(message);
            } catch (e) {
                console.error("Bridge Error: sendFeedback", e);
                return { success: false, error: e.toString() };
            }
        }
        return { success: false };
    },

    openNativeWindow: async function (url) {
        if (window.pywebview) {
            try {
                return await window.pywebview.api.open_native_window(url);
            } catch (e) {
                console.error("Bridge Error: openNativeWindow", e);
                return { success: false, error: e.toString() };
            }
        } else {
            window.open(url, '_blank');
            return { success: true };
        }
    }
});
