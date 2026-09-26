/* The template provider: Singlish lines picked by kind and outcome, with a few
   per-person intros and stories from the roster. Placeholders: {name} (how they
   say Aldi's name), {topic}, {item}, {detail}, {other}, {time} (morning /
   afternoon / evening). The pick is random among the lines that fit. */
import type { DialogueContext, DialogueLine, DialogueProvider } from './types';
import { properName } from '../social/social';

const L: Record<string, string[]> = {
  intro: [
    "Eh, new face! You new here ah? I'm {self}. You are…? Aldi! Nice to meet you.",
    'Hello! Never see you before leh. {self}. You from where? Indonesia! Wah, welcome to Singapore.',
    "Oh hi, you must be new. I'm {self}. Aldi, is it? OK OK, I remember already.",
  ],
  'greet.stranger': ['Oh, hello.', 'Hi hi.', 'Yes? Can help you?', 'Hello, Aldi right?'],
  'greet.acquaintance': [
    'Eh Aldi! Good {time}.',
    'Aldi! How are you?',
    'Hello Aldi, you makan already?',
    'Aldi ah, long time no see!',
  ],
  'greet.friend': [
    'Aldi! My friend! Come, come.',
    'Eh Aldi, I was just thinking about you. Makan already?',
    'Wah, Aldi! You look shiok today.',
    'Aldi! Sit down lah, chit chat a while.',
  ],
  'greet.cold': ['Hmm. You again.', "Oh. It's you.", 'Yah, what?'],
  'greet.out.walking': [
    "Eh Aldi! I'm on the way {detail}. Walk with me a bit?",
    'Aldi! Fancy bumping into you here. Going {detail} lah.',
    'Oi Aldi! Where you going? Me, {detail}.',
  ],
  'greet.out.haunt': [
    'Wah, Aldi! You also come {detail} ah? Small world!',
    "Eh, Aldi! Didn't expect to see you at {detail}.",
    'Aldi! Here also can meet you. Singapore really small, hor?',
  ],
  'greet.again': ['Eh, we just talked leh!', 'Back again? Ha, OK lah.', 'Miss me already ah?'],
  'topic.like': [
    'Wah, {topic}! You also like ah? We can talk until tomorrow.',
    'Eh {topic} is my thing, you know! Shiok, finally someone to talk to.',
    'Ah {topic}, now you are talking. Let me tell you…',
  ],
  'topic.neutral': [
    '{topic} ah? OK lah, not bad.',
    'Hmm, {topic}. Can, can.',
    "Oh, {topic}. I don't know much, but OK.",
  ],
  'topic.dislike': [
    'Aiyo, {topic}… Can we talk about something else?',
    '{topic} again? Siao liao. I really not interested lah.',
    'Eh, {topic} makes me pek chek. Change topic please.',
  ],
  'topic.repeat': ['We talked about {topic} already leh.', '{topic} again? You like to repeat ah.'],
  'ask.like': [
    'Me ah? I really like {topic}. Can talk the whole day.',
    'You want to know? {topic}! Ask anyone, they will tell you.',
  ],
  'ask.dislike': ["I cannot stand {topic}. Don't start ah.", 'Honestly? {topic} bores me to death.'],
  'ask.birthday': ['My birthday? {detail}. Why, you want to belanja me ah?', "{detail}. Don't forget hor!"],
  'ask.story': ['{detail}', 'OK I tell you something… {detail}'],
  'ask.done': ['Enough about me lah, what about you?', 'Aiyo, you ask so many questions. Next time!'],
  'compliment.good': [
    'Wah, thank you! You very sweet leh.',
    'Aiyo, you make me paiseh. Thanks ah!',
    'Really ah? Thank you, Aldi.',
  ],
  'compliment.shy': ['Oh… um, thanks.', "Aiyah, don't say like that… thank you."],
  'compliment.flat': ['Hmm. OK.', 'Thanks, I guess.'],
  'compliment.repeat': ['You said already leh. Ha.', 'Again? You want something from me ah?'],
  'joke.good': ['Hahaha! Wah, you damn funny!', 'Hahaha, siao! Where you learn that one?', 'Hahaha, OK that one good.'],
  'joke.flat': ['Heh. OK.', "…I don't get it, but OK.", 'Hmm, lame lah, but I give you one point.'],
  'joke.bad': ['Eh, not funny lah.', "Aiyo. Don't joke like that.", '…Wah. OK.'],
  'gift.loved': ['Wah, {item}! You know me so well. Thank you so much!', '{item}! My favourite! How you know?'],
  'gift.liked': ['Oh, {item}, thank you! So nice of you.', 'For me ah? Thanks Aldi, {item} not bad!'],
  'gift.neutral': ['Oh, {item}. Thanks ah.', '{item}? OK, thank you.'],
  'gift.disliked': ['Oh… {item}. Um. Thanks?', 'Eh, {item} not really my thing leh, but thanks.'],
  'gift.again': ['You already gave me something today! Keep it lah.'],
  'gossip.good': ['{other}? Very nice person. I like {other} a lot.', 'Ah, {other}! Steady one, you can trust.'],
  'gossip.bad': [
    "{other} ah… don't get me started. Very lecheh one.",
    'Between you and me, {other} and I, not so close.',
  ],
  'gossip.neutral': ['{other}? OK lah, nothing special.', '{other}, can lah. We say hello only.'],
  'gossip.shy': ["Eh, I don't talk about other people lah.", "Not my business, I don't know."],
  'gossip.refuse': ["I don't like to gossip. Paiseh."],
  'bye.warm': ['OK, see you Aldi! Take care!', "Bye bye! Don't work too hard ah!", 'Jio me next time hor!'],
  'bye.neutral': ['OK, bye.', 'See you.', 'Bye bye.'],
  'bye.cold': ['Hmm. Bye.', 'OK.'],
};

const timeOf = (t: number) => (t < 12 * 60 ? 'morning' : t < 18 * 60 ? 'afternoon' : 'evening');

export class TemplateProvider implements DialogueProvider {
  async getLine(ctx: DialogueContext): Promise<DialogueLine> {
    const key = ctx.outcome && L[`${ctx.kind}.${ctx.outcome}`] ? `${ctx.kind}.${ctx.outcome}` : ctx.kind;
    const own = PERSONAL[ctx.npc.id]?.[key];
    const pool = own?.length ? own : (L[key] ?? L[ctx.kind] ?? ['…']);
    const raw = pool[Math.floor(Math.random() * pool.length)];
    const text = raw
      .replace(/\{self\}/g, properName(ctx.npc))
      .replace(/\{topic\}/g, ctx.topic ?? 'that')
      .replace(/\{item\}/g, ctx.item ?? 'this')
      .replace(/\{detail\}/g, ctx.detail ?? '')
      .replace(/\{other\}/g, ctx.other ? properName(ctx.other) : 'them')
      .replace(/\{time\}/g, timeOf(ctx.time));
    const emote = /good|loved|liked|friend/.test(key)
      ? 'happy'
      : /bad|dislike|cold|refuse/.test(key)
        ? 'annoyed'
        : 'neutral';
    const cap = text.replace(/(^|[.?!]\s+)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
    return { text: cap, emote };
  }
}
/** Lines for one person that replace the general ones (set by the roster). */
export const PERSONAL: Record<string, Record<string, string[]>> = {};
export const provider: DialogueProvider = new TemplateProvider();
