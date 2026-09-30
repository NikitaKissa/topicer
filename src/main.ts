import { loadTopics } from "./data_loader";
import { MIN_TOPICS, getRandomTopicIndex } from "./topics";
import { Reel } from "./reel";
import { MIN_SPIN_ROWS, ReelAnimator } from "./reel_animation";
import type { ReelState, SpinResult } from "./types";
import { SlotSound } from "./sound";

function byId<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Елемент #${id} не знайдено`);
    return el as T;
}

async function init(): Promise<void> {
    const app = byId<HTMLElement>("app");
    const viewport = byId<HTMLElement>("reel-viewport");
    const track = byId<HTMLElement>("reel-track");
    const button = byId<HTMLButtonElement>("spin-button");
    const status = byId<HTMLElement>("status");
    const resultEl = byId<HTMLElement>("result");

    const showError = (message: string): void => {
        app.dataset.state = "error";
        status.hidden = false;
        status.classList.add("is-error");
        status.setAttribute("role", "alert");
        status.textContent = message;
        button.disabled = true;
    };

    let topics: string[];
    try {
        topics = await loadTopics("./topics.txt");
    } catch (error) {
        showError(error instanceof Error ? error.message : "Не вдалось завантажити теми.");
        return;
    }
    if (topics.length < MIN_TOPICS) {
        showError(`У topics.txt має бути мінімум ${MIN_TOPICS} теми, зараз: ${topics.length}.`);
        return;
    }

    const sound = new SlotSound();
    const soundBtn = byId<HTMLButtonElement>("sound-toggle");
    const renderSound = (): void => {
        soundBtn.setAttribute("aria-pressed", String(sound.enabled));
        soundBtn.textContent = sound.enabled ? "Звук: увімк" : "Звук: вимк";
    };
    soundBtn.addEventListener("click", () => { sound.setEnabled(!sound.enabled); renderSound(); });
    renderSound();

    const reel = new Reel(viewport, track);
    reel.setTopics(topics, MIN_SPIN_ROWS);
    const animator = new ReelAnimator(reel, {
        onRowPass: () => sound.tick(),
        onLand: () => sound.land(),
    });
    reel.observeResize(() => { if (!animator.isRunning) reel.refresh(); });

    let state: ReelState = "idle";
    let lastResult: SpinResult | null = null;

    status.hidden = true;
    app.dataset.state = "idle";
    button.disabled = false;

    button.addEventListener("click", async () => {
        if (state !== "idle") return; 

        sound.unlock();
        sound.lever();

        state = "spinning";
        app.dataset.state = state;
        button.setAttribute("aria-disabled", "true");
        viewport.setAttribute("aria-busy", "true");

        const resultIndex = getRandomTopicIndex(topics, lastResult?.index ?? null);

        try {
            const result = await animator.spin(resultIndex);
            if (result.index !== resultIndex) console.error("Візуальний результат не збігся з обраним індексом");
            lastResult = result;
            resultEl.textContent = result.topic;
            sound.win();
        } catch (error) {
            console.error(error);
            resultEl.textContent = "Щось пішло не так. Спробуйте ще раз.";
        } finally {
            state = "idle";
            app.dataset.state = state;
            button.removeAttribute("aria-disabled");
            viewport.removeAttribute("aria-busy");
        }
    });
}

void init();
