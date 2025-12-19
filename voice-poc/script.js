/**
 * Hey Dose Voice Assistant Logic
 * 
 * Implements a state-machine based voice assistant that listens for a specific wake word
 * before processing further commands.
 */

class VoiceAssistant {
    constructor() {
        // State definitions
        this.STATES = {
            INACTIVE: 'INACTIVE',
            LISTENING_WAKE: 'LISTENING_WAKE',
            SPEAKING: 'SPEAKING',
            LISTENING_COMMAND: 'LISTENING_COMMAND'
        };

        this.currentState = this.STATES.INACTIVE;
        this.recognition = null;
        this.synth = window.speechSynthesis;

        // DOM Elements
        this.btnEnable = document.getElementById('enable-btn');
        this.statusIndicator = document.getElementById('status-indicator');
        this.logContainer = document.getElementById('log-container');

        // Configuration
        this.wakeWord = "hey dose";
        this.wakeVariations = ["hey dose", "hi dose", "hello dose", "hey does", "he dose"];

        this.init();
    }

    init() {
        // 1. Browser Compatibility Check
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.log("Error: Web Speech API not supported in this browser.", "error");
            this.btnEnable.disabled = true;
            this.btnEnable.textContent = "Not Supported";
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        // 2. Configure Recognition
        // We use continuous=true for wake word monitoring to avoid constant restarts
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        // 3. Bind Events
        this.recognition.onstart = () => this.handleStart();
        this.recognition.onend = () => this.handleEnd();
        this.recognition.onerror = (e) => this.handleError(e);
        this.recognition.onresult = (e) => this.handleResult(e);

        this.btnEnable.addEventListener('click', () => this.activate());
    }

    /**
     * User explicit activation triggers the listening loop.
     */
    activate() {
        this.btnEnable.style.display = 'none'; // Hide button after activation
        this.transitionTo(this.STATES.LISTENING_WAKE);
        try {
            this.recognition.start();
        } catch (e) {
            console.error("Starting error:", e);
        }
    }

    /**
     * State Management Helper
      */
    transitionTo(newState) {
        console.log(`State Transition: ${this.currentState} -> ${newState}`);
        this.currentState = newState;
        this.updateUI(newState);
    }

    /**
     * Core Result Processing Logic
     */
    handleResult(event) {
        // If we are speaking, ignore everything (echo cancellation)
        if (this.currentState === this.STATES.SPEAKING) return;

        const results = Array.from(event.results);
        const lastResult = results[results.length - 1];
        const transcript = lastResult[0].transcript.trim().toLowerCase();
        const isFinal = lastResult.isFinal;

        console.log(`[${this.currentState}] Heard: "${transcript}" (Final: ${isFinal})`);

        if (this.currentState === this.STATES.LISTENING_WAKE) {
            // Check for wake word in interim or final results
            const detected = this.wakeVariations.some(trigger => transcript.includes(trigger));

            if (detected) {
                this.log(`Wake Word Detected: "${transcript}"`, 'wake');

                // 1. Stop listening immediately to prevent self-hearing
                this.recognition.abort();

                // 2. State: Speaking
                this.transitionTo(this.STATES.SPEAKING);

                // 3. Acknowledge and then switch to Command Mode
                this.speak("Yes, I am listening", () => {
                    // After speaking finishes:
                    this.transitionTo(this.STATES.LISTENING_COMMAND);

                    // Reconfigure for command capture (single sentence preferred)
                    // We intentionally restart recognition here
                    try { this.recognition.start(); } catch (e) { }
                });
            }
        }
        else if (this.currentState === this.STATES.LISTENING_COMMAND) {
            // In command mode, we care mostly about the Final result
            if (isFinal) {
                this.log(`Command Received: "${transcript}"`, 'command');

                // 1. Stop listening to process 'thought'
                this.recognition.abort();

                // 2. Speak confirmation (optional, good for UX)
                this.transitionTo(this.STATES.SPEAKING);
                this.speak(`You said: ${transcript}`, () => {
                    // 3. Return to Wake Word mode
                    this.transitionTo(this.STATES.LISTENING_WAKE);
                    try { this.recognition.start(); } catch (e) { }
                });
            }
        }
    }

    /**
     * robust Speech Synthesis
     */
    speak(text, onComplete) {
        if (this.synth.speaking) {
            this.synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);

        // Select a nice voice if available
        const voices = this.synth.getVoices();
        const preferred = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha'));
        if (preferred) utterance.voice = preferred;

        utterance.onend = () => {
            if (onComplete) onComplete();
        };

        this.synth.speak(utterance);
    }

    handleStart() {
        console.log("Microphone active.");
    }

    handleEnd() {
        console.log("Microphone disconnected.");

        // Auto-restart logic (The "Always On" behavior)
        // Only restart if we are in a listening state and NOT currently speaking
        // (If we are speaking, the speak() callback will handle the restart)
        if (this.currentState === this.STATES.LISTENING_WAKE ||
            this.currentState === this.STATES.LISTENING_COMMAND) {

            // Avoid rapid loops
            setTimeout(() => {
                try {
                    this.recognition.start();
                } catch (e) {
                    // Ignore "already started" errors
                }
            }, 500);
        }
    }

    handleError(event) {
        console.warn("Recognition Error:", event.error);
        if (event.error === 'not-allowed') {
            this.statusIndicator.textContent = "Mic Permission Denied";
            this.statusIndicator.className = "status-inactive";
            this.currentState = this.STATES.INACTIVE;
        }
    }

    updateUI(state) {
        switch (state) {
            case this.STATES.LISTENING_WAKE:
                this.statusIndicator.textContent = "Listening for 'Hey Dose'...";
                this.statusIndicator.className = "status-listening";
                break;
            case this.STATES.SPEAKING:
                this.statusIndicator.textContent = "Dose is speaking...";
                this.statusIndicator.className = "status-processing";
                break;
            case this.STATES.LISTENING_COMMAND:
                this.statusIndicator.textContent = "Listening for Command...";
                this.statusIndicator.className = "status-active";
                break;
        }
    }

    log(message, type = 'normal') {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        this.logContainer.insertBefore(entry, this.logContainer.firstChild);
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    new VoiceAssistant();
});
