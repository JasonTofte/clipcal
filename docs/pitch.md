# ClipCal -- Pitch Deck

*Your campus copilot. Snap a flyer, know if you should go.*

---

## Slide 1: The Problem

**60% of college students never attend a campus event.**

Not because they don't want to. Because the flyer gets screenshotted and dies in their camera roll.

- 33% of students feel disconnected from campus due to *awareness*, not interest
- The #1 most-requested campus app feature is an events calendar
- *"Half the events that go on around campus aren't advertised very well."* -- Inside Higher Ed 2023

---

## Slide 2: The Current Solutions Fail

| Feature | Apple iOS 26 | Google Lens | Photo2Calendar | Corq | **ClipCal** |
|---------|-------------|-------------|----------------|------|-------------|
| Multi-event extraction | 1/image | 1/image | 1/image | N/A | **Yes (array)** |
| Conflict detection | No | No | No | No | **Yes (freebusy)** |
| Knows your campus | No | No | No | Partial | **Yes (LiveWhale + GopherLink)** |
| Works on Android | No | One-shot | No (iOS) | Yes | **Yes (PWA)** |
| Works on shared/DM'd flyers | No | No | No | No | **Yes** |
| ADHD-supportive design | No | No | No | No | **Yes** |
| No install required | No | No | No | App Store | **Yes (mobile web)** |

**Corq 1-star reviews tell the story:**
- *"Events are never updated"* -- App Store, 2024
- *"Crashes constantly and half the events are wrong"* -- App Store, 2024
- *"Limited to only the events the school decides to post"* -- App Store, 2023

ClipCal works with ANY flyer. From any source. On any device.

---

## Slide 3: What ClipCal Does

**Paste any flyer. Get everything you need to decide.**

1. **Claude Vision reads the flyer** -- extracts title, date, time, location, category, and whether there's free food. Even from handwritten signs or stylized typography.

2. **Checks your calendar** -- green "you're free" or red "overlaps Intro to Data Science." Instant conflict awareness.

3. **Knows your campus** -- cross-references the UMN Events Calendar (events.tc.umn.edu) and GopherLink student org feeds. Shows the official event page, department, and RSVP link.

4. **ADHD-supportive noticings** -- not instructions. Observations.
   - Walk time to the venue
   - Buffer before your next thing
   - "No early class tomorrow"
   - "Long evening commitment" / "Social-energy event"
   - Sensory context: indoor/outdoor, crowd size
   - Temporal distance bar (pulsing when imminent)
   - Day-shape timeline showing breathing room

5. **One tap to calendar** -- .ics download, Google Calendar, or Outlook.

---

## Slide 4: The Design Principle

### *Inform, don't decide.*

Grounded in:
- **Cognitive offloading research** (Risko & Gilbert, 2016) -- externalizing information reduces working memory load
- **Ottawa Decision Support Framework** -- present options and trade-offs, let the person decide
- **Tiimo** (Apple App of the Year 2025) -- proved the market for ADHD-friendly calendar design
- **Goblin Tools / Sunsama** -- validated "gentle intelligence" over gamification

**What this means in practice:**
- No noticing ever says "don't go"
- No auto-decline of conflicting events
- No streak counters or shame mechanics
- "Add anyway -- you decide" instead of "Resolve conflict"
- The app is a noticer, not a warden

---

## Slide 5: The Technology

- **Claude Haiku 4.5** -- vision extraction (~$0.002/image, strongest on stylized text)
- **Claude Sonnet 4.5** -- fallback for stubborn flyers (one-button retry)
- **Next.js 16** on Vercel -- zero-config deployment, Edge Runtime
- **UMN LiveWhale API** -- live campus events, CORS-enabled, no auth required
- **GopherLink ICS** -- student org events via server-side proxy
- **PWA with share target** -- Android users share screenshots directly to ClipCal
- **Stateless architecture** -- no accounts, no database, localStorage only. Privacy by default.

---

## Slide 6: The Four-Part Moat

No competitor combines these:

1. **Conflict-aware ingest** -- Google Calendar freebusy integration
2. **Multi-event extraction** -- one flyer, eight events
3. **Campus intelligence** -- live UMN events + student org feeds
4. **ADHD-supportive design** -- noticings, not instructions

---

## Slide 7: Market Validation

- **60%** of 4-year college students never attend a campus event (Inside Higher Ed)
- **33%** feel disconnected due to awareness, not interest
- **#1** most-requested campus app feature: events calendar
- **$10-12** documented student app price ceiling -- $1 is trivially acceptable
- **500+ universities** use Localist/LiveWhale -- ClipCal's campus adapter could work at any of them

---

## Slide 8: What's Next

**Hackathon to product:**

1. **User accounts** -- "Sign in with Google" restricted to @umn.edu (Google Workspace)
2. **Real Google Calendar integration** -- replace demo mode with live freebusy
3. **Cross-device sync** -- Supabase Postgres backend
4. **Deeper campus integration** -- GopherLink API access, per-org feeds
5. **Multi-campus expansion** -- point the LiveWhale adapter at any university's events.tc domain

---

## Slide 9: Try It

**clipcal.vercel.app**

*Paste any flyer. On any phone. Right now.*

*inform -- don't decide*

---

## Sources

- [Inside Higher Ed: Why So Many Students Want a Campus Events Calendar (2023)](https://www.insidehighered.com/news/student-success/college-experience/2023/10/13/why-so-many-students-want-campus-events-calendar)
- [Risko & Gilbert: Cognitive Offloading (2016)](https://doi.org/10.1016/j.tics.2016.07.002)
- [Ottawa Decision Support Framework](https://decisionaid.ohri.ca/odsf.html)
- [Tiimo: Apple App of the Year 2025](https://www.tiimoapp.com/)
- [Corq App Store Reviews (2023-2024)](https://apps.apple.com/us/app/corq/id1494498430)
- [iOS 26 Screenshot-to-Calendar Limitations (gHacks)](https://www.ghacks.net/2026/03/06/ios-26-lets-you-instantly-add-calendar-events-from-screenshots/)
- [CampusGroups API](https://www.campusgroups.com/api?public=1)
