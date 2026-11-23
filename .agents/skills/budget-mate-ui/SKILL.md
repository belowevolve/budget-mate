---
name: budget-mate-ui
description: Applies budget mate UI conventions when changing a scrolling list, category picker, bottom sheet, or mobile operation layout. Preserves shadcn scroll fade on the scrollable part.
---

# budget mate UI

- Apply the shared shadcn utilities `scroll-edges-y` and `scroll-edges-x` to every user-facing scroll viewport. In a ui-sdk Select, fade the list alone. In a sheet, fade the scrolling body while keeping its grip and footer outside the mask.
- Reuse `surface-panel list-panel` for framed lists of places and bindings. The list inside the frame owns scrolling and fading, while the frame, search and actions stay visible. Use `settings-row` for the rows and the shared `SearchField` for the native search input, magnifier and clear action.
- Let list-only sheets reach the bottom safe area so the fade runs to the edge. Preserve scrolling by touch, wheel, and keyboard while hiding scrollbar tracks.
- Keep the journal's mobile gutters on its controls and list. Let operation rows fill the card up to its rounded outer edge. Give row labels a single horizontal inset.
- On mobile, extend the bill participant scroll viewport to the left edge and keep the first chip aligned with the form inset.
- When editing scrollable UI, verify at 360 CSS px with enough items to scroll. Check the mask at the start and end of the list, that the final option is fully readable, and that a short list displays without fading.
