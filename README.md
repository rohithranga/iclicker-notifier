# iClicker Poll Notifier

Version 0.1 — A Chrome extension with desktop notifications and optional sound alerts when a new iClicker page URL appears.

A small Chrome extension that alerts you when `student.iclicker.com` navigates to a new URL. This is intended as a poll awareness and accessibility aid: it does not read question content, capture screenshots, generate answers, or submit responses.

## Features

- Watches top-level iClicker page navigations, including URL changes made by single-page apps.
- Shows a Chrome notification for each new URL.
- Plays an optional three-note chime. Use **Test sound** in the popup to check the volume.
- Stores only notification preferences and short-lived hashes of URLs to avoid duplicate alerts. It does not store the URLs themselves.

The notifier uses a new unique URL as the poll signal. A course or session page change on the same iClicker domain can also trigger an alert.

## Install in Chrome

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select this folder.
5. Open `https://student.iclicker.com/` and pin the extension if you want quick access to its controls.

Chrome 116 or newer is required for the optional background chime.

## Use

Open the extension popup to pause or resume URL alerts, enable or mute the chime, and test the sound. Chrome system notifications must be allowed for the extension and by the operating system.

## How the linked project compares

[byeClicker](https://github.com/aszaw/byeClicker) is also a Manifest V3 extension. Its manifest declares a popup, a background service worker, a content script for the iClicker student site, and `tabs`/`storage` permissions. Its README describes automatic class joining and answering. This project uses the service worker and popup pattern for URL notifications, with Chrome's navigation and notification APIs; it leaves page contents and poll responses alone.
