# Game Design Spec: "Kampung" (working title)
A first-person, browser-based life simulation set in a small Indonesian kampung (urban village neighbourhood), built around social interaction.

## Decisions (resolved)
- **Setting:** Indonesian kampung-style neighbourhood (narrow *gang* lanes, warungs, musholla, *pos ronda*, dense community life).
- **Player:** Fixed protagonist with a set name and backstory (§3.1). No appearance editor.
- **Romance:** Not in v1. Friendship and community only; keep a data hook so it can be added later.
- **Dialogue:** Trait-flavoured templates in v1, behind a dialogue interface that an LLM provider can plug into later.
- **Language:** English dialogue and UI, with Indonesian words used naturally for places, food, greetings and address terms (*Pak, Bu, Mas, Mbak, Dek*). Include a short glossary in the Contacts/Journal UI.

> **Instructions for the builder (Claude):** Build this in phases (see §12). Finish and verify each phase before starting the next. Favour a working, smooth game over feature count. Where this spec is silent, choose the simplest option that fits the design pillars.

---

## 1. Design Pillars
1. **People first.** The neighbourhood should feel *lived in*. NPCs have routines, opinions, relationships with each other, and memories of the player.
2. **Small but dense.** One compact neighbourhood you can walk across in ~90 seconds, packed with things to do and people to meet.
3. **Cozy, low-pressure.** No fail state. Days pass, relationships grow or fade, the player chooses how to spend time.
4. **Runs smoothly on a mid-range laptop.** Target 60 FPS in Chrome on integrated graphics.

---

## 2. Tech Stack
- **Rendering:** Three.js (latest), WebGL2.
- **Language/build:** TypeScript + Vite. (If building as a single-file artifact instead, use one HTML file with Three.js from a CDN and no build step.)
- **Controls:** `PointerLockControls` for mouse look; WASD movement; custom simple collision (axis-aligned boxes), no physics engine.
- **UI:** Plain HTML/CSS overlays on top of the canvas (dialogue box, HUD, menus). No UI framework required.
- **Save:** `localStorage` (single save slot, autosave at end of each in-game day). Wrap in try/catch.
- **Audio (optional, later phase):** Howler.js or Web Audio for ambient loops and UI sounds.

---

## 3. Player Experience
- **Camera:** First-person, eye height 1.7 m, FOV 70. Slight head bob when walking (toggleable).
- **Movement:** Walk (default), sprint (Shift), no jumping. Walk speed 3.5 m/s, sprint 6 m/s.
- **Interaction:** Crosshair in centre. Looking at an interactable within 2.5 m shows a prompt: `[E] Talk to Mei`, `[E] Sit`, `[E] Buy coffee`.
- **HUD (minimal):** clock + day, current energy/mood bars, money, small notification toasts ("Mei likes you more").
- **Phone menu (Tab):** Contacts (relationships), Journal (tasks/goals), Map, Settings.

### 3.1 The protagonist
**Raka, 27.** Grew up in this kampung until age 10, then moved to the city with his parents. After years in an office job he has gone freelance (graphic design) and moved back into his late grandmother's small house, which has sat empty for two years.
- Some older residents remember him as a kid ("Raka? The one who broke Pak Darto's window?"), which gives a head start with a few elders and a built-in hook for stories.
- Freelance work gives flexible hours: a laptop at home offers **Freelance jobs** as an activity (money, costs energy), alongside the warung shift.
- Personal arc: restore the grandmother's house room by room, and discover through neighbours' memories who she was in the community.
- Raka's face is never shown; he appears only as hands/arms in first-person and as a portrait silhouette in menus.

*(Name, age and backstory are placeholders and easy to change.)*

---

## 4. World: The Neighbourhood
Compact map, roughly 120 m × 120 m: one main lane (*jalan*) wide enough for motorbikes, branching into narrow *gang* alleys (1.5–2.5 m wide) lined with one- and two-storey houses. Low-poly, stylised art with a warm tropical palette: terracotta roof tiles, painted walls in faded pastels, potted plants, laundry lines, motorbikes parked outside doors, overhead cables, banana and mango trees. Build from simple geometry; only interiors marked ★ are enterable.

