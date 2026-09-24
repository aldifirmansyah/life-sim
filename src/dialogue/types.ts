/* The dialogue interface (spec §8.3). Game logic decides what happens (the
   outcome and friendship change) and then asks a provider for the words. A
   provider never changes game state; it only turns a context into a line. */
import type { Memory, NPC, Stage, Topic } from '../npc/types';

/** What the line is for. Game logic picks the kind; the provider picks the wording. */
export type LineKind =
  | 'intro'
  | 'greet'
  | 'greet.again'
  | 'greet.busy'
  | 'greet.memory'
  | 'address'
  | 'topic.like'
  | 'topic.neutral'
  | 'topic.dislike'
  | 'topic.repeat'
  | 'ask.like'
  | 'ask.dislike'
  | 'ask.birthday'
  | 'ask.story'
  | 'ask.done'
  | 'compliment'
  | 'joke'
  | 'tease'
  | 'gossip'
  | 'gift'
  | 'bye';

export interface DialogueContext {
  kind: LineKind;
  /** Sub-case chosen by game logic, e.g. 'good' | 'flat' | 'bad', or a memory kind. */
  outcome?: string;
  npc: NPC;
  stage: Stage;
  mood: number;
  memories: Memory[];
  topic?: Topic;
  /** Another resident the line is about (gossip, memories). */
  other?: NPC;
  /** Game-minutes since midnight. */
  time: number;
  day: number;
  /** Where the NPC is, e.g. "Warung Bu Sri". */
  location: string;
  /** Where the NPC is heading, when walking. */
  heading?: string;
  /** A gift's name. */
  item?: string;
  /** Extra text a line may need, e.g. a backstory snippet or birthday. */
  detail?: string;
}

export interface DialogueLine {
  text: string;
  /** Expression hint for the UI. */
  emote?: 'happy' | 'neutral' | 'annoyed' | 'shy' | 'sad';
}

export interface DialogueProvider {
  getLine(ctx: DialogueContext): Promise<DialogueLine>;
}
