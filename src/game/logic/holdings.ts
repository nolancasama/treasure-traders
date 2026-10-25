import { ITEM_IDS, type ItemId } from "../content/ids";
import type { HolderId, Holdings, Inventory } from "./types";

/** Count of `item` held by `holder`. */
export function count(h: Holdings, holder: HolderId, item: ItemId): number {
  return h[holder]?.[item] ?? 0;
}

export function has(h: Holdings, holder: HolderId, item: ItemId, n = 1): boolean {
  return count(h, holder, item) >= n;
}

/** Items held by `holder`, in canonical order. */
export function itemsOf(h: Holdings, holder: HolderId): ItemId[] {
  const inv = h[holder];
  if (!inv) return [];
  return ITEM_IDS.filter((i) => (inv[i] ?? 0) > 0);
}

/** A deep copy (holdings are small). */
export function cloneHoldings(h: Holdings): Holdings {
  const out: Holdings = {};
  for (const [holder, inv] of Object.entries(h)) {
    if (inv) out[holder as HolderId] = { ...inv };
  }
  return out;
}

/**
 * Moves `n` of `item` from one holder to another, returning new holdings.
 * Throws if `from` does not hold enough: a programming error, never a child's.
 */
export function move(h: Holdings, item: ItemId, from: HolderId, to: HolderId, n = 1): Holdings {
  if (n <= 0) return h;
  const have = count(h, from, item);
  if (have < n) throw new Error(`${from} cannot give ${n} ${item} (has ${have})`);
  const out = cloneHoldings(h);
  const src: Inventory = { ...(out[from] ?? {}) };
  const left = have - n;
  if (left > 0) src[item] = left;
  else delete src[item];
  out[from] = src;
  const dst: Inventory = { ...(out[to] ?? {}) };
  dst[item] = (dst[item] ?? 0) + n;
  out[to] = dst;
  return out;
}

/** Total of every item type across all holders (conservation checks). */
export function totals(h: Holdings): Inventory {
  const out: Inventory = {};
  for (const inv of Object.values(h)) {
    if (!inv) continue;
    for (const [item, c] of Object.entries(inv)) {
      if (!c) continue;
      out[item as ItemId] = (out[item as ItemId] ?? 0) + c;
    }
  }
  return out;
}

/** True when both holdings contain the same number of every item type. */
export function sameTotals(a: Holdings, b: Holdings): boolean {
  const ta = totals(a);
  const tb = totals(b);
  return ITEM_IDS.every((i) => (ta[i] ?? 0) === (tb[i] ?? 0));
}

/** Holdings with no negative or fractional counts. */
export function isValidHoldings(h: unknown): h is Holdings {
  if (!h || typeof h !== "object") return false;
  for (const inv of Object.values(h as Record<string, unknown>)) {
    if (!inv || typeof inv !== "object") return false;
    for (const [item, c] of Object.entries(inv as Record<string, unknown>)) {
      if (!(ITEM_IDS as readonly string[]).includes(item)) return false;
      if (typeof c !== "number" || c < 0 || !Number.isInteger(c)) return false;
    }
  }
  return true;
}
