# Singapore plan

The game moves from Kampung Sukamaju to Singapore. The player is **Aldi**, a young Indonesian designer who lands at Changi to start a job in the city, finds a place to rent, and builds a life: neighbours, colleagues, the hawker stall owners who learn Aldi's order, the Indonesian community on Orchard Road on a Sunday. The world is the whole of Singapore, compressed, and travel happens in the world (walking, MRT, buses, then cars) with no loading screens.

This replaces the kampung (its setting, map, 24 residents, lines, food and events). It keeps the engine and every system: schedules and NPC movement, conversation and friendship, gifts, plans and invitations, the phone, interiors and doors, actions and hands, shops, mini-games, rain, save and audio. The open-world plan's technical ideas (chunks, streaming, a skyline, in-place travel, the 30-minute day) carry over here.

The last kampung version is kept on the branch **`kampung-v1`** (commit `18dfd08`).

## Decisions (with the user)

- **Setting:** real Singapore, the whole island: central, west, east, north, north-east and south, plus the islands. **Clementi** and **Science Park Drive** are in explicitly.
- **Player:** Aldi, from Indonesia, new to Singapore. A fixed character with no face shown.
- **Start:** landing at Changi Airport.
- **Home:** rented, of the player's choosing; where Aldi lives decides the neighbours.
- **Work:** a real CBD job that still leaves the days free to go around (below: flexible, deliverable-based work with an office in the CBD).
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

The island is about 50 × 27 km. The game compresses it unevenly:
- **Inside a neighbourhood** (Clementi, Chinatown, Marina Bay…), about **1:3**, so a town centre, its MRT station, hawker centre, mall and HDB blocks are a few minutes' walk apart, as they feel in real life.
- **Between regions**, much more (about **1:10**), with generated HDB estates, expressways and greenery filling the space. The whole island comes out at roughly **5 × 3 km**.
- **Journey times follow real Singapore.** Trains and buses run fast enough through the compressed gaps that a trip takes about what it would really take in game time: Changi Airport to the city about 35 game-minutes, Clementi to Raffles Place about 25, Clementi to Science Park about 10 by bus. With the 30-minute day (0.8 game-minutes a real second), that's under a minute of real riding for most trips.

## The areas

The whole island is in the plan; it's built region by region (step 9 onward), each with its people.

