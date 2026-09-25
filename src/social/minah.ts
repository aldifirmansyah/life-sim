/* Mbah Minah (spec §3.1, personal arc): who Raka's grandmother was in the
   community, pieced together from what he finds restoring her house and what
   the neighbours tell him. Shown in the Journal. */
import { toast } from '../ui/hud';

export interface MinahMemory {
  id: string;
  title: string;
  text: string;
  /** Who told him, or where he found it. */
  from: string;
  day: number;
}
export const minah: MinahMemory[] = [];

export function addMinah(m: Omit<MinahMemory, 'day'>, day: number) {
  if (minah.some(x => x.id === m.id)) return;
  minah.push({ ...m, day });
  toast(`Mbah Minah: ${m.title}`, 'A new memory in your Journal (Tab).');
}

export const saveMinah = () => minah;
export function loadMinah(d: MinahMemory[]) {
  minah.length = 0;
  minah.push(...d);
}