The narrow gangs are a gift for both atmosphere and performance: they naturally block sight lines (cheap occlusion) and funnel NPCs into encounters with the player.

| Location | Purpose |
|---|---|
| ★ Raka's house (grandmother's) | Sleep, cook, freelance on laptop, rest; rooms restored over time |
| ★ Warung Bu Sri | Small shop + food stall; buy ingredients and snacks, part-time shift; the social heart of the kampung |
| ★ Warung kopi | Coffee, fried snacks, TV football at night; men's evening hangout |
| ★ Musholla | Small prayer room; community announcements, pengajian gatherings |
| ★ Balai warga (community hall) | RT meetings, arisan, classes, event prep, notice board |
| Pos ronda | Night-watch post; card games, chatting, ronda shifts at night |
| Lapangan (small field) | Futsal, badminton, kite flying, 17 Agustus competitions |
| Pasar pagi (morning market street) | Only exists 06:00–09:00; vendor stalls spawn along the main lane |
| Mobile food carts | Bakso, siomay, nasi goreng carts that roam the lanes on a schedule (moving social magnets) |
| Ojek base | Corner where ojek drivers wait; kampung entrance/exit (NPC spawn/despawn point) |
| Small river bank / irrigation canal | Fishing, evening walks, kids playing |
| Shared vegetable plots / pots along gang | Gardening activity |
| Residential houses | NPC homes, entered only as a guest (knock, and wait to be invited in); neighbours sit on their front terraces (*teras*) and chat with passers-by |

Interiors are built in place, at real size, inside hollow buildings: Raka walks through a real door with no loading or fade, and the furniture is only drawn near the building. Residents' houses can be entered too, but only by knocking or calling out at the door (*kulonuwun*, *assalamualaikum*) while the owner is home and invites him in. See `docs/interiors-plan.md`.

**Ambient life:** roosters in the morning, adzan from a distant mosque five times a day (also a natural time cue), motorbikes crawling through the main lane, cats everywhere, kids running in the gangs after school, cart vendors' calls and bells.

---

## 5. Time System
- 1 in-game day = **20 real minutes** (configurable). Clock runs 06:00 → 02:00; sleeping skips to next morning.
- Day of week matters (weekend events, NPC work schedules, Friday prayers, Sunday kerja bakti).
- Occasional **afternoon rain** (tropical downpour, 20–40 in-game minutes): NPCs shelter under eaves, at the warung or pos ronda, which clusters people and creates conversation opportunities.
- Lighting changes with time: morning, noon, golden hour, night (streetlights on). Use a single directional light + hemisphere light; animate colours/intensity. No real-time shadows at night; one shadow-casting light during day with a small shadow map (1024).

---

## 6. Player Stats (kept simple)
- **Energy** (0–100): drops with activities, restored by sleep/food/coffee.
- **Mood** (0–100): raised by good conversations, hobbies, eating well; lowered by loneliness, exhaustion.
- **Money:** earned from the part-time job and odd jobs; spent on food, gifts, classes.
- **Skills** (level 1–10, gained by practice): Cooking, Fitness, Gardening, Charisma, Music.

No hunger micro-management; eating is a mood/energy boost, not a survival requirement.

---

## 7. Activities
Each activity: takes in-game time, costs/gives energy, affects mood and a skill, and **can be done alongside NPCs** (bonus relationship points).

