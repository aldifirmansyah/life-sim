# Open world plan: Kota Sukamaju

Kampung Sukamaju stops being the whole game and becomes Raka's home neighbourhood in a small coastal town. Beyond the gapura are the main road, the town centre with a mall and a hotel, a country club on the hill, and a waterfront with a beach and a theme park. All of it is one continuous world: Raka walks, cycles, rides his motorbike, takes an angkot or sits behind an ojek to get there, and the trip happens in place, with no loading screen and no fade.

## Decisions (with the user)

- **Destinations:** the beach, a shopping mall, a country club, a hotel and a theme park, each a distinct experience rather than more kampung.
- **Travel in place:** every trip is driven or ridden through the world in real time. No fast travel.
- **Transport:** all of it: walking, a bicycle, Raka's own motorbike, ojek (the pangkalan and an app on the phone), and angkot minibuses on fixed routes.
- **People:** 8–12 new named people across the new places, with schedules, likes and arcs, plus generated crowds, shopkeepers and traffic.
- **Day length:** 30 real minutes (0.8 game-minutes per second, down from 1.2). Every schedule still works; the day just runs slower.
- **Unchanged:** the kampung itself (layout hash `280363673`), its 24 residents and every system built so far.

## Why these numbers work

Travel time has to fit in a day. With the 30-minute day a real second is 0.8 game-minutes:

| Trip | Distance | Walk (3.5 m/s) | Bicycle (6.5 m/s) | Motorbike (~16 m/s) |
|---|---|---|---|---|
| Kampung → mall | ~500 m | 2 min real ≈ 1.9 h game | 77 s ≈ 1 h | 31 s ≈ 25 min |
| Kampung → country club | ~550 m | ≈ 2.1 h | ≈ 1.1 h | ≈ 28 min |
| Kampung → beach, theme park | ~900 m | ≈ 3.4 h | ≈ 1.8 h | 56 s ≈ 45 min |

So walking works inside the kampung and to the nearest shops, a bicycle suits the town centre, and the beach is a proper outing: a motorbike, an angkot or an ojek. The town is compressed like most open-world games: real Indonesian distances would be two or three times longer.

NPC walking speed is defined per game-minute (`WALK` in `npc/npcs.ts`). It changes with the clock so residents still look like they walk at 1.45 m/s; crossing the kampung then takes about 60 game-minutes instead of 90.

## The map (about 1.6 × 1.2 km)

```
                      sawah · kali · gunung (north, as now)
   ┌──────────────┐   ┌─────────────────┐   ┌──────────────────────┐
   │ Country club │   │ Kampung Sukamaju│   │ Pusat kota           │
   │ on the hill: │   │ (unchanged,     │   │ Mall · Hotel ·       │
   │ golf, pool,  │   │ 120 × 125 m)    │   │ alun-alun · masjid   │
   │ clubhouse    │   │    gapura       │   │ raya · ruko blocks   │
   └──────┬───────┘   └───────┬─────────┘   └──────────┬───────────┘
   ═══════╧═══════ Jalan Raya (east–west, angkot route A) ═╧════════
          │  more kampungs, a pasar besar, SPBU and pertamini  │
   ═══════╧════════ Jalan Pantai (angkot route B) ════════════╧═══
   ┌──────────────────────────────────────────────────────────────┐
   │ Waterfront: Pantai Sukamaju · pier · theme park · beach hotel│
   └───────────────────────────── laut ───────────────────────────┘
```

- **Jalan Raya** replaces the ruko road outside the gapura: two lanes plus shoulders, ruko rows, warung tenda at night, a pertamini (bottled bensin on a rack) and an SPBU, bus-stop shelters.
- **Neighbouring kampungs** line the roads between destinations, generated with the same house builder, so the town feels continuous. They have ambient people but no named residents.
- **Pusat kota** (east): the mall, the hotel, an alun-alun (town square) with food carts at night, and the masjid raya with its minaret on the skyline.
- **Country club** (west, up a gentle slope): gatehouse, golf holes, driving range, pool, clubhouse restaurant. A different social class from the kampung.
- **Waterfront** (south): sand, the sea, fishing boats, a pier, kelapa muda stalls, a theme park with a ferris wheel and a roller coaster that show on the skyline, and a beach hotel.

