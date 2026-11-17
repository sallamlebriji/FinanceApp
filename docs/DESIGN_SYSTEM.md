# Design system

Grounded in Apple's Human Interface Guidelines via the installed **apple-design** skill (references read:
`accessibility.md`, `layout.md`, `typography.md`, `color.md`, `designing-for-ios.md`, `dark-mode.md`, `branding.md`,
`charting-data.md`, `sidebars.md`, `tab-bars.md`, `cross-platform.md`) and the **dataviz** skill for charts.
Tokens live in `apps/web/src/styles/index.css`.

## Identity

**Mizan** (ميزان — "balance, scale"). Point of view: a calm instrument that weighs what comes in against what
goes out. Accent: **Majorelle blue**, the cobalt of Marrakech's Jardin Majorelle — rooted in the product's
market rather than a template palette.

**Signature element — the balance beam** (`features/dashboard/balance-beam.tsx`). A literal scale tips toward
income or spending for the selected period. It always ships with a text sentence ("Spending outweighs income by
…"), so meaning is never carried by motion or colour alone. Everything else stays quiet.

## Colour (semantic, role-named)

| Token | Light | Dark | Contrast (on surface) |
| --- | --- | --- | --- |
| `--label` | `#111114` | `#F4F4F6` | 18.9 / 16.3 |
| `--label-2` | `#55555F` | `#A9A9B3` | 7.4 / 7.7 |
| `--label-3` | `#6B6B75` | `#8E8E98` | 5.3 / 5.5 |
| `--accent` (Majorelle) | `#4B3FD1` | `#9D95FF` | 7.2 / 7.0 |
| `--positive` | `#18794A` | `#4CC38A` | 5.4 / 8.1 |
| `--negative` | `#C2362B` | `#FF7B70` | 5.5 / 7.1 |
| `--warning` | `#9A5A00` | `#F2B24C` | 5.5 / 9.6 |

All text/status tokens ≥ 4.5:1 on both `--bg` and `--surface` in both appearances (lowest 4.80:1). Increased
contrast (`prefers-contrast: more`) darkens secondary labels and separators.

Rules: the accent is reserved for the primary action, selection and progress (HIG `branding.md`). Income vs
spending is never colour-only — amounts carry a sign (+ / −) and deltas carry an arrow and words.

## Charts (dataviz method)

| Series | Light | Dark | Validator |
| --- | --- | --- | --- |
| Income | `#4B3FD1` | `#9085E9` | PASS all checks (CVD ΔE 30.7 light / 26.0 dark) |
| Spending | `#EB6834` | `#D95926` | PASS |

Forms: cash flow = grouped bars (2 series → legend, one y-axis, tooltip); spending = ranked single-hue meter list
(not a donut); net worth = single line with crosshair. Every chart has a text headline and an accessible label.

## Type

System stack (`-apple-system`, SF Pro on Apple, Segoe UI Variable on Windows, Roboto on Android). Scale (px):
caption 11 · footnote 12 · subhead 13 · callout 14 · body 15 · title3 19 · title2 22 · title1 28 · display 44.
Nothing below 11 px; no light weights; all money uses tabular figures.

## Shape, depth, motion

Radius: controls 10 · cards 16 · sheets 20. Depth by surface colour, not borders; only floating layers (menus,
sheets, toasts) cast shadows. Motion 120–220 ms ease-out, all reduced to 1 ms under `prefers-reduced-motion`.

## Components (`apps/web/src/components/ui`)

Button (primary · secondary · tinted · plain · ghost · destructive) · Field/Input/Select/Textarea (labelled,
inline errors with `role="alert"`) · Sheet (trailing panel ≥ md, bottom sheet on compact, always a Close button) ·
Confirm (alert dialog, Cancel focused) · Menu · Segmented · Progress (`role=progressbar`) · Money · Badge ·
Skeleton · EmptyState · ErrorState · Toast (5–8 s, dismissible, Undo action) · CategoryIcon.

## Navigation

Regular width: sidebar (one level). Compact width: bottom tab bar, 5 single-word tabs, never hidden or disabled
(HIG `tab-bars.md`). Only shipped modules appear in navigation. Keyboard: `N` new transaction, `/` search,
skip link, visible focus rings everywhere.

## Design review — Phase 2 (web)

**Rating: Good.** Thesis: "one calm screen that tells you whether this period balances." Remembered by the beam.

Fixed during review: KPI deltas wrapping (moved "vs previous" to one caption), budget names truncating (figures
moved under the meter), sticky day headers overlapping rows, double focus ring on the amount field, raw ISO dates in
alerts, compact top bar search squeezed (now an icon to Transactions), budgets headline ignoring near-limit budgets.

Open (tracked in PROGRESS.md): UI copy is English-only while numbers/dates follow `fr-MA` — needs i18n (FR/AR,
RTL); bundle is 1.1 MB (route code-splitting); tab label 11 px is the HIG minimum — verify at 200 % zoom.

## Mobile (Phase 3, `apps/mobile`)

Same identity and tokens (`apps/mobile/src/theme.ts` mirrors the web palette and its contrast figures), adapted to
the platforms rather than ported from the web:

| Concern | iOS | Android | Source |
| --- | --- | --- | --- |
| Top-level navigation | `UITabBar` via `NativeTabs`, SF Symbols (filled when selected) | Material 3 navigation bar, Material Symbols | `tab-bars.md › Best practices` |
| Focused tasks (new/edit transaction, account, budget) | Form sheet, grabber, swipe to dismiss | Bottom sheet | `sheets.md`, `modality.md` |
| Sheet actions | Cancel leading, prominent Save/Add trailing | Same (Android sheets can't show a native header) | `toolbars.md` |
| Titles | Large title per tab, header role for VoiceOver | Same | `typography.md` |
| Type | iOS "Large" Dynamic Type sizes (body 17, footnote 13, caption 12); scales with the system text size | Roboto at the same sizes | `typography.md › Supporting Dynamic Type` |
| Hit targets | 44 pt | 48 dp | `accessibility.md`, `cross-platform.md` |
| Destructive actions | System alert, Cancel is the safe default | Same | `alerts.md` |
| Feedback | Success haptic on save | Same | `playing-haptics.md` |
| Refresh | Pull to refresh on every tab | Same | Judgment (platform convention) |

Adding a transaction is a prominent `+` toolbar button on Home and Activity — never a tab, because tabs navigate and
don't act. Choices beat typing in the composer: accounts, categories, dates (Today / Yesterday) and payment methods
are chips; the amount is the one large field and opens the decimal keypad.

Button labels use Apple's title-style capitalization on both platforms (one convention for one codebase).

## Design review — Phase 3 (mobile)

**Rating: Good.** Thesis: "the same calm balance, one thumb away" — the beam on Home, and a two-tap path from any
tab to a saved expense. Verified in the Expo web preview at 375 × 812, dark and light, against the real API.

Fixed during review:

- The amount field was wider than the sheet on web and pushed the whole form off-screen (`minWidth: 0`).
- Typing a malformed amount ("37,2537,25") crashed validation with a decimal.js exception — fixed in the shared
  schema (`abort: true`), which also protects the web and the API; regression test added.
- Percentages used a dot ("92.5 %") in a comma locale; now formatted with the person's locale ("92,5 %").
- Edit forms showed stored amounts with a dot ("37.25"); now shown as typed ("37,25").
- Lower-case day headers in Activity ("samedi 14 novembre") are now capitalised.
- Sheet Cancel/Save buttons had no accessible name; savings caption said "of income" when there was none.

Open (tracked in PROGRESS.md):

- **Medium** — no swipe actions on list rows (`designing-for-ios.md › Best practices` asks for swipe actions in list
  rows); delete/duplicate live inside the edit sheet for now.
- **Medium** — swiping a sheet away with unsaved edits doesn't ask for confirmation (`sheets.md`: "If people have
  unsaved changes in the sheet when they begin swiping to dismiss it, use an action sheet to let them confirm").
- **Medium** — a custom date is typed as YYYY-MM-DD; a native date picker should replace it (`pickers.md`).
- **High (release blocker)** — app icon and splash are Expo placeholders; needs an icon built from the balance mark,
  with dark and tinted variants (`app-icons.md`).
- Not yet verified on physical iOS/Android devices or at the largest accessibility text sizes; English-only copy.