| Activity | Where | Notes |
|---|---|---|
| Freelance work | Home (laptop) | Take design jobs; mini-game or time-skip. Main income, flexible hours. |
| Help at the warung | Warung Bu Sri | Serve customers (match orders to items); earns a little money and lots of social contact. |
| Cook a meal | Home | Recipes like nasi goreng, sayur asem, sambal; quality depends on Cooking skill. Share food with neighbours (*berbagi*) for big friendship gains. |
| Morning walk / jog | Lanes, river bank | NPCs on their morning routine greet and join you. |
| Futsal / badminton | Lapangan | Evenings; join a group; simple timing mini-game. |
| Gardening | Pots/plots | Chili, tomatoes, herbs; water daily, harvest, gift produce. |
| Ronda night watch | Pos ronda | Scheduled night shift with 2–3 NPCs; long relaxed conversations, card games, bonus friendship. |
| Fishing | Canal | Quiet activity; old men and kids fish here. |
| Play guitar | Teras or pos ronda | Neighbours gather and sing along at night. |
| Hang out at warung kopi | Warung kopi | Sit; NPCs may approach you; watch football together. |
| Restore the house | Home | Spend money + help from friendly NPCs (the handyman, etc.) to fix rooms; unlocks features. |
| Odd jobs / favours | Balai warga notice board, NPC requests | Deliver, fetch, fix, babysit, help move furniture. |
| Community events | Various | See below. |

**Community events**
- **Kerja bakti** (every Sunday morning): communal clean-up; everyone participates, great for meeting people.
- **Arisan** (monthly): rotating-savings social gathering at a host's house; food and gossip.
- **Pengajian** (weekly, evening at musholla): community gathering; optional attendance.
- **Pasar pagi** (every morning): brief, busy market.
- **17 Agustus festival** (once per in-game "year" / season): lomba games (sack race, *panjat pinang*, *makan kerupuk*), decorations, night stage show. The big event of the game.
- **Hajatan / kenduri** (story-triggered): a wedding or celebration hosted by a resident; everyone helps prepare.

---

## 8. Social System (core feature)

### 8.1 NPC count and roster
- **24 named NPCs** with full personalities and routines ("residents").
- **Up to 20 ambient NPCs** at a time (unnamed passers-by, commuters) for crowd density. They walk paths, sit, chat with each other visually, and give one-line greetings, but have no relationship tracking.
- Group residents into households and social circles so NPCs have relationships **with each other**, not just with the player. Suggested roster:
  - **Pak RT** (neighbourhood head) and his wife: organisers of everything, first people you must greet.
  - **Bu Sri**: warung owner, knows everyone's business; her teenage son helps out.
  - **Pak Darto & Bu Darto**: elderly couple who remember Raka as a kid; knew his grandmother well.
  - **A young family** (father drives ojek, mother runs a home catering business, two kids).
  - **The warung kopi owner** and his regulars: a retired civil servant, a mechanic, a security guard on night shifts.
  - **Ibu-ibu arisan circle**: three women who meet on teras and exchange gossip.
  - **Two university students** renting a room (*anak kos*).
  - **The musholla caretaker / ustadz**: respected, calm, gives advice.
  - **A handyman (tukang)**: helps restore Raka's house.
  - **A young mother working from home**, a **teenager** who wants to be a content creator, a **cart vendor** (bakso) who roams the lanes.
- Include some existing friction between NPCs (a noisy-motorbike feud, a borrowed-money grudge) that the player can mediate.

### 8.2 NPC data model
```ts
interface NPC {
  id: string;
  name: string;
  age: number;
  occupation: string;
  home: LocationId;
  traits: Trait[];            // 2–3 from: cheerful, shy, grumpy, curious, gossip, sporty, artsy, bookish, ambitious, caring
  likes: Topic[];             // conversation topics & gift categories
  dislikes: Topic[];
  schedule: ScheduleBlock[];  // per day-of-week: {start, end, location, activity}
  relationships: Record<string, number>; // to other NPCs, -100..100
  playerRelationship: {
    friendship: number;       // -100..100
    // romance: reserved for a later version; do not implement in v1
    stage: 'stranger' | 'acquaintance' | 'friend' | 'close friend' | 'best friend';
    lastTalkedDay: number;
    memories: Memory[];       // last ~10 notable events with player
  };
  mood: number;               // current mood, affects responses
  appearance: AppearanceParams; // body colour, hair shape/colour, clothing colours, height
}
```

