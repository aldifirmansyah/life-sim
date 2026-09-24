/* v1 dialogue provider: picks a line from lines.json by kind, preferring
   variants flavoured for the NPC's traits and mood, avoiding recent repeats,
   then fills in variables. */
import LINES from './lines.json';
import type { DialogueContext, DialogueLine, DialogueProvider } from './types';

type Variant = string | { t: string; traits?: string[]; mood?: 'good' | 'bad'; emote?: DialogueLine['emote'] };
const lines = LINES as unknown as Record<string, Variant[]>;

export const TOPIC_LABEL: Record<string, string> = {
  football: 'football',
  food: 'food',
  family: 'family',
  work: 'work',
  'kampung news': 'kampung news',
  weather: 'the weather',
  motorbikes: 'motorbikes',
  'old days': 'the old days',
  religion: 'musholla and Ramadan plans',
  music: 'music',
  'market prices': 'pasar prices',
  gossip: 'neighbourhood gossip',
};

/** How an NPC addresses Raka: elders say "Nak Raka", children and teens "Kak Raka", everyone else "Mas Raka". */
export const rakaFor = (age: number) => (age >= 55 ? 'Nak Raka' : age < 18 ? 'Kak Raka' : 'Mas Raka');
export const timeGreeting = (t: number) => {
  const h = (t / 60) % 24;
  return h < 11 ? 'Pagi' : h < 15 ? 'Siang' : h < 18 ? 'Sore' : 'Malam';
};
export const firstName = (name: string) => name.replace(/^(Pak|Bu|Mas|Mbak|Bang|Ustadz|Dek) /, '');

/** Which lines.json key a context reads. */
function keyFor(ctx: DialogueContext): string[] {
  const o = ctx.outcome;
  switch (ctx.kind) {
    case 'intro':
      return [`npc.${ctx.npc.id}.intro`, 'intro.generic'];
    case 'greet':
      return [`greet.${o}`];
    case 'greet.memory':
      return [`greet.memory.${o}`, 'greet.acquaintance'];
    case 'topic.like':
      return [`topic.like.${ctx.topic}`];
    case 'address':
    case 'compliment':
    case 'joke':
    case 'tease':
    case 'gossip':
    case 'bye':
      return [`${ctx.kind}.${o}`];
    default:
      return [ctx.kind];
  }
}

export class TemplateDialogueProvider implements DialogueProvider {
  /** Recently used lines per NPC and key, so repeats stay rare. */
  private recent = new Map<string, string[]>();

  async getLine(ctx: DialogueContext): Promise<DialogueLine> {
    const key = keyFor(ctx).find(k => lines[k]?.length) ?? 'bye.neutral';
    const traits = ctx.npc.traits as string[];
    const mood = ctx.mood >= 65 ? 'good' : ctx.mood < 35 ? 'bad' : 'mid';
    const pool: { t: string; emote?: DialogueLine['emote']; w: number }[] = [];
    for (const v of lines[key]) {
      const o = typeof v === 'string' ? { t: v } : v;
      if (o.traits && !o.traits.some(t => traits.includes(t))) continue;
      if (o.mood && o.mood !== mood) continue;
      // Flavoured lines are rarer in the file, so weight them up when they apply.
      pool.push({ t: o.t, emote: o.emote, w: o.traits || o.mood ? 3 : 1 });
    }
    const rk = `${ctx.npc.id}|${key}`;
    const used = this.recent.get(rk) ?? [];
    const fresh = pool.filter(p => !used.includes(p.t));
    const from = fresh.length ? fresh : pool;
    let r = Math.random() * from.reduce((a, p) => a + p.w, 0);
    let pick = from[0];
    for (const p of from)
      if ((r -= p.w) <= 0) {
        pick = p;
        break;
      }
    used.push(pick.t);
    if (used.length > Math.min(4, pool.length - 1)) used.shift();
    this.recent.set(rk, used);
    return { text: fill(pick.t, ctx), emote: pick.emote };
  }
}

function fill(t: string, ctx: DialogueContext) {
  const vars: Record<string, string> = {
    raka: rakaFor(ctx.npc.age),
    name: ctx.npc.name,
    first: firstName(ctx.npc.name),
    greet: timeGreeting(ctx.time),
    topic: ctx.topic ? TOPIC_LABEL[ctx.topic] : '',
    other: ctx.other?.name ?? '',
    place: ctx.location,
    heading: ctx.heading ?? '',
    detail: ctx.detail ?? '',
    job: ctx.npc.occupation,
  };
  const out = t.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
  // Capitalise a line that opens with a variable ("pasar prices? ...").
  return out.charAt(0).toUpperCase() + out.slice(1);
}
