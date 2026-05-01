# Design System — ReplayX

## Product Context
- **What this is:** A Codex-first incident proof engine that turns production-style incidents into ranked diagnosis, validated patch strategy, review artifacts, regression proof, postmortem, and reusable incident memory.
- **Who it's for:** Engineering operators, technical leads, and founders who need to know whether an incident is understood, whether a fix is credible, and what proof exists before trusting the patch.
- **Space/industry:** Incident management, developer tooling, engineering productivity.
- **Project type:** Operational product with an editorial first impression. The homepage is an entrance into the proof workspace, not a generic marketing page.
- **Primary action:** Start or inspect a live ReplayX run until the user can trust the diagnosis, patch, and regression plan.

## Aesthetic Direction
- **Direction:** Premium restrained operational editorial
- **Decoration level:** Intentional
- **Mood:** Calm, high-trust, precise, and quietly premium. ReplayX should feel like a serious proof room: fast enough for incidents, restrained enough for executives, and concrete enough for engineers.
- **Differentiation:** Warmer and more human than fleet monitoring tools, more evidence-led than standard incident SaaS, and less template-like than an AI demo dashboard.

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
  - `--bg`: `#f4efe6`
  - `--bg-raised`: `#fbf7ef`
  - `--surface-solid`: `#fffaf2`
  - `--surface-inverse`: `#221917`
  - `--text`: `#241b18`
  - `--muted`: `#74665b`
  - `--accent`: `#b65742`
  - `--accent-soft`: `#f4d8ce`
  - `--success`: `#2f7a55`
  - `--warning`: `#9c6a11`
  - `--danger`: `#b04432`
  - `--info`: `#4a6576`
- **Rules:**
  - One primary accent only
  - No purple, indigo, or blue-to-purple gradient defaults
  - Dark surfaces only for emphasis, never everywhere
  - Light and dark modes use the same semantic tokens and must be visually checked together

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
  - Large panels/surfaces: `16px`
  - Compact rows/chips: `8–12px`
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
- The first screen should answer: what is being proven, what is the next action, and what evidence exists.

### Incident Workspace
- This is the hero product screen
- Top rail must make current state obvious in under 5 seconds
- Timeline and validation need stronger visual authority than decorative panels
- Commands, PR metadata, and evidence should use crisp mono treatment
- Decision callouts should be informational or proof-oriented unless the state is genuinely failed or blocked.

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
