# ReplayX 2-Minute Hackathon Demo Script

This script is optimized for the actual judging constraints:

- max 2-minute video
- must clearly show what was built during the hackathon
- must meaningfully leverage Codex
- should feel ambitious, not incremental

The winning angle is not "we made a dashboard."

The winning angle is:

`We built an incident-response system where Codex acts like a bounded debugging team: intake -> diagnosis arena -> challenger -> fix plan -> regression proof -> postmortem -> reusable skill.`

Do not try to show everything.
Show one incident.
Show one transformation.
Show one unforgettable product idea.

---

## The Story To Sell

ReplayX is not a chatbot.
ReplayX is a Codex-native incident-response system.

It takes a production-style incident and turns it into:

- a ranked diagnosis
- a validated fix path
- regression proof
- a postmortem
- a reusable incident skill

That is strong for this hackathon because it is:

- deeply Codex-native
- ambitious
- clearly useful
- hard to build without coding agents

---

## What Judges Must Understand In 15 Seconds

If they only remember one thing, it should be:

`ReplayX turns incident response from manual debugging into a Codex-powered pipeline with evidence, not guesses.`

---

## Recommended Video Structure

Keep the video between `1:45` and `1:55`.
Do not aim for exactly `2:00`.
Leave buffer for transitions and screen lag.

Use this sequence:

1. Hook: painful production problem
2. Show the bug
3. Show Slack intake
4. Show the live Codex diagnosis arena in ReplayX
5. Show selected fix + verification proof
6. Show reusable skill/postmortem
7. Close with the big idea

---

## Exact 2-Minute Script

### 00:00 - 00:10

Screen:

- ReplayX dashboard hero or title slide

Say:

> Production incidents are still handled like craftsmanship: logs, guesses, tribal knowledge, and pressure. We built ReplayX to turn an incident into diagnosis, fix, proof, and reusable memory using Codex.

Why this works:

- immediately states the problem
- makes the product feel large and ambitious
- puts Codex at the center

---

### 00:10 - 00:25

Screen:

- show the broken `demo_app`
- use the concurrent checkout repro endpoint or visible broken state

Say:

> Here, our seeded incident reproduces a real failure mode: concurrent checkout oversells inventory. This is the kind of bug that is expensive, user-visible, and difficult to debug quickly.

What to do:

- show failing or inconsistent output fast
- do not explain implementation details
- keep this visual proof under 15 seconds

---

### 00:25 - 00:40

Screen:

- switch to Slack
- post the bug report
- show ReplayX acknowledgment and live handoff link

Say:

> The incident starts the way real incidents do: a bug report lands in Slack. ReplayX ingests the report, starts a live Codex-powered response flow, and hands off into the dashboard.

What to do:

- paste a short bug report:
  `@ReplayX concurrent checkout oversells inventory; serial mode looks correct`
- wait for the bot response
- click the dashboard handoff link

---

### 00:40 - 01:05

Screen:

- ReplayX dashboard live run page
- diagnosis worker fan-out
- statuses changing

Say:

> This is the core idea. ReplayX does not ask one giant model for one guess. It fans out bounded Codex specialists, each with a different debugging lens, then compares their evidence in a diagnosis arena.

Then say:

> A challenger phase tries to disprove the top explanations, so we do not just get an answer. We get a defended answer.

What to highlight with your mouse:

- worker cards
- ranked diagnosis
- evidence or candidate files
- challenger or validation section

This is the most important segment in the whole demo.

---

### 01:05 - 01:28

Screen:

- fix proposal card
- verification plan
- regression proof section

Say:

> ReplayX then selects the safest winning fix path and, critically, generates the proof needed to trust it: verification steps, regression checks, and a reviewable incident record.

Then say:

> The point is not autocomplete. The point is operational confidence under pressure.

What to do:

- pause briefly on the winning diagnosis
- then move to the fix and verification cards
- make the proof visible

---

### 01:28 - 01:45

Screen:

- postmortem artifact
- reusable skill artifact

Say:

> And when the incident is over, ReplayX converts the response into durable organizational memory: a postmortem and a reusable incident skill so the next similar failure gets solved faster.

What to do:

- hover or zoom on the postmortem section
- then show the reusable skill card

