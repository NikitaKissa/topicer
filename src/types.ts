export type ReelState = "idle" | "spinning";

export interface SpinResult {
    readonly index: number;
    readonly topic: string;
}
