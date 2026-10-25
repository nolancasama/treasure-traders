import { useEffect, useState } from "react";
import { speakerName } from "../../game/content/cast";
import { cachedPortrait, portrait, type PortraitId } from "../../scene/portraits";
import type { Expression } from "../../scene/models/people";

/** A character portrait for the HUD; a coloured initial until (or unless) WebGL renders it. */
export function Portrait({ id, size = 72, mood = "neutral", round = true }: { id: PortraitId; size?: number; mood?: Expression; round?: boolean }) {
  const [url, setUrl] = useState<string | null>(() => cachedPortrait(id, mood));
  useEffect(() => {
    let alive = true;
    const hit = cachedPortrait(id, mood);
    if (hit) setUrl(hit);
    else void portrait(id, mood).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id, mood]);
  const name = id === "seaChest" ? { en: "Sea chest", ja: "たからばこ" } : speakerName(id);
  const style = { width: size, height: size, borderRadius: round ? "50%" : 14 };
  if (!url)
    return (
      <div className="portrait portrait-fallback" style={{ ...style, fontSize: size * 0.42 }} aria-label={name.en}>
        {name.en.replace(/^(Mayor|Grandma|Ms\.|Captain|Coach) /, "").charAt(0)}
      </div>
    );
  return <img className="portrait" src={url} alt={name.en} width={size} height={size} style={style} draggable={false} />;
}
