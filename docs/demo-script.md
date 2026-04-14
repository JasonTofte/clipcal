# ShowUp Demo Script

**Target time:** 3 minutes
**Format:** Live demo on projector (phone or laptop browser)
**URL:** clipcal.vercel.app (or localhost:3000 as backup)

---

## Pre-Demo Setup

- Browser open to ShowUp home page (demo mode ON)
- One strong flyer ready to paste (clear date, time, location)
- Phone nearby for mobile demo if asked
- Terminal and Slack closed, Spotify paused

---

## Script

### 1. Hook (15 sec)

> "60% of college students never attend a campus event. Not because they don't want to. Because the flyer they screenshotted dies in their camera roll."
>
> "One student on Reddit said: *'Half the events that go on around campus aren't advertised very well.'* We built something about that."

*(Source: Inside Higher Ed 2023)*

### 2. What It Is (10 sec)

> "I'm Jason. I built ShowUp -- the only mobile web flyer scanner that's conflict-aware, campus-aware, and built for ADHD brains."

*(Gesture at screen showing ShowUp home page. Point out the "Happening on Campus" section at the bottom.)*

> "Before you even scan anything, ShowUp is already pulling live events from the UMN Events Calendar. It knows your campus."

### 3. Live Demo -- Scan a Flyer (45 sec)

*(Paste or drag a flyer into the dropzone.)*

> "I paste any flyer. Claude reads it in about 3 seconds."

*(Wait for extraction. Event card appears with badges, noticings, temporal bar, day-shape.)*

> "Look at what we get. Title, date, location -- extracted from a photo. But here's what nobody else does:"

- *(Point to conflict badge)* "Green badge: I'm free. Or red: it overlaps my CSCI 5801 lecture -- but this chip tells me that class is usually recorded."
- *(Point to temporal bar)* "This color bar shows how far away the event is. It pulses when it's happening soon -- ambient time awareness for ADHD time blindness."
- *(Point to noticings)* "Walk time. Buffer before my next thing. Whether it's a weekend commitment. These are noticings -- observations, never instructions."
- *(Point to day-shape)* "This little timeline shows my whole day. I can see the breathing room at a glance."
- *(Point to campus match panel, if present)* "And ShowUp cross-referenced the UMN Events Calendar and found this event -- with the official department and registration link."
- *(Point to sensory chips)* "Indoor, small group. Sensory context so you know what you're walking into."

> "One tap -- it's in my calendar."

### 4. The Feed (20 sec)

*(Navigate to /feed)*

> "Everything I've scanned lives in the feed. I can filter by free food" *(tap the pizza filter)* "-- because let's be honest, that matters -- or by 'no conflicts' to see only events I can actually attend."

*(Scroll to forgotten events section if visible.)*

> "And these? Events I screenshotted more than a week ago and never added. Not a nag -- just a noticing."

### 5. Differentiator (30 sec)

> "Apple's iOS 26 feature extracts one event per image. Google Lens is one-shot. Photo2Calendar is iOS only. None of them know your campus. None of them check your calendar for conflicts. And none of them are built for ADHD brains."
>
> "ShowUp does all four. It runs on any phone's browser -- no install. Android, iPhone, laptop. And if the first extraction isn't perfect, you can retry with a stronger model."

*(Point to "Try with stronger model" button if visible.)*

### 6. Close (20 sec)

> "Our design principle is three words: *inform, don't decide*. Grounded in cognitive offloading research and the Ottawa Decision Support Framework. No auto-decline. No streak counters. No shame. We surface the trade-offs. You make the call."
>
> "ShowUp is live right now. Try it with any flyer."

---

## Total: ~2:40

## If Asked

- **"How does it work?"** -- Claude Haiku vision reads the flyer image and returns structured JSON. It runs on Vercel with the Anthropic API.
- **"What about privacy?"** -- Stateless. No accounts, no database. Everything lives in your browser's localStorage. We never see your data.
- **"Can it do multiple events?"** -- Yes. If a flyer has a semester schedule with 8 events, Claude extracts all of them. No competitor does this.
- **"What's next?"** -- User accounts with UMN Google sign-in, real Google Calendar integration (not demo mode), and deeper GopherLink student org integration.
- **"How is this different from just adding it to my calendar manually?"** -- Manual entry takes 2 minutes per event and you still don't know if you're free. ShowUp gives you extraction + conflict check + context in 3 seconds.
