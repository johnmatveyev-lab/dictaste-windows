# Dictaste for Windows

Tray app — hold-to-talk dictation + AI polish via **https://dictaste.vercel.app**.

**★ Free Developer plan:** star [johnmatveyev-lab/dictaste](https://github.com/johnmatveyev-lab/dictaste) → unlock at https://dictaste.vercel.app/developers/setup  

Full install guide: https://github.com/johnmatveyev-lab/dictaste/blob/main/docs/INSTALL_WINDOWS.md

## Quick start

```powershell
git clone https://github.com/johnmatveyev-lab/dictaste-windows.git
cd dictaste-windows
npm install
npm start
```

1. Tray → **Settings**  
2. Paste license key (`dt_live_…`)  
3. Optional: OpenAI key for polish / Whisper  
4. **Ctrl+Shift+Space** to start/stop listening  

## Features

- Global hotkey `Ctrl+Shift+Space` → floating HUD  
- STT: Web Speech · OpenAI Whisper · offline whisper.cpp  
- Polish via `/api/v1/polish` · auto-paste  
- Settings: license, API base, STT mode  

## Package installer (on Windows)

```powershell
npm run dist
# → dist/Dictaste-Setup-0.1.0.exe
```

## Verify (no Electron launch)

```bash
npm run verify
```

## License keys

Same as Mac — from Dashboard / Developer setup (`dt_live_…` or legacy `fd_live_…`).
