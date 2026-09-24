/* The phone (Tab): Contacts (spec §10) for every resident Raka has met, and a
   glossary of the Indonesian words the game uses. */
import { $ } from '../core/util';
import { S } from '../core/state';
import { keys } from '../core/player';
import { residents } from '../npc/npcs';
import * as social from '../social/social';
import { TOPIC_LABEL } from '../dialogue/template';
import { drawPortrait } from './portrait';
import { renderHearts } from './dialogue';
import { tryLock } from './overlays';
import * as stats from '../game/stats';
import { item, rupiah } from '../game/items';

const GLOSSARY: [string, string][] = [
  ['Pak / Bu', 'Mr / Mrs. For elders and anyone older or respected. Use it with the first name: Pak Darto, Bu Sri.'],
  ['Mas / Mbak', 'Older brother / sister. For men and women around your own age: Mas Yusuf, Mbak Ayu.'],
  ['Dek', 'Little one. For children and younger teens: Dek Bima.'],
  ['Kak', 'What children call an older boy or girl.'],
  ['Nak', 'Child. What elders call young people, affectionately.'],
  ['Bang', 'Big brother, Betawi style. Bang Udin.'],
  ['Ustadz', 'A religious teacher. Ustadz Hasan looks after the musholla.'],
  ['Mbah', 'Grandparent. Mbah Minah was Raka’s grandmother.'],
  ['Cucu', 'Grandchild.'],
  ['Pak RT / Bu RT', 'The head of the RT and his wife. Pak Bambang is Pak RT.'],
  ['RT / RW', 'Rukun Tetangga / Rukun Warga: the neighbourhood and the ward. This is RT 04, RW 07.'],
  ['Kampung', 'An urban village: dense lanes, small houses, everyone knows everyone.'],
  ['Gang', 'A narrow lane between houses, too narrow for cars.'],
  ['Jalan', 'Street or road. Jalan Sukamaju is the main lane.'],
  ['Teras', 'The front porch. Where neighbours sit and call out to passers-by.'],
  ['Warung', 'A small shop and food stall. Warung Bu Sri is the heart of the kampung.'],
  ['Warkop', 'Warung kopi: a coffee stall. Men gather at Warkop Berkah in the evening.'],
  ['Musholla', 'A small prayer room, smaller than a masjid.'],
  ['Adzan', 'The call to prayer, five times a day.'],
  ['Jumatan', 'Friday midday prayers. Most men go to the musholla.'],
  ['Balai warga', 'The community hall, for RT meetings and events.'],
  ['Pos ronda', 'The night-watch post. Neighbours take turns keeping watch.'],
  ['Ronda', 'The night watch itself.'],
  ['Lapangan', 'A small field, for futsal, badminton and kites.'],
  ['Pasar pagi', 'The morning market, gone by half past nine.'],
  ['Kali', 'A river or canal.'],
  ['Sawah', 'Rice fields.'],
  ['Gapura', 'The decorated gateway at the kampung entrance.'],
  ['Ojek', 'A motorbike taxi. The pangkalan ojek is where drivers wait.'],
  ['Bakso', 'Meatball soup, sold from a cart.'],
  ['Gorengan', 'Fried snacks: tempe, tofu, banana fritters.'],
  ['Kue', 'Cakes and sweets, often steamed.'],
  ['Jamu', 'Traditional herbal drink.'],
  ['Arisan', 'A rotating-savings gathering. Everyone pays in, one person takes the pot each month.'],
  ['Pengajian', 'A religious study gathering.'],
  ['Kerja bakti', 'Communal clean-up, usually Sunday morning.'],
  ['Anak kos', 'A student renting a room.'],
  ['Tukang', 'A handyman or builder.'],
  ['Selamat pagi / siang / sore / malam', 'Good morning / midday / afternoon / evening.'],
  ['Mampir', 'Drop in, stop by.'],
  ['Hati-hati', 'Take care, go carefully.'],
];

export function openPhone() {
  if (!S.started || S.dialog || S.map || S.paused) return;
  S.phone = true;
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  $('phone').hidden = false;
  showTab('contacts');
}
export function closePhone() {
  S.phone = false;
  $('phone').hidden = true;
  tryLock();
}