## How it works

### World structure
- **Districts with their own seeds.** Each new district is generated from `mulberry32(hash(districtName))`, never from the kampung's `R()`. The kampung's build order and layout hash stay exactly as they are, and districts can be built in any order.
- **Chunks and streaming.** The world outside the kampung is split into 128 m chunks. Each chunk owns its own small `Batch` set (solid, roofs, lit…), colliders and interactables, and is shown when within the fog distance (170 m at High) plus a margin. Chunks are generated lazily in idle time ahead of the player, so a motorbike at 16 m/s never catches up with the building.
- **Skyline.** Landmarks that should be seen from anywhere (the hotel tower, the masjid raya minaret, the ferris wheel, the mountain) sit in one merged low-poly skyline mesh drawn past the fog and tinted by the sky colour, so the town reads as big even with a short draw distance.
- **Terrain.** Still mostly flat: a raised slope for the country club, a beach that slopes into the sea, and a sea plane with a cheap animated shader (one draw call).
- **Kampung walls.** The gapura becomes a real way through for vehicles. The walls stay; the kampung keeps its character and the main road stays outside.

### Roads and traffic
- **Road graph.** A second graph for vehicles (lanes, junctions, directions, speed limits), separate from the pedestrian lane graph. Pedestrian lanes join it at crossings.
- **Traffic.** Motorbikes, cars, angkot and trucks, instanced like the `Crowd` (a handful of draw calls whatever the count). They follow the road graph, keep left (Indonesia drives on the left), slow at junctions, stop for the player and honk. Only traffic near the player is simulated in detail; the rest is a density number per road.
- **Sound.** Engine hum per vehicle (placed), horns, the angkot kernet calling the route.

