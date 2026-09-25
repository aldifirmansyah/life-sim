/* The dialogue interface. Game logic decides what happens (the outcome and the
   friendship change), then asks a provider for the words. A provider never
   changes game state; it only turns a context into a line. The templates
   (dialogue/template.ts) are the provider now; an LLM provider can plug in later
   behind the same interface. */
import type { NPC, Stage, Topic } from '../npc/types';

export type LineKind =
  | 'intro'
  | 'greet'
  | 'greet.again'
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
  | 'gift'
  | 'gossip'
  | 'bye';

export interface DialogueContext {
  kind: LineKind;
  /** Sub-case chosen by game logic: 'good' | 'flat' | 'bad', 'stranger' | 'friend', … */
  outcome?: string;
  npc: NPC;
  stage: Stage;
  topic?: Topic;
  /** Another person the line is about (gossip). */
  other?: NPC;
  item?: string;
  detail?: string;
  time: number;
  day: number;
  location: string;
}
export interface DialogueLine {
  text: string;
  emote?: 'happy' | 'neutral' | 'annoyed' | 'shy' | 'sad';
}
export interface DialogueProvider {
  getLine(ctx: DialogueContext): Promise<DialogueLine>;
}
