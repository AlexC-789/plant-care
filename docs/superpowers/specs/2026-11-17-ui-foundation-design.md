# UI foundation: applying the "Glazed Ceramic" design: design (small change)

Date: 2026-11-17
Status: Draft for approval
Applies: [App UI design](2026-11-17-app-ui-design.md) (canvas: https://claude.ai/artifact/FVr5hjCEB2vj7uZ7gpcKUy)
Builds on: milestone 1 + email confirmation (on `main`)

## Intent
Give the app the approved look now, and a theme layer every later milestone builds on, so
the new screens come straight from the canvas and nothing gets restyled twice.

## Scope
**Now:** theme tokens and shared building blocks; restyle the screens that exist (sign in,
sign up, the empty Plants home, Settings, email-confirmed); dark mode; large-text behaviour.

**Later (with the milestone that brings the feature):** plant rows and status sentences,
plant detail, actions, the "Add a pot" flow, alerts, module settings, the offline and
loading states, the empty-state line drawing, and the notification toggles in Settings.

## Owner decisions (2026-11-17)
- **Keep units, the design's way:** new default **Automatic (from region)**, with Metric and
  Imperial as overrides. DB: `profiles.units` gains `'auto'`, which becomes the default.
  Existing rows are left as they are.
- **Keep quiet hours:** built in milestone 6 with notifications, as a Settings row in this
  style. Nothing now.
- **Approach:** a small in-house theme (no styling library), a lint rule that blocks raw
  colours outside the theme, and a shared large-text check.

## Approaches
- **In-house theme (chosen):** the design's token tables map one-to-one; no dependency;
  about five small components.
- Styling library (NativeWind / Tamagui) (rejected): new build setup and conventions; the
  iOS text styles don't map cleanly; more machinery than needed.

## Design
**Theme (`src/theme/`):** colours exactly as the design's table, for light and dark; type
styles (largeTitle, title, title3, headline, body, callout, subheadline, footnote, caption1)
with the design's sizes and leading; spacing on the 4 pt grid; radii (thumbnail 14,
group 22, capsule). `useTheme()` follows the phone's light/dark setting.
`useIsAccessibilitySize()` is true above the largest standard text size (font scale > 1.4).
Text scales with the system setting and is never capped.
Serif (plant names, large titles): `ui-serif` on iOS, `serif` on Android,
`ui-serif, "New York", Georgia, serif` on web.

**Building blocks:** themed `Text` (by style name and colour token); capsule `Button`
(prominent = tint, bordered = tinted outline; 44 pt minimum); `InsetGroup` with an optional
header and footer; `Row` (label, value, chevron, checkmark, switch, text field, destructive).
Icons: SF Symbols on iOS via `expo-symbols`, with an equivalent fallback on Android and web.

**Lint:** raw hex/rgb colour literals are errors outside `src/theme/`.

**Screens:**
- **Plants (home):** large serif title "Plants" on the paper background; toolbar
  `person.crop.circle` opens Settings. Empty state per the canvas: "No plants yet", then
  "Adding pots arrives in the next build." The "+" button and "Add a pot" appear with the
  milestone that builds the flow, so nothing on screen does nothing.
- **Settings:** a sheet with "Done". Groups: Profile (display name); Units (Automatic /
  Metric / Imperial as a checkmark list); Plan ("Free (testing)" / "Active", kept from
  milestone 1 for testing the entitlement switch); Account (email, Sign out).
- **Sign in / sign up:** serif title, fields in an inset group, prominent capsule button,
  bordered "Resend…" button, tint links. Error text uses `statusNow` (6.5:1); notices use
  `label`. All copy and behaviour unchanged.
- **Email confirmed:** paper background, serif title, secondary body, tint "Sign in" link.
- **Dark mode:** follows the system, using the design's dark values.

## Testing
- Existing tests keep passing. Copy and behaviour are unchanged except the home title
  ("Plants") and empty-state text.
- New tests: a theme contrast test (the WCAG pairs the design lists, both themes; text
  pairs at least 4.5:1); the Settings sheet (units choice saves `auto` / `metric` /
  `imperial`); `useIsAccessibilitySize`; and pgTAP for the new `units` value and default.
- Browser screenshots of each screen in light and dark.

## Left to the builder
The Android/web icon fallback set, the exact Settings sheet presentation per platform,
and component file layout inside `src/theme/` and `src/ui/`.
