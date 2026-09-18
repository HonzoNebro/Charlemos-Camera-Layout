# UX renewal acceptance checklist

The implementation is not a substitute for visual validation in Foundry. Every item below is pending manual verification in Foundry 13.351 and 14.361. Use a backed-up test world, one GM and one player; add a second GM for conflict tests.

## Safe editing

- Open scene A, edit two cameras, switch sections and users, and confirm pending values remain.
- Switch to B: preview disappears and Apply is blocked. Return to A and confirm the draft remains.
- Delete A while editing: retain the draft for inspection without allowing writes.
- Edit an offline user; then test deletion of that user before Apply.
- Preview changes to geometry, effects, artwork, names and background: player view must remain unchanged until Apply.
- Apply, edit again, cancel: restore the latest saved state, not the pre-Apply snapshot.
- Test Save and close, header close, Cancel and each pending-changes decision.
- Have another GM edit different fields, then the same field. Resolve both saved/draft choices without losing unrelated values.
- Run existing immediate-apply and load-for-editing macros while the panel is open.

## Import and recovery

- Create library templates from saved state and a valid draft; verify only the library changes and scene Cancel does not undo an explicitly confirmed library write. Rename/delete without a scene, and reload after reconnecting as another GM.
- Load a template into two different scenes, assign/exclude missing user IDs and relative targets, undo/redo and Apply. Verify backgrounds and destination-only cameras stay unchanged. Changing or deleting a template must not modify already configured scenes.
- Have two GMs replace/delete the same selected template; ensure stale actions require refresh. Simulate a failed library write and verify recovery reporting and absence of duplicated submissions.
- Export/import the optional JSON v2 library block, exclude a template, replace matching IDs, restore a complete empty library and restore an old three-block backup. The old backup must not clear templates. Template user IDs must be assigned on load, not guessed by name on import.

- Export v2, then round-trip frames, dormant native-mode geometry and custom CSS.
- Import legacy and v1 fixtures; reject unrelated JSON, empty objects, malformed blocks and unsupported versions.
- Map missing scene/user IDs and explicitly exclude entries. Test duplicate destinations and excluded relative targets.
- Review merge, camera replacement and full restoration, including a complete empty backup.
- Confirm copying/importing a subset leaves unselected scenes, users and fields unchanged.
- Inject a setting-write failure in a test environment; verify rollback and incomplete-recovery reporting without overwriting another GM's changes.

## Visual editor and media

- Compare Automatic, Normal, Screen and Soft light using PNG/WebM frames with and without tint, including paths containing `/frame`. Switch modes repeatedly and return to Automatic; confirm legacy appearance returns without stale media styles. Verify undo/redo, discard and shared state only after Apply. Check blending against bright/dark video and the area outside the camera.

- Load each quick frame preset with enabled and disabled PNG/WebM frames. Check the bounds diagram, preserved asset/tint/opacity and unchanged camera/video geometry. Undo/redo must treat each preset as one step; another client must see nothing until Apply. Discard must restore the saved frame. Check all three languages and a narrow panel.

- Test all four dock orientations, extremes, scrolling and camera-off avatar views.
- Undock, move, resize, minimize, restore and dock again. In V14 also detach/reinsert the application window.
- Use camera handles, aspect lock, guides, CSS-pixel tolerance and vw/vh/%/px values at different window sizes.
- Resize a relative camera; verify free movement requires explicit absolute conversion.
- Test complex CSS preservation and explicit conversion without silent unit changes.
- Move, rotate, scale and expand PNG/WebM frames; video dimensions and transforms must stay unchanged.
- Adjust top and bottom name offsets and ensure native names, speaking indication and A/V controls remain usable.
- Change assets quickly, including invalid paths; old validation results must not override the selected asset.
- Interrupt gestures with Escape, scene teardown and DOM replacement; check undo grouping and absence of duplicated controls.
- Repeat open/preview/apply/cancel cycles with 720p and 1080p feeds; inspect observers, listeners, media resources and memory/GPU trends.
- Confirm the original A/V dock keeps playing throughout. Test canvas-disabled worlds and V14 Level switches for background fallback.

## Accessibility and release

- Review saved scene compositions, duplicate into a different scene with existing users/background, decline a review and simulate source changes. Check destination scene binding, one-step undo, missing-user warnings and retained background.
- Export saved/draft macros with duplicate names and verify active-scene execution remains unchanged. Download diagnostics both directly and from the report window; check privacy guidance and edited versus viewed scene IDs.

- Navigate all sections and actions by keyboard; inspect focus, labels, errors and disabled-control explanations.
- Test English, Spanish and Galician, long user names and resized panels.
- Run `npm test` and inspect the diagnostic report's saved/draft state.
- Record Foundry build, browser, client roles, result and any remaining defects before authorizing publication.
- Keep version unchanged until publication is authorized; then align SemVer, changelog, manifest/download metadata and GitHub tag.
