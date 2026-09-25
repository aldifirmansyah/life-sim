# Singapore plan

The game moves from Kampung Sukamaju to Singapore. The player is **Aldi**, a young Indonesian software engineer who lands at Changi to start a job at Chopee, finds a place to rent, and builds a life: neighbours, colleagues, the hawker stall owners who learn Aldi's order, the Indonesian community on Orchard Road on a Sunday. The world is the whole of Singapore, compressed, and travel happens in the world (walking, MRT, buses, then cars) with no loading screens.

This replaces the kampung (its setting, map, 24 residents, lines, food and events). It keeps the engine and every system: schedules and NPC movement, conversation and friendship, gifts, plans and invitations, the phone, interiors and doors, actions and hands, shops, mini-games, rain, save and audio. The open-world plan's technical ideas (chunks, streaming, a skyline, in-place travel, the 30-minute day) carry over here.

The last kampung version is kept on the branch **`kampung-v1`** (commit `18dfd08`).

## Decisions (with the user)

- **Setting:** real Singapore, the whole island: central, west, east, north, north-east and south, plus the islands. **Clementi** and **Science Park Drive** are in explicitly.
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

The island is about 50 × 27 km. The game compresses it unevenly:
- **Inside a neighbourhood** (Clementi, Chinatown, Marina Bay…), about **1:3**, so a town centre, its MRT station, hawker centre, mall and HDB blocks are a few minutes' walk apart, as they feel in real life.
- **Between regions**, much more (about **1:10**), with generated HDB estates, expressways and greenery filling the space. The whole island comes out at roughly **5 × 3 km**.
- **Journey times follow real Singapore.** Trains and buses run fast enough through the compressed gaps that a trip takes about what it would really take in game time: Changi Airport to the city about 35 game-minutes, Clementi to Raffles Place about 25, Clementi to Science Park about 10 by bus. With the 30-minute day (0.8 game-minutes a real second), that's under a minute of real riding for most trips.

## The areas

The whole island is in the plan; it's built region by region (step 9 onward), each with its people.

- **Central:** Marina Bay (the bay promenade, the Merlion, the three-tower hotel and sky park, the durian domes, the helix bridge, the supertrees and their light show), the CBD around Raffles Place (Chopee's city office tower), Boat Quay and Clarke Quay, the octagonal hawker market with satay street at night, Chinatown (shophouses, temples, hawker centre, wet market), Tanjong Pagar, Tiong Bahru's art deco blocks, Little India, Kampong Glam and the Sultan Mosque, Bugis, Orchard Road with its malls (one the Indonesian community's Sunday meeting place) and the Botanic Gardens, Novena and Toa Payoh.
- **West:** **Clementi** (the HDB town round the MRT station and bus interchange, the mall above it, the market and hawker centre, the stadium, the neighbourhood park, and the view to the West Coast), **Science Park Drive** (the tech campus next to Kent Ridge where Chopee has its headquarters: glass offices in green grounds, a food court, the park connector), NUS and Kent Ridge Park, Haw Par Villa, West Coast Park, Jurong East (malls, the lake gardens, the science centre), Jurong Island's flares on the skyline, Boon Lay.
- **East:** **Changi Airport** (the terminals, the dome with the indoor waterfall, the MRT station), Changi Village and the bumboat jetty to **Pulau Ubin** (Singapore's last kampung island: bicycles, quarries, a real kampung house or two, a nod to where the game began), Tampines, Bedok, East Coast Park (the beach, cycling, the seafood centre), Katong and Joo Chiat (Peranakan shophouses, laksa), Geylang Serai (the Hari Raya bazaar), Paya Lebar.
- **South:** Sentosa (beaches, a theme park, the cable car and monorail), HarbourFront and its big mall, Mount Faber, Keppel Bay.
- **North and North-East:** Woodlands and the Causeway (the queue to Johor), Sembawang, Mandai (the zoo, night safari and bird park), Yishun, Ang Mo Kio, Serangoon, Sengkang, and Punggol's waterfront.
- **The earlier plan's destinations** land here: beaches at East Coast and Sentosa, malls on Orchard, at HarbourFront and in Jurong, a country club in the east or at Keppel, the Marina Bay hotel, and the theme park on Sentosa.

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

1. **The new spec and the groundwork (done).** Rewrite `docs/design-spec.md` and CLAUDE.md for Singapore. The 30-minute day. The island framework: regions with their own seeds and compression, 128 m chunks with streaming, the skyline, builders for HDB blocks, shophouse rows and towers, the road graph. Clear out the kampung content. Aldi can walk a blockout of the island's towns and ride an MRT line through it.
2. **Changi and the first ride.** The airport (arrival hall, the dome and waterfall, the MRT station), the East-West Line across the island with the transfers at Tanah Merah and Buona Vista. The arrival tutorial.
3. **Science Park Drive, one-north and Clementi.** Chopee's headquarters (the lobby and gantries, the team's floor, the pantry, meeting rooms, the food court), the serviced apartment at one-north, Clementi's town centre, HDB blocks with void decks and lifts, the market and hawker centre, the mall, the bus interchange; NUS and Kent Ridge between them. The sprint job and buses.
4. **The CBD and Marina Bay.** Chopee's city office tower (lift lobby, the floor, meeting rooms), Raffles Place, the hawker market, the river quays, Marina Bay's landmarks. Meetings, all-hands and hackathons there.
5. **A place to live.** The property app, viewings, leases and rent, the five homes (Clementi first) with their interiors, moving in and decorating.
6. **People and conversation.** The first 30 named people, all lines rewritten in Singlish, hawker food and gifts, the Clementi neighbours and the colleagues.
7. **Chinatown, Tiong Bahru, Little India, Kampong Glam and Orchard.** The rest of the centre, including the mosque (wudhu and sholat carry over) and the Indonesian community on Orchard.
8. **The calendar.** National Day, 17 Agustus and the first months' festivals; everyday rituals; balancing money and time.
9. **The east** (Katong, Geylang Serai, East Coast Park, Changi Village and Pulau Ubin, Tampines), then **the south** (Sentosa and HarbourFront), **the rest of the west** (Jurong), and **the north and north-east** (Woodlands, Mandai, Punggol): one region per step, each with its people.
10. **Cars as a passenger:** taxis and ride-hail, and the traffic they drive in.
11. **Aldi's own car:** saving up, the licence tests, the dealer and buying, driving, parking, ERP and running costs.
12. **Performance pass and docs.**

## Open questions

- **Where to stay after the serviced apartment:** the five homes above, or others you'd add (Clementi first, as you live there)?
