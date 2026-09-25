# Game Design Spec: "Singapore" (working title)
A first-person, browser-based life simulation set in Singapore, built around social interaction. The player is Aldi, a young Indonesian who has just moved to Singapore for work, in a compressed but recognisable whole-island city travelled in place.

The earlier version of this game was set in an Indonesian kampung ("Kampung Sukamaju"); it is kept on the branch `kampung-v1`. Its engine and systems carry over; its content was replaced. The step-by-step plan for the move is `docs/singapore-plan.md`.

## Decisions (resolved)
- **Setting:** real Singapore, the whole island, compressed (§4). Real names for public places; businesses and brands get pun names on the real ones (Chopee, Marina Bay Stands, Nab, EZ-Lah…).
- **Player:** Aldi, from Indonesia, a software engineer at Chopee on Science Park Drive (§3.1). Fixed protagonist, no appearance editor, face never shown.
- **Start:** landing at Changi Airport on Sunday 26 July.
- **Home:** rented, of the player's choosing (a room or flat from a property app); where Aldi lives decides the neighbours.
- **Travel:** in place, never a loading screen or fast travel: walking, the MRT and buses first; taxis and ride-hail (as a passenger) next; Aldi's own car last, bought as a big life goal.
- **Romance:** not in v1. Friendship and community only; keep the data hook in the NPC model.
- **Dialogue:** trait-flavoured templates behind a `DialogueProvider` interface; an LLM provider can plug in later. Game logic never lives in the provider.
- **Language:** English with Singlish, everywhere (lah, leh, can or not, shiok, chope, makan…), plus Malay, Hokkien, Tamil and Aldi's own Indonesian where they belong, with a glossary. No other language setting.

> **Instructions for the builder (Claude):** Build this in the steps of `docs/singapore-plan.md`. Finish and check each step with the user before starting the next. Favour a working, smooth game over feature count. Where this spec is silent, choose the simplest option that fits the design pillars.

---

## 1. Design Pillars
1. **People first.** The city should feel lived in: people have routines, opinions, relationships with each other, and memories of Aldi.
2. **A real place, compressed.** Singapore's towns, landmarks, MRT lines and everyday rituals, at a scale that fits a day of play.
3. **Cozy, low-pressure.** No fail state. Days pass, relationships grow or fade, the player chooses how to spend the free time the job leaves.
4. **Runs smoothly on a mid-range laptop.** Target 60 FPS in Chrome on integrated graphics.

---

## 2. Tech Stack
- **Rendering:** Three.js (pinned 0.169.0), WebGL2.
- **Language/build:** TypeScript + Vite.
- **Controls:** pointer lock for mouse look; WASD movement; custom collision (boxes, axis-aligned or rotated, with height ranges) and floors (platforms, stairs), no physics engine.
- **UI:** plain HTML/CSS overlays on the canvas.
- **Save:** `localStorage`, one slot, autosave; wrapped in try/catch.
- **Audio:** Web Audio, synthesised, no files.

---

## 3. Player Experience
- **Camera:** first person, eye height 1.7 m, FOV 70, optional head bob.
- **Movement:** walk 3.5 m/s, run 6 m/s (Shift), no jumping; stairs and ramps are walked up and down.
- **Interaction:** crosshair; a prompt for what's in front (`[E] Tap card`, `[E] Order`, `[E] Talk to …`).
- **HUD:** clock and date, where Aldi is (a town, a station, "East-West Line to Tuas Link" aboard a train), energy/mood/money once they matter, toasts.
- **Phone (Tab):** contacts, chats, maps, the property app, the bag, the journal, the glossary.

### 3.1 The protagonist
**Aldi**, a young Indonesian software engineer, just arrived in Singapore on an employment pass to work at **Chopee**, the e-commerce company on Science Park Drive.
- **The job leaves time to live:** two-week sprints of tickets done anywhere on the laptop, office days two or three times a week at the Science Park headquarters (stand-up at 10:00, sprint review and planning every second Friday), and Chopee's city office in a Raffles Place tower for meetings, all-hands and hackathons. Salary on the 25th, a year-end review and bonus, a ladder from Software Engineer to Senior and Staff.
- **Being Indonesian in Singapore:** Malay-speaking Singaporeans understand Aldi's Bahasa; the Indonesian community on Orchard Road on Sundays; 17 Agustus at the embassy; calls home; missing home food and finding it.
- **Big goals:** a home of Aldi's own choosing, friends across the city, a good review and a promotion, and one day a car.
- Aldi's face is never shown; only hands in first person and a silhouette in menus.

---

## 4. World: Singapore
The whole island, compressed unevenly: real latitude and longitude map to game metres at **1:10** around (1.35 N, 103.82 E), so the island is about 4.7 × 3.3 km; inside a town, content is laid out at a gentler scale (about 1:3) so a town centre, its station, hawker centre and blocks are a few minutes' walk apart. Heights are real (HDB blocks 30–56 m, towers up to 250 m). Low-poly, flat-shaded, warm tropical palette.

