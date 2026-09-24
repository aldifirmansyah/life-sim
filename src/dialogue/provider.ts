/* The one dialogue provider the game uses, and a helper for lines spoken outside
   the dialogue panel (speech bubbles, phone texts). Swap `provider` for an
   LLM-backed one later; it only ever words lines. */
import { S } from '../core/state';
import { heading, placeName, type Resident } from '../npc/npcs';
import type { DialogueContext, DialogueProvider } from './types';
import { TemplateDialogueProvider } from './template';

export const provider: DialogueProvider = new TemplateDialogueProvider();

/** A line from a resident, with the usual context filled in. */
export async function lineFor(r: Resident, part: Partial<DialogueContext> & Pick<DialogueContext, 'kind'>) {
  const npc = r.npc;
  const line = await provider.getLine({
    npc,
    stage: npc.playerRelationship.stage,
    mood: npc.mood,
    memories: npc.playerRelationship.memories,
    time: S.time,
    day: S.day,
    location: placeName(r),
    heading: heading(r) ?? undefined,
    ...part,
  });
  return line.text;
}
