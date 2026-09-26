# Singapore plan

The game moves from Kampung Sukamaju to Singapore. The player is **Aldi**, a young Indonesian software engineer who lands at Changi to start a job at Chopee, finds a place to rent, and builds a life: neighbours, colleagues, the hawker stall owners who learn Aldi's order, the Indonesian community on Orchard Road on a Sunday. The world is Singapore the way GTA San Andreas does Los Angeles: a smaller, hand-built island (about 3 × 2 km) that follows the real city's shape and keeps its important landmarks, with travel in the world (walking, MRT, buses, then cars) and no loading screens.

This replaces the kampung (its setting, map, 24 residents, lines, food and events). It keeps the engine and every system: schedules and NPC movement, conversation and friendship, gifts, plans and invitations, the phone, interiors and doors, actions and hands, shops, mini-games, rain, save and audio. The open-world plan's technical ideas (chunks, streaming, a skyline, in-place travel, the 30-minute day) carry over here.

The last kampung version is kept on the branch **`kampung-v1`** (commit `18dfd08`).

## Decisions (with the user)

- **Setting:** Singapore, San Andreas style: a hand-built island of about **3 × 2 km** that follows the real geography (west is west, the city is by the bay, Changi is east, Sentosa south) but keeps only the important districts and landmarks, squeezing out what's between. First districts: the West (Clementi, Science Park, NUS), the City (Marina Bay, the CBD, Chinatown), Orchard with Kampong Glam and Little India, and the East with Sentosa. **Clementi** and **Science Park Drive** are in explicitly. Real place names; businesses get pun names.
- **Player:** Aldi, from Indonesia, new to Singapore. A fixed character with no face shown.
- **Start:** landing at Changi Airport.
- **Home:** rented, of the player's choosing; where Aldi lives decides the neighbours.
- **Work:** a software engineer at **Chopee** (the Shopee pun), whose campus is on Science Park Drive. The job leaves the days free to go around (flexible, sprint-based work), and Chopee's city office in the CBD gives the CBD work experience.
- **Language:** English with Singlish, and nothing else: every line is written in Singlish-flavoured English (lah, leh, can or not, shiok, chope, makan…), with the glossary to explain it. No setting and no language skill.
- **Transport, in three stages:** public transport first (walking, MRT, buses); then cars as a passenger (taxi and ride-hail); then Aldi's own car to drive. The car has to be bought: it's one of the big life goals to work towards, not something given.
- **The kampung is replaced**, not kept as a place to visit. 8–12 named people per area Aldi spends time in, plus crowds. A 30-minute day.
- **Unchanged:** friendship and community, not romance; template dialogue behind `DialogueProvider`; the low-poly, warm, flat-shaded look.

## Real Singapore, compressed

Real place names for public places: areas, roads, MRT lines and stations, parks, landmarks, shaped after the real ones. **Businesses and brands get pun names** on the real ones, so a Singaporean recognises them at a glance but none is used by its real name or logo. The first ones:

| Real | In the game |
|---|---|
| Shopee (Science Park Drive) | **Chopee**, the e-commerce company on Science Park Drive (a pun on *chope*, reserving a seat) |
| Marina Bay Sands | Marina Bay Stands |
| Jewel Changi | Jool |
| Grab | Nab |
| EZ-Link | EZ-Lah |
| ION Orchard | EON Orchard |
| Lucky Plaza | Lucky Place |
| VivoCity | VivaCity |
| FairPrice | FairlyPrice |
| 7-Eleven | 8-Twelve |
| Singtel | SingaTel |
| Universal Studios (Sentosa) | Uniworsal Studios |

More are named the same way as they come up. Signs and logos use the game's own colours and shapes, not the real brand's.

## The map: San Andreas style

