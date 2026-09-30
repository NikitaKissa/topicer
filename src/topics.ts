export const MIN_TOPICS = 3;

function randomInt(max: number): number {
    const buffer = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    do {
        crypto.getRandomValues(buffer);
    } while (buffer[0] >= limit);
    return buffer[0] % max;
}

export function getRandomTopicIndex(topics: readonly string[], previousIndex: number | null = null): number {
    const count = topics.length;
    if (count === 0) throw new Error("Список тем порожній.");
    if (count === 1) return 0;

    const hasPrevious = previousIndex !== null && previousIndex >= 0 && previousIndex < count;
    if (!hasPrevious) return randomInt(count);

    const pick = randomInt(count - 1);
    return pick >= (previousIndex as number) ? pick + 1 : pick;
}
