# Dictaste for Windows (MVP + W1 STT)

Hold-to-talk + license polish against **https://dictaste.vercel.app**.

## Status
- Tray app with brand tooltip
- Global hotkey `Ctrl+Shift+Space` → floating HUD
- **STT engines (W1)**
  - `webspeech` — Chromium Web Speech (default)
  - `openai` — OpenAI Whisper API (BYO `sk-…`)
  - `whisper-cli` — offline [whisper.cpp](https://github.com/ggerganov/whisper.cpp) binary + ggml model path
- Stop hotkey → STT → polish via `/api/v1/polish` → auto-paste (Ctrl+V)
- Settings: license, API base, STT mode, Whisper keys/paths

## Dev
```bash
npm install
npm start
```

## Package installer (on Windows)
```bash
npm run dist
```
Produces `dist/Dictaste-Setup-0.1.0.exe` (NSIS).

## Offline whisper.cpp
1. Build or download `whisper-cli` for Windows x64  
2. Download a ggml model (e.g. `ggml-base.en.bin`)  
3. Settings → STT = Offline whisper.cpp → set binary + model paths  

## License
Same keys as Mac from Dashboard / Developer setup (`dt_live_…` or legacy `fd_live_…`).
