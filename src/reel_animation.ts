import type { Reel } from "./reel";
import type { SpinResult } from "./types";

export const MIN_SPIN_ROWS = 36;

const ACCEL_MS = 650;    // разгон
const TOTAL_MS = 6800;   // разгон + быстрая фаза + торможение
const DECEL_MS = 4700;   // торможение
const SETTLE_MS = 500;   // возврат после лёгкого перелёта
const OVERSHOOT_ROWS = 0.16;

const easeOutCubic = (u: number): number => 1 - (1 - u) ** 3;
const easeInOutSine = (u: number): number => -(Math.cos(Math.PI * u) - 1) / 2;

export interface SpinHooks {
    onRowPass?: () => void;
    onLand?: () => void;
}

function planSteps(currentIndex: number, target: number, n: number): number {
    let steps = (((target - currentIndex) % n) + n) % n;
    if (steps < MIN_SPIN_ROWS) steps += n * Math.ceil((MIN_SPIN_ROWS - steps) / n);
    return steps;
}

export class ReelAnimator {
    private running = false;

    constructor(private readonly reel: Reel, private readonly hooks: SpinHooks = {}) {}

    get isRunning(): boolean { return this.running; }

    spin(targetIndex: number): Promise<SpinResult> {
        const { reel } = this;
        const n = reel.topicCount;
        if (this.running) return Promise.reject(new Error("Рулетка вже крутиться."));
        if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= n) {
            return Promise.reject(new Error("Недійсний індекс теми."));
        }

        reel.clearResult();
        const startRow = reel.currentRow;

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return Promise.resolve(this.finish(reel.homeRow(targetIndex)));
        }

        const steps = planSteps(reel.topicIndexAt(startRow), targetIndex, n);
        const endRow = startRow + steps;

        const h = reel.itemHeight;
        const distance = steps * h;
        const overshoot = OVERSHOOT_ROWS * h;
        const reach = distance + overshoot;
        const cruiseMs = TOTAL_MS - ACCEL_MS - DECEL_MS;
        const vmax = reach / (ACCEL_MS / 2 + cruiseMs + DECEL_MS / 3);
        const distAccel = (vmax * ACCEL_MS) / 2;
        const distCruise = vmax * cruiseMs;
        const distDecel = reach - distAccel - distCruise;
        const baseY = reel.translateFor(startRow);
        const endMs = TOTAL_MS + SETTLE_MS;

        this.running = true;
        return new Promise<SpinResult>((resolve) => {
            let t0: number | null = null;
            let lastRow = 0;
            let landed = false;

            const frame = (now: number): void => {
                if (t0 === null) t0 = now;
                const t = now - t0;
                if (t >= endMs) {
                    this.running = false;
                    resolve(this.finish(endRow));
                    return;
                }

                let offset: number;
                if (t < ACCEL_MS) {
                    offset = (vmax * t * t) / (2 * ACCEL_MS);
                } else if (t < ACCEL_MS + cruiseMs) {
                    offset = distAccel + vmax * (t - ACCEL_MS);
                } else if (t < TOTAL_MS) {
                    offset = distAccel + distCruise + distDecel * easeOutCubic((t - ACCEL_MS - cruiseMs) / DECEL_MS);
                } else {
                    if (!landed) { landed = true; this.hooks.onLand?.(); }
                    offset = reach - overshoot * easeInOutSine((t - TOTAL_MS) / SETTLE_MS);
                }

                const row = Math.round(offset / h);
                if (row > lastRow) {
                    lastRow = row;
                    this.hooks.onRowPass?.();
                }

                reel.applyTranslate(baseY - offset);
                requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        });
    }

    private finish(endRow: number): SpinResult {
        const { reel } = this;
        const index = reel.topicIndexAt(endRow);
        reel.setRow(reel.homeRow(index));
        reel.markResult();
        return { index, topic: reel.topicAt(index) };
    }
}