This gives the demo a strong ending because it shows compounding value.

---

### 01:45 - 01:58

Screen:

- full ReplayX dashboard summary view
- optionally split with broken app on one side and ReplayX result on the other

Say:

> We built ReplayX during the hackathon as a Codex-first incident-response system: intake, diagnosis arena, challenger, fix strategy, regression proof, and reusable knowledge in one flow.

Then close with:

> ReplayX is what incident response looks like when Codex is the debugging team.

---

## Shorter Closing Variant

If you are running long, replace the final lines with:

> ReplayX turns incidents into defended fixes and reusable memory with Codex at the center.

---

## What To Physically Do While Recording

### Before recording

Have these ready:

- `demo_app` already running
- `dashboard` already running
- Slack already authenticated and connected
- one test incident already verified end-to-end
- browser tabs arranged in order:
  1. demo app
  2. Slack
  3. ReplayX dashboard live run

### During recording

1. Start on ReplayX title/dashboard.
2. Jump to broken app and show the failure immediately.
3. Jump to Slack and send the bug report.
4. Open the handoff link.
5. Narrate the diagnosis arena while scrolling slowly.
6. Pause on winning diagnosis.
7. Pause on fix plus verification proof.
8. End on postmortem plus reusable skill.

### Recording rules

- Speak slightly slower than normal.
- Do not improvise new claims.
- Do not explain architecture diagrams.
- Do not type more than one message live.
- Do not wait on slow transitions; rehearse until the flow is tight.

---

## Exact Slack Message To Use

Use this:

```text
@ReplayX concurrent checkout oversells inventory; serial mode is fine. Please diagnose and propose the safest fix with verification.
```

This is better than a vague report because it:

- names the failure
- gives a control condition
- tees up diagnosis plus proof

---

## What Not To Say

Avoid these weak phrases:

- "This is kind of like ChatGPT for incidents"
- "We have some agents doing stuff"
- "We also built a dashboard"
- "This could maybe help developers"
- "This is an MVP"

Those make the product feel smaller and less defensible.

---

## What To Emphasize Repeatedly

These are the winning phrases:

- `Codex-first incident response`
- `bounded specialists, not one giant guess`
- `evidence and challenger validation`
- `fix plus regression proof`
- `reusable incident memory`

---

## Judge-Friendly One-Liner

If someone asks what ReplayX is after the demo, answer with:

> ReplayX is a Codex-native incident-response system that turns a bug report into a defended diagnosis, safe fix plan, proof, and reusable incident knowledge.

---

## README / Submission Alignment

Your repo submission should explicitly say:

- what was built during the hackathon
- that ReplayX is Codex-first
- that the golden demo flow is:
  - broken app
  - Slack intake
  - diagnosis arena
  - fix plan
  - verification proof
  - postmortem
  - reusable skill

Your video should match that exact story.

---

## Final Recommended Spoken Script, Clean Version

Use this if you want one single read-through:

> Production incidents are still handled with logs, guesses, and tribal knowledge under pressure. We built ReplayX to turn an incident into diagnosis, fix, proof, and reusable memory using Codex.
>
> Here, our seeded incident reproduces a real failure mode: concurrent checkout oversells inventory. It is user-visible, expensive, and hard to debug quickly.
>
> The incident starts the way real incidents do: a bug report lands in Slack. ReplayX ingests the report, normalizes the incident, and starts a Codex-powered response flow.
>
> This is the core idea. ReplayX does not ask one giant model for one guess. It fans out bounded Codex specialists, each with a different debugging lens, then compares their evidence in a diagnosis arena.
>
> A challenger phase tries to disprove the top explanations, so we do not just get an answer. We get a defended answer.
>
> ReplayX then selects the safest winning fix path and generates the proof needed to trust it: verification steps, regression checks, and a reviewable incident record.
>
> When the incident is over, ReplayX converts the response into durable organizational memory: a postmortem and a reusable incident skill so the next similar failure gets solved faster.
>
> We built ReplayX during the hackathon as a Codex-first incident-response system: intake, diagnosis arena, challenger, fix strategy, regression proof, and reusable knowledge in one flow.
>
> ReplayX is what incident response looks like when Codex is the debugging team.
