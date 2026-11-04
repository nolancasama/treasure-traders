/** Held keys (by physical code, so WASD works on JIS keyboards and with the IME on). */
export const keys = new Set<string>();

export function keyboardMove(): { x: number; y: number; held: boolean } {
  const up = keys.has("KeyW") || keys.has("ArrowUp"), down = keys.has("KeyS") || keys.has("ArrowDown");
  const left = keys.has("KeyA") || keys.has("ArrowLeft"), right = keys.has("KeyD") || keys.has("ArrowRight");
  return { x: Number(right) - Number(left), y: Number(up) - Number(down), held: up || down || left || right };
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return Boolean(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable));
}

/** Install listeners. `onPress` receives fresh presses only (no auto-repeat). */
export function installKeyboard(onPress: (code: string, e: KeyboardEvent) => void): () => void {
  const down = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    const fresh = !keys.has(e.code) && !e.repeat;
    keys.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (fresh) onPress(e.code, e);
  };
  const up = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };
  const blur = () => keys.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}