- **Central:** Marina Bay (the bay promenade, the Merlion, the three-tower hotel and sky park, the durian domes, the helix bridge, the supertrees and their light show), the CBD around Raffles Place (Aldi's office tower), Boat Quay and Clarke Quay, the octagonal hawker market with satay street at night, Chinatown (shophouses, temples, hawker centre, wet market), Tanjong Pagar, Tiong Bahru's art deco blocks, Little India, Kampong Glam and the Sultan Mosque, Bugis, Orchard Road with its malls (one the Indonesian community's Sunday meeting place) and the Botanic Gardens, Novena and Toa Payoh.
- **West:** **Clementi** (the HDB town round the MRT station and bus interchange, the mall above it, the market and hawker centre, the stadium, the neighbourhood park, and the view to the West Coast), **Science Park Drive** (the tech campus next to Kent Ridge: glass offices in green grounds, a food court, the park connector), NUS and Kent Ridge Park, Haw Par Villa, West Coast Park, Jurong East (malls, the lake gardens, the science centre), Jurong Island's flares on the skyline, Boon Lay.
- **East:** **Changi Airport** (the terminals, the dome with the indoor waterfall, the MRT station), Changi Village and the bumboat jetty to **Pulau Ubin** (Singapore's last kampung island: bicycles, quarries, a real kampung house or two, a nod to where the game began), Tampines, Bedok, East Coast Park (the beach, cycling, the seafood centre), Katong and Joo Chiat (Peranakan shophouses, laksa), Geylang Serai (the Hari Raya bazaar), Paya Lebar.
- **South:** Sentosa (beaches, a theme park, the cable car and monorail), HarbourFront and its big mall, Mount Faber, Keppel Bay.
- **North and North-East:** Woodlands and the Causeway (the queue to Johor), Sembawang, Mandai (the zoo, night safari and bird park), Yishun, Ang Mo Kio, Serangoon, Sengkang, and Punggol's waterfront.
- **The earlier plan's destinations** land here: beaches at East Coast and Sentosa, malls on Orchard, at HarbourFront and in Jurong, a country club in the east or at Keppel, the Marina Bay hotel, and the theme park on Sentosa.

## Aldi's life

### Arrival (the tutorial)
Aldi lands at Changi with a suitcase: immigration, the arrival hall, a SIM card and a transit card from the convenience store, the dome's waterfall on the way out, and the first MRT ride into the city on the East-West Line (changing trains at Tanah Merah). A colleague meets Aldi at the short-stay serviced apartment in Tanjong Pagar, near the office, for the first two weeks while Aldi looks for a place. The first days cover the office, a first hawker meal (chope a seat with a tissue packet, queue, return the tray), and the property app.

### Work: a CBD job with free days
Aldi is a product designer at a fictional regional tech company with its office in a Raffles Place tower. The job is built for freedom:
- **Work is a weekly set of deliverables**, not hours. Each week brings 3–5 design tasks with deadlines (a screen flow, an icon set, a user test report). Aldi works on them with the laptop anywhere: at home, in a café, at a co-working space, or at the office desk.
- **The office is the social and focus place.** Two fixed meetings a week (a Monday stand-up and a Thursday review) are in person; otherwise going in is optional. At the office: colleagues (named people), the pantry and free coffee, focus (tasks go faster), lunch with the team at the hawker market, after-work drinks at Boat Quay on Fridays, the lift lobby small talk.
- **Pay** comes on the 25th; missing deadlines hurts the quarterly review and bonus; good reviews raise the pay. Freelance side jobs stay possible from the laptop.
- **Science Park Drive** is where the company's partner, **Chopee** (the e-commerce company), has its campus: design workshops there some weeks, a career path later (Aldi can move jobs to Science Park, close to Clementi), and one of the best reasons to live in the west.

### A place to live
The property app lists rooms and flats. Viewings happen in person at a set time with the landlord or agent. Signing means a deposit and monthly rent on the 1st; Aldi can move later. The first choices:
- **A common room in an HDB flat in Clementi** with an aunty landlord and her family (affordable, most social, near the MRT, 15 minutes to Science Park by bus).
- **A studio in Tiong Bahru's art deco blocks** (central, walkable to the office, pricier).
- **A condo room near Orchard or River Valley**, with a pool and gym (expensive, private).
- **A co-living room at Tanjong Pagar** (young expats, shared kitchen, a short walk to work).
- **A shophouse loft in Joo Chiat** (in the east, near the beach).
Furniture and decorating follow the home (the kampung's house restoration becomes making the room Aldi's own).

### Money, stats and skills
- **Money in SGD:** salary on the 25th and rent on the 1st; a hawker meal $4–6, a kopi $1.40, the MRT about a dollar a trip, a taxi $10–25, the sky bar a lot.
- **Energy, mood and skills** stay: Cooking, Fitness, Charisma, Music, and Gardening (corridor plants and community garden plots). A Design skill joins them, raised by work, which makes tasks faster and reviews better.

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

- **Named people per area:** 8–12 in each place Aldi spends time: the Clementi landlord family and the block's neighbours, colleagues at the office, the partner team at Science Park, hawker stall owners, the mosque's imam, kopitiam uncles, the Indonesian friends on Orchard, a Singaporean friend who shows Aldi around. About 30 to start, more as areas are added. Same NPC model: traits, likes and dislikes, schedules, ties between them, 3-step arcs.
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

New systems: the island's regions and uneven compression; chunks and streaming; the skyline; tall buildings and multi-storey interiors (lifts, corridors, floors); the road graph and traffic; the MRT and buses; the property app, leases and monthly money; the weekly deliverables job; taxis and ride-hail; later, driving.

## Performance

Same budget (spec §9): under 150 draw calls, under 300k triangles, under 8 ms of JS a frame on a mid-range laptop. A city is harder than a kampung:
- Towers and HDB blocks are low-poly boxes with lit window textures from one shared atlas, instanced per 128 m chunk; only chunks near the player are drawn, and everything past the fog is one skyline mesh tinted by the sky.
- Regions are generated from their own seeds in idle time ahead of the player; a train at speed never catches up with the building.
- Traffic, trains and crowds are instanced; far ones are only numbers.
- Every step ends with the F3 sweep (views in each district, on a train, in a tower, in a hawker centre at lunch).

## Steps (a check with the user after each)

1. **The new spec and the groundwork.** Rewrite `docs/design-spec.md` and CLAUDE.md for Singapore. The 30-minute day. The island framework: regions with their own seeds and compression, 128 m chunks with streaming, the skyline, builders for HDB blocks, shophouse rows and towers, the road graph. Clear out the kampung content. Aldi can walk a blockout of the island's towns and ride an MRT line through it.
2. **Changi and the first ride.** The airport (arrival hall, the dome and waterfall, the MRT station), the East-West Line into the city with the transfer at Tanah Merah, the Tanjong Pagar serviced apartment. The arrival tutorial.
3. **The CBD and Marina Bay.** The office tower (lift lobby, the office floor, the pantry, meeting rooms), Raffles Place, the hawker market, the river quays, Marina Bay's landmarks. The weekly deliverables job.
4. **Clementi and Science Park Drive.** Clementi's town centre, HDB blocks with void decks and lifts, the market and hawker centre, the mall, the bus interchange; the Science Park campus; NUS and Kent Ridge between them. Buses.
5. **A place to live.** The property app, viewings, leases and rent, the five homes (Clementi first) with their interiors, moving in and decorating.
6. **People and conversation.** The first 30 named people, all lines rewritten in Singlish, hawker food and gifts, the Clementi neighbours and the colleagues.
7. **Chinatown, Tiong Bahru, Little India, Kampong Glam and Orchard.** The rest of the centre, including the mosque (wudhu and sholat carry over) and the Indonesian community on Orchard.
8. **The calendar.** National Day, 17 Agustus and the first months' festivals; everyday rituals; balancing money and time.
9. **The east** (Katong, Geylang Serai, East Coast Park, Changi Village and Pulau Ubin, Tampines), then **the south** (Sentosa and HarbourFront), **the rest of the west** (Jurong), and **the north and north-east** (Woodlands, Mandai, Punggol): one region per step, each with its people.
10. **Cars as a passenger:** taxis and ride-hail, and the traffic they drive in.
11. **Aldi's own car:** saving up, the licence tests, the dealer and buying, driving, parking, ERP and running costs.
12. **Performance pass and docs.**

## Open questions

- **Aldi's CBD employer** needs a name too (a small design and tech company, so not a pun on a known one unless you have one in mind). Any name you'd like, or should I make one up?
- **Where to stay after the serviced apartment:** the five homes above, or others you'd add (Clementi first, as you live there)?
