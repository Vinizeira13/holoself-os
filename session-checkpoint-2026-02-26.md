# HoloSelf OS — Checkpoint 26/02/2026

## Commits
- `f98ba59` Phase 1 scaffold
- `5945c1d` Phase 2 TTS, Scheduler, VitD
- `dc4569b` Phase 3 UI modern, smart agent, settings, blink
- `04344b9` Visual overhaul: layout, CSS, avatar
- `32c751c` Jarvis HUD: dark bg, grid, vignette, brackets, Splat

## Arquitetura Atual

### Backend Rust (src-tauri/)
- **commands/**: health, agent, gemini, voice, scheduler, vitamin_d, settings, system
- **services/**: cartesia (TTS), scheduler (rules engine), vitamin_d (calculator)
- **db/**: SQLite WAL, versioned migrations, tables: supplements, vitals, lab_results, health_schedule, agent_memory

### Frontend React (src/)
- **avatar/HoloScene**: 3D orb + DNA helix + rings + particles + Gaussian Splatting ready
- **hud/**: AgentPanel, HudOverlay, SettingsPanel(3 tabs), ErrorBoundary, Toast, Icons, LoadingSkeleton, JarvisHud
- **health/**: VitaminDWidget, BlinkRateWidget, ScheduleWidget

## Status por Feature do Spec

| Feature | Status | Detalhe |
|---------|--------|---------|
| Transparent HUD window | ✅ | Tauri config OK, dark fallback CSS |
| Gaussian Splatting | ✅ Infra | Splat component wired, falta arquivo .splat do user |
| Cartesia TTS | ✅ Serviço | HTTP service OK, command wired |
| Whisper.cpp STT | ❌ | Retorna "not implemented" |
| Gemini OCR PDF | ✅ | Command + API call implementados |
| Open-Meteo UV | ✅ | API call real implementada |
| Vitamin D calc | ✅ | Fitzpatrick + UV + latitude + season |
| Health Scheduler | ✅ | Rules engine: Zn 3mo, Mg 4mo, VitD 3mo, TSH 6mo, ANA 6mo |
| Agent contextual | ✅ | 5 protocolos, aderência %, exams awareness |
| Blink Rate webcam | ⚠️ | UI + brightness detection, sem ML |
| Settings persist | ✅ | File-based JSON via dirs crate |
| Drag-drop PDF | ✅ | Handler no App.tsx |
| sqlite-vec RAG | ❌ | Não implementado |
| Keyboard WPM tracking | ❌ | Não implementado |

## Visual
- Fundo: dark radial gradient (fallback) + transparent no Tauri
- Grid: 3 colunas (left widgets | avatar center | right widgets)
- Font: monospace (SF Mono/Fira Code)
- HUD elements: corner brackets, scan lines, grid pattern, vignette, telemetry points, circular reticle, status bar
- Cards: glassmorphic com edge highlight
- Animações: fade-in, slide-up, slide-in-left/right, scale-in, stagger, neon-pulse, scanline

## O Que Falta Para "Jarvis" Real
1. **Arquivo .splat do rosto do user** (Luma AI / Polycam scan)
2. **Whisper.cpp** (STT nativo em Rust)
3. **sqlite-vec** (RAG local para memória de longo prazo)
4. **Keystroke WPM** tracking (fatigue detection)
5. **TTS auto-play** (agent falar automaticamente)
6. Refinar BlinkRate com MediaPipe Face Mesh (CDN)

## Decisões
- Font monospace para estética terminal/HUD
- Layout 3-column grid (não stack vertical)
- Dim colors em vez de bright (calm tech)
- Window 560x720 (mais largo que spec original 420)
- Agent fala português PT (não BR)