type Tab = 'contacts' | 'bag' | 'skills' | 'glossary';
const TAB_TITLE: Record<Tab, string> = { contacts: 'Contacts', bag: 'Bag', skills: 'Skills', glossary: 'Glossary' };
const RENDER: Record<Tab, () => void> = {
  contacts: renderContacts,
  bag: renderBag,
  skills: renderSkills,
  glossary: renderGlossary,
};

function showTab(tab: Tab) {
  document
    .querySelectorAll<HTMLElement>('#phonetabs button')
    .forEach(b => b.setAttribute('aria-checked', String(b.dataset.tab === tab)));
  for (const t of Object.keys(TAB_TITLE) as Tab[]) $(t).hidden = t !== tab;
  $('phone-title').textContent = TAB_TITLE[tab];
  RENDER[tab]();
}

export function bindPhone() {
  document
    .querySelectorAll<HTMLElement>('#phonetabs button')
    .forEach(b => (b.onclick = () => showTab(b.dataset.tab as Tab)));
  $('closephone').onclick = closePhone;
  $('tphone').onclick = openPhone;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function renderContacts() {
  const box = $('contacts');
  box.innerHTML = '';
  const met = residents.filter(r => social.social(r.npc).met);
  $('phone-count').textContent = `${met.length} of ${residents.length} neighbours met`;
  const sorted = [...met].sort((a, b) => b.npc.playerRelationship.friendship - a.npc.playerRelationship.friendship);
  for (const r of sorted) {
    const npc = r.npc;
    const st = social.social(npc);
    const rel = npc.playerRelationship;
    const card = document.createElement('article');
    card.className = 'contact';
    const chips = (known: string[], total: number, cls: string) =>
      known.map(t => `<span class="chip ${cls}">${esc(TOPIC_LABEL[t])}</span>`).join('') +
      (total > known.length ? `<span class="chip unknown">${total - known.length} unknown</span>` : '');
    const housemates = residents
      .filter(o => o !== r && o.def.household === r.def.household && social.social(o.npc).met)
      .map(o => o.npc.name);
    const ties = st.known.ties.map(id => {
      const other = residents.find(o => o.npc.id === id)!.npc;
      const v = npc.relationships[id] ?? 0;
      return v >= 30
        ? `Thinks highly of ${other.name}.`
        : v <= -20
          ? `Doesn’t get along with ${other.name}.`
          : `Knows ${other.name} a little.`;
    });
    const mems = [...rel.memories]
      .reverse()
      .slice(0, 2)
      .map(m => `Day ${m.day}: ${m.text}.`);
    const notes = [housemates.length ? `Lives with ${housemates.join(', ')}.` : '', ...ties, ...mems].filter(Boolean);
    card.innerHTML = `
      <canvas class="portrait"></canvas>
      <div class="cbody">
        <header><h3>${esc(npc.name)}</h3><span class="stage${rel.friendship < 0 ? ' bad' : ''}">${rel.friendship < 0 ? 'strained' : rel.stage}</span><div class="hearts"></div></header>
        <p class="job">${esc(npc.occupation)} · call ${npc.gender === 'm' ? 'him' : 'her'} <b>${esc(social.properName(npc))}</b></p>
        <dl>
          <dt>Likes</dt><dd>${chips(st.known.likes, npc.likes.length, 'like') || '<span class="chip unknown">ask them</span>'}</dd>
          <dt>Dislikes</dt><dd>${chips(st.known.dislikes, npc.dislikes.length, 'dislike') || '<span class="chip unknown">ask them</span>'}</dd>
          ${giftChips(st.known.gifts)}
          <dt>Birthday</dt><dd>${st.known.birthday ? esc(npc.birthday) : '<span class="chip unknown">?</span>'}</dd>
          ${notes.length ? `<dt>Notes</dt><dd><ul>${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></dd>` : ''}
        </dl>
      </div>`;
    box.appendChild(card);
    renderHearts(card.querySelector('.hearts')!, rel.friendship);
    drawPortrait(card.querySelector('canvas')!, npc.appearance, r.i);
  }
  const unmet = residents.length - met.length;
  if (unmet) {
    const card = document.createElement('article');
    card.className = 'contact unmet';
    card.innerHTML = `<canvas class="portrait"></canvas><div class="cbody"><header><h3>${unmet} more</h3></header><p class="job">Neighbours you haven’t said hello to yet. Look for them at the warung, the warkop, their teras… and press E.</p></div>`;
    box.appendChild(card);
    const any = residents.find(r => !social.social(r.npc).met)!;
    drawPortrait(card.querySelector('canvas')!, any.npc.appearance, 0, true);
  }
}

function renderGlossary() {
  $('phone-count').textContent = 'Words you’ll hear around the kampung';
  $('glossary').innerHTML = GLOSSARY.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('');
}

function giftChips(gifts: Record<string, string>) {
  const ids = Object.keys(gifts);
  if (!ids.length) return '';
  const cls: Record<string, string> = { loved: 'like', liked: 'like', disliked: 'dislike', neutral: '' };
  const sym: Record<string, string> = { loved: '\u2665 ', liked: '', disliked: '\u2715 ', neutral: '' };
  const order = ['loved', 'liked', 'neutral', 'disliked'];
  ids.sort((a, b) => order.indexOf(gifts[a]) - order.indexOf(gifts[b]));
  return `<dt>Gifts</dt><dd>${ids.map(id => `<span class="chip ${cls[gifts[id]]}">${sym[gifts[id]]}${esc(item(id).name)}</span>`).join('')}</dd>`;
}

/* ================= bag and skills ================= */

function renderBag(note?: string) {
  const box = $('bag');
  const list = stats.contents();
  $('phone-count').textContent =
    note ?? `${rupiah(stats.stats.money)} \u00b7 ${list.reduce((a, e) => a + e.qty, 0)} things in your bag`;
  if (!list.length) {
    box.innerHTML =
      '<p class="empty">Nothing yet. The warung and the pasar pagi sell food, ingredients, seedlings and small gifts.</p>';
    return;
  }
  box.innerHTML = '';
  for (const e of list) {
    const row = document.createElement('article');
    row.className = 'bagitem';
    const stars =
      e.item.cat === 'dish' ? ` <span class="stars">${'\u2605'.repeat(e.q)}${'\u2606'.repeat(5 - e.q)}</span>` : '';
    row.innerHTML = `<div><h4>${esc(e.item.name)}${stars} <small>\u00d7${e.qty}</small></h4><p>${esc(e.item.blurb)}</p></div>`;
    if (e.item.eat) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ghost';
      b.textContent = e.item.cat === 'drink' ? 'Drink' : 'Eat';
      b.onclick = () => {
        stats.take(e.item.id);
        stats.consume(e.item.id, e.q);
        S.time += 5;
        renderBag(
          `You ${e.item.cat === 'drink' ? 'drink' : 'eat'} the ${e.item.name.charAt(0).toLowerCase() + e.item.name.slice(1)}. Energy ${Math.round(stats.stats.energy)}, mood ${Math.round(stats.stats.mood)}.`,
        );
      };
      row.appendChild(b);
    }
    box.appendChild(row);
  }
}

function renderSkills() {
  const s = stats.stats;
  $('phone-count').textContent = 'Skills grow with practice, from level 1 to 10';
  const bar = (label: string, v: number, text: string, cls = '') =>
    `<div class="skill"><span>${label}</span><b class="${cls}"><i style="width:${Math.round(v * 100)}%"></i></b><em>${text}</em></div>`;
  const how: Record<stats.Skill, string> = {
    cooking: 'Cook at home',
    fitness: 'Jog around the kampung (hold Shift)',
    gardening: 'Plant, water and harvest',
    charisma: 'Good conversations, helping at the warung',
    music: 'Comes later: the guitar',
  };
  $('skills').innerHTML =
    '<div class="skillgroup">' +
    bar('Energy', s.energy / 100, String(Math.round(s.energy)), 'energy') +
    bar('Mood', s.mood / 100, String(Math.round(s.mood)), 'mood') +
    `<div class="skill"><span>Money</span><em class="money">${rupiah(s.money)}</em></div></div><div class="skillgroup">` +
    (Object.keys(stats.SKILL_NAMES) as stats.Skill[])
      .map(k => bar(`${stats.SKILL_NAMES[k]} <small>${how[k]}</small>`, stats.levelProgress(k), `Lv ${stats.level(k)}`))
      .join('') +
    '</div>';
}
