/**
 * RecordingManager - Handles screen recording using the MediaStream Recording API.
 */
class RecordingManager {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.stream = null;
        this.isRecording = false;
    }

    async start() {
        if (this.isRecording) return;

        try {
            // Request screen capture
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: { ideal: 30 } },
                audio: true
            });

            this.recordedChunks = [];
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: 'video/webm; codecs=vp9'
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => this.save();

            this.mediaRecorder.start();
            this.isRecording = true;
            window.chomka.log("Recording started");

            // Handle stream stop (e.g., user clicks "Stop sharing")
            this.stream.getVideoTracks()[0].onended = () => {
                if (this.isRecording) this.stop();
            };

            return true;
        } catch (err) {
            console.error("Failed to start recording:", err);
            window.chomka.log(`Recording failed to start: ${err.message}`, "ERROR");
            return false;
        }
    }

    stop() {
        if (!this.isRecording) return;

        this.mediaRecorder.stop();
        this.stream.getTracks().forEach(track => track.stop());
        this.isRecording = false;
        window.chomka.log("Recording stopped");
    }

    async save() {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const reader = new FileReader();

        reader.onloadend = async () => {
            const base64data = reader.result;
            const id = `rec-${Date.now()}`;
            window.chomka.log(`Saving recording ${id}...`);

            const result = await window.chomka.saveAsset(base64data, id);
            if (result && result.success) {
                window.chomka.log(`Recording saved to ${result.path}`);
                if (window.notificationManager) {
                    window.notificationManager.notify("Recording Saved", `Saved as ${result.path}`, "📹");
                }
            } else {
                window.chomka.log(`Failed to save recording: ${result?.error}`, "ERROR");
            }
        };

        reader.readAsDataURL(blob);
    }
}

window.RecordingManager = RecordingManager;
