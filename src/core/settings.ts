import { REDUCED } from './util';

export interface Settings {
  /** 0 = low, 1 = medium, 2 = high */
  quality: number;
  sens: number;
  bob: boolean;
  debug: boolean;
}

export const SETTINGS: Settings = { quality: 1, sens: 1, bob: !REDUCED, debug: false };
try {
  Object.assign(SETTINGS, JSON.parse(localStorage.getItem('kampung-settings') || '{}'));
} catch (e) {
  /* storage unavailable */
}
export const saveSettings = () => {
  try {
    localStorage.setItem('kampung-settings', JSON.stringify(SETTINGS));
  } catch (e) {
    /* storage unavailable */
  }
};
