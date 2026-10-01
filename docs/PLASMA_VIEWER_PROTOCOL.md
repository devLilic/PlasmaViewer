# PlasmaViewer protocol v1

PlasmaViewer listens on `127.0.0.1:47832` by default. Every request requires
`Authorization: Bearer <PLASMA_VIEWER_TOKEN>`. The server accepts requests only
on loopback:

- `GET /v1/health` returns readiness and protocol version.
- `GET /v1/state` returns the current FR2, FR3, gallery, window and display state.
- `POST /v1/commands` accepts a versioned command envelope.

Every command contains `id` (unique string), `version: 1`, an ISO-8601 `timestamp`,
`type`, and the type-specific `payload`. The supported v1 names and payloads remain
`show`, `transform`, `hide`, `disconnect-outputs`, `window`, and `reset-transform`.
Duplicate command IDs are acknowledged without applying the command again.
Unknown, malformed, or unsupported commands are rejected.

`show` validates that the image URL uses HTTP or HTTPS and returns an image
content type, then applies the supplied image and transform to FR2. `transform`
and `reset-transform` affect FR2 only. Brightness, contrast and saturation are
clamped to 0–200; zoom is clamped to 1–4; each pan axis is clamped to
`±((zoom - 1) × 50)%`, so the image continues to cover FR2. Older v1 transforms
that omit `saturation` normalize it to 100. FR2 transforms belong to the active
onAIR image and are not persisted between sessions. `reset-transform` applies
the saved FR2 brightness, contrast and saturation defaults, with zoom 1, centered
position and no flip.

`GET /v1/state` includes `transformDefaults`, the FR2 `window` settings and an
`fr3` object. FR3 reports `enabled`, derived `visible`, the common output
`displayId`, `selectedBackgroundId`, `activeBackgroundId`, and a full image
transform (`brightness`, `contrast`, `saturation`, `zoom`, `panX`, `panY`,
`flipX`). `backgrounds` lists local gallery entries with their ID, display name,
availability and a Viewer-managed image URL. `defaultImage` remains in the state
as a compatibility descriptor for the active FR3 image; it does not restore an
FR2 background layer and the HTTP protocol does not expose gallery source paths.
The additive `outputOrder` object defaults to `{fr2: 3, fr3: 1}`. Values are
normalized to integers from 0 to 100; the higher value places that native output
window above the other, and equal values place FR2 above FR3.

The FR1 Settings page saves persistent FR2 brightness, contrast and saturation
defaults explicitly. Saving them does not change the active onAIR image; the
profile is used for FR2 initialization and `reset-transform`.

FR1 Control uses the full available window width with two equal side-by-side
columns and compact 16:9 previews. FR2 and FR3 labels sit at the top left inside
their respective preview cards. The FR2 preview shows only the onAIR image
received from `plasma.test`. The FR3 preview uses the selected gallery entry;
selection changes the preview but does not change the live background. `Afișează`
applies the selected background to FR3, and the previous live image remains in
place until the new image is ready. The same loading behavior applies when a new
onAIR image replaces the current FR2 image. FR3's brightness, contrast, saturation,
zoom, position and horizontal flip are independent of the FR2 adjustments and
apply live. Slider changes do not alter native window bounds, fullscreen state,
or z-order.

FR2 fullscreen/windowed actions are at the top right of its preview card, beside
the FR2 label. Its position/dimensions panel immediately follows the preview.
Both image-adjustment panels can be folded using their keyboard-accessible
headings. They start expanded; folding is UI-session state only and does not
alter or reset either transform. Output display selection is not in Control:
Settings contains one monitor selector shared by FR2 and FR3, and their persistent
relative z-index controls.

FR3 images are imported into a managed local gallery, copied into Viewer data,
and validated as images before import. Gallery names and entries persist across
restarts. The gallery is a single row with local horizontal scrolling when
needed; long names are truncated visually without changing the saved name.
Names initially come from imported filenames; rename controls are no longer
shown in the gallery (the typed rename API is retained for compatibility).
Removal uses a small red X above the thumbnail's top-right corner and requests
a localized native confirmation. Cancel is the default and leaves files,
selection and settings unchanged. Acceptance deletes only the managed copy,
never the source file. Main rechecks whether the item became live while the
confirmation was open before deleting it.
Selecting an item changes only the preview selection; the selected and
active IDs are persisted separately. An enabled active image cannot be removed
until FR3 is explicitly hidden/disconnected or another background is applied;
being temporarily covered by fullscreen FR2 does not unlock removal.
Legacy settings with one `defaultImagePath` are copied into the
gallery at startup and become both the selected and active item; existing FR3
enabled state and color settings are retained. Invalid or missing gallery files
remain unavailable and are not displayed.

The first legacy-image migration preserves the original settings file as
`viewer-settings.pre-dual-preview.json` in Viewer userData; retries do not
overwrite that backup. Original imported image files are never deleted.

FR3 is a separate, fullscreen background window on the same display as FR2.
It cannot receive focus or input. Updating either legacy display field updates
both outputs. Migration prefers the previous FR2 display when available, then
the previous FR3 display, then an available monitor; disconnecting a monitor
also keeps both outputs on the same fallback display.
With the default order, FR3 stays behind windowed FR2. While visible fullscreen
FR2 occupies their common display and is above FR3, FR3 is temporarily hidden
and returns when FR2 is hidden or windowed. Explicitly placing FR3 above FR2
keeps FR3 visible above it, including fullscreen FR2. These numbers control only
the relative order of the output windows, not a global Windows z-index.
Native stacking is updated only for a relevant change in order, display, mode,
topmost or visibility; changing numeric ranks without changing their relative
order does not restack windows.

The v1 `show`, `hide`, and `disconnect-outputs` commands retain their names and
payloads. `show` reconnects FR2 and any enabled FR3. As clarified for PV-008,
`hide` clears and hides FR2 without disabling FR3; an enabled FR3 also returns
when it was temporarily covered by fullscreen FR2. `disconnect-outputs`
hides both output windows and clears the active FR2 image; it temporarily
suppresses FR3 without changing its saved enabled setting. The next `show`
reconnects the enabled outputs.

FR2 window settings persist, including its selected display, fullscreen,
topmost, bounds and `free` or `16:9` aspect mode. With `16:9` selected, main
normalizes windowed FR2 bounds after resizes and bounds changes, preserving the
edited width (or deriving it from an edited height) and clamping to the display
work area. Fullscreen does not overwrite the saved windowed bounds. FR3 always
uses fullscreen geometry on the common selected display.

FR1 also provides a non-persistent keyboard adjustment mode for windowed FR2.
With FR1 focused and the capture surface active, arrows move FR2 by 10 px,
Ctrl+arrows resize it by 10 px, Shift changes the step to 50 px, and Escape exits
the mode. It is not a system-wide shortcut; editable controls, fullscreen and
lost focus disable or suppress it. Main validates all bounds changes.

The visible header and native application title are PlasmaVu. Package identity,
executable name and userData location remain unchanged, preserving existing
settings and managed gallery files. The gallery, selected/applied background,
FR3 adjustments, common display and relative order are restored at startup.

Closing PlasmaVu asks for confirmation when FR2 onAIR or FR3 is live. If
confirmed, both output windows are disconnected before the application quits.
