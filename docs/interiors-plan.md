# Walk-in interiors: plan

Agreed with the user after Phase 7. The spec (§4) is updated to match.

## Decisions
- **Rooms in place.** Interiors are built inside hollow buildings in the outdoor scene, with no separate scene and no fade. You walk through a real door. The furniture is a `PropSet`, drawn only within about 30 m of the building, so it costs nothing elsewhere.
- **Real size.** Rooms match the building's exterior. Raka's house is 7 × 6.2 m outside, so its rooms are small, the way kampung houses are.
- **Prayer** at the musholla is a respectful fade, not an animation.
- **Other people's houses.** You knock or call out at the door ("Kulonuwun…", "Assalamualaikum!"). You may only go in when the owner is home and invites you. An empty house stays shut.

## How it works
- `world/houses.ts` `hollow`: walls with a doorway and window openings instead of a solid block, with colliders to match. It adds no `R()` calls, so the layout doesn't change. Windows get frames, teralis bars and open shutters.
- `interiors/door.ts` `Door`: a hinged leaf that swings inward. E opens or closes it; a collider applies while it's shut. It closes by itself a few seconds after Raka walks away, and won't shut on him while he's in the doorway.
- `interiors/interior.ts`:
  - Each `Interior` has named rooms (world rectangles), props, a door and a lamp.
  - Every frame it works out which room Raka is in. The HUD shows "Rumah Raka · Dapur".
  - Indoor effects ease in: less sky light (`setIndoorLight`), a warm point lamp (always in the scene, intensity 0 when unused, so shaders don't recompile), muffled ambience with a short room reverb (`setIndoor`), and a slower walk with no running.
  - Rain streaks are hidden indoors.
  - Sandals come off at the threshold: a sound, and a pair appears on the teras mat.
- `game/interact.ts`:
  - Interactables can have a height `y`, so you aim at them in 3D, pitch included, with a tighter cone.
  - `inside` limits where they can be used: an interior's name, `'*'` for anywhere (doors), or outdoors only when omitted.
- Saves already store Raka's position, so loading inside puts him back inside.

## Steps (a check with the user after each)

Steps 1 and 2 are done.
1. **Foundation + Raka's house shell.**
   - Hollow shell, door, rooms (ruang tamu, kamar, dapur, kamar mandi), tiled floor, plafon, lamp, indoor light and sound, sandals, slower walk, room names.
   - The home menu moves to a table inside.
   - Mornings start in the kamar.
2. **Raka's house in full.**
   - The neglected state: sheets over the furniture, dust, a leak stain and a bucket, a dim bulb. It changes as each room is restored.
   - Objects:
     - laptop: freelance
     - stove, gas bottle and rice cooker: cook
     - bed: sleep and nap, with a lie-down camera
     - chairs: rest
     - bak and gayung: bathe, for mood
     - radio: music
     - lemari: storage
   - Memory objects you can re-read: the guest book, recipe tin, letters, ledger and the 17 Agustus photo.
   - Teh guests sit in the ruang tamu.
3. **Warung Bu Sri.**
   - Shelves of renteng sachets, an etalase of gorengan, rice sacks, galons, a freezer, and Sri behind the counter.
   - Pick items off the shelves.
   - The warung shift becomes physical: order bubbles, and you fetch from the right shelf.
4. **Warkop Berkah.**
   - The back room becomes the shop: kopi counter, kettle, kerupuk jars, long table, calendar, TV on a bracket.
   - Sit and order; Pak Slamet brings the kopi over.
   - Football nights with cheers.
5. **Musholla and balai.**
   - Musholla: carpet with shaf lines, mihrab, mimbar, clock, infaq box, wudhu at the taps. Jamaah is a fade; the pengajian sits in a circle.
   - Balai: chairs, whiteboard, trophies, the arisan jar draw, lapor diri to Pak RT.
6. **Neighbours' houses.**
   - Knock or call out. Go in only if the owner is present and invites you.
   - Procedural interiors from the house size and household.
   - Bertamu: sitting, being served, when to take your leave.
7. **Performance pass and docs.**
