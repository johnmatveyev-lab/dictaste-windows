# Dictaste for Windows (MVP)

Hold-to-talk + license polish against **https://dictaste.vercel.app**.

## Status
- Tray app with brand tooltip
- Global hotkey `Ctrl+Shift+Space` → floating HUD → Web Speech STT
- Stop hotkey → polish via `/api/v1/polish` → auto-paste (Ctrl+V)
- Settings: license key, API base, polish/auto-paste toggles
- Offline Whisper STT: next (W1)

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

## License
Same keys as Mac from Dashboard / Developer setup (`dt_live_…` or legacy `fd_live_…`).
