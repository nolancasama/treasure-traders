import type { ReactElement } from "react";
import { STICKERS, type StickerId } from "../../game/content/stickers";
import { INK } from "../../scene/models/palette";

/** Festival stickers (SPEC §6.6) as round die-cut stickers with a white border. */
const ART: Record<StickerId, ReactElement> = {
  balloon: (
    <g stroke={INK} strokeWidth={2.4} strokeLinejoin="round">
      <path d="M32 46 Q34 52 30 58" fill="none" strokeLinecap="round" />
      <ellipse cx="32" cy="27" rx="13" ry="16" fill="#e5484d" />
      <polygon points="29,43 35,43 32,47" fill="#e5484d" />
      <ellipse cx="27" cy="21" rx="3.5" ry="5" fill="#ffffff" fillOpacity={0.6} stroke="none" />
    </g>
  ),
  star: (
    <polygon
      points="32,9 38.5,24 54,24.5 41.5,34 46,50 32,40.5 18,50 22.5,34 10,24.5 25.5,24"
      fill="#ffcf3f"
      stroke={INK}
      strokeWidth={2.4}
      strokeLinejoin="round"
    />
  ),
  fish: (
    <g stroke={INK} strokeWidth={2.4} strokeLinejoin="round">
      <polygon points="44,32 56,22 56,42" fill="#2f8cc7" />
      <ellipse cx="29" cy="32" rx="17" ry="11" fill="#5bb0e8" />
      <circle cx="20" cy="29" r="2.6" fill={INK} stroke="none" />
      <path d="M30 24 Q34 32 30 40" fill="none" />
    </g>
  ),
  flower: (
    <g stroke={INK} strokeWidth={2.2}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="32" cy="19" rx="7.5" ry="11" fill="#ff8fb1" transform={`rotate(${a} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="7" fill="#ffcf3f" />
    </g>
  ),
  bell: (
    <g stroke={INK} strokeWidth={2.4} strokeLinejoin="round">
      <path d="M18 44 Q18 18 32 16 Q46 18 46 44 Z" fill="#ffcf3f" />
      <rect x="14" y="42" width="36" height="6" rx="3" fill="#e0a800" />
      <circle cx="32" cy="51" r="4" fill="#e0a800" />
      <circle cx="32" cy="13" r="3" fill="#e0a800" />
    </g>
  ),
  lantern: (
    <g stroke={INK} strokeWidth={2.4} strokeLinejoin="round">
      <rect x="24" y="10" width="16" height="6" rx="2" fill={INK} />
      <rect x="24" y="48" width="16" height="6" rx="2" fill={INK} />
      <ellipse cx="32" cy="32" rx="16" ry="17" fill="#e5484d" />
      {[24, 32, 40].map((y) => (
        <path key={y} d={`M17 ${y} Q32 ${y + 3} 47 ${y}`} fill="none" stroke="#ffcf3f" strokeWidth={1.6} />
      ))}
    </g>
  ),
  kite: (
    <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
      <polygon points="32,8 46,26 32,44 18,26" fill="#ffcf3f" />
      <polygon points="32,8 46,26 32,26" fill="#e5484d" />
      <polygon points="32,26 32,44 18,26" fill="#2f6fe4" />
      <path d="M32 44 Q28 50 33 53 Q38 56 34 60" fill="none" strokeLinecap="round" />
      <polygon points="30,49 36,49 33,52" fill="#3daa6b" />
    </g>
  ),
  fireworks: (
    <g strokeLinecap="round" strokeWidth={3}>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const color = ["#e5484d", "#ffcf3f", "#2f6fe4", "#3daa6b"][i % 4];
        return <line key={i} x1={32 + Math.cos(a) * 7} y1={32 + Math.sin(a) * 7} x2={32 + Math.cos(a) * 21} y2={32 + Math.sin(a) * 21} stroke={color} />;
      })}
      <circle cx="32" cy="32" r="4" fill="#ffcf3f" stroke={INK} strokeWidth={2} />
    </g>
  ),
  anchor: (
    <g stroke="#2e3f73" strokeWidth={5} strokeLinecap="round" fill="none">
      <circle cx="32" cy="15" r="5" />
      <line x1="32" y1="20" x2="32" y2="50" />
      <line x1="22" y1="27" x2="42" y2="27" />
      <path d="M14 38 Q18 52 32 52 Q46 52 50 38" />
    </g>
  )
};

export function StickerIcon({ id, size = 56, owned = true }: { id: StickerId; size?: number; owned?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={STICKERS[id].en} className="sticker-icon">
      <circle cx="32" cy="32" r="30" fill={owned ? "#ffffff" : "#efe9dc"} stroke={owned ? "#e8dcc4" : "#d8cfbd"} strokeWidth={2} strokeDasharray={owned ? undefined : "4 3"} />
      <g opacity={owned ? 1 : 0.18}>{ART[id]}</g>
    </svg>
  );
}
