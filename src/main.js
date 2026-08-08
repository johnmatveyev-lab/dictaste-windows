/**
 * Dictaste Windows MVP
 * - Tray app + lime brand icon
 * - Global shortcut Ctrl+Shift+Space starts/stops mic capture
 * - Web Speech STT in always-on-top HUD
 * - Auto polish via /api/v1/polish + paste (Ctrl+V) on stop
 * - Settings for license key + API base
 */
const {
  app,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  clipboard,
  BrowserWindow,
  ipcMain,
  shell,
  Notification,
} = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const { exec } = require("child_process");

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const DEFAULT_API = "https://dictaste.vercel.app";

function loadConfig() {
  try {
    return { ...defaultConfig(), ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
  } catch {
    return defaultConfig();
  }
}

function defaultConfig() {
  return {
    apiBase: DEFAULT_API,
    licenseKey: "",
    polish: true,
    autoPaste: true,
  };
}

function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

/** 16×16 lime “D” tray icon (PNG buffer, no assets needed). */
function makeTrayIcon() {
  // Minimal valid 16x16 PNG with lime pixel data is heavy by hand —
  // use Electron's createFromDataURL via a tiny canvas-less base64 16x16 lime square.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMElEQVQ4T2NkYGD4z0ABYBzVMKoB" +
      "BgP+MzAw/GdG5jMyMqJLgDQjCyBrGHUDhtMNAABmQQf9vQZ0dwAAAABJRU5ErkJggg==",
    "base64"
  );
  let img = nativeImage.createFromBuffer(png);
  if (img.isEmpty()) {
    // Fallback empty → still works; tooltip carries brand.
    img = nativeImage.createEmpty();
  }
  return img.resize({ width: 16, height: 16 });
}

let tray = null;
let settingsWin = null;
let hudWin = null;
let listening = false;
let cfg = null;

function requestJson(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(data || "{}") });
          } catch {
            resolve({ status: res.statusCode, json: { raw: data } });
          }
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

async function polishText(text) {
  if (!cfg.polish || !text.trim()) return text;
  if (!cfg.licenseKey) return text;
  const base = (cfg.apiBase || DEFAULT_API).replace(/\/$/, "");
  try {
    const { status, json } = await requestJson(`${base}/api/v1/polish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.licenseKey}` },
      body: { text },
    });
    if (status === 200 && json.text) return json.text;
  } catch {
    /* keep raw */
  }
  return text;
}

function pasteText(text) {
  if (!text) return;
  const prev = clipboard.readText();
  clipboard.writeText(text);
  // Windows: SendKeys Ctrl+V into focused window
  exec(
    `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 80; [System.Windows.Forms.SendKeys]::SendWait('^v')"`,
    () => {
      setTimeout(() => clipboard.writeText(prev), 500);
    }
  );
}

function notify(body) {
  try {
    if (Notification.isSupported()) {
      new Notification({ title: "Dictaste", body }).show();
    }
  } catch {
    /* ignore */
  }
}

function setTrayLabel() {
  if (!tray) return;
  tray.setToolTip(
    listening
      ? "Dictaste — listening (Ctrl+Shift+Space to stop)"
      : "Dictaste — ready (Ctrl+Shift+Space)"
  );
}

function broadcastStatus(extra = {}) {
  const payload = { listening, ...extra };
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send("status", payload);
  }
  if (hudWin && !hudWin.isDestroyed()) {
    hudWin.webContents.send("status", payload);
  }
}

function ensureHud() {
  if (hudWin && !hudWin.isDestroyed()) return hudWin;
  hudWin = new BrowserWindow({
    width: 360,
    height: 120,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });
  hudWin.loadFile(path.join(__dirname, "hud.html"));
  hudWin.on("closed", () => {
    hudWin = null;
  });
  return hudWin;
}

function showHud() {
  const w = ensureHud();
  w.showInactive();
  w.setAlwaysOnTop(true, "screen-saver");
}

function hideHud() {
  if (hudWin && !hudWin.isDestroyed()) hudWin.hide();
}

async function startListening() {
  if (listening) return;
  listening = true;
  setTrayLabel();
  showHud();
  broadcastStatus({ phase: "listening" });
  // Tell HUD to start Web Speech
  if (hudWin && !hudWin.isDestroyed()) {
    hudWin.webContents.send("dictate-control", { action: "start" });
  }
  // Also open settings window if never opened so user can save license first session
  if (!cfg.licenseKey) {
    openSettings();
  }
}

async function stopListening() {
  if (!listening) return;
  listening = false;
  setTrayLabel();
  broadcastStatus({ phase: "stopping" });
  if (hudWin && !hudWin.isDestroyed()) {
    hudWin.webContents.send("dictate-control", { action: "stop" });
  }
}

function toggleListen() {
  if (listening) stopListening();
  else startListening();
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 460,
    height: 620,
    title: "Dictaste",
    backgroundColor: "#0A0A0B",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });
  settingsWin.loadFile(path.join(__dirname, "settings.html"));
  settingsWin.on("closed", () => {
    settingsWin = null;
  });
}

function createTray() {
  const img = makeTrayIcon();
  tray = new Tray(img);
  const menu = Menu.buildFromTemplate([
    { label: "Dictaste", enabled: false },
    { type: "separator" },
    {
      label: "Toggle dictation (Ctrl+Shift+Space)",
      click: () => toggleListen(),
    },
    { label: "Settings…", click: () => openSettings() },
    {
      label: "Open dashboard",
      click: () => shell.openExternal(`${(cfg.apiBase || DEFAULT_API).replace(/\/$/, "")}/dashboard`),
    },
    {
      label: "Download / waitlist",
      click: () => shell.openExternal(`${(cfg.apiBase || DEFAULT_API).replace(/\/$/, "")}/download`),
    },
    { type: "separator" },
    { label: "Quit Dictaste", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  setTrayLabel();
  tray.on("click", () => openSettings());
}

app.whenReady().then(() => {
  cfg = loadConfig();
  createTray();
  ensureHud();
  globalShortcut.register("CommandOrControl+Shift+Space", () => toggleListen());

  ipcMain.handle("get-config", () => cfg);
  ipcMain.handle("save-config", (_e, next) => {
    cfg = { ...cfg, ...next };
    saveConfig(cfg);
    return cfg;
  });
  ipcMain.handle("polish-and-paste", async (_e, text) => {
    const polished = await polishText(String(text || ""));
    if (cfg.autoPaste !== false) pasteText(polished);
    return polished;
  });
  ipcMain.handle("open-external", (_e, url) => shell.openExternal(url));
  ipcMain.handle("set-listening", (_e, on) => {
    if (on) startListening();
    else stopListening();
    return listening;
  });

  /** HUD finished a session with transcript — polish + paste + notify */
  ipcMain.handle("session-complete", async (_e, { text } = {}) => {
    listening = false;
    setTrayLabel();
    hideHud();
    const raw = String(text || "").trim();
    if (!raw) {
      broadcastStatus({ phase: "idle", last: "" });
      return { polished: "" };
    }
    broadcastStatus({ phase: "polishing", last: raw });
    const polished = await polishText(raw);
    if (cfg.autoPaste !== false) pasteText(polished);
    broadcastStatus({ phase: "idle", last: polished });
    notify(polished.length > 80 ? polished.slice(0, 77) + "…" : polished);
    return { polished };
  });

  // First-run: open settings so license can be pasted
  if (!cfg.licenseKey) {
    setTimeout(() => openSettings(), 400);
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", (e) => {
  e.preventDefault?.();
});
