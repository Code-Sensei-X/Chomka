import webview
import os
import sys

import json
from concurrent.futures import ThreadPoolExecutor
import threading
import datetime
import traceback
from lifecycle import LifecycleManager

CONFIG_FILE = 'config.json'
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

class Api:
    def __init__(self, window=None, is_test_mode=False):
        self._window = window
        self.is_test_mode = is_test_mode
        self.config = self._load_config()
        self.is_saving_and_quitting = False
        self._executor = ThreadPoolExecutor(max_workers=1)
        self._lifecycle = LifecycleManager(self)
        self._log_file = os.path.join(self._get_share_dir(), "chomka.log")
        
        mode_str = " (TEST MODE)" if is_test_mode else ""
        self.log(f"Chomka: Session started (v1.14b){mode_str}")

    def show_notification(self, title, message):
        """Triggers a native Windows toast notification via PowerShell."""
        import subprocess
        # Clean inputs for PowerShell safety
        title_safe = title.replace("'", "''")
        msg_safe = message.replace("'", "''")
        
        ps_script = f"""
        $title = '{title_safe}'
        $msg = '{msg_safe}'
        [reflection.assembly]::loadwithpartialname('System.Windows.Forms') | Out-Null
        $toast = New-Object System.Windows.Forms.NotifyIcon
        $toast.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon([System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName)
        $toast.BalloonTipTitle = $title
        $toast.BalloonTipText = $msg
        $toast.Visible = $true
        $toast.ShowBalloonTip(5000)
        # Give it a tiny bit of time to display before cleanup (async shell call anyway)
        Start-Sleep -Seconds 1
        $toast.Dispose()
        """
        try:
            subprocess.Popen(["powershell", "-WindowStyle", "Hidden", "-Command", ps_script], 
                             creationflags=subprocess.CREATE_NO_WINDOW)
            self.log(f"[Notification] Native trigger: {title}")
        except Exception as e:
            self.log(f"[Notification] Failed to trigger native: {e}", "ERROR")

    @property
    def lifecycle(self):
        return self._lifecycle

    def _load_config(self):
        try:
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, 'r') as f:
                    return json.load(f)
            else:
                # First run: Create default config
                default_config = {"data_dir": "shared_data"}
                self.config = default_config
                self._save_config()
                self.log("Created initial config.json")
                return default_config
        except Exception as e:
            print(f"Config load error: {e}")
        return {"data_dir": "shared_data"}

    def _save_config(self):
        with open(CONFIG_FILE, 'w') as f:
            json.dump(self.config, f)

    def log(self, message, level="INFO"):
        """Diagnostic logger that writes to a file."""
        try:
            share_dir = self._get_share_dir()
            if not os.path.exists(share_dir):
                os.makedirs(share_dir)
            log_path = os.path.join(share_dir, "chomka.log")
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            with open(log_path, "a", encoding='utf-8') as f:
                f.write(f"[{timestamp}] [{level}] {message}\n")
            print(f"[{level}] {message}")
        except:
            pass

    def _get_share_dir(self):
        """Helper to get the absolute path to the data directory."""
        share_dir = self.config.get("data_dir", "shared_data")
        if not os.path.isabs(share_dir):
            share_dir = os.path.join(os.getcwd(), share_dir)
        return share_dir

    def choose_folder(self):
        """Allows user to pick a custom directory for data."""
        if not self._window:
            return {'success': False, 'error': 'Window not ready'}
            
        result = self._window.create_file_dialog(webview.FOLDER_DIALOG)
        if result and len(result) > 0:
            new_path = result[0]
            self.config["data_dir"] = new_path
            self._save_config()
            return {'success': True, 'path': new_path}
        
        return {'success': False, 'error': 'No folder selected'}

    def save_file(self, filename, content, sync=False):
        """Saves a file to the chosen data directory."""
        future = self._executor.submit(self._save_file_internal, filename, content, not sync)
        if sync:
            try:
                return future.result(timeout=10) # 10s safety timeout
            except Exception as e:
                return {'success': False, 'error': f"Save timed out or failed: {e}"}
        return {'success': True, 'queued': True}

    def save_asset(self, base64_data, original_id):
        """Saves a base64 asset via the executor to maintain serial order."""
        future = self._executor.submit(self._save_asset_internal, base64_data, original_id)
        try:
            return future.result(timeout=30) # Assets can be large
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _save_asset_internal(self, base64_data, original_id):
        """Worker method for saving assets."""
        try:
            import base64
            import uuid
            
            # Extract file extension from data URI
            ext = "bin"
            if "," in base64_data:
                header, base64_data = base64_data.split(",", 1)
                if "/" in header and ";" in header:
                    ext = header.split("/")[1].split(";")[0]

            share_dir = self._get_share_dir()
            assets_dir = os.path.join(share_dir, "assets")
            if not os.path.exists(assets_dir):
                os.makedirs(assets_dir)

            filename = f"{original_id}_{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join(assets_dir, filename)
            
            with open(filepath, "wb") as f:
                f.write(base64.b64decode(base64_data))
            
            self.log(f"Asset saved: {filename}")
            return {'success': True, 'path': f"assets/{filename}"}
        except Exception as e:
            err_details = traceback.format_exc()
            self.log(f"Asset save error: {e}\n{err_details}", "ERROR")
            return {'success': False, 'error': str(e)}

    def pick_and_save_image(self):
        """Allows user to pick an image from Windows and saves it to local assets."""
        if not self._window:
            return {'success': False, 'error': 'Window not ready'}
            
        file_types = ('Image Files (*.jpg;*.jpeg;*.png;*.gif)', 'All files (*.*)')
        result = self._window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        
        if result and len(result) > 0:
            src_path = result[0]
            try:
                import shutil
                import uuid
                
                ext = os.path.splitext(src_path)[1]
                share_dir = self._get_share_dir()
                assets_dir = os.path.join(share_dir, "assets")
                if not os.path.exists(assets_dir):
                    os.makedirs(assets_dir)
                
                new_filename = f"user_{uuid.uuid4().hex}{ext}"
                dest_path = os.path.join(assets_dir, new_filename)
                
                shutil.copy2(src_path, dest_path)
                self.log(f"Image picked and saved: {new_filename}")
                return {'success': True, 'path': f"assets/{new_filename}"}
            except Exception as e:
                self.log(f"Image pick/save error: {e}", "ERROR")
                return {'success': False, 'error': str(e)}
        
        return {'success': False, 'error': 'Cancelled'}

    def get_data_url(self):
        """Returns the absolute file:// URL to the data directory."""
        path = self._get_share_dir()
        return f"file:///{path.replace('\\', '/')}/"


    def log_js_error(self, message, stack=""):
        """Called from JS to log client-side errors."""
        self.log(f"JS Error: {message}\nStack: {stack}", "JS_ERROR")
        return {'success': True}

    def _write_atomic(self, filepath, content, is_binary=False):
        """Writes a file atomically by using a temporary file."""
        temp_path = filepath + ".tmp"
        try:
            mode = 'wb' if is_binary else 'w'
            encoding = None if is_binary else 'utf-8'
            with open(temp_path, mode, encoding=encoding) as f:
                f.write(content)
            
            # Atomic swap
            if os.path.exists(filepath):
                os.replace(temp_path, filepath)
            else:
                os.rename(temp_path, filepath)
        except Exception as e:
            self.log(f"Atomic write error for {filepath}: {e}", "ERROR")
            if os.path.exists(temp_path):
                try: os.remove(temp_path)
                except: pass
            raise e

    def _save_file_internal(self, filename, content, notify_js=True):
        """Internal synchronous save method run in the executor thread."""
        try:
            share_dir = self._get_share_dir()
            filepath = os.path.join(share_dir, filename)
            
            # Ensure parent directory exists (e.g. saves/screenlayout.txt)
            parent_dir = os.path.dirname(filepath)
            if not os.path.exists(parent_dir):
                os.makedirs(parent_dir)
            
            self._write_atomic(filepath, content)
            
            content_snippet = (content[:50] + '...') if len(content) > 50 else content
            self.log(f"File saved: {filename} (size: {len(content)} bytes, snippet: {content_snippet})")
            if notify_js and self._window:
                try:
                    self._window.evaluate_js(f'onSaveComplete("{filename}")')
                except Exception as eval_err:
                    self.log(f"Bridge error (onSaveComplete): {eval_err}", "WARNING")
            return {'success': True, 'path': filepath}
        except Exception as e:
            err_details = traceback.format_exc()
            self.log(f"Error saving file {filename}: {e}\n{err_details}", "ERROR")
            if notify_js and self._window:
                try:
                    err_msg = str(e).replace('"', '\\"').replace('\n', '\\n')
                    self._window.evaluate_js(f'onSaveError("{filename}", "{err_msg}")')
                except Exception as eval_err:
                    self.log(f"Bridge error (onSaveError): {eval_err}", "WARNING")
            return {'success': False, 'error': str(e)}


    def read_file(self, filename):
        """Reads a file and merges with coords.txt if it's desktop.json."""
        try:
            share_dir = self._get_share_dir()
            filepath = os.path.join(share_dir, filename)
            
            content = None
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
            
            
            if content is not None:
                return content

            # Fallback to root for things like readme.txt
            root_path = os.path.join(os.getcwd(), filename)
            if os.path.exists(root_path):
                with open(root_path, 'r', encoding='utf-8') as f:
                    return f.read()
            
            return None
        except Exception as e:
            print(f"Error reading file {filename}: {e}")
            return None

    def _merge_coords(self, items):
        """Merges coordinates from coords.txt into the items list."""
        try:
            share_dir = self._get_share_dir()
            coords_path = os.path.join(share_dir, "screenlayout.txt")
            if os.path.exists(coords_path):
                coords_map = {}
                with open(coords_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        if ':' in line:
                            parts = line.strip().split(':')
                            if len(parts) == 2:
                                cid, cpos = parts
                                if ',' in cpos:
                                    x, y = cpos.split(',')
                                    coords_map[cid] = {'x': int(float(x)), 'y': int(float(y))}
                
                # Apply to items
                if isinstance(items, list):
                    for item in items:
                        if item.get('id') in coords_map:
                            pos = coords_map[item['id']]
                            item['x'] = pos['x']
                            item['y'] = pos['y']
            return items
        except Exception as e:
            print(f"Error merging coords: {e}")
            return items

    def _save_coords_file(self, items):
        """Saves coordinates to coords.txt."""
        try:
            if not isinstance(items, list): return
            
            share_dir = self._get_share_dir()
            coords_path = os.path.join(share_dir, "screenlayout.txt")
            
            lines = []
            for item in items:
                if 'id' in item and 'x' in item and 'y' in item:
                    lines.append(f"{item['id']}:{item['x']},{item['y']}")
            
            with open(coords_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
        except Exception as e:
            print(f"Error saving coords.txt: {e}")

    def get_state(self, key):
        """Reads a bit of app state."""
        if key == 'is_test_mode':
            return {'success': True, 'value': self.is_test_mode}
        try:
            share_dir = self._get_share_dir()
            config_path = os.path.join(share_dir, "config.json")
            if os.path.exists(config_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    val = data.get(key)
                    
                    # SPECIAL HANDLING: if requesting desktop_items, merge screenlayout.txt
                    if key == 'desktop_items' and isinstance(val, list):
                        val = self._merge_coords(val)
                        
                    return {'success': True, 'value': val}
            return {'success': True, 'value': None}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def save_state(self, key, value):
        """Saves a bits of app state to config.json atomically."""
        try:
            share_dir = self._get_share_dir()
            config_path = os.path.join(share_dir, "config.json")
            
            data = {}
            if os.path.exists(config_path):
                try:
                    with open(config_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                except: pass
            
            data[key] = value
            self._write_atomic(config_path, json.dumps(data, indent=4))
            
            # SPECIAL HANDLING: Sync coords to screenlayout.txt
            if key == 'desktop_items':
                self._save_coords_file(value)
                
            self.log(f"State saved: {key}")
            return {'success': True}
        except Exception as e:
            self.log(f"State save error: {e}", "ERROR")
            return {'success': False, 'error': str(e)}

    def send_feedback(self, message):
        """Opens the default mail client with feedback."""
        try:
            import webbrowser
            import urllib.parse
            
            recipient = "crabisoftcompany@gmail.com"
            subject = "Chomka Feedback"
            body = message
            
            # Construct mailto link
            params = {
                "subject": subject,
                "body": body
            }
            query_string = urllib.parse.urlencode(params)
            mailto_link = f"mailto:{recipient}?{query_string}"
            
            webbrowser.open(mailto_link)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def open_native_window(self, url):
        """Opens a URL in a new native window for compatibility."""
        try:
            # Handle case where URL might be passed as a state object/dict
            if isinstance(url, dict) and 'value' in url:
                url = url['value']
            
            if not isinstance(url, str):
                self.log(f"Invalid URL type received in open_native_window: {type(url)}", "ERROR")
                return {'success': False, 'error': 'Invalid URL type'}

            self.log(f"Opening native window for: {url}")
            # Track as last YT URL if applicable
            if 'youtube.com' in url.lower() or 'youtu.be' in url.lower():
                self.save_state('last_yt_url', url)
                
            webview.create_window('Chomka WebOS External', url)
            return {'success': True}
        except Exception as e:
            self.log(f"Error opening native window: {e}", "ERROR")
            return {'success': False, 'error': str(e)}

    def set_shutdown_flag(self, value):
        """Allows JS to signal that a graceful shutdown is in progress."""
        self.is_saving_and_quitting = value
        self.log(f"Shutdown flag set to: {value}")

    def quit(self):
        self.is_saving_and_quitting = True
        try: self._executor.shutdown(wait=False)
        except: pass
        self._lifecycle.shut_down_immediately()

    def quit_finally(self):
        self.is_saving_and_quitting = True
        try: self._executor.shutdown(wait=False)
        except: pass
        self._lifecycle.shut_down_immediately()

    def confirm_quit(self):
        if not self._window: return True
        return self._window.create_confirmation_dialog('Unsaved Changes', 'Do you want to save your progress before exiting?')

    def hook_closing(self, window):
        window.events.closing += self._lifecycle.on_closing

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Chomka WebOS Launcher")
    parser.add_argument('--test', '--debug', action='store_true', help="Run in test mode with DevTools enabled")
    args, unknown = parser.parse_known_args()
    
    is_test = args.test

    try:
        # Get absolute path to index.html
        if getattr(sys, 'frozen', False):
            base_path = sys._MEIPASS
        else:
            base_path = os.getcwd()
            
        html_path = os.path.join(base_path, "index.html")
        icon_path = os.path.join(base_path, "sakura.png")
        file_url = f"file://{html_path}"
        
        api = Api(is_test_mode=is_test)
        
        window = webview.create_window(
            'Chomka WebOS' + (" [TEST MODE]" if is_test else ""), 
            file_url, 
            js_api=api,
            width=1280, 
            height=800,
            resizable=True,
            min_size=(800, 600)
        )
        
        api._window = window 
        api.hook_closing(window)
        
        # Start webview
        api.log(f"Chomka: Starting webview (debug={is_test})")
        webview.start(debug=is_test)
        api.log("Chomka: Webview loop ended")
        
    except Exception as e:
        import traceback
        err = traceback.format_exc()
        try:
            # Emergency log
            with open("chomka_crash.log", "a") as f:
                f.write(f"CRITICAL CRASH: {e}\n{err}\n")
        except: pass
        sys.exit(1)

if __name__ == '__main__':
    main()
