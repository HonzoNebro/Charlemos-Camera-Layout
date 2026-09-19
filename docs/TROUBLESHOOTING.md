# Camera troubleshooting

[Español](TROUBLESHOOTING.es.md) · [Galego](TROUBLESHOOTING.gl.md)

Use a backed-up test world. Do not diagnose A/V problems by reinstalling over your production world or deleting its settings.

## A change is not visible

With viewer-role variants, check both **Edit camera settings for** and **Local preview audience**. GM/player refers to the viewer, not the owner of the camera. A role override can hide a later base edit; use inheritance reset to remove it. With preview disabled, the saved configuration for your actual role is displayed. Role styling does not restrict access to feeds or shared settings.

1. Check the scene shown in the editor header. A draft belongs to that scene, not whichever scene you subsequently view. Return to it before applying.
2. Check whether local preview is enabled. Other clients see only the saved configuration until Apply succeeds.
3. Check whether the frame is enabled and has a valid resource. Presets and blend controls preserve its visibility; they do not enable an empty frame.
4. For position and size, check that Charlemos controls geometry and that the camera is undocked. Native dock restrictions still apply. Undocking is a separate Foundry action, not undone by Cancel.
5. Check missing users, relative positioning targets, validation messages and concurrent-edit conflicts. Disconnection alone does not prevent editing.

## A camera or avatar disappears

- First check the same camera using Foundry's native positioning control. Confirm camera permission, the selected input and the local/remote feed through Foundry's A/V controls. Charlemos does not start the camera or repair an unavailable stream.
- Disable the scene composition through your saved configuration or use a backed-up test world without Charlemos to distinguish styling from the underlying A/V feed. Keep any pending draft safe before switching context.
- In a test world, enable only Charlemos and the required A/V provider, then re-enable other camera/layout modules individually. Falemos assets can be reused as files; this does not mean two active layout managers can safely control the same camera DOM simultaneously.
- A collapsed internal video container has a targeted fallback only when Charlemos controls geometry and the camera view has a usable size. Intentionally hidden or minimized elements are not forced visible. Report recurring sizing failures with dock orientation, window size and diagnostics.

## A frame is clipped or looks washed out

In Video and effects, explicitly select a shape to replace the current crop. Compatible circles, ellipses and insets expose parameters and an illustrative diagram; custom CSS remains in Advanced. Opposite insets cannot exceed 100%.

The six frame alignment actions use the complete rectangle after extensions, scale and rotation, not its opaque silhouette. Only one offset changes, preserving its simple unit. A measurable camera is required; CSS expressions need explicit conversion. Offset percentages refer to the expanded frame. Undo is available, and nothing is shared until Apply.

- Use Expanded bounds for artwork outside the video; Inside camera retains clipping. The PNG/WebM alpha channel determines its silhouette, not the bounds rectangle.
- Quick presets are starting points, not automatic opening detection. Match the artwork's transparent opening with fit, extensions, offset and scale. The camera video keeps its own dimensions.
- Use Normal blending for illustrated artwork and portraits. Automatic retains the previous path-based Screen behavior for paths containing `/frame`; Screen and Soft light intentionally change colors against the backdrop. Frame blending is separate from tint blending.
- Browser/window edges remain a hard limit. The dock reserves space around the transformed frame but cannot draw outside the browser. In a Foundry 14 detached window, include which window owns the camera in a report.

## A scene background falls back to its native image

The live background waits for the configured user's usable video. With the camera off, disconnected or without useful dimensions, it retains the setting and shows the native background until the feed returns. Include the local background status, Foundry version and any Level changes in a report. The background is runtime rendering, not a persisted Tile or Scene texture.

## Copying and conflicts

The Composition library stores world-shared templates. Save, rename and delete require confirmation and are not undone by scene Cancel. Loading enters the draft: assign missing IDs, review destinations and Apply only when ready to share the scene. Refresh a template changed by another GM before using it. Previously configured scenes never update automatically. Older backups that omit the library leave current templates untouched.

Saved compositions are listed by scene name and ID in Tools. Duplication replaces complete source-user layouts in a destination draft, keeps other destination users and excludes the camera background. Review the affected IDs before confirming. Deleted users must be resolved or excluded with selective copy; names are never automatically matched.

If another GM or macro changes the same fields, resolve the editor's saved/draft conflict explicitly. Do not repeatedly click Apply. When a save reports partial recovery, download diagnostics and a backup before making more changes.

## Send a useful report

1. Record exact steps, expected/actual results, Foundry build, browser, GM/player role, dock/popout/detached window and whether the problem reproduces with other layout modules disabled.
2. In module settings enable Renderer debug mode, reproduce once, then use Tools → Download diagnostic JSON. The Diagnostic window also lets you inspect, copy or download its current report.
3. Review the JSON before sharing: it may include world and user names/IDs, file paths, CSS, saved configuration and drafts. It contains no camera frames or audio, but is not an anonymized report. Downloading does not upload it anywhere.
4. Attach the reviewed report and relevant browser console logs to the project's issue tracker. Disable debug mode when finished; do not delete useful logs before confirming the fix.

Automated tests do not replace checks on Foundry 13.351 and 14.361 with real cameras and multiple clients. Use the [acceptance checklist](UX_ACCEPTANCE.md) for visual validation.
