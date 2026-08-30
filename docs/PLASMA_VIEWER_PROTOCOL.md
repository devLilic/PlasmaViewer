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
transform defaults (the persisted brightness, contrast and saturation values; zoom 1, centered, no flip). Window/display settings remain persistent, including the `free` or `16:9` aspect preference. `reset-transform` applies the defaults immediately.

`GET /v1/state` also includes `transformDefaults`, the persisted FR3 configuration (`fr3`) and the FR2 `window.aspectMode`. FR3 remains non-visible until its dedicated window is implemented.

The control window (FR1) can configure a persistent local default image. The
output window (FR2) renders this image as a fixed background and renders the
image received from `plasma.test` in a separate layer above it. Transform
commands affect only the `plasma.test` layer. The default image can be selected
or removed only through FR1; the HTTP protocol exposes its descriptor in state
but cannot change its local file path.
