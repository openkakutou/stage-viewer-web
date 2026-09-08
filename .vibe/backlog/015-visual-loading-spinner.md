---
status: todo
---
# Show a Visual Loading Spinner During Stage Load and Sprite Decode

## Description
Loading a stage currently gives no visual feedback beyond a plain text status (`role="status" aria-live="polite"`, e.g. "Reading…" or "Decoding sprites…") and a dimmed/disabled control — no spinner, no other visual affordance, in any of the three loading call sites (`stage-file-input-view.ts`, `background-preview.ts`, `model-preview.ts`). This reads as a blank/broken screen while a stage loads.

Consume the new `<wuik-spinner>` component from `web-ui-kit` (see that repo's backlog item "Add Loading Spinner Component") in all three call sites, following one common pattern: stop overwriting the whole `role="status"` container's content via `.textContent =` (which would wipe out the spinner on every status re-render). Instead, give each "loading" state two persistent children inside the existing `role="status" aria-live="polite"` container: a `<wuik-spinner>` (decorative — no `label` attribute, since the parent container already carries `role="status"` and a second accessible name would double-announce) plus a `<span>` carrying the existing i18n status message — it's that `span`, not the container, that `render()`/the locale-change refreshers update going forward.

- `stage-file-input-view.ts`: toggle `spinner.hidden = phase !== "loading"`; keep the existing `input.reading`/`input.readingFile` i18n keys unchanged.
- `background-preview.ts`: add `<wuik-spinner>` as the first child of the existing `<p role="status">` (`background.decodingSprites`); the existing `status.remove()` at the end of `finish()` is unchanged.
- `model-preview.ts`: same treatment for its own `role="status"` banner shown while loading the 3D model/environment.

## Acceptance Criteria
- [ ] All three loading states (`stage-file-input-view.ts`, `background-preview.ts`, `model-preview.ts`) show a visible `<wuik-spinner>` while their respective async operation is in progress, and hide/remove it once done.
- [ ] The existing `role="status" aria-live="polite"` text message (from the current i18n keys) is unchanged and still announced correctly — no accessibility regression, and no duplicate announcement from the spinner itself.
- [ ] Each of the three files' existing `.test.ts` is extended to assert the spinner's presence/`hidden` state per phase.

## Notes
Depends on `web-ui-kit`'s "Add Loading Spinner Component" backlog item (cross-repo dependency, not expressible as a local `depends_on` number) — specifically on that component being published (`@openkakutou/web-ui-kit` version bump), since this repo consumes it as a published npm dependency, not a sibling checkout.
