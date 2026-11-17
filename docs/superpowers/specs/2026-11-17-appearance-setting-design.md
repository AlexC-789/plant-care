# Appearance setting and launch timing: design (small change)

Date: 2026-11-17
Status: Draft for approval
Amends: [App UI design](2026-11-17-app-ui-design.md) (it said "theme follows system")

## Owner decisions (2026-11-17)
- The app is **light by default**, whatever the phone's setting. Users can switch to **Dark** in
  Settings. There is no "System" option.
- The launch animation rests on the finished drawing for about half a second before fading
  (≈ 1.2 s total).

## Behaviour
- **Settings → Appearance:** two checkmark rows, **Light** (default) and **Dark**. Choosing one
  applies instantly everywhere: every screen, the sign-in screens, the launch animation, and
  native pieces (keyboard, alerts, date pickers) via React Native's `Appearance.setColorScheme`.
- **Saved on the phone** (AsyncStorage), not in the account: it must apply before sign-in, and
  it's a device preference. Signing out keeps it.
- **App config:** `userInterfaceStyle: "light"`. The native launch screen is always paper, and
  its dark variant is removed.
- **Start-up for Dark users:** the saved choice is read before the launch animation renders (a
  few ms), so the animation and app are dark. Only the native launch screen before it is paper,
  for a split second.
- **Launch timing:** drawing ≈ 700 ms → rest 500 ms → fade 250 ms. It still runs while the
  session loads, so it never adds waiting on top.

## Approaches
- **App-wide override via `Appearance.setColorScheme` + stored preference (chosen):** one switch
  that native components follow too; `useTheme` needs no change.
- Theme context only (rejected): native keyboard and alerts would stay light in Dark mode.

## Testing
- Appearance rows: Light checked by default; choosing Dark calls `setColorScheme('dark')`,
  saves the choice and checks Dark; a saved choice is applied on start before the launch
  overlay renders.
- The phone set to dark with no saved choice → the app is light.
- Launch: `onDone` fires only after drawing + rest (≈ 1.2 s); Reduce Motion is unchanged (fade).
- Browser screenshots: Settings in Light and Dark; launch frames.