### 8.3 Conversation
Approaching an NPC and pressing E opens a dialogue panel (camera gently turns to face them; NPC stops and faces the player).
- **Greeting** tailored to relationship stage, time of day, NPC mood, and a recent memory ("Hey! How did the garden turn out?").
- **Actions menu:**
  - *Chat* → pick a topic (weather, food, sports, music, neighbourhood gossip, their work, their family…). Liked topic: +friendship; disliked: −. Each topic has cooldowns to prevent spam.
  - *Ask about them* → reveals a like/dislike or backstory snippet (fills the Contacts page).
  - *Compliment / Joke / Tease* → outcome depends on traits and relationship stage.
  - *Give gift* → from inventory; loved/liked/neutral/disliked reaction.
  - *Invite* → to an activity or event at a time ("Join me for a jog at 7am?"). NPC accepts based on schedule + friendship, then actually shows up.
  - *Ask for help / favour* → unlocks at friend stage.
  - *Gossip* → hear what NPCs think of each other; can spread info (affects NPC–NPC relationships).
- Daily friendship gain cap per NPC to encourage breadth; friendship slowly decays if not talked to for 7+ days.
- **Social etiquette matters:** address NPCs correctly (*Pak/Bu* for elders, *Mas/Mbak* for peers); greeting elders first and bringing food when visiting earns goodwill. Rude choices (skipping kerja bakti repeatedly, not greeting neighbours) cost reputation.
- **Dialogue content (v1):** a template system with variables and trait-flavoured lines (e.g. grumpy vs cheerful variants of the same line). Store lines in JSON. Write at least 5 variants per common line so repeats feel rare.
- **Dialogue interface for later LLM support:** all dialogue goes through one interface, e.g.
  ```ts
  interface DialogueProvider {
    getLine(ctx: DialogueContext): Promise<DialogueLine>; // ctx: npc profile, mood, stage, memories, topic, time, location
  }
  ```
  v1 ships `TemplateDialogueProvider`. A future `LLMDialogueProvider` can call the Claude API with the same context and fall back to templates on error or timeout. Game logic (friendship changes, topic reactions) must stay in code, never decided by the provider.

### 8.4 Making the neighbourhood feel social
- **NPC–NPC conversations:** when two NPCs meet and like each other, they stop, face each other, and show speech-bubble icons for 10–30 s. If the player gets close, they can overhear a line (text floating above).
- **Group gatherings:** warung in the morning and midday, teras chats in the afternoon, lapangan at dusk, warung kopi and pos ronda at night. Seats (benches, *lincak* bamboo platforms, plastic stools) are "slots" NPCs claim.
- **Teras encounters:** neighbours sitting on their front terraces call out to the player as he walks past ("Mau ke mana, Mas Raka?"), which is the kampung's most common social moment. Make this frequent.
- **Food sharing:** NPCs sometimes bring food to Raka's door (and expect the plate back, an easy return visit).
- **NPCs initiate:** friends may wave, walk up to the player, message them via the phone (a WhatsApp-style RT group chat with announcements and gossip, plus private messages), or invite them to events.
- **Reputation:** a neighbourhood-wide score that rises with helping people and attending events; affects strangers' first impressions. Gossip spreads player actions between connected NPCs.
- **Story arcs:** each resident has a 3–5 step personal storyline unlocked at friendship thresholds (e.g. Bu Sri's warung losing customers to a new minimarket; the catering mother wanting to sell online; the teenager's first viral video; Pak Darto's stories about Raka's grandmother). Completing arcs has visible effects on the world.
- **Relationship milestones:** friend → close friend → best friend. Milestones trigger special scenes (invited for dinner, trusted with a secret, asked to be part of a family event).

### 8.5 NPC behaviour (AI)
- **Schedule-driven** state machine: `Idle → WalkTo(target) → DoActivity → …`, following the day's schedule blocks.
- **Navigation:** pre-authored waypoint graph (sidewalks, crossings, doors, seats) with A* on the graph. No navmesh needed at this scale.
- **Light avoidance:** simple steering to not overlap the player or each other (separation force), no full crowd sim.
- **Interrupts:** being talked to, meeting a friend, a random event (rain → go indoors).

---

## 9. Performance Plan
Target: **60 FPS with ~24 residents + up to 20 ambient NPCs** on integrated graphics.