### Getting around
- **Walking and running** as now.
- **Bicycle.** Bought at a toko sepeda on Jalan Raya (or from the notice board second-hand). Pedal with W; no fuel; a small Fitness gain.
- **Motorbike.** Mbah Minah's old Honda in the back of the house, fixed up by Bang Udin (the mechanic) as a short arc, or a new one from a dealer. Arcade handling, first-person handlebars and mirrors, lean in turns, a helmet, parking on the stand (it stays where it's left and is saved), fuel bought by the bottle at a pertamini or at the SPBU. Kampung rules: push it through the gangs with the engine off after 21:00, or Pak Hartono (who hates motorbike noise) hears about it.
- **Angkot.** Two fixed routes (Jalan Raya; Jalan Pantai to the waterfront). Wait at a shelter or wave one down, climb in, sit on the side bench with other passengers (ambients and sometimes residents), pay the driver, and call "Kiri!" to stop. The ride is real: the angkot drives the route through the traffic.
- **Ojek.** From the pangkalan (Mas Yusuf when he's there, for a friendly ride and friendship) or booked on the phone (an ojol app: pick a destination, a driver arrives, Raka rides pillion while the driver goes there).
- **Phone Maps.** A Maps tab for the town map with a destination pin; the HUD shows a small direction marker and distance, like the tutorial marker.

### People
- **New named people (8–12)**, each with a home or workplace in the new areas, a schedule, likes and dislikes, and a 3-step arc. For example: a kelapa muda seller and a lifeguard at the beach; a food-court stall owner and a young shop assistant at the mall; the hotel receptionist; a club manager who hires Raka for design work; a caddy who grew up near the kampung; a ride operator at the theme park. They use the same NPC model, Contacts, gifts and plans.
- **Residents go out.** Residents who now go `away` get real destinations where it fits: Pak Rahmat's night shift is at the mall; Mas Yusuf rides his ojek around town; the students go to campus by angkot; families go to the beach on Sunday. Off-screen travel is abstract (a travel time, then they appear at the destination). Near the player they ride visibly.
- **Crowds per district.** Ambient pools per district (shoppers at the mall, bathers at the beach, golfers at the club), spawned near the player and recycled, like today's passers-by.

### The places
- **Pantai (beach).** Sit under a rented payung, swim (a simple wading and swimming mode), kelapa muda and seafood warung, beach football and volleyball (timing mini-games), fishing from the pier, sunsets. A Mbah Minah memory: she used to bring Raka here as a boy.
- **Mall.** A multi-floor interior with escalators, air-conditioning (a cool indoor sound), a supermarket (cheaper ingredients in bulk), clothes and gift shops (new gift items), a food court, a cinema (buy a ticket, watch as a fade), a game arcade, and a phone-accessory kiosk. Security at the door; open 10:00–22:00.
- **Hotel.** A lobby, a restaurant with a breakfast buffet, a rooftop pool and bar with a view over the town, and rooms to book for a night (a staycation: sleep there, breakfast included). A place to meet clients.
- **Country club.** Membership (or a guest pass from a client), a driving range and a few golf holes (a timing and aim mini-game), the pool, the clubhouse. Bigger freelance clients come from here, which gives income a way to grow.
- **Theme park.** A ticket at the gate, rides seen in place from Raka's seat (ferris wheel, roller coaster, bumper cars, carousel, swinging ship), game booths with prizes that make good gifts, and food stalls. Rides are on-rails camera sequences through the real park.

### Tying it into what's there
- **Outings and invitations** gain the new places (a Sunday at the beach, a film at the mall, the theme park on a weekend), with travel handled by the invite: meet at the gapura and go together on the angkot, or meet there.
- **Community events:** a *rekreasi warga* (the RT's day trip to the beach by rented bus) as a yearly event, and the town's 17 Agustus parade on Jalan Raya.
- **Economy:** new places cost more; bigger freelance jobs from the club and hotel clients; fuel, fares and tickets as everyday costs.
- **Save:** vehicles owned, where they're parked, fuel, memberships and tickets, the new people's socials and arcs.

## Performance budget

The spec §9 budget stays: under 150 draw calls, under 300k triangles, under 8 ms of JS a frame on a mid-range laptop.
- Chunk batches are small and only a few chunks are in view at once; the far town is the skyline mesh.
- Traffic and crowds are instanced; far traffic is a number, not a simulation.
- At 16 m/s the shadow camera follows as now; chunk generation runs in idle time and never in a frame that's already slow.
- Every step ends with the F3 sweep from interiors step 7, extended with views along the roads and in each new place.

## Steps (a check with the user after each)

1. **Foundations.** The 30-minute day (and `WALK` per game-minute). District seeds, chunks and streaming, the skyline mesh. Jalan Raya outside the gapura and the road graph. Neighbouring kampungs along it. The town map (M) and the phone Maps tab with a destination marker. Walking only, but the whole town layout exists as roads and blockouts.
2. **Bicycle and motorbike.** Riding, parking, fuel and the pertamini, helmets, Mbah Minah's old motorbike and Bang Udin's repair arc, the night-time gang rule.
3. **Traffic, angkot and ojek.** Traffic on the road graph, two angkot routes with shelters and passengers, ojek from the pangkalan and the phone app, residents riding.
4. **Pantai.** The waterfront, sea and sand, the beach activities, the first new named people, the beach memory.
5. **Mall.** The multi-floor interior, escalators, the shops, the food court, the cinema and the arcade.
6. **Hotel and country club.** The upscale town: the hotel's rooms and rooftop, the club, golf, and the freelance clients.
7. **Theme park.** The park, rides as in-place ride sequences, booths and prizes.
8. **Weaving in, balancing, performance and docs.** Residents' jobs and outings in the new places, the rekreasi warga, invitations, prices and income, a full performance pass, CLAUDE.md.

## Open questions

- **Cars:** Raka could also rent or borrow a car later (the plan covers motorbikes, bicycles, angkot and ojek). Worth adding?
- **Skipping a passenger ride:** travel is in place by decision. Should Esc during an angkot or ojek ride still jump to arrival (the ride is shown, but can be skipped), or should the ride always play out?
- **A second kampung story:** the neighbouring kampungs are ambient only. Later they could get their own RT, residents and events.
