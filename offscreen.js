let audioContext;
let activeOscillators = [];
let chimeSequence = 0;

async function playChime(volume) {
  const sequence = ++chimeSequence;
  if (audioContext?.state === "closed") audioContext = undefined;
  audioContext ??= new AudioContext();
  if (audioContext.state === "suspended") await audioContext.resume();

  for (const oscillator of activeOscillators) {
    try {
      oscillator.stop();
    } catch {
      // The previous chime may already have ended.
    }
  }
  activeOscillators = [];

  const master = audioContext.createGain();
  master.gain.value = volume;
  master.connect(audioContext.destination);

  const notes = [880, 1174.66, 1567.98];
  const start = audioContext.currentTime + 0.02;
  const spacing = 0.2;
  const duration = 0.3;

  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    const noteStart = start + index * spacing;
    const noteEnd = noteStart + duration;

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, noteStart);
    envelope.gain.exponentialRampToValueAtTime(0.7, noteStart + 0.025);
    envelope.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.02);
    activeOscillators.push(oscillator);
  });

  window.setTimeout(() => {
    master.disconnect();
    if (sequence === chimeSequence) activeOscillators = [];
  }, 900);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PLAY_CHIME") {
    playChime(Math.min(1, Math.max(0, Number(message.volume) || 0)))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  return false;
});
