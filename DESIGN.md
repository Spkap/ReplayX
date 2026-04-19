# Design System — ReplayX

## Product Context
- **What this is:** A Slack-native incident response product that turns bug reports into live investigations, validated fixes, and reusable engineering memory.
- **Who it's for:** Engineering teams, operators, and technical leads who need to understand and resolve production issues quickly.
- **Space/industry:** Incident management, developer tooling, engineering productivity.
- **Project type:** Hybrid product. Marketing-style homepage with app-grade operational surfaces.

## Aesthetic Direction
- **Direction:** Premium restrained operational editorial
- **Decoration level:** Intentional
- **Mood:** Calm, high-trust, precise, and quietly premium. ReplayX should feel like a serious command surface with just enough editorial character to be memorable.
- **Differentiation:** Warmer and more human than Datadog or PagerDuty, cleaner and more product-grade than a founder demo page, more distinctive than standard incident SaaS.

## Typography
- **Display/Hero:** Fraunces
  Use for hero headlines and a small number of high-importance product statements.
- **Body/UI:** Manrope
  Use for all interface copy, labels, body text, and operational content.
- **Data/Tables:** IBM Plex Mono
  Use for commands, durations, IDs, status metadata, and validation outputs. Always use tabular numerals where possible.
- **Code:** IBM Plex Mono
- **Scale:**
  - Hero XL: `clamp(3.4rem, 6vw, 6.6rem)`
  - Page title: `clamp(2.4rem, 4vw, 4rem)`
  - Section title: `clamp(1.55rem, 2vw, 2.2rem)`
  - Body large: `1.0625rem`
  - Body: `0.95rem`
  - Meta/UI: `0.78rem`

## Color
- **Approach:** Restrained warm editorial
- **Core palette:**
  - `--bg`: `oklch(0.965 0.008 68)`
  - `--panel`: `rgba(255, 252, 246, 0.88)`
  - `--panel-strong`: `oklch(0.93 0.012 62)`
  - `--panel-inverse`: `oklch(0.22 0.018 32)`
  - `--text`: `oklch(0.235 0.018 38)`
  - `--muted`: `oklch(0.52 0.022 42)`
  - `--accent`: `oklch(0.56 0.16 25)`
  - `--accent-soft`: `oklch(0.92 0.038 26)`
  - `--success`: `oklch(0.57 0.11 150)`
  - `--warning`: `oklch(0.75 0.12 80)`
  - `--danger`: `oklch(0.59 0.15 24)`
- **Rules:**
  - One primary accent only
  - No purple, indigo, or blue-to-purple gradient defaults
  - Dark surfaces only for emphasis, never everywhere

## Spacing
- **Base unit:** `8px`
- **Density:** Comfortable but not airy
- **Scale:** `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`
- **Rules:**
  - Tighter spacing on app surfaces than on the homepage
  - Related metadata should feel clustered
  - Page sections should be separated with real rhythm, not identical gaps everywhere

## Layout
- **Approach:** Hybrid
  - Homepage: asymmetric editorial composition
  - Product surfaces: structured operational grid
- **Grid:**
  - Max width: `1280px`
  - Desktop workspace: 12-column rhythm
  - App content should prefer rails and grouped regions over repeated equal-width cards
- **Radius hierarchy:**
  - Small controls: `999px`
  - Panels: `24px`
  - Compact rows/chips: `16px`
- **Cards rule:** Cards are not the default layout tool. Use them only when the card is the interaction, status unit, or evidence block.

## Motion
- **Approach:** Intentional and restrained
- **Required motion:**
  - Homepage hero reveal
  - Tab/content transition in incident workspace
  - Hover/selection motion on key interactive elements
- **Rules:**
  - No bounce
  - No decorative looping motion
  - Prefer opacity + transform
  - Keep durations in the `140–320ms` range

## Page Guidance
### Homepage
- One strong composition in the first viewport
- Primary CTA is the product entrance
- Supportive links are secondary, not equal-weight calls to action
- The featured product truth should be: `Slack -> Workspace -> Validated PR -> Memory`

### Incident Workspace
- This is the hero product screen
- Top rail must make current state obvious in under 5 seconds
- Timeline and validation need stronger visual authority than decorative panels
- Commands, PR metadata, and evidence should use crisp mono treatment

### Ops Command Center
- Should feel like live fleet monitoring
- Dense but readable
- More “control room” than “marketing dashboard”

### Analytics
- Should feel trustworthy and analytical, not decorative
- Metrics first, explanation second
- Typography should do most of the hierarchy work

## Anti-Slop Rules
- No generic 3-column icon feature grid as the main first impression
- No centered-everything SaaS template rhythm
- No ornamental blobs or floating circles
- No same-radius-on-everything softness
- No overuse of cards to solve layout
- No headline/copy patterns that sound like landing-page filler
