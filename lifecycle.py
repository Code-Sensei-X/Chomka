import webview
import time
import os
import sys

class LifecycleManager:
    def __init__(self, api):
        self.api = api
        self.is_terminal = False

    def on_closing(self):
        """Main entry point for window closing events."""
        self.api.log(f"[Lifecycle] on_closing triggered (is_saving={self.api.is_saving_and_quitting})")
        
        # If we are in terminal state, allow the window to close immediately
        if self.is_terminal:
            self.api.log("[Lifecycle] Terminal state active, allowing final close")
            return True

        if self.api.is_saving_and_quitting:
            self.api.log("[Lifecycle] Save-and-quit in progress, ignoring close request until done")
            return False
            
        result = self.api.confirm_quit()
        self.api.log(f"[Lifecycle] Confirmation result: {result}")

        if result is True:
            self.api.log("[Lifecycle] User chose SAVE. Triggering JS ShutdownManager (async)...")
            self.api.is_saving_and_quitting = True
            
            # CRITICAL: Trigger JS on a separate thread to avoid deadlock in on_closing
            def trigger_async():
                time.sleep(0.01) # Ultra-short delay to let on_closing return False first
                
                # SAFETY EXIT: If we haven't closed in 60 seconds, force terminate.
                def safety_exit_timer():
                    time.sleep(60)
                    if not self.is_terminal:
                        self.api.log("[Lifecycle] Safety Exit Timer reached (60s). Force terminating...", "WARNING")
                        self.shut_down_immediately()
                
                import threading
                threading.Thread(target=safety_exit_timer, daemon=True).start()

                try:
                    self.api._window.evaluate_js('window.ShutdownManager.start(true)')
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
        """Force the window to destroy and hard-exit the process."""
        self.api.log("[Lifecycle] shut_down_immediately called")
        if self.api._window:
            self.api.log("[Lifecycle] Destroying window for exit")
            self.is_terminal = True # Set terminal flag to bypass on_closing logic
            self.api._window.destroy()
            self.api.log("[Lifecycle] Window destroyed. Triggering hard exit...")
            
            # Hard exit to ensure no dangling threads or UI loops keep the process alive
            os._exit(0)
