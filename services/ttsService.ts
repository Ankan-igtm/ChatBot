/**
 * A simple wrapper around the browser's SpeechSynthesis API.
 */

/**
 * Checks if the browser supports the SpeechSynthesis API.
 * @returns {boolean} True if supported, false otherwise.
 */
export const isSupported = (): boolean => {
  return 'speechSynthesis' in window && typeof window.speechSynthesis !== 'undefined';
};

/**
 * Speaks the given text using the browser's TTS engine.
 * Cancels any previously ongoing speech before starting a new one.
 * @param {string} text The text to be spoken.
 */
export const speak = (text: string): void => {
  if (!isSupported()) {
    console.warn('Speech synthesis is not supported in this browser.');
    return;
  }

  // Cancel any currently speaking utterance to prevent overlap
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Optional: Configure voice, rate, pitch, etc.
  // utterance.voice = window.speechSynthesis.getVoices()[0]; // Example: Set a specific voice
  utterance.rate = 1; // From 0.1 to 10
  utterance.pitch = 1; // From 0 to 2

  window.speechSynthesis.speak(utterance);
};

/**
 * Immediately stops any speech that is currently in progress.
 */
export const cancel = (): void => {
  if (isSupported()) {
    window.speechSynthesis.cancel();
  }
};