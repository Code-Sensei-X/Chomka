# Chomka WebOS

## Overview
Chomka is an innovative web browser that reimagines the web browsing experience by integrating a full Desktop Window Manager (DWM) interface directly into the browser. Inspired by modern operating systems, Chomka brings native desktop multitasking and personalization to the web.

## 🚀 Key Features
- **Desktop Environment**: A full virtual desktop for organizing your web resources.
- **Persistent Customization**: All desktop items, positions, and notes are automatically saved to `desktop.json`.
- **Dynamic Desktop Items**:
    - **Sticky Notes**: Quick text notes that support URL recognition (converts to link cards).
    - **Image Widgets**: Display images directly on your desktop (supports local upload and URLs).
    - **Folders**: Organize links and images into named directories.
    - **YouTube Objects**: Embed interactive YouTube players directly on your desktop.
- **Window Management**:
    - Open websites in floating, draggable, and resizable browser windows.
    - Minimize/Maximize and Taskbar integration.
- **Toolbelt Sidebar**: A movable utility bar providing quick access to system tools.
- **Search Widget**: Centered search bar for quick Google searches or direct URL navigation.
- **Global Drag & Drop**: Drag images or URLs from your host system or other browser windows to create desktop items instantly.

## 🖱️ Controls & Usage

### Desktop Interactions
- **Right-Click**: Open the desktop context menu to add new items or move the toolbelt.
- **Left-Click & Drag**: Move desktop items around the workspace.
- **Double-Click (Folders)**: Open folder contents in a modal view.

### Toolbelt Features
- **`+` (Add Item)**: Open the quick-add panel for Folders, Notes, Images, or Browser windows.
- **`::: ` (Tab Grid)**: Toggle visibility of desktop items.
- **`✉` (Feedback)**: Send email feedback directly to the developers.
- **`ℹ` (Info)**: View this readme file.
- **`⬈` (Move Mode)**: Enable keyboard-based movement for selected items.
    - **Arrow Keys / WASD**: Move selected item by 10px.
    - **Shift + Arrows/WASD**: Move selected item by 50px.
    - **Esc**: Deselect item.
- **`⚙` (Settings)**: Change the data storage directory.

### Item Management (Right-Click on Item)
- **Bring Forward / Send Backward**: Adjust the layering (z-index) of desktop objects.
- **Delete**: Permanently remove the item from the desktop.

### Specialized Workflows
- **Pasting (Ctrl+V)**: Paste images or URLs directly onto the desktop or into an open folder.
- **YouTube Embedding**: Paste or drag a YouTube link to create an interactive video object.
- **Smart Notes**: Paste a URL into a note to turn it into a "Link Card" with an "Open" button.

## 📂 Data Storage
By default, Chomka saves your configuration in the `shared_data` folder. You can customize this location in the Settings menu to sync your setup via cloud storage or local backups.

