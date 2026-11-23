# budget mate

## User preferences

- Do not create or extend automated tests unless the user explicitly asks for tests. Run the project's existing validation checks as needed.
- Design and verify mobile layouts starting at 360 CSS pixels.

## Design system

Define all application colors as semantic tokens in `src/index.css`, including chart accents. Keep Tailwind's default color palette disabled. Use named tokens in UI code and avoid raw color values, default palette classes, and ad hoc color overrides.

Use ui-sdk for interactive behavior. Build screens from small components that own their markup and Tailwind styles. Keep reusable UI components in `src/shared/ui` and feature components with their feature. Keep theme tokens and shared browser rules in `src/index.css`. Avoid modules that export strings of Tailwind utilities.

Use the shared `Button` for standard actions. Pass icons and labels as children. The button variant and size control spacing and default icon dimensions. Use Tailwind utilities in the component. Use the `cva` package on the v1 beta line for variants and the `cn` package for merging. Configure CVA with `defineConfig({ cx: cn })` from `cva/config`.

For changes to scrollable UI, follow the [budget mate UI skill](.agents/skills/budget-mate-ui/SKILL.md).

## Reatom

Follow the [Reatom v1001 skills](https://github.com/reatom/reatom/tree/v1001/skills) when editing models. Derive state with `computed`, use named actions for updates, use `withAsync` and `wrap` for asynchronous actions, and scope cancellation to the owning session or screen.

## ui-sdk

Before using ui-sdk, follow the ui-sdk skill if it is installed, and read `node_modules/@ui-sdk/react/docs/llms.txt`. To build a new component, also search `node_modules/@ui-sdk/react/docs/core.md` by heading and read `node_modules/@ui-sdk/react/docs/rendering.md`.
