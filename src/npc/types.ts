/* NPC data model (spec §8.2). Game logic reads and writes these; the dialogue
   provider (Phase 3) only ever reads them. */

export type Trait =
  'cheerful' | 'shy' | 'grumpy' | 'curious' | 'gossip' | 'sporty' | 'artsy' | 'bookish' | 'ambitious' | 'caring';

/** Conversation topics (spec §11). Gift categories are added in Phase 4. */
export type Topic =
  | 'football'
  | 'food'
  | 'family'
  | 'work'
  | 'kampung news'
  | 'weather'
  | 'motorbikes'
  | 'old days'
  | 'religion'
  | 'music'
  | 'market prices'
  | 'gossip';

export type Stage = 'stranger' | 'acquaintance' | 'friend' | 'close friend' | 'best friend';

/** A place an NPC can be: `<poi>.<slot tag>`, e.g. `warung.customer`, `home.teras`, `away`. */
export type LocationId = string;

/** What the NPC is doing there. Drives pose now, dialogue flavour later. */
export type Activity =
  | 'sleep'
  | 'home'
  | 'relax'
  | 'work'
  | 'shop'
  | 'eat'
  | 'pray'
  | 'chat'
  | 'play'
  | 'garden'
  | 'fish'
  | 'study'
  | 'ronda'
  | 'walk'
  | 'away';

export interface ScheduleBlock {
  /** Game-minutes since midnight; the day runs 06:00 (360) to 26:00 (1560). */
  start: number;
  end: number;
  location: LocationId;
  activity: Activity;
}

/** One day's blocks per day of week; index 0 is Minggu (Sunday), matching `DAYS`. */
export type WeekSchedule = ScheduleBlock[][];

export interface Memory {
  day: number;
  kind: string;
  text: string;
  weight: number;
}

export type HairStyle = 'short' | 'long' | 'bun' | 'hijab' | 'peci' | 'cap' | 'bald';

export interface AppearanceParams {
  /** Standing height in metres. */
  height: number;
  /** Width multiplier for torso and limbs (0.85 slim … 1.25 stocky). */
  build: number;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  top: string;
  longSleeves: boolean;
  bottom: string;
  /** Long skirt or sarung over the legs. */
  skirt: boolean;
  /** Hijab, peci or cap colour, when worn. */
  headwear: string;
  child: boolean;
}

export interface NPC {
  id: string;
  name: string;
  /** How Raka addresses them: Pak, Bu, Mas, Mbak, Dek, Bang, Ustadz. */
  address: string;
  age: number;
  gender: 'm' | 'f';
  occupation: string;
  /** Household id; members share a home. */
  household: string;
  home: LocationId;
  traits: Trait[];
  likes: Topic[];
  dislikes: Topic[];
  schedule: WeekSchedule;
  /** Feelings toward other residents, -100..100, keyed by NPC id. */
  relationships: Record<string, number>;
  playerRelationship: {
    friendship: number; // -100..100
    // romance: reserved for a later version; do not implement in v1
    stage: Stage;
    lastTalkedDay: number;
    memories: Memory[]; // last ~10 notable events with the player
  };
  mood: number; // 0..100, affects responses
  appearance: AppearanceParams;
}
