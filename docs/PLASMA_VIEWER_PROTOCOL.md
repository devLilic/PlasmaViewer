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

Transform limits are brightness and contrast 0–200, zoom 1–4 and pan X/Y -100–100.

Image transforms belong to the currently displayed image. They are not persisted
as application settings and a newly opened Plasma dialog starts from the default
transform (brightness and contrast 100, zoom 1, centered, no flip). Window/display settings
remain persistent. `reset-transform` applies the defaults immediately.

The control window (FR1) can configure a persistent local default image. The
output window (FR2) renders this image as a fixed background and renders the
image received from `plasma.test` in a separate layer above it. Transform
commands affect only the `plasma.test` layer. The default image can be selected
or removed only through FR1; the HTTP protocol exposes its descriptor in state
but cannot change its local file path.
