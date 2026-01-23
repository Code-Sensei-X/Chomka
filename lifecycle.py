import webview
import time

class LifecycleManager:
    def __init__(self, api):
        self.api = api
        self.is_terminal = False

    def on_closing(self):
        """Main entry point for window closing events."""
        self.api.log(f"[Lifecycle] on_closing triggered (is_saving={self.api.is_saving_and_quitting})")
        
        if self.api.is_saving_and_quitting:
            self.api.log("[Lifecycle] Save-and-quit in progress, permitting close")
            return True
            
        result = self.api.confirm_quit()
        self.api.log(f"[Lifecycle] Confirmation result: {result}")

        if result is True:
            self.api.log("[Lifecycle] User chose SAVE. Triggering JS ShutdownManager (async)...")
            self.api.is_saving_and_quitting = True
            
            # CRITICAL: Trigger JS on a separate thread to avoid deadlock in on_closing
            def trigger_async():
                time.sleep(0.01) # Ultra-short delay to let on_closing return False first
                try:
                    self.api.window.evaluate_js('window.ShutdownManager.start(true)')
                    self.api.log("[Lifecycle] JS ShutdownManager triggered successfully")
                except Exception as e:
                    self.api.log(f"[Lifecycle] Async JS trigger failed: {e}", "ERROR")
            
            import threading
            threading.Thread(target=trigger_async, daemon=True).start()
            return False 
            
        elif result is False:
            self.api.log("[Lifecycle] User chose QUIT WITHOUT SAVE")
            return True # Close immediately
            
        else:
            self.api.log("[Lifecycle] User cancelled")
            return False # Cancel closing

    def shut_down_immediately(self):
        """Force the window to destroy after a small safety pause."""
        self.api.log("[Lifecycle] shut_down_immediately called")
        if self.api.window:
            time.sleep(0.1) # Bridge breathing room
            self.api.window.destroy()
            self.api.log("[Lifecycle] Window destroyed successfully")
