const ICICKER_FILTER = {
  url: [{ schemes: ["https"], hostEquals: "student.iclicker.com" }],
};

const SETTINGS_KEY = "preferences";
const HISTORY_KEY = "seenUrlFingerprints";
const HISTORY_TTL_MS = 48 * 60 * 60 * 1000;
const MAX_HISTORY = 120;

const DEFAULT_SETTINGS = {
  alertsEnabled: true,
  soundEnabled: true,
  soundVolume: 0.8,
};

let navigationQueue = Promise.resolve();
let offscreenCreation;

async function readSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] ?? {}) };
}

function isSupportedUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && url.hostname === "student.iclicker.com";
  } catch {
    return false;
  }
}

async function fingerprint(rawUrl) {
  const bytes = new TextEncoder().encode(rawUrl);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function markUrlAsSeen(rawUrl) {
  const now = Date.now();
  const hash = await fingerprint(rawUrl);
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const history = (stored[HISTORY_KEY] ?? []).filter((entry) => now - entry.seenAt < HISTORY_TTL_MS);

  if (history.some((entry) => entry.hash === hash)) {
    await chrome.storage.local.set({ [HISTORY_KEY]: history });
    return false;
  }

  history.push({ hash, seenAt: now });
  await chrome.storage.local.set({ [HISTORY_KEY]: history.slice(-MAX_HISTORY) });
  return true;
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });

  if (contexts.length > 0) return;

  if (!offscreenCreation) {
    offscreenCreation = chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play the user's optional alert chime when a new iClicker URL is detected.",
    }).finally(() => {
      offscreenCreation = undefined;
    });
  }

  await offscreenCreation;
}

async function playChime(volume, force = false) {
  const settings = await readSettings();
  if (!force && !settings.soundEnabled) return;

  await ensureOffscreenDocument();
  const result = await chrome.runtime.sendMessage({
    type: "PLAY_CHIME",
    volume: Math.min(1, Math.max(0, Number(volume) || 0)),
  });
  if (result?.error) throw new Error(result.error);
}

async function notifyForUrl(details) {
  if (details.frameId !== 0 || !isSupportedUrl(details.url)) return;

  const settings = await readSettings();
  if (!settings.alertsEnabled) return;

  const isNewUrl = await markUrlAsSeen(details.url);
  if (!isNewUrl) return;

  const notificationId = `iclicker-url-${details.tabId}-${Date.now()}`;
  await chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title: "New iClicker poll URL",
    message: "A new iClicker URL was detected. Open the tab to view the page.",
    contextMessage: "Click this notification to return to iClicker.",
    priority: 2,
  });

  if (settings.soundEnabled) {
    await playChime(settings.soundVolume).catch((error) => {
      console.warn("Could not play the alert chime:", error);
    });
  }
}

function queueNavigation(details) {
  navigationQueue = navigationQueue
    .then(() => notifyForUrl(details))
    .catch((error) => console.error("Could not process iClicker navigation:", error));
}

chrome.webNavigation.onCommitted.addListener(queueNavigation, ICICKER_FILTER);
chrome.webNavigation.onHistoryStateUpdated.addListener(queueNavigation, ICICKER_FILTER);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(queueNavigation, ICICKER_FILTER);

chrome.notifications.onClicked.addListener(async (notificationId) => {
  const match = notificationId.match(/^iclicker-url-(-?\d+)-/);
  if (!match) return;

  const tabId = Number(match[1]);
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId !== undefined) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    await chrome.tabs.update(tabId, { active: true });
  } catch {
    // The tab may have been closed after the notification appeared.
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_SETTINGS") {
    readSettings().then(sendResponse).catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message?.type === "SAVE_SETTINGS") {
    const settings = {
      alertsEnabled: Boolean(message.settings?.alertsEnabled),
      soundEnabled: Boolean(message.settings?.soundEnabled),
      soundVolume: Math.min(1, Math.max(0, Number(message.settings?.soundVolume) || 0)),
    };
    chrome.storage.local.set({ [SETTINGS_KEY]: settings })
      .then(() => sendResponse(settings))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message?.type === "TEST_CHIME") {
    playChime(message.volume, true)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  return false;
});