**Towns** (each with a real centre, a radius and a kind that decides what's built): Changi Airport and Changi Village, Tampines, Pasir Ris, Simei, Tanah Merah, Bedok, Katong, Joo Chiat, Geylang Serai, Paya Lebar, Geylang, Kallang, Marina Bay, Raffles Place, City Hall, Clarke Quay, Chinatown, Tanjong Pagar, Bugis, Kampong Glam, Little India, Orchard Road, the Botanic Gardens, Tiong Bahru, Novena, Toa Payoh, Bishan, Queenstown, HarbourFront, Ang Mo Kio, Serangoon, Hougang, Sengkang, Punggol, Yishun, Sembawang, Woodlands, Mandai, Bukit Panjang, Choa Chu Kang, Bukit Batok, Jurong East, Jurong Lake Gardens, Jurong West, Tuas, **Clementi**, Dover, West Coast, NUS Kent Ridge, **Science Park**, one-north, Buona Vista, Holland Village, Sentosa and Pulau Ubin. Between them: estates, landed houses, greenery, industry; the Central and Western catchment forests; the airport and its runways; Jurong Island.

**Getting around:** the expressways (PIE, AYE, ECP, CTE, BKE, KJE, SLE, TPE, KPE) and main roads; town streets; the MRT (the East-West Line and its Changi Airport branch first, the other lines as they're added) on viaducts with stations whose platforms have half-height screen doors, and underground in the city later.

**Places to live, work and spend time** come step by step (see the plan): Chopee's headquarters at Science Park and its CBD office; hawker centres, kopitiams and wet markets; malls; the Marina Bay hotel with its sky park; mosques, temples and churches; parks, beaches and the islands; the homes Aldi can rent.

**Ambient life:** crowds by district (office workers, tourists, students, shoppers, families, commuters), traffic, trains on their timetable, birds and afternoon thunderstorms, the city lit at night.

---

## 5. Time System
- 1 in-game day = **30 real minutes** (0.8 game-minutes per real second). The clock runs 06:00 → 02:00; sleeping skips to the next morning.
- **Riding the MRT runs the clock faster** (4.5×), so a ride takes about as long in game time as the real journey would. Holding T fast-forwards the world (6× aboard a train, 75× otherwise; the trains keep their timetable relative to the clock).
- Day 1 is Sunday 26 July, so National Day (9 August) is day 15 and 17 Agustus day 23. Days of the week matter (office days, weekends, Friday prayers).
- Afternoon thunderstorms; lighting through the day; the city's windows light up at night.

---

## 6. Player Stats (kept simple)
- **Energy** and **Mood** (0–100) as before; **Money** in SGD (salary, rent, fares, food, gifts).
- **Skills** (1–10, by practice): Coding (new: faster tickets, better reviews), Cooking, Fitness, Charisma, Music, Gardening.
- No hunger micro-management; eating is a boost, not a survival need.

---

## 7. Activities
Each activity takes game time, costs or gives energy, affects mood and a skill, and can be done alongside people.

| Activity | Where | Notes |
|---|---|---|
| Sprint tickets | Laptop: home, café, office | The job: a coding mini-game or a time skip; deadlines per sprint |
| Office day | Chopee HQ, Science Park | Stand-up, colleagues, pantry, food court, focus |
| City office | Raffles Place tower | Meetings, all-hands, hackathons, after-work drinks at Boat Quay |
| Hawker meal | Hawker centres, kopitiams | Chope a seat, queue, order, return the tray |
| Cook | Home | Recipes from home and from here; share with neighbours |
| Walk / jog / cycle | Park connectors, East Coast, reservoirs | People on their routines greet and join |
| Sports | Community courts, the stadium, the beach | Futsal, badminton, beach volleyball (timing mini-games) |
| Pray | Mosques (Sultan Mosque and the neighbourhood ones) | Wudhu and sholat as in the kampung version; Friday prayers |
| Shop | Malls, markets, the Indonesian mall on Orchard | Food, gifts, things for the home |
| Home | The rented room or flat | Sleep, rest, decorate, host friends |
| Community | The residents' committee, void decks, festivals | Events, volunteering, celebrations |

**Events and the calendar:** National Day, 17 Agustus at the embassy, Hari Raya, Deepavali, Chinese New Year, Mid-Autumn, Hungry Ghost month getai, Christmas on Orchard, the night motor race round Marina Bay; everyday rituals (chope, the tray return, queues at famous stalls, the void-deck wedding or funeral tent, fines).

---

## 8. Social System (core feature)

### 8.1 People
- **Named people per area** Aldi spends time in (8–12 each): neighbours where Aldi rents, colleagues at Chopee, hawker stall owners, the mosque's imam, kopitiam uncles, Indonesian friends on Orchard, a Singaporean friend who shows Aldi around. About 30 to start, more as areas are added. They have relationships with each other, and some friction to mediate.
- **Crowds:** pooled, instanced passers-by per district with one-line greetings and no relationship tracking.
- **Singapore's mix:** Chinese, Malay, Indian and Eurasian Singaporeans, other expats, migrant workers. Forms of address (Uncle, Aunty, Encik, Mak Cik, Boss, Ah Boy…) with the same etiquette idea as before.

### 8.2 NPC data model
```ts
interface NPC {
  id: string;
  name: string;
  age: number;
  occupation: string;
  home: LocationId;
  traits: Trait[];            // 2–3 from: cheerful, shy, grumpy, curious, gossip, sporty, artsy, bookish, ambitious, caring
  likes: Topic[];
  dislikes: Topic[];
  schedule: ScheduleBlock[];  // per day of week: {start, end, location, activity}
  relationships: Record<string, number>; // to other NPCs, -100..100
  playerRelationship: {
    friendship: number;       // -100..100
    // romance: reserved for a later version; do not implement in v1
    stage: 'stranger' | 'acquaintance' | 'friend' | 'close friend' | 'best friend';
    lastTalkedDay: number;
    memories: Memory[];       // last ~10 notable events with the player
  };
  mood: number;
  appearance: AppearanceParams;
}
```

### 8.3 Conversation
As in the kampung version (its rules carry over, in `social/social.ts`): a greeting tailored to stage, time, mood and memories; Chat (topics with likes, dislikes and cooldowns), Ask (facts in order, stories), Banter (compliment, joke, tease), gifts, gossip and good words, invitations; a daily friendship cap and slow decay; etiquette in how people are addressed. All text goes through `DialogueProvider`; templates in JSON with at least 5 variants per common line, now written in Singlish.

### 8.4 Making the city feel social
NPC–NPC chats you can overhear; gatherings at hawker centres, void decks, kopitiams and parks; group chats (the block's, the team's, the Indonesian friends') and private messages; invitations both ways; reputation among the people who know Aldi; story arcs per person; milestones (dinner at their home, a secret, a family event).

### 8.5 NPC behaviour (AI)
Schedule-driven movement on a waypoint graph with A*; light avoidance; interrupts (being talked to, rain, a friend). People who travel far (to work, to school) do it abstractly, and ride visibly when near Aldi.

---

## 9. Performance Plan
Target **60 FPS** on integrated graphics.
- **Streaming:** the island is generated once as data (36 m lots grouped into 128 m chunks); chunks near Aldi become instances in pooled InstancedMeshes (one draw call per kind of geometry however many chunks are loaded), loaded within a few ms per frame, nearest first. Beyond them: one flat mesh of the island, the sea, and a skyline of every tall building (hidden while its chunk is loaded).
- **Buildings** are boxes with procedural facades (windows from world position in the shader, lit at night), so no textures.
- **Trains** and later traffic and crowds are instanced; far ones are only numbers.
- **Simulation LOD** for people as before (near every frame, mid 10 Hz, far 1 Hz or abstract); social logic at 1 Hz.
- **Budgets:** draw calls < 150, triangles < 300k, JS < 8 ms per frame. F3 (or backtick) shows the numbers and the costliest parts of the frame.

---

## 10. UI / UX
- **Dialogue panel** at the bottom: name, stage, hearts, typewriter text, numbered choices.
- **Phone:** contacts with portraits, chats, the property app, maps with a destination marker, bag, journal, glossary.
- **Map (M):** the whole island, towns, roads, the MRT, where Aldi is.
- **Notifications:** toasts, never blocking. Esc pauses and releases the pointer.

---

## 11. Content Scope (first version)
- The whole island as a blockout, the MRT's East-West Line and Changi Airport branch rideable; then, step by step, the landmark areas, Clementi and Science Park in detail, the homes, about 30 people, the calendar's first months.
- ~12 conversation topics (food, football, work and tech, family back home, neighbourhood news, weather and rain, prices, music, religion-light topics like Ramadan, travel, the old days, gossip); gifts from hawker food, kueh, kopi, fruit, snacks from home, small souvenirs.
- Starting scenario: Aldi lands at Changi, takes the MRT across the island, stays in a serviced apartment in one-north for two weeks while house-hunting, and starts at Chopee.

---

## 12. Build Steps
See `docs/singapore-plan.md`:
1. The new spec and the groundwork (the island, streaming, the skyline, tall buildings, roads, the MRT you can ride).
2. Changi and the first ride.
3. Science Park Drive, one-north and Clementi (the job, buses).
4. The CBD and Marina Bay.
5. A place to live.
6. People and conversation.
7. Chinatown, Tiong Bahru, Little India, Kampong Glam and Orchard.
8. The calendar.
9. The other regions, one per step.
10. Taxis and ride-hail.
11. Aldi's own car.
12. Performance pass and docs.

---

## 13. Future Versions
- Romance and a partner stage (data hook reserved in the NPC model).
- An LLM dialogue provider (Claude API) behind `DialogueProvider`.
- Ramadan season (sahur, bukber, the Geylang Serai bazaar) and Hari Raya open houses.
- Trips across the Causeway to Johor, and home to Indonesia.
