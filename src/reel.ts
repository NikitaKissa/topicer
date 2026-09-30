export const VISIBLE_ROWS = 5;
export const PAD_ROWS = Math.floor(VISIBLE_ROWS / 2);

const mod = (a: number, n: number): number => ((a % n) + n) % n;

export class Reel {
    private topics: readonly string[] = [];
    private rows: HTMLElement[] = [];
    private row = 0;
    private height = 0;
    private resultEl: HTMLElement | null = null;

    constructor(private readonly viewport: HTMLElement, private readonly track: HTMLElement) {
        viewport.style.setProperty("--visible-rows", String(VISIBLE_ROWS));
        track.setAttribute("aria-hidden", "true"); 
    }

    get topicCount(): number { return this.topics.length; }
    get currentRow(): number { return this.row; }
    get itemHeight(): number { return this.height; }

    setTopics(topics: readonly string[], minSpinRows: number): void {
        this.topics = topics;
        const n = topics.length;
        const total = 2 * n + minSpinRows + 2 * PAD_ROWS;
        const fragment = document.createDocumentFragment();
        this.rows = [];
        for (let v = 0; v < total; v++) {
            const item = document.createElement("div");
            item.className = "reel__item";
            const text = document.createElement("span");
            text.className = "reel__text";
            text.textContent = topics[mod(v - PAD_ROWS, n)];
            item.appendChild(text);
            this.rows.push(item);
            fragment.appendChild(item);
        }
        this.track.replaceChildren(fragment);
        this.resultEl = null;
        this.measure();
        this.setRow(this.homeRow(0));
    }

    homeRow(topicIndex: number): number { return PAD_ROWS + topicIndex; }
    topicIndexAt(row: number): number { return mod(row - PAD_ROWS, this.topics.length); }
    topicAt(index: number): string { return this.topics[index]; }

    translateFor(row: number): number { return (PAD_ROWS - row) * this.height; }

    applyTranslate(y: number): void {
        this.track.style.transform = `translate3d(0, ${y}px, 0)`;
    }

    setRow(row: number): void {
        this.row = row;
        this.applyTranslate(this.translateFor(row));
    }

    markResult(): void {
        this.clearResult();
        this.resultEl = this.rows[this.row] ?? null;
        this.resultEl?.classList.add("is-result");
    }

    clearResult(): void {
        this.resultEl?.classList.remove("is-result");
        this.resultEl = null;
    }

    refresh(): void {
        this.measure();
        this.setRow(this.row);
    }

    observeResize(callback: () => void): void {
        new ResizeObserver(callback).observe(this.viewport);
    }

    private measure(): void {
        this.height = this.viewport.getBoundingClientRect().height / VISIBLE_ROWS;
    }
}
