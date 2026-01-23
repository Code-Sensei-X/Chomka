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

class Api:
    def __init__(self, window=None):
        self.window = window
        self.config = self._load_config()
        self.is_saving_and_quitting = False
        self._executor = ThreadPoolExecutor(max_workers=1)
        self.lifecycle = LifecycleManager(self)
        self._log_file = os.path.join(self._get_share_dir(), "chomka.log")
        self.log("Chomka: Session started")

    def _load_config(self):
        try:
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, 'r') as f:
                    return json.load(f)
        except Exception:
            pass
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
        if not self.window:
            return {'success': False, 'error': 'Window not ready'}
            
        result = self.window.create_file_dialog(webview.FOLDER_DIALOG)
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

    def get_data_url(self):
        """Returns the absolute file:// URL to the data directory."""
        path = self._get_share_dir()
        return f"file:///{path.replace('\\', '/')}/"

    def update_coords(self, item_id, x, y):
        """Ultra-fast coordinate update for frequent drags."""
        self._executor.submit(self._update_coords_internal, item_id, x, y)
        return {'success': True}

    def _update_coords_internal(self, item_id, x, y):
        """Updates the coords.txt file (simple key:value format)."""
        try:
            share_dir = self._get_share_dir()
            coord_file = os.path.join(share_dir, "coords.txt")
            
            # Read existing coords
            coords = {}
            if os.path.exists(coord_file):
                try:
                    with open(coord_file, 'r') as f:
                        for line in f:
                            if ':' in line:
                                k, v = line.strip().split(':', 1)
                                coords[k] = v
                except: pass
            
            # Update specific item
            coords[item_id] = f"{int(x)},{int(y)}"
            
            # Write back
            with open(coord_file, 'w') as f:
                for k, v in coords.items():
                    f.write(f"{k}:{v}\n")
                    
        except Exception as e:
            print(f"Chomka: Coord save error: {e}")

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
            if not os.path.exists(share_dir):
                os.makedirs(share_dir)
            
            filepath = os.path.join(share_dir, filename)
            self._write_atomic(filepath, content)
            
            self.log(f"File saved: {filename}")
            if notify_js and self.window:
                try:
                    self.window.evaluate_js(f'onSaveComplete("{filename}")')
                except Exception as eval_err:
                    self.log(f"Bridge error (onSaveComplete): {eval_err}", "WARNING")
            return {'success': True, 'path': filepath}
        except Exception as e:
            err_details = traceback.format_exc()
            self.log(f"Error saving file {filename}: {e}\n{err_details}", "ERROR")
            if notify_js and self.window:
                try:
                    err_msg = str(e).replace('"', '\\"').replace('\n', '\\n')
                    self.window.evaluate_js(f'onSaveError("{filename}", "{err_msg}")')
                except Exception as eval_err:
                    self.log(f"Bridge error (onSaveError): {eval_err}", "WARNING")
            return {'success': False, 'error': str(e)}

    def _update_coords_internal(self, item_id, x, y):
        """Updates the coords.txt file atomically."""
        try:
            share_dir = self._get_share_dir()
            coord_file = os.path.join(share_dir, "coords.txt")
            
            # Read existing coords
            coords = {}
            if os.path.exists(coord_file):
                try:
                    with open(coord_file, 'r', encoding='utf-8') as f:
                        for line in f:
                            if ':' in line:
                                k, v = line.strip().split(':', 1)
                                coords[k] = v
                except: pass
            
            # Update specific item
            coords[item_id] = f"{int(x)},{int(y)}"
            
            # Construct content
            lines = []
            for k, v in coords.items():
                lines.append(f"{k}:{v}\n")
            
            self._write_atomic(coord_file, "".join(lines))
                    
        except Exception as e:
            self.log(f"Coord save error: {e}", "ERROR")

    def read_file(self, filename):
        """Reads a file and merges with coords.txt if it's desktop.json."""
        try:
            share_dir = self._get_share_dir()
            filepath = os.path.join(share_dir, filename)
            
            content = None
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
            
            # If we are reading desktop.json, try to merge coordinates from coords.txt
            if filename == 'desktop.json' and content:
                try:
                    data = json.loads(content)
                    coord_file = os.path.join(share_dir, "coords.txt")
                    if os.path.exists(coord_file):
                        with open(coord_file, 'r', encoding='utf-8') as f:
                            for line in f:
                                if ':' in line:
                                    k, v = line.strip().split(':', 1)
                                    if ',' in v:
                                        x, y = v.split(',', 1)
                                        # Find item and update
                                        for item in data:
                                            if item.get('id') == k:
                                                item['x'] = int(x)
                                                item['y'] = int(y)
                        content = json.dumps(data)
                except Exception as e:
                    self.log(f"Merge coords error: {e}", "WARNING")
            
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

    def quit(self):
        self.lifecycle.shut_down_immediately()

    def quit_finally(self):
        self.lifecycle.shut_down_immediately()

    def confirm_quit(self):
        if not self.window: return True
        return self.window.create_confirmation_dialog('Unsaved Changes', 'Do you want to save your progress before exiting?')

    def hook_closing(self, window):
        window.events.closing += self.lifecycle.on_closing

def main():
    try:
        # Get absolute path to index.html
        if getattr(sys, 'frozen', False):
            base_path = sys._MEIPASS
        else:
            base_path = os.getcwd()
            
        html_path = os.path.join(base_path, "index.html")
        icon_path = os.path.join(base_path, "sakura.png")
        file_url = f"file://{html_path}"
        
        api = Api()
        
        window = webview.create_window(
            'Chomka WebOS', 
            file_url, 
            js_api=api,
            width=1280, 
            height=800,
            resizable=True,
            min_size=(800, 600)
        )
        
        api.window = window 
        api.hook_closing(window)
        
        # Start webview
        api.log("Chomka: Starting webview")
        webview.start(debug=False)
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
