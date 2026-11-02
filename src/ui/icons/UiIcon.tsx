import type { ReactElement } from "react";
import { INK } from "../../scene/models/palette";

/**
 * The interface's own icons, drawn like the item icons: same ink, same stroke,
 * same chunky fills. Emoji looked different on every OS, and some school
 * Chromebooks lack the glyphs entirely, so nothing in the HUD depends on them.
 */
const W = 2.8;
const line = { stroke: INK, strokeWidth: W, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

const ICONS = {
  backpack: <g {...line}>
    <path d="M23 18 Q23 8 32 8 Q41 8 41 18" fill="none" />
    <rect x="13" y="16" width="38" height="41" rx="11" fill="#e8604c" />
    <rect x="20" y="36" width="24" height="16" rx="4" fill="#ffcc4d" />
    <path d="M20 43 L44 43" />
    <rect x="28" y="40" width="8" height="6" rx="2" fill="#fff4d4" strokeWidth={2} />
    <path d="M13 28 Q32 34 51 28" fill="none" />
  </g>,
  journal: <g {...line}>
    <path d="M32 16 Q20 8 8 12 L8 52 Q20 48 32 56 Q44 48 56 52 L56 12 Q44 8 32 16 Z" fill="#fffaf0" />
    <path d="M32 16 L32 56" />
    <path d="M15 22 Q21 20 26 24 M15 32 Q21 30 26 34 M38 24 Q43 20 49 22 M38 34 Q43 30 49 32" fill="none" stroke="#4f9ad6" strokeWidth={2.4} />
    <path d="M8 52 Q20 48 32 56 Q44 48 56 52 L56 56 Q44 52 32 60 Q20 52 8 56 Z" fill="#e8604c" />
  </g>,
  parrot: <g {...line}>
    <path d="M18 56 Q14 38 21 24 Q26 10 40 12 Q52 14 52 26 L52 30 L44 30 Q46 46 32 54 Z" fill="#4dbb52" />
    <path d="M44 22 L58 26 Q56 36 45 32 Z" fill="#ff9f2e" />
    <circle cx="39" cy="22" r="6" fill="#fff" />
    <circle cx="40" cy="22" r="2.6" fill={INK} stroke="none" />
    <path d="M22 28 Q10 36 14 52 Q24 48 30 38 Z" fill="#2e8c3a" />
    <circle cx="31" cy="30" r="4.6" fill="#ffd23f" stroke="none" />
    <path d="M16 54 L8 62 L20 60 Z" fill="#e5484d" />
  </g>,
  gear: <g {...line}>
    <path d="M28 6 H36 L38 14 L44 17 L51 12 L57 18 L52 25 L55 31 L62 32 V40 L54 42 L51 48 L56 55 L50 61 L43 56 L37 59 L35 62 H28 L26 54 L20 51 L13 56 L7 50 L12 43 L9 37 L2 36 V28 L10 26 L13 20 L8 13 L14 7 L21 12 L27 9 Z" fill="#a9b4bf" transform="translate(0 -2)" />
    <circle cx="32" cy="32" r="9" fill="#fffaf0" />
  </g>,
  speaker: <g {...line}>
    <path d="M9 25 H19 L34 12 V52 L19 39 H9 Z" fill="#4f9ad6" />
    <path d="M41 24 Q46 32 41 40" fill="none" />
    <path d="M48 17 Q58 32 48 47" fill="none" />
  </g>,
  mic: <g {...line}>
    <rect x="22" y="6" width="20" height="34" rx="10" fill="#fffaf0" />
    <path d="M22 18 H30 M22 26 H30" strokeWidth={2.2} />
    <path d="M14 30 Q14 48 32 48 Q50 48 50 30" fill="none" />
    <path d="M32 48 L32 58 M21 58 L43 58" />
  </g>,
  chest: <g {...line}>
    <path d="M8 28 Q8 12 32 12 Q56 12 56 28 Z" fill="#c9742f" />
    <rect x="8" y="28" width="48" height="26" rx="3" fill="#b5651d" />
    <path d="M18 13 L18 54 M46 13 L46 54" stroke="#ffcc4d" strokeWidth={5} />
    <path d="M18 13 L18 54 M46 13 L46 54" fill="none" strokeWidth={0} />
    <rect x="26" y="23" width="12" height="14" rx="3" fill="#ffcc4d" />
    <circle cx="32" cy="30" r="2.6" fill={INK} stroke="none" />
  </g>,
  arrow: <g {...line} strokeWidth={6}><path d="M12 32 H50 M34 16 L50 32 L34 48" fill="none" /></g>,
  close: <g {...line} strokeWidth={6}><path d="M16 16 L48 48 M48 16 L16 48" fill="none" /></g>,
  star: <g {...line}><path d="M32 6 L39.5 23 L58 25 L44 37 L48 55 L32 46 L16 55 L20 37 L6 25 L24.5 23 Z" fill="#ffcc4d" /></g>,
  flag: <g {...line}><path d="M15 6 V60" /><path d="M15 9 Q32 3 49 11 L40 22 L49 33 Q32 25 15 31 Z" fill="#e8604c" /></g>,
  sun: <g {...line}><circle cx="32" cy="32" r="13" fill="#ffcc4d" /><path d="M32 6 V13 M32 51 V58 M6 32 H13 M51 32 H58 M14 14 L19 19 M45 45 L50 50 M50 14 L45 19 M19 45 L14 50" /></g>,
  lock: <g {...line}><path d="M20 28 V19 Q20 7 32 7 Q44 7 44 19 V28" fill="none" strokeWidth={5} /><rect x="12" y="27" width="40" height="30" rx="6" fill="#ffcc4d" /><circle cx="32" cy="42" r="4" fill={INK} stroke="none" /></g>,
  thought: <g {...line}><path d="M15 34 Q6 30 10 21 Q10 12 21 13 Q27 5 37 10 Q48 7 52 17 Q60 22 55 31 Q55 41 44 39 Q36 45 27 40 Q18 42 15 34 Z" fill="#fffaf0" /><circle cx="17" cy="48" r="4" fill="#fffaf0" /><circle cx="9" cy="57" r="2.6" fill="#fffaf0" /></g>
} satisfies Record<string, ReactElement>;

export type UiIconName = keyof typeof ICONS;

export function UiIcon({ name, size = 28 }: { name: UiIconName; size?: number }) {
  return <svg className="tt-ui-icon" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">{ICONS[name]}</svg>;
}