**Simulation LOD**
- **Near (< 40 m, or in same interior):** full update every frame — movement, animation, head-turn toward player.
- **Mid (40–80 m):** update movement at 10 Hz; simplified animation.
- **Far / not visible / in another scene:** "abstract simulation" — no rendering, position is computed from schedule and time (NPC is simply "at the café"). Snap them into place when the player approaches.
- Social logic (relationship changes, gossip spread, NPC–NPC meetings off-screen) runs on a **1 Hz tick**, not per frame.

**Rendering**
- Stylised low-poly characters built from a few primitives (capsule body, sphere head, simple limbs), or a single shared rigged mesh recoloured per NPC. **Do not load per-NPC models.**
- Use `InstancedMesh` for trees, benches, lamps, fences, props. Merge static building geometry per block.
- Character animation: procedural (sine-wave limb swing for walking, simple sit/idle poses) — cheap and avoids animation assets. If using a rigged model, share one `AnimationMixer` clip set and pause mixers for far NPCs.
- Frustum culling on; distance fog to hide the far edge; render distance ~120 m.
- Speech bubbles and name tags: pooled HTML elements or sprite textures, shown only for near NPCs.
- Texture budget: mostly vertex colours / flat materials, one small texture atlas.
- Cap pixel ratio at 1.5. Provide a Low/Medium/High graphics setting (shadows, render distance, ambient NPC count).

**Budgets**
- Draw calls < 150, triangles < 300k, JS frame time < 8 ms.
- Show an optional FPS/debug overlay (toggle with F3).

---

## 10. UI / UX
- **Dialogue panel:** bottom of screen, NPC name + relationship stage + heart meter, typewriter text, numbered choices (click or 1–6 keys).
- **Contacts page:** every met NPC, portrait (generated from appearance params), stage, discovered likes/dislikes, birthday, notes.
- **Journal:** active favours, story arc steps, upcoming invites and events with times.
- **Map:** top-down 2D map with location labels and friend markers (shows where friends are *now* for close friends only).
- **Notifications:** small toasts, never blocking.
- Pause menu (Esc) releases pointer lock.

---

## 11. Content Scope for v1
- 24 residents with names, traits, schedules, likes/dislikes, 3-step story arcs.
- ~12 conversation topics (football, food, family, work, kampung news, weather/rain, motorbikes, the old days, religion-light topics like Ramadan plans, music, prices at the market, gossip), ~40 gift items (kue, fruit, kopi, teh, martabak, home-cooked dishes, garden produce, small crafts).
- Activities from §7.
- Recurring events: pasar pagi, kerja bakti, pengajian, arisan; one 17 Agustus festival.
- Starting scenario: Raka arrives by ojek with one suitcase. Pak RT meets him at the gang entrance, reminds him to report as a new resident, and walks him to his grandmother's house, introducing neighbours on the way (tutorial). First goal: greet every household in your gang and bring something to Bu Sri's warung.

---

## 12. Build Phases
1. **Foundation:** Three.js scene, first-person controls, collision, blockout of the neighbourhood, day/night cycle, HUD clock.
2. **NPC core:** character generator, waypoint graph + A*, schedule-driven movement for 24 residents, simulation LOD, debug overlay. Verify 60 FPS.
3. **Conversation:** interaction prompt, dialogue panel, topics, relationship values, memories, Contacts page.
4. **Activities & economy:** stats, money, inventory, work shift, cooking, jogging, gardening.
5. **Living world:** NPC–NPC chats, gatherings, gossip, invitations (both directions), ambient NPCs, phone texts.
6. **Depth:** story arcs, events (incl. 17 Agustus), milestones, reputation, house restoration.
7. **Polish:** save/load, settings, audio, tutorial, balancing.

---

## 13. Future Versions (out of scope for v1)
- Romance and partner stage (data hook reserved in the NPC model).
- LLM dialogue provider (Claude API) plugged into the `DialogueProvider` interface.
- Full Bahasa Indonesia language toggle.
- Ramadan season (sahur wake-ups, bukber gatherings, takbiran night) and Lebaran open houses.
