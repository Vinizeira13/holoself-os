# Data flow and prototype boundaries

This document describes the checked-in implementation. It is not a security certification or a clinical validation report.

## Local processing and storage

| Data | Current path |
| --- | --- |
| Activity and health-related records | Rust commands and `holoself.db` in the Tauri application data directory |
| Settings | `settings.json` in the application configuration directory |
| API credentials | Process environment, application `.env`, and settings fields |
| Microphone audio | Frontend capture, temporary local audio, conversion, and whisper.cpp |
| Camera frames | In-memory canvas analysis in React hooks |
| Typing signal | Timestamps from key events in the application window |

SQLite encryption and OS keychain storage are not implemented. On startup, the application attempts to restrict an existing `.env` file to owner access on Unix; `settings.json` can also contain credentials and does not receive the same permission handling.

The camera hooks analyze brightness and variance. They do not include an image-upload operation. These heuristics can be affected by lighting and background and do not establish identity or a reliable posture diagnosis.

## External requests

| Destination | Data sent when the feature runs |
| --- | --- |
| Gemini | Agent context or a base64-encoded PDF with a parsing prompt |
| Cartesia | Text to synthesize and voice configuration |
| Open-Meteo | Coordinates for the UV forecast |
| Voice dependency hosts | Binary/model download requests during installation or repair |

Gemini and Cartesia are optional integrations that require provider credentials. They are not part of an entirely offline mode. Model identifiers are defined in Rust source and may need updating independently of the UI.

## Known integration limits

1. **PDF handoff:** `App.tsx` passes a filename, while `ocr_clinical_pdf` reads a filesystem path. The frontend does not currently transfer the file bytes in that command.
2. **Browser preview:** sample agent messages are used outside Tauri. A successful web build does not verify native commands.
3. **Typing context:** the WPM widget estimates typing locally, but the broader health context currently receives `wpm: 0`.
4. **Platform assumptions:** native speech and dependency helpers include macOS-specific commands and paths. Other operating systems are not established targets by this implementation.
5. **Distribution:** the checked-in updater key is empty and signing is unconfigured. A package build alone does not establish a trusted update channel.
6. **Medical output:** extraction, reference ranges, supplement quantities, and scores have no clinical validation included in this repository.

## Reviewing a change

Use synthetic PDFs and fictional context. Confirm which data crosses the native bridge, which service receives it, how local files are retained, and what happens when permissions or credentials are absent. Do not attach personal records or API keys to issue reports.

For native verification, check the actual desktop build: microphone permission, voice conversion, transcription, fallback speech, database persistence, and file import. These paths cannot be established by frontend compilation alone.
