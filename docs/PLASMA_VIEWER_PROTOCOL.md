# PlasmaViewer protocol v1

PlasmaViewer listens only on `127.0.0.1:47832` by default. Every request requires
`Authorization: Bearer <PLASMA_VIEWER_TOKEN>`.

- `GET /v1/health` returns readiness and protocol version.
- `GET /v1/state` returns the current image, transform, window and display state.
- `POST /v1/commands` accepts a versioned command envelope.

Every command contains `id` (unique string), `version: 1`, an ISO-8601 `timestamp`,
`type`, and the type-specific `payload`. Supported types are `show`, `transform`,
`hide`, `window`, and `reset-transform`. Duplicate IDs are acknowledged without
applying the command twice.

Transform limits are brightness, contrast and saturation 0–200, zoom 1–4 and pan X/Y -100–100. `saturation` is additive for v1: older commands which omit it are normalized to 100.

Image transforms belong to the currently displayed image. They are not persisted
as application settings and a newly opened Plasma dialog starts from the default
transform defaults (the persisted brightness, contrast and saturation values; zoom 1, centered, no flip). Window/display settings remain persistent, including the `free` or `16:9` aspect preference. When `16:9` is selected, Electron main normalizes windowed FR2 bounds after every resize or bounds command, preserving the edited width (or deriving it from an edited height), clamping the result to the selected display work area. Fullscreen does not alter the stored windowed bounds. `reset-transform` applies the defaults immediately.

`GET /v1/state` also includes `transformDefaults`, the persisted FR3 configuration (`fr3`) and the FR2 `window.aspectMode`. `fr3.visible` is derived: it is true only when FR3 is enabled and a valid local default image is available.

The FR1 Settings page configures the persistent local default image intended for FR3 and the default brightness, contrast and saturation profile. Selecting or removing the image is saved immediately; numerical defaults are saved explicitly and never alter the active onAIR transform. The HTTP protocol exposes the image descriptor in state but cannot change its local file path.

FR3 is a separate frameless, fullscreen background window on the display selected for FR2. It displays only the local default image using `cover`, cannot receive focus or input, and is behind FR2 whenever both windows are visible. Its toggle does not alter FR2, and `show`/`hide` continue to control FR2 only. FR2 renders only the image received from `plasma.test`; transform commands affect that image only.

FR1 also provides a non-persistent keyboard-adjustment mode for windowed FR2. With FR1 focused and the capture surface active, arrows move FR2 by 1 px, Ctrl+arrows resize it by 1 px, Shift changes the step to 10 px, and Escape exits the mode. It is not a system-wide shortcut; editable controls, fullscreen and lost focus disable or suppress it. Bounds still use the same main-process normalization.
