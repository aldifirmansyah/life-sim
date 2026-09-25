# Singapore plan

The game moves from Kampung Sukamaju to Singapore. The player is **Aldi**, a young Indonesian who arrives in Singapore to work, finds a place to rent, and builds a life in the city: neighbours, colleagues, the hawker stall owners who learn Aldi's order, and the Indonesian community on Orchard Road on a Sunday. The world is real Singapore, compressed, and travel happens in the world: walking, the MRT, buses, taxis and bicycles, with no loading screens.

This replaces the kampung (the setting, its map, its 24 residents, its lines, food and events). It keeps the engine and every system: schedules and NPC movement, conversation and friendship, gifts, plans and invitations, the phone, interiors and doors, actions and hands, shops, mini-games, rain, save and audio. It also replaces `docs/openworld-plan.md`: its technical ideas (chunks, streaming, a skyline, the road graph, in-place travel, the 30-minute day) carry over here.

The last kampung version is commit `18dfd08` on this branch.

## Decisions (with the user)

- **Setting:** real Singapore, starting from the landmarks in the centre and growing outward.
- **Player:** Aldi, from Indonesia, new to Singapore. A fixed character with no face shown, as before.
- **Home:** Aldi comes as an expat and rents a place of the player's choosing; where Aldi lives decides the neighbours.
- **The kampung is replaced**, not kept as a place to visit.
- **From the open-world plan:** travel in place with every kind of transport, 8–12 named people per area plus crowds, a 30-minute day.
- **Unchanged:** friendship and community, not romance; trait-flavoured template dialogue behind `DialogueProvider`; English UI with local words (Singlish, Malay, Hokkien, Tamil, and Aldi's Indonesian) and a glossary; the low-poly, warm, flat-shaded look.

## Real Singapore, compressed

Real place names for public places (Marina Bay, Chinatown, Orchard Road, Little India, Kampong Glam, Sentosa, the MRT lines and stations), shaped after the real landmarks. Businesses and brands are fictional (a "Bayfront" hotel with three towers and a sky park, not the real one's name; malls, hawker stalls, banks and ride-hail apps with invented names), so nothing claims to be a real company.

The city is compressed about **1:3** so it can be walked and ridden within a day. The central area (Marina Bay to Orchard, Chinatown to Kampong Glam) becomes roughly 1.5 × 1.2 km. Places keep their real positions relative to each other: Orchard is north-west of the bay, Chinatown south-west, Kampong Glam north-east, Sentosa to the south across the water.

| Trip (compressed) | Distance | Walk | MRT (with waiting) | Taxi |
|---|---|---|---|---|
| Chinatown → Marina Bay | ~450 m | ≈ 1.7 h game | ≈ 25 min | ≈ 15 min |
| Chinatown → Orchard | ~900 m | ≈ 3.4 h | ≈ 30 min | ≈ 25 min |
| City → Sentosa (later) | ~1.3 km | too far | ≈ 40 min + monorail | ≈ 35 min |

(At the 30-minute day, one real second is 0.8 game-minutes.) Walking works within a district; the MRT is how Aldi crosses the city, just like a real resident.

## The first map: the landmark core

1. **Marina Bay.** The bay with its promenade loop and the Merlion spouting water, the hotel with three towers and a sky park (rooftop pool, observation deck), the durian-shaped theatre domes on the waterfront, the helix bridge, the supertree grove with its evening light show, and the skyline of the CBD behind. The light-and-water show over the bay at night.
2. **CBD and the river.** Towers around Raffles Place, the old post-office hotel, Boat Quay's bars in low shophouses along the river, Clarke Quay, the bridges, bumboats on the river, a lau pa sat-style octagonal hawker market with satay street at night.
3. **Chinatown.** Shophouse streets with five-foot ways, a Buddhist temple and a Hindu temple on the same road, a hawker centre (the Maxwell style), the wet market, pagoda street stalls, red lanterns, older HDB blocks with void decks at the edge.
4. **Little India and Kampong Glam.** Serangoon Road with the Hindu temple, flower-garland sellers and a 24-hour department store; the Sultan Mosque's golden dome, Arab Street textiles, Haji Lane murals, nasi padang and teh tarik. The mosque is where Aldi can pray (the musholla's systems carry over: wudhu, sholat, Friday prayers).
5. **Orchard Road.** The tree-lined shopping street with its malls, a mall that is the Indonesian community's Sunday meeting place (remittance counters, Indonesian food and groceries, phone shops), the Botanic Gardens at the far end.

Later areas (step 9 onward): Sentosa (beach, a theme park, the cable car and monorail), East Coast Park (the beach, cycling, the seafood centre), a country club, the heartlands (Tiong Bahru, Toa Payoh, Tampines, Jurong), Changi Airport, the reservoirs.

## Aldi's life

- **Arrival.** Aldi lands at the airport, or (to keep the first map small) arrives at a budget hostel in Chinatown with a suitcase for the first week. A tutorial covers the EZ-link-style card, the MRT, a first hawker meal (chope a seat with a tissue packet, queue, return the tray), and house-hunting.
- **Work.** Aldi arrives on an employment pass for a job as a designer at a small studio in the CBD (office hours on weekdays, some days working from home), with freelance on the side as today. Colleagues are named people. *(Open question below.)*
- **Renting a place.** A property app on the phone lists rooms and flats. Viewings happen in person with an agent or landlord at a set time. Choices, each in a different neighbourhood with its own neighbours:
  - a common room in an older HDB flat in Chinatown, with an aunty landlord and her family (cheapest, most social)
  - a whole studio in a Tiong Bahru-style art deco block (later map)
  - a room in a condo near Orchard or River Valley, with a pool and gym (expensive, private)
  - a co-living room near the CBD (young expats, shared kitchen)
  - a shophouse loft in Kampong Glam
  Signing means a deposit and monthly rent. Aldi can move later; furniture and the home's look follow the choice, and the restoration idea becomes decorating the room.
- **Money in SGD.** Salary on the 25th, rent on the 1st, CPF doesn't apply to an employment pass; hawker meals cost $4–6, a kopi $1.40, the MRT about a dollar a trip, a taxi $10–20, the hotel's rooftop bar a lot.
- **Stats and skills** stay: energy, mood, money; Cooking, Fitness, Charisma, Music, and Gardening (the HDB corridor plants, community gardens) — plus possibly Language (Singlish and Hokkien words picked up, unlocking better chats).
- **Being Indonesian in Singapore.** Malay-speaking Singaporeans understand Aldi's Bahasa (a warm bonus with them); the Indonesian community on Orchard on Sundays; 17 Agustus at the embassy; missing home food and finding it; calls home to family on the phone.

## People

- **Named people per area:** 8–12 in each place Aldi spends time: the neighbours where Aldi rents, colleagues at the studio, hawker stall owners, the mosque's imam, the kopitiam uncles, the Indonesian friends at the Orchard mall, a Singaporean friend who shows Aldi around. About 30 to start, with more as areas are added. Same NPC model: traits, likes and dislikes, schedules, ties between them, and 3-step arcs.
- **Singapore's mix:** Chinese, Malay, Indian and Eurasian Singaporeans, other expats, foreign workers; titles and forms of address (Uncle, Aunty, Encik, Mak Cik, Anneh, Ah Boy) replace Pak, Bu and Mas, with the same etiquette idea.
- **Crowds** per district: office workers at lunch in the CBD, tourists at Marina Bay, shoppers on Orchard, families at the hawker centre. Pooled and instanced like today's passers-by, with more of them in the city.

## Culture, events and calendar

The calendar starts on a date that suits the story (arrival in late July, so National Day is a couple of weeks in, as 17 Agustus was).
- **National Day** (9 August): the parade rehearsals' fighter jets over the bay, fireworks, flags on HDB blocks.
- **17 Agustus** at the Indonesian embassy and in the community.
- **Hari Raya** at Geylang and Kampong Glam, **Deepavali** lights on Serangoon Road, **Chinese New Year** in Chinatown, **Mid-Autumn** lanterns, **Hungry Ghost month** getai stages and offerings, **Christmas** lights on Orchard, and a night motor race around Marina Bay in September.
- **Everyday rituals:** chope, the tray return, queues at famous stalls, "eaten already?", the void-deck wedding or funeral tent, the RC's events, the neighbourhood's cat, the fines (no durian on the MRT, no littering), afternoon thunderstorms and lightning alerts.

## What happens to the code

| Keep (engine and systems) | Rewrite or replace (content) |
|---|---|
| `core/` (time, player, collision, input, settings, state) | `world/` (the kampung's builders, layout, zones) |
| `render/` (batches, props, signs atlas, hands, sky, lighting, quality) | `npc/roster.ts` (24 residents), `places.ts` POIs |
| `npc/` runtime: schedules, navgraph and A*, characters, appearance, ambient | `dialogue/lines.json` (all text, now Singapore-flavoured) |
| `social/` rules, life, plans, phone, reputation, arcs framework | `game/items.ts` (food and gifts), recipes, shop stock |
| `dialogue/` provider and panel, `ui/` panel, contacts, map, minigames | `game/events.ts`, calendar content, arcs' scripts |
| `interiors/` framework, doors, shutters | the warung, warkop, musholla, balai and homes interiors |
| `game/` actions, stats, save, weather, bus, gains, jobs | the tutorial, the glossary, `house.ts` (becomes renting and decorating) |
| `audio/` engine | the soundscape's sources (MRT chimes, hawker clatter, traffic) |

New systems: tall buildings and multi-storey interiors (lifts as short in-place rides, corridors, floors), the city's chunks and streaming, the skyline, the road graph and traffic, the MRT (lines, stations, fare gates, trains you ride), buses, taxis and a ride-hail app, bicycles, the property app and leases, monthly money (salary, rent), and the office job.

## Performance

Same budget (spec §9): under 150 draw calls, under 300k triangles, under 8 ms of JS a frame on a mid-range laptop. A city is harder than a kampung:
- Towers are low-poly boxes with lit window textures (one shared atlas), instanced per chunk; only chunks near the player are drawn, and the skyline beyond the fog is one merged mesh tinted by the sky.
- The fog distance may need to grow in the city so the skyline reads; the skyline mesh does most of that work.
- Traffic, trains and crowds are instanced; far ones are simulated as numbers.
- Every step ends with the F3 sweep (views in each district, on a train, in a tower), as in interiors step 7.

## Steps (a check with the user after each)

1. **The new spec and the groundwork.** Rewrite `docs/design-spec.md` and CLAUDE.md for Singapore. The 30-minute day. The city framework: districts with their own seeds, 128 m chunks with streaming, the skyline, tall-building builders (HDB blocks, shophouse rows, towers), the road graph. Clear out the kampung content. Aldi walks an empty compressed Marina Bay and CBD blockout.
2. **Marina Bay and the CBD.** The bay, the promenade, the Merlion, the hotel and sky park, the domes, the helix bridge, the supertrees and their light show, the river with Boat Quay and Clarke Quay, the towers. Crowds and first ambient life.
3. **Chinatown.** Shophouse streets, the temples, the hawker centre with stalls you order from (chope, queue, tray return), the wet market, the older HDB blocks with void decks and a lift. The hostel where Aldi stays at first.
4. **Getting around.** The MRT through the core (stations, fare gates, a card to top up, trains you board and ride), buses, taxis and a ride-hail app, bicycles, the town map and Maps on the phone.
5. **Little India, Kampong Glam and Orchard.** The rest of the landmark core, including the mosque (wudhu and sholat carry over) and the Indonesian community's mall.
6. **A place to live.** The property app, viewings, leases and rent, three or four homes to choose from with their interiors, moving in, decorating.
7. **People and conversation.** The new roster (about 30), rewritten lines with Singapore flavour, hawker food and gifts, the studio job, colleagues and neighbours, the tutorial.
8. **The calendar.** National Day, 17 Agustus, and the festivals that fall in the first months; everyday rituals; balancing money and time.
9. **Expanding.** Sentosa (beach, theme park, cable car), East Coast Park, a country club, more of the heartlands, one area per step, each with its people.
10. **Performance pass and docs.**

## Open questions

- **Aldi's job:** a studio job on an employment pass (office hours, colleagues, salary) with freelance on the side, as proposed; or fully freelance as Raka was?
- **Arrival:** land at the airport (a bigger first map) or start at the Chinatown hostel (proposed)?
- **Language skill:** a Language skill for picking up Singlish and other languages, or just the glossary?
- **Cars:** a car is famously expensive in Singapore. Leave it out, or make it a late, costly dream?
- **Keeping the kampung version:** should it be kept on a separate branch or tag before the content is cleared out? (It stays in this branch's history either way.)
