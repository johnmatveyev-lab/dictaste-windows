/**
 * Dictaste Windows MVP
 * - Tray app
 * - Global shortcut (Ctrl+Shift+Space) toggles dictation session
 * - Records mic → sends to optional local STT or placeholder
 * - Polish via Dictaste API /api/v1/polish with license key
 * - Paste into focused window via clipboard + Ctrl+V
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
} = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const DEFAULT_API = "https://dictaste.vercel.app";

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {
      apiBase: DEFAULT_API,
      licenseKey: "",
      openAIKey: "",
      polish: true,
    };
  }
}

function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

let tray = null;
let settingsWin = null;
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
  const { status, json } = await requestJson(`${base}/api/v1/polish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.licenseKey}` },
    body: { text },
  });
  if (status === 200 && json.text) return json.text;
  return text;
}

function pasteText(text) {
  const prev = clipboard.readText();
  clipboard.writeText(text);
  // SendInput-style paste requires native addon; clipboard is ready for user Ctrl+V
  // On Windows we try robot via powershell SendKeys
  const { exec } = require("child_process");
  exec(
    `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`,
    () => {
      setTimeout(() => clipboard.writeText(prev), 400);
    }
  );
}

function setTrayLabel() {
  if (!tray) return;
  tray.setToolTip(
    listening ? "Dictaste — listening (Ctrl+Shift+Space to stop)" : "Dictaste — ready"
  );
}

function toggleListen() {
  listening = !listening;
  setTrayLabel();
  if (listening) {
    // MVP: capture not fully wired offline STT — open capture helper window
    // User can paste raw text for polish+paste in settings for now
    if (settingsWin) {
      settingsWin.webContents.send("status", { listening: true });
    }
  } else if (settingsWin) {
    settingsWin.webContents.send("status", { listening: false });
  }
}

function openSettings() {
  if (settingsWin) {
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 440,
    height: 560,
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
  const img = nativeImage.createEmpty();
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
      click: () => shell.openExternal(`${cfg.apiBase || DEFAULT_API}/dashboard`),
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
  globalShortcut.register("CommandOrControl+Shift+Space", () => toggleListen());

  ipcMain.handle("get-config", () => cfg);
  ipcMain.handle("save-config", (_e, next) => {
    cfg = { ...cfg, ...next };
    saveConfig(cfg);
    return cfg;
  });
  ipcMain.handle("polish-and-paste", async (_e, text) => {
    const polished = await polishText(String(text || ""));
    pasteText(polished);
    return polished;
  });
  ipcMain.handle("open-external", (_e, url) => shell.openExternal(url));
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", (e) => {
  // keep tray alive
  e.preventDefault?.();
});
