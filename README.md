# HoloSelf OS

**An experimental desktop companion with a holographic interface.**

HoloSelf combines a transparent desktop HUD, a reactive 3D scene, local activity records, and voice interaction. The project explores how a small desktop agent can make personal routines and reminders visible without becoming a full-screen dashboard.

**Status:** prototype, version `0.2.0`. The native implementation targets macOS; the browser build provides a UI development mode. Health-related outputs are experimental and have not been clinically validated.

[Frontend](src) · [Rust backend](src-tauri/src) · [Data flow and limitations](docs/data-flow.md) · [Issues](https://github.com/Vinizeira13/holoself-os/issues)

## What is implemented

- **Desktop HUD:** transparent, frameless, always-on-top Tauri window with a React interface and Three.js scene.
- **Local records:** SQLite storage for activity and health-related logs, plus scheduling commands and daily summaries.
- **Voice pipeline:** microphone capture, a local `whisper.cpp` transcription path, native macOS speech, and optional Cartesia speech generation.
- **Agent messages:** rule-based context and optional Gemini-generated messages, exposed through typed Tauri commands.
- **Settings and onboarding:** dependency detection, API-key configuration, and voice dependency installation flows.
- **Exploratory signals:** in-window typing estimates and camera brightness heuristics for presence and head position.

The Rust backend also includes PDF extraction through Gemini and a UV lookup through Open-Meteo. These integrations require separate runtime verification; their presence in source does not establish a complete or medically reliable workflow.

## Try the interface

Use Node.js 22.12+ and npm.

```bash
git clone https://github.com/Vinizeira13/holoself-os.git
cd holoself-os
npm ci
npm run dev
```

Open [localhost:1420](http://localhost:1420). Browser mode uses sample agent messages. Tauri commands, SQLite operations, and native voice services need the desktop runtime.

```bash
npm run build
npm run preview
```

## Run the desktop app

In addition to the frontend dependencies, install a Rust toolchain and the platform prerequisites for Tauri 2. On macOS this includes Xcode Command Line Tools.

```bash
npm run tauri -- dev
```

Use the setup wizard to configure integrations. The application reads credentials from its process environment and its application configuration directory; copying the root `.env.example` alone does not load credentials into the Rust process.

| Integration | Configuration | Used for |
| --- | --- | --- |
| Gemini | `GEMINI_API_KEY` | Agent messages and clinical-PDF parsing |
| Cartesia | `CARTESIA_API_KEY` | Optional cloud speech generation |
| whisper.cpp | Local binary and model | Local speech transcription |
| macOS speech | `say` and `afconvert` | Native speech fallback |
| Open-Meteo | Coordinates in settings | UV index lookup |

The optional voice installer downloads local dependencies and models. It can use Homebrew for `whisper.cpp` and installs files under `~/.holoself`. Review the setup flow before using it on a managed machine.

To build native artifacts:

```bash
npm run tauri -- build
```

Signing and notarization are not configured in the checked-in bundle settings. The updater also has an empty public key, so release distribution requires additional configuration.

## Architecture

| Layer | Responsibility |
| --- | --- |
| React 19 + TypeScript | HUD, setup, settings, widgets, and interaction |
| React Three Fiber + Drei | Three.js scene composition |
| Zustand | Agent and speech state |
| Tauri 2 | Window behavior, native command bridge, and plugins |
| Rust services | Voice, scheduling, external API requests, and context |
| SQLite | Application records in `holoself.db` |

The frontend lives in [`src/`](src); native commands and services live in [`src-tauri/src/`](src-tauri/src). Start with [`src/App.tsx`](src/App.tsx) and [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) to follow the runtime wiring.

## Boundaries worth understanding

Camera analysis uses brightness measurements, not a trained posture model. Typing measurements capture keyboard events inside the application window; they are not a system-wide productivity metric. The context aggregator currently supplies a fixed WPM value even though the typing widget has its own hook.

The PDF drop handler currently passes a sanitized filename to a backend that expects an existing file path. That path handoff needs integration work before the import flow can be considered complete.

Local storage does not mean every operation stays on the device. Configured Gemini requests can include personal context or PDF contents, and Cartesia receives speech text. Settings and credentials are stored in local files, without an OS keychain integration. See [data flow and limitations](docs/data-flow.md) before using personal information.

Use synthetic data for development. Medical parsing, supplement suggestions, and wellness scores are prototype behavior, not clinical measurements or treatment guidance.

## Contributing and attribution

Useful next steps include native integration tests, a reliable file-picker/import flow, secure credential storage, clearer permissions, and replacing health heuristics with explicitly validated behavior. Include the OS, reproduction steps, and redacted logs with bug reports.

The Rust package credits **Guilherme Rocha** in [`Cargo.toml`](src-tauri/Cargo.toml) and declares MIT licensing. A standalone `LICENSE` file is not currently included. Existing authorship is preserved.
