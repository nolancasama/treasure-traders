/** Track maximum travel, so dragging away and back never becomes a tap. */
export class TapTracker {
  private pointer: number | null = null;
  private x = 0;
  private y = 0;
  private travel = 0;
  private cancelled = false;
  down(id: number, x: number, y: number): void {
    if (this.pointer !== null) { this.cancelled = true; return; }
    this.pointer = id; this.x = x; this.y = y; this.travel = 0; this.cancelled = false;
  }
  move(id: number, x: number, y: number): void {
    if (id === this.pointer) this.travel = Math.max(this.travel, Math.hypot(x - this.x, y - this.y));
  }
  up(id: number, x: number, y: number): boolean {
    this.move(id, x, y);
    if (id !== this.pointer) return false;
    const tap = !this.cancelled && this.travel <= 8;
    this.pointer = null;
    return tap;
  }
  cancel(): void { this.cancelled = true; this.pointer = null; }
}
