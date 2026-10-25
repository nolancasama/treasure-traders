import type { ReactElement } from "react";
import type { ItemId } from "../../game/content/ids";
import { ITEMS } from "../../game/content/items";
import { INK, ITEM_COLORS } from "../../scene/models/palette";

/**
 * Inline SVG item icons (SPEC §9–10): the same signature look and colours as
 * the 3D models, crisp from 24 to 96 px. Silhouette mode paints one flat
 * colour without details (empty backpack slots, sea-chest engravings).
 */
type Mode = { sil: string | null };

const W = 2.6;

function paint(m: Mode, color: string): string {
  return m.sil ?? color;
}

function strokeOf(m: Mode): string {
  return m.sil ?? INK;
}

const DRAW: Record<ItemId, (m: Mode) => ReactElement> = {
  pen: (m) => {
    const c = ITEM_COLORS.pen;
    return (
      <g transform="rotate(-45 32 32)" stroke={strokeOf(m)} strokeWidth={W} strokeLinejoin="round">
        <polygon points="5,32 13,28 13,36" fill={paint(m, c.accent)} />
        <rect x="13" y="27.5" width="9" height="9" fill={paint(m, c.dark)} />
        <rect x="22" y="27.5" width="19" height="9" fill={paint(m, c.main)} />
        <rect x="40" y="26.5" width="18" height="11" rx="4" fill={paint(m, c.dark)} />
        {!m.sil && <rect x="42" y="23" width="12" height="3.4" rx="1.4" fill={c.accent} />}
        {!m.sil && <line x1="24" y1="30" x2="38" y2="30" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" />}
      </g>
    );
  },
  marker: (m) => {
    const c = ITEM_COLORS.marker;
    return (
      <g transform="rotate(-45 32 32)" stroke={strokeOf(m)} strokeWidth={W} strokeLinejoin="round">
        <polygon points="5,30 10,26 10,38 5,34" fill={paint(m, "#3a3a40")} />
        <rect x="10" y="24.5" width="30" height="15" rx="2" fill={paint(m, c.main)} />
        {!m.sil && <rect x="17" y="24.5" width="13" height="15" fill={c.accent} />}
        {!m.sil && <rect x="17" y="30" width="13" height="4" fill={c.main} stroke="none" />}
        <rect x="39" y="23.5" width="20" height="17" rx="4" fill={paint(m, c.dark)} />
        {!m.sil && <rect x="42" y="20" width="14" height="3.6" rx="1.5" fill={c.dark} />}
        {!m.sil && <line x1="42" y1="28" x2="56" y2="28" stroke="#ffffff" strokeOpacity={0.45} strokeWidth={1.6} strokeLinecap="round" />}
      </g>
    );
  },
  ruler: (m) => {
    const c = ITEM_COLORS.ruler;
    return (
      <g transform="rotate(-35 32 32)" stroke={strokeOf(m)} strokeWidth={W} strokeLinejoin="round">
        <rect x="3" y="24" width="58" height="16" rx="2.5" fill={paint(m, c.main)} />
        {!m.sil &&
          Array.from({ length: 13 }, (_, i) => (
            <line key={i} x1={7 + i * 4.2} y1={24} x2={7 + i * 4.2} y2={i % 5 === 0 ? 32 : 28.5} stroke={c.accent} strokeWidth={1.4} />
          ))}
        {!m.sil && <line x1="6" y1="37" x2="58" y2="37" stroke={c.light} strokeWidth={1.4} />}
      </g>
    );
  },
  stapler: (m) => {
    const c = ITEM_COLORS.stapler;
    return (
      <g stroke={strokeOf(m)} strokeWidth={W} strokeLinejoin="round">
        <rect x="7" y="41" width="50" height="9" rx="4" fill={paint(m, c.accent)} />
        <path d="M9 39 L49 29 Q58 27 58 35 L58 37 Q58 41 54 41 L12 41 Z" fill={paint(m, c.main)} />
        <circle cx="12" cy="41" r="4.4" fill={paint(m, "#9aa0aa")} />
        {!m.sil && <path d="M18 36 L46 30" stroke={c.light} strokeWidth={2} strokeLinecap="round" />}
        {!m.sil && <rect x="47" y="41" width="9" height="2.6" fill={INK} stroke="none" />}
      </g>
    );
  },
  calendar: (m) => {
    const c = ITEM_COLORS.calendar;
    return (
      <g stroke={strokeOf(m)} strokeWidth={W} strokeLinejoin="round">
        <rect x="11" y="13" width="42" height="42" rx="5" fill={paint(m, c.main)} />
        <path d="M11 25 L11 18 Q11 13 16 13 L48 13 Q53 13 53 18 L53 25 Z" fill={paint(m, c.accent)} />
        <rect x="20" y="8" width="5" height="10" rx="2.5" fill={paint(m, "#9aa0aa")} />
        <rect x="39" y="8" width="5" height="10" rx="2.5" fill={paint(m, "#9aa0aa")} />
        {!m.sil &&
          [0, 1, 2].flatMap((r) =>
            [0, 1, 2, 3].map((col) => (
              <rect key={`${r}-${col}`} x={16 + col * 8.5} y={30 + r * 7.8} width="6" height="5.4" rx="1" fill={r === 1 && col === 2 ? c.accent : c.dark} stroke="none" />
            ))
          )}
      </g>
    );
  },
  notebook: (m) => {
    const c = ITEM_COLORS.notebook;
    return (
      <g stroke={strokeOf(m)} strokeWidth={W} strokeLinejoin="round">
        <rect x="17" y="9" width="35" height="47" rx="3.5" fill={paint(m, c.main)} />
        {!m.sil && <rect x="48.5" y="11" width="3" height="43" fill="#f7f5ee" stroke="none" />}
        {!m.sil && <rect x="25" y="17" width="19" height="11" rx="1.5" fill={c.accent} strokeWidth={1.6} />}
        {!m.sil && <line x1="28" y1="21" x2="41" y2="21" stroke="#9fb7c9" strokeWidth={1.4} />}
        {!m.sil && <line x1="28" y1="24.5" x2="38" y2="24.5" stroke="#9fb7c9" strokeWidth={1.4} />}
        {Array.from({ length: 7 }, (_, i) => (
          <ellipse key={i} cx="17" cy={14 + i * 6.3} rx="4" ry="2.2" fill={paint(m, "#d7dbe2")} strokeWidth={1.8} />
        ))}
      </g>
    );
  },
  eraser: (m) => {
    const c = ITEM_COLORS.eraser;
    return (
      <g stroke={strokeOf(m)} strokeWidth={W} strokeLinejoin="round">
        <polygon points="8,26 15,19 60,19 53,26" fill={paint(m, "#ffffff")} />
        <polygon points="53,26 60,19 60,38 53,45" fill={paint(m, "#dfe3e8")} />
        <rect x="8" y="26" width="45" height="19" rx="2" fill={paint(m, c.main)} />
        {!m.sil && <rect x="24" y="25.2" width="29" height="20.6" fill={c.accent} />}
        {!m.sil && <polygon points="24,25.2 31,18.2 60,18.2 53,25.2" fill={c.accent} />}
        {!m.sil && <rect x="24" y="25.2" width="5" height="20.6" fill="#ffffff" />}
        {!m.sil && <rect x="47" y="25.2" width="3.5" height="20.6" fill={INK} stroke="none" />}
      </g>
    );
  },
  pencil: (m) => {
    const c = ITEM_COLORS.pencil;
    return (
      <g transform="rotate(-45 32 32)" stroke={strokeOf(m)} strokeWidth={W} strokeLinejoin="round">
        <polygon points="14,27.5 3,32 14,36.5" fill={paint(m, "#f2cf9a")} />
        {!m.sil && <polygon points="6.6,30.5 3,32 6.6,33.5" fill="#3a3a40" strokeWidth={1.2} />}
        <rect x="14" y="27.5" width="35" height="9" fill={paint(m, c.main)} />
        {!m.sil && <line x1="15" y1="32" x2="48" y2="32" stroke={c.dark} strokeWidth={1.4} />}
        <rect x="49" y="27" width="6" height="10" fill={paint(m, "#c9cdd3")} />
        <rect x="55" y="27.5" width="6" height="9" rx="3" fill={paint(m, c.accent)} />
      </g>
    );
  },
  pencilCase: (m) => {
    const c = ITEM_COLORS.pencilCase;
    return (
      <g stroke={strokeOf(m)} strokeWidth={W} strokeLinejoin="round">
        <path d="M7 31 Q7 21 18 21 L46 21 Q57 21 57 31 L57 41 Q57 50 46 50 L18 50 Q7 50 7 41 Z" fill={paint(m, c.main)} />
        {!m.sil && <rect x="11" y="24" width="42" height="3.6" rx="1.8" fill={c.dark} strokeWidth={1.4} />}
        {!m.sil && <line x1="13" y1="25.8" x2="51" y2="25.8" stroke={c.accent} strokeWidth={1.3} strokeDasharray="2 1.6" />}
        <rect x="48" y="23" width="6" height="10" rx="2" fill={paint(m, "#c9cdd3")} />
        {!m.sil && <path d="M14 43 Q32 47 50 43" stroke={c.light} strokeWidth={2} fill="none" strokeLinecap="round" />}
      </g>
    );
  }
};

export function ItemIcon({ id, size = 48, title = true }: { id: ItemId; size?: number; title?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={ITEMS[id].en} className="item-icon">
      {title && <title>{ITEMS[id].en}</title>}
      {DRAW[id]({ sil: null })}
    </svg>
  );
}

/** One-colour outline of an item (empty slots, engravings). */
export function ItemSilhouette({ id, size = 48, color = "#c8c2b6" }: { id: ItemId; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="item-silhouette">
      {DRAW[id]({ sil: color })}
    </svg>
  );
}
