import os
import sys
import subprocess
import shutil

def create_shortcut(target_exe, shortcut_name):
    """Creates a desktop shortcut using PowerShell."""
    target_exe = os.path.abspath(target_exe)
    working_dir = os.path.dirname(target_exe)
    
    # PowerShell command to create shortcut using robust environment expansion
    ps_command = f"""
    $ErrorActionPreference = 'Stop'
    $desktop = [System.Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktop '{shortcut_name}.lnk'
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = '{target_exe}'
    $Shortcut.WorkingDirectory = '{working_dir}'
    $Shortcut.Save()
    """
    
    try:
        subprocess.run(["powershell", "-Command", ps_command], check=True, capture_output=True, text=True)
        print(f"Successfully created desktop shortcut: {shortcut_name}")
    except subprocess.CalledProcessError as e:
        print(f"Failed to create shortcut: {e.stderr}")

def build_exe():
    print("Starting build process for Chomka v1.0.7 ...")
    
    # Path to icon
    icon_path = os.path.join(os.getcwd(), "icon.ico")
    if not os.path.exists(icon_path):
        # Fallback to sakura.ico if icon.ico doesn't exist
        icon_path = os.path.join(os.getcwd(), "sakura.ico")

    # PyInstaller command
    cmd = [
        "python", "-m", "PyInstaller",
        "--noconfirm",
        "--onefile",
        "--windowed",
        f"--icon={icon_path}",
        "--add-data=index.html;.",
        "--add-data=sakura.png;.",
        "--add-data=css;css",
        "--add-data=js;js",
        "--add-data=assets;assets",
        "--add-data=ScidosC.ttf;.",
        "--name=Chomka",
        "launcher.py"
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print("Build successful!")
        
        exe_path = os.path.abspath(os.path.join("dist", "Chomka.exe"))
        if os.path.exists(exe_path):
            print(f"Verified EXE at: {exe_path}")
            create_shortcut(exe_path, "Chomka v1.07")
        else:
            print("Error: Could not find built EXE in dist folder.")
            
    except subprocess.CalledProcessError as e:
        print(f"Build failed: {e}")
    except FileNotFoundError:
        print("Error: PyInstaller not found. Please install it using 'pip install pyinstaller'.")

if __name__ == "__main__":
    build_exe()
