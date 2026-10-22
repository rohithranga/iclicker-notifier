const alertsEnabled = document.querySelector("#alerts-enabled");
const soundEnabled = document.querySelector("#sound-enabled");
const soundVolume = document.querySelector("#sound-volume");
const volumeValue = document.querySelector("#volume-value");
const volumeSection = document.querySelector("#volume-section");
const testSound = document.querySelector("#test-sound");
const siteStatus = document.querySelector("#site-status");
const feedback = document.querySelector("#feedback");

let settings = {
  alertsEnabled: true,
  soundEnabled: true,
  soundVolume: 0.8,
};

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function render() {
  alertsEnabled.checked = settings.alertsEnabled;
  soundEnabled.checked = settings.soundEnabled;
  soundVolume.value = String(settings.soundVolume);
  volumeValue.textContent = `${Math.round(settings.soundVolume * 100)}%`;
  volumeSection.hidden = !settings.soundEnabled;
  testSound.disabled = !settings.soundEnabled;
}

async function saveSettings() {
  feedback.textContent = "Saving…";
  try {
    const saved = await sendMessage({ type: "SAVE_SETTINGS", settings });
    if (saved?.error) throw new Error(saved.error);
    settings = saved;
    feedback.textContent = "Settings saved.";
    render();
  } catch {
    feedback.textContent = "Could not save settings. Try reopening the extension.";
  }
}

async function updateSiteStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const hostname = new URL(tab?.url ?? "").hostname;
    siteStatus.textContent = hostname === "student.iclicker.com"
      ? "This iClicker tab is being watched."
      : "Open student.iclicker.com to receive alerts.";
  } catch {
    siteStatus.textContent = "Open student.iclicker.com to receive alerts.";
  }
}

alertsEnabled.addEventListener("change", () => {
  settings.alertsEnabled = alertsEnabled.checked;
  void saveSettings();
});

soundEnabled.addEventListener("change", () => {
  settings.soundEnabled = soundEnabled.checked;
  void saveSettings();
});

soundVolume.addEventListener("input", () => {
  settings.soundVolume = Number(soundVolume.value);
  volumeValue.textContent = `${Math.round(settings.soundVolume * 100)}%`;
});

soundVolume.addEventListener("change", () => {
  settings.soundVolume = Number(soundVolume.value);
  void saveSettings();
});

testSound.addEventListener("click", async () => {
  feedback.textContent = "Playing chime…";
  try {
    const result = await sendMessage({ type: "TEST_CHIME", volume: settings.soundVolume });
    if (result?.error) throw new Error(result.error);
    feedback.textContent = "Chime played.";
  } catch {
    feedback.textContent = "Could not play the chime.";
  }
});

async function initialize() {
  try {
    const saved = await sendMessage({ type: "GET_SETTINGS" });
    if (saved?.error) throw new Error(saved.error);
    settings = { ...settings, ...saved };
  } catch {
    feedback.textContent = "Could not load settings.";
  }
  render();
  await updateSiteStatus();
}

void initialize();
