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

- Export v2, then round-trip frames, dormant native-mode geometry and custom CSS.
- Import legacy and v1 fixtures; reject unrelated JSON, empty objects, malformed blocks and unsupported versions.
- Map missing scene/user IDs and explicitly exclude entries. Test duplicate destinations and excluded relative targets.
- Review merge, camera replacement and full restoration, including a complete empty backup.
- Confirm copying/importing a subset leaves unselected scenes, users and fields unchanged.
- Inject a setting-write failure in a test environment; verify rollback and incomplete-recovery reporting without overwriting another GM's changes.

## Visual editor and media

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

- Navigate all sections and actions by keyboard; inspect focus, labels, errors and disabled-control explanations.
- Test English, Spanish and Galician, long user names and resized panels.
- Run `npm test` and inspect the diagnostic report's saved/draft state.
- Record Foundry build, browser, client roles, result and any remaining defects before authorizing publication.
- Keep version unchanged until publication is authorized; then align SemVer, changelog, manifest/download metadata and GitHub tag.