Instead of the real island shrunk to scale (step 1's blockout, about 1:10 everywhere), the island is **laid out by hand, about 3 × 2 km** (x −1500…1500, z −1000…1000; +x east, +z south). Like San Andreas, it follows the real city (where things are relative to each other, the coastline's character, the MRT's shape) and keeps what makes each place recognisable, while the ordinary stretches between them shrink to a street or two. Buildings, roads and landmarks are real size; distances between districts aren't.

Rough layout (to be refined while building):

```
 z −1000  ┌──────────────────── Strait of Johor ─────────────────────┐
          │  (the North: forest, reservoir, the zoo; Woodlands and     │
          │   the Causeway at the edge; later)                         │
 z  −400  │ WEST                 ORCHARD · LITTLE INDIA · KAMPONG GLAM │  EAST
          │ Clementi town        Botanic Gardens – Orchard Road –      │  Changi Airport
          │ NUS on the hill      malls, Lucky Place   Sultan Mosque    │  (Jool, runways)
          │ Science Park         CITY: CBD towers, the river, Boat Quay│  Katong shophouses
          │ (Chopee campus)      Chinatown · the bay: Marina Bay Stands│  East Coast beach
 z  +500  │ West Coast park      Merlion, Flyer, durians, supertrees   │
          │            HarbourFront ── cable car ──┐                   │
 z +1000  └──────────────────── SENTOSA (beach, Uniworsal) ───────────┘
            x −1500                     x 0                    x +1500
```

- **Districts, each packed with its landmarks:**
  - **The West:** Clementi's HDB town (the MRT with the mall over it, the bus interchange, the market and hawker centre, void decks, the stadium), Science Park with **Chopee's campus**, NUS on Kent Ridge, one-north, West Coast Park on the shore.
  - **The City:** Marina Bay (Marina Bay Stands and its sky park, the Merlion, the Flyer, the durian domes, the helix bridge, the supertrees), the CBD towers round Raffles Place (Chopee's city office), the river with Boat Quay and Clarke Quay, Chinatown (shophouses, the temple, the hawker centre), the octagonal hawker market and satay street.
  - **Orchard, Kampong Glam and Little India:** Orchard Road's malls (EON Orchard, Lucky Place for the Indonesian community), the Botanic Gardens, the Sultan Mosque and Arab Street, Little India's Serangoon Road.
  - **The East:** Changi Airport (terminals, the Jool dome and waterfall, the runways), Katong's Peranakan shophouses, East Coast Park's beach.
  - **Sentosa:** a small island to the south: the beach, Uniworsal Studios, reached by the cable car from HarbourFront (and a bridge).
  - **Later:** the North (forest, the reservoirs, the zoo, Woodlands and the Causeway to Johor).
- **The MRT:** two or three lines and about 12–16 stations that pass the landmarks: the East-West Line (Changi Airport – Katong – Paya Lebar – Bugis – City Hall – Raffles Place – Chinatown – Tiong Bahru – Buona Vista – Clementi – Jurong East), a North-South Line (the North – Orchard – City Hall – Raffles Place – Marina Bay), and later a line out to HarbourFront. A hop takes 10–15 real seconds; end to end about 1–2 real minutes, faster still with the express stop. Stations in the city are underground (later step), the others on viaducts.
- **Between districts:** a few HDB estates, parks and expressways, not kilometres of them.
- **What carries over from step 1:** the streaming and pools, the facade material, the skyline, collision and floors, the trains, stations and riding, save, the map and HUD. **What changes:** the island's data (coastline, districts, roads, MRT) becomes hand-placed and the generator fills each district from its layout instead of scattering lots across a scaled-down real island.

## Aldi's life

### Arrival (the tutorial)
Aldi lands at Changi with a suitcase: immigration, the arrival hall, a SIM card and a transit card from the convenience store, the dome's waterfall on the way out, and the first MRT ride across the island on the East-West Line (changing at Tanah Merah, then at Buona Vista for the Circle Line). A colleague meets Aldi at a short-stay serviced apartment in one-north, a stop from the office, for the first two weeks while Aldi looks for a place. The first days cover onboarding at Chopee, a first hawker meal (chope a seat with a tissue packet, queue, return the tray), and the property app.

### Work: software engineer at Chopee
Aldi is a software engineer at **Chopee**, the e-commerce company, on a team building the shopping app. The job is built for freedom:
- **Work is a two-week sprint of tickets**, not hours. Each sprint brings 4–6 tickets with points and a due date (a new checkout screen, a bug from users, a slow page to speed up, a code review for a teammate). Aldi works on them with the laptop anywhere: at home, in a café, at a co-working space, or at a desk at the office. Working a ticket is a short coding mini-game (reading the problem, choosing the fix, writing and testing) or a time skip.
- **The headquarters on Science Park Drive** is the everyday office: the team's desks, a pantry with free coffee and snacks, meeting rooms, the campus food court, table tennis, the nap pods. Two things are in person: the daily stand-up at 10:00 on office days (Aldi goes in two or three days a week, the player chooses which) and the sprint review and planning every second Friday.
- **The CBD:** Chopee's city office in a Raffles Place tower, where the business teams sit. Aldi goes there for meetings with sellers and partners, the quarterly all-hands, the company's town hall and hackathons, and can hot-desk there any day. After work: the hawker market's satay street, drinks at Boat Quay, the bay's light show.
- **Engineering life:** code reviews from teammates, a production incident now and then (a page from the on-call phone at night, fixed from wherever Aldi is), demo days, and a hackathon twice a year.
- **Pay and growth:** salary on the 25th and a bonus after the year-end review. Tickets done well and on time, good reviews, helping teammates and incidents handled raise the rating; the ladder goes Software Engineer → Senior → Staff, with raises. Side projects stay possible from the laptop.

### A place to live
The property app lists rooms and flats. Viewings happen in person at a set time with the landlord or agent. Signing means a deposit and monthly rent on the 1st; Aldi can move later. The first choices:
- **A common room in an HDB flat in Clementi** with an aunty landlord and her family (affordable, most social, near the MRT, 10 minutes to Chopee by bus).
- **A studio in Tiong Bahru's art deco blocks** (central, near the CBD, pricier, 25 minutes to Chopee).
- **A condo room near Orchard or River Valley**, with a pool and gym (expensive, private).
- **A co-living room at Tanjong Pagar** (young expats, shared kitchen, a short walk to work).
- **A shophouse loft in Joo Chiat** (in the east, near the beach).
Furniture and decorating follow the home (the kampung's house restoration becomes making the room Aldi's own).

### Money, stats and skills
- **Money in SGD:** salary on the 25th and rent on the 1st; a hawker meal $4–6, a kopi $1.40, the MRT about a dollar a trip, a taxi $10–25, the sky bar a lot.
- **Energy, mood and skills** stay: Cooking, Fitness, Charisma, Music, and Gardening (corridor plants and community garden plots). A Coding skill joins them, raised by work and side projects, which makes tickets faster and reviews better.

### Being Indonesian in Singapore
Malay-speaking Singaporeans understand Aldi's Indonesian (a warm bonus with them); the Indonesian community on Orchard Road on Sundays (food, groceries, remittance counters); 17 Agustus at the embassy; calls home to family; missing home food and finding it; helping a newer arrival later on.

## Getting around

1. **Public transport (the first version).** Walking; the MRT (lines and stations as in reality, fare gates, a card to top up, trains arriving on a timetable, platforms, standing or sitting inside while the city passes, announcements, the transfer at interchanges); buses (stops with arrival boards, the route numbers, tapping in, ringing the bell); shared bicycles and park connectors.
2. **Cars as a passenger.** Taxis flagged at a stand or on the road, and a ride-hail app on the phone: pick a destination, a car comes, Aldi rides in the back seat through the traffic.
3. **Aldi's own car, driven, and bought.** Owning a car is one of the big goals, earned step by step:
   - **Saving up:** a used car with its certificate of entitlement costs tens of thousands of dollars, so it takes good reviews, raises, a bonus and side jobs; the Journal tracks the savings goal.
   - **A licence:** converting Aldi's Indonesian licence means a theory test (a quiz on the phone) and a practical test at a driving centre (a short driving course).
   - **Choosing and buying:** a used-car dealer in the west (and car listings in the app) with a few models at different prices; test drives; a loan with monthly payments, or paying in full.
   - **Living with it:** parking at home (a season parking label, or hunting for a lot), fuel, ERP gantries charging on the way into town, road tax and insurance each year, and a car wash.
   - **What it opens:** late-night drives, taking friends out (a carload for the beach or a supper run), trips to the far corners of the island, and later the Causeway to Johor.
   Until then Aldi rides as a passenger: taxis and ride-hail cost more than the MRT but go door to door.

Traffic (cars, buses, taxis, motorbikes, lorries) runs on a road graph from the first version, since buses and taxis need it.

## People

- **Named people per area:** 8–12 in each place Aldi spends time: the Clementi landlord family and the block's neighbours, colleagues at Chopee (the team at Science Park and a few in the city office), hawker stall owners, the mosque's imam, kopitiam uncles, the Indonesian friends on Orchard, a Singaporean friend who shows Aldi around. About 30 to start, more as areas are added. Same NPC model: traits, likes and dislikes, schedules, ties between them, 3-step arcs.
- **Singapore's mix:** Chinese, Malay, Indian and Eurasian Singaporeans, other expats, migrant workers. Titles and forms of address (Uncle, Aunty, Encik, Mak Cik, Boss, Ah Boy) replace Pak, Bu and Mas, with the same etiquette idea.
- **Crowds** per district: office workers at lunch in the CBD, tourists at Marina Bay, students at NUS, shoppers on Orchard, families at the hawker centre, commuters in the MRT. Pooled and instanced like today's passers-by, with more of them.

## Culture, events and calendar

The game starts in late July, so National Day comes two weeks in, as 17 Agustus did.
- **National Day** (9 August): the parade rehearsal jets over the bay, fireworks, flags on the HDB blocks.
- **17 Agustus** at the Indonesian embassy.
- **Hari Raya** at Geylang Serai and Kampong Glam, **Deepavali** lights in Little India, **Chinese New Year** in Chinatown, **Mid-Autumn** lanterns, **Hungry Ghost month** getai stages and offerings, **Christmas** lights on Orchard, the night motor race round Marina Bay in September.
- **Everyday life:** chope, the tray return, queues at famous stalls, "eaten already?", the void-deck wedding or funeral tent, the residents' committee's events, the block's cat, fines (no durian on the MRT, no littering), afternoon thunderstorms and lightning alerts, the weekend at the hawker centre.

## What happens to the code

| Keep (engine and systems) | Rewrite or replace (content) |
|---|---|
| `core/` (time, player, collision, input, settings, state) | `world/` (the kampung's builders, layout, zones) |
| `render/` (batches, props, the signs atlas, hands, sky, lighting, quality, prewarm) | `npc/roster.ts` (the 24 residents), `places.ts` POIs |
| `npc/` runtime: schedules, navgraph and A*, characters, appearance, ambient | `dialogue/lines.json` (all text, now Singapore, in Singlish) |
| `social/` rules, life, plans, phone, reputation, the arcs framework | `game/items.ts` (food and gifts), recipes, shop stock |
| `dialogue/` provider and panel; `ui/` panel, contacts, map, mini-games | `game/events.ts`, the calendar's content, the arcs' scripts |
| `interiors/` framework, doors, shutters | the warung, warkop, musholla, balai and homes interiors |
| `game/` actions, stats, save, weather, bus, gains, jobs | the tutorial, the glossary, `house.ts` (becomes renting and decorating) |
| `audio/` engine | the soundscape's sources (MRT chimes, hawker clatter, traffic, the airport) |

New systems: the island's regions and uneven compression; chunks and streaming; the skyline; tall buildings and multi-storey interiors (lifts, corridors, floors); the road graph and traffic; the MRT and buses; the property app, leases and monthly money; the sprint-based job at Chopee; taxis and ride-hail; later, driving.

## Performance

Same budget (spec §9): under 150 draw calls, under 300k triangles, under 8 ms of JS a frame on a mid-range laptop. A city is harder than a kampung:
- Towers and HDB blocks are low-poly boxes with lit window textures from one shared atlas, instanced per 128 m chunk; only chunks near the player are drawn, and everything past the fog is one skyline mesh tinted by the sky.
- Regions are generated from their own seeds in idle time ahead of the player; a train at speed never catches up with the building.
- Traffic, trains and crowds are instanced; far ones are only numbers.
- Every step ends with the F3 sweep (views in each district, on a train, in a tower, in a hawker centre at lunch).

## Steps (a check with the user after each)

1. **The new spec and the groundwork (done; a scaled-down real island, replaced by 1b).** Rewrite `docs/design-spec.md` and CLAUDE.md for Singapore. The 30-minute day. The island framework: regions with their own seeds and compression, 128 m chunks with streaming, the skyline, builders for HDB blocks, shophouse rows and towers, the road graph. Clear out the kampung content. Aldi can walk a blockout of the island's towns and ride an MRT line through it.
1b. **The San Andreas-style island (done).** The hand-built 3 × 2 km coastline, the districts laid out by hand with their landmarks as blockouts, the roads, the MRT (East-West and North-South Lines, 12–16 stations), the map. Replaces step 1's scaled-down real island; the engine stays.
2. **Changi and the first ride (done).** The airport (Terminal 3's arrival hall with the 8-Twelve kiosk, the Jool and the Rain Vortex, the MRT station), fare gates and the EZ-Lah card, the East-West Line across the island to Buona Vista with a stop picker (express), the one-north studio. The arrival goals with a marker. Money (the wallet) returns.
3. **Science Park Drive, one-north and Clementi (done: Chopee's HQ with the lobby, gantry, canteen, lifts, team floor, pantry and meeting room; the sprint job with onboarding, tickets on the laptop, stand-ups, reviews and salary; bus 96; 448 Clementi Market & Food Centre with the chope ritual; energy and mood. Moved on: HDB blocks with void decks and lifts to step 5 with the Clementi home; the mall and NUS as places later).** Chopee's headquarters (the lobby and gantries, the team's floor, the pantry, meeting rooms, the food court), the serviced apartment at one-north, Clementi's town centre, HDB blocks with void decks and lifts, the market and hawker centre, the mall, the bus interchange; NUS and Kent Ridge between them. The sprint job and buses.
4. **The CBD and Marina Bay (done: Chopee's city office on Level 30 of Won Raffles Place with hot desks, seller meetings and the monthly all-hands; Lau Pa Sat with satay; Boat Quay's café tables; the light show; hackathons left for later).** Chopee's city office tower (lift lobby, the floor, meeting rooms), Raffles Place, the hawker market, the river quays, Marina Bay's landmarks. Meetings, all-hands and hackathons there.
5. **A place to live (done: HomeLah on the phone, viewings at booked times, leases signed at the door, rent on the 1st, the five homes walk-in with Blk 420's void deck and lift, decorating that lifts the mood each morning).** The property app, viewings, leases and rent, the five homes (Clementi first) with their interiors, moving in and decorating.
6. **People and conversation (done: 22 named people with places by the hour, the friendship rules ported with Singlish template lines behind the DialogueProvider, gifts from a bag, Contacts, passers-by by hour and district; walking between places and more people come with the districts).** The first 30 named people, all lines rewritten in Singlish, hawker food and gifts, the Clementi neighbours and the colleagues.
7. **Chinatown, Tiong Bahru, Little India, Kampong Glam and Orchard (done: Masjid Sultan with wudhu, the five prayers and Jumaat, prayer at home; Lucky Place's Toko Indonesia, bakso and remittances with Dewi and Bayu on Sundays; Chinatown's market and temple; Haji Lane; Tekka Centre; Tiong Bahru Market; EON Orchard; eight more people).** The rest of the centre, including the mosque (wudhu and sholat carry over) and the Indonesian community on Orchard.
8. **The calendar (done: National Day with flags and fireworks, the holiday in lieu, 17 Agustus at the embassy with the ceremony and the lomba, getai in Hungry Ghost month, Mid-Autumn lanterns, the night race, Deepavali, holidays without stand-ups, a Calendar app, afternoon thunderstorms).** National Day, 17 Agustus and the first months' festivals; everyday rituals; balancing money and time.
9. **(done: Katong's Peranakan row, East Coast Lagoon and the beach, the cable car to Sentosa, Uniworsal Studios, Siloso Beach, Mandai Zoo, the MacRitchie trail, the Causeway to Johor, buses 12 and 138)** **The East** (Changi, Katong, East Coast Park) and **Sentosa** (the beach, Uniworsal Studios, the cable car), then **the North** (forest, the zoo, Woodlands and the Causeway): one district per step, each with its people.
10. **(done: the road graph from the roads and their crossings, traffic driving it, six taxi stands and the Nab app, riding in the back to 17 destinations with fares by distance)** **Cars as a passenger:** taxis and ride-hail, and the traffic they drive in.
11. **(done: BB Drive Centre's theory test and circuit, Leng Kee Autos with three cars and a loan, driving from the driver's seat, petrol, ERP gantries, street and season parking, the monthly costs, the My car app)** **Aldi's own car:** saving up, the licence tests, the dealer and buying, driving, parking, ERP and running costs.
12. **(done: a sweep of 15 places and times at 34–67 draw calls, 183–225k triangles and 1.3–3.1 ms of JS headless; people, passers-by and trains made cheaper; CLAUDE.md, the spec and this plan brought up to date)** **Performance pass and docs.**

## v2: a living city

**The aim (with the user):** make the island feel bigger and busier than it is, the way San Andreas and Skyrim do. Neither world is large; both feel large because there is always something to see, hear or do within a few steps, and because the world visibly goes on without the player.

**How those games do it, and what it means here:**
- **Density over size.** Something new every 20–30 seconds of travel: a landmark on the skyline, a person doing something, a thing to use, a small event. The island stays 3 × 2 km; what changes is how much happens per street.
- **Layers.** A backdrop (the skyline, the sea, planes over Changi, ships in the strait); ambient life (crowds, traffic, birds, cats, sounds); things to use (vending machines, benches, ATMs, bike share); small activities (games, gigs, hobbies); stories (people, favours, events). Every street should have at least the first three.
- **Routines you can see.** Skyrim's people go to work, eat and sleep where the player can watch. Here: named people walk between their places, shops pull their shutters up in the morning and down at night, the hawker centre fills at lunch and the office crowd leaves at six.
- **Small events that find the player.** A lost tourist, a dropped wallet, an auntie with a heavy trolley, a busker, a cat. Short, optional, remembered by the people involved.
- **Discovery.** Things worth finding off the main roads (San Andreas' tags and oysters, Skyrim's books and shrines): Singapore's version is a makan list of dishes, community cats, murals, rooftop views and heritage plaques, kept in a phone app with progress.
- **Details that tell stories.** Shoes outside HDB doors, laundry poles, a chope'd seat, a wedding or funeral tent at a void deck, chalk hopscotch, a queue at the popular stall.
- **Tricks at a distance.** Moving things far away (planes landing, trains on the viaducts, ships, the Flyer turning, lit windows at night) make the edge of the world feel inhabited without costing much.

**Performance:** the same budget (150 draw calls, 300k triangles, 8 ms). Everything new is instanced or pooled, drawn only near Aldi (like `near` prop sets and the crowd's slots), and ticks at 1 Hz unless it's close. Each step ends with the F3 sweep.

## Steps for v2 (a check with the user after each)

13. **Street life (done: people walk the pavements between places near Aldi, passers-by with roles, gear, groups and umbrellas, diners at the hawker tables by the meal times, shutters by the hour).** Named people walk between their places along the pavements (to work, lunch and home) instead of jumping; passers-by get purposes and props (office workers with lanyards at lunch, aunties with shopping trolleys, students with bags, joggers in the parks, umbrellas in the rain) and walk in twos and threes; the hawker centres fill with seated diners at mealtimes; shops raise and lower their shutters by the hour.
14. **Traffic that behaves (done: lights at 118 junctions with the green man, zebra crossings, cars that stop at reds, queue and stop for Aldi with a horn, solid cars, the red-light camera, buses pulling in).** Traffic lights at the main junctions with the green man and its beeping, pedestrian crossings, cars that queue behind each other and stop for red lights and for Aldi, buses pulling in at stops, a horn now and then. Aldi's car obeys the same rules (a fine for running a red).
15. **Things to use on every street (done: about 160 vending machines, ATMs, benches, newsstands, Pedal-Lah racks, fitness corners and chess tables along the town roads, nine overhead bridges you can climb, each with its use).** Street furniture with a small use each: vending machines (a drink), ATMs (the bank), benches and bus-stop seats to sit on, fitness corners, void-deck chess tables, bike-share bikes to ride ("SG Bike" pun), newspaper stands, rain shelters, overhead bridges. Placed by the generator along streets and at void decks, so every town has them.
16. **Small events (done: a lost tourist, a dropped wallet, an auntie's trolley, a busker, flyers, community cats, void-deck weddings and wakes; deeds people mention).** About every minute or two of walking, something nearby: a tourist who asks the way (point on the map), a dropped wallet (return it, or not), an auntie's trolley on the stairs, a busker, a flyer, a community cat, an uncle's chess challenge, sudden rain sending everyone under a shelter, a void-deck wedding or wake. Each is short and optional; some give mood, reputation, a contact or a story people mention later.
17. **Discovery (done: the Explore app with the makan list, 14 cats, 6 murals, 13 viewpoints, 11 heritage plaques, titles, the off-menu dish, map dots).** An Explore app on the phone: the makan list (dishes to try across the hawker centres), community cats to photograph, murals, rooftop and bridge viewpoints, heritage plaques; each found one is marked on the map with progress per district, and some unlock something (a secret menu item, a rooftop bar, a person).
18. **Side gigs and hobbies.** Repeatable things with variety (San Andreas' side missions, Skyrim's radiant tasks): Nab Food deliveries on a bike share (timed runs to a door), badminton or futsal at the community centre with people, karaoke nights, a running club at East Coast Park, fishing at the reservoir, neighbours' favours.
19. **The world at a distance.** Planes landing and taking off at Changi, ships at anchor in the strait, birds over the trees, the Flyer turning, lit bridges and towers at night, and a sound bed per district (the CBD's hum, HDB estates' children and pigeons, the hawker centres' clatter, the sea).
20. **Performance pass and docs for v2.**

## Open questions

- **Where to stay after the serviced apartment:** the five homes above, or others you'd add (Clementi first, as you live there)?
- **v2 order:** start with step 13 (street life), or with the quick wins of steps 15 and 16 (things to use and small events)? Anything to add to or drop from the list?
