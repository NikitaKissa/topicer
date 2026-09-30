(() => {
  // src/data_loader.ts
  function parseTopics(text) {
    return text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line.length > 0);
  }
  async function loadTopics(url) {
    let response;
    try {
      response = await fetch(url, { cache: "no-cache" });
    } catch {
      throw new Error("\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 \u0441\u043F\u0438\u0441\u043E\u043A \u0442\u0435\u043C. \u0412\u0456\u0434\u043A\u0440\u0438\u0439\u0442\u0435 \u0441\u0430\u0439\u0442 \u0447\u0435\u0440\u0435\u0437 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u0438\u0439 \u0441\u0435\u0440\u0432\u0435\u0440, \u0430 \u043D\u0435 \u044F\u043A \u0444\u0430\u0439\u043B.");
    }
    if (!response.ok) {
      throw new Error(`\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 \u0441\u043F\u0438\u0441\u043E\u043A \u0442\u0435\u043C (\u043F\u043E\u043C\u0438\u043B\u043A\u0430 ${response.status}).`);
    }
    return parseTopics(await response.text());
  }

  // src/topics.ts
  var MIN_TOPICS = 3;
  function randomInt(max) {
    const buffer = new Uint32Array(1);
    const limit = Math.floor(4294967296 / max) * max;
    do {
      crypto.getRandomValues(buffer);
    } while (buffer[0] >= limit);
    return buffer[0] % max;
  }
  function getRandomTopicIndex(topics, previousIndex = null) {
    const count = topics.length;
    if (count === 0) throw new Error("\u0421\u043F\u0438\u0441\u043E\u043A \u0442\u0435\u043C \u043F\u043E\u0440\u043E\u0436\u043D\u0456\u0439.");
    if (count === 1) return 0;
    const hasPrevious = previousIndex !== null && previousIndex >= 0 && previousIndex < count;
    if (!hasPrevious) return randomInt(count);
    const pick = randomInt(count - 1);
    return pick >= previousIndex ? pick + 1 : pick;
  }

  // src/reel.ts
  var VISIBLE_ROWS = 5;
  var PAD_ROWS = Math.floor(VISIBLE_ROWS / 2);
  var mod = (a, n) => (a % n + n) % n;
  var Reel = class {
    constructor(viewport, track) {
      this.viewport = viewport;
      this.track = track;
      viewport.style.setProperty("--visible-rows", String(VISIBLE_ROWS));
      track.setAttribute("aria-hidden", "true");
    }
    viewport;
    track;
    topics = [];
    rows = [];
    row = 0;
    height = 0;
    resultEl = null;
    get topicCount() {
      return this.topics.length;
    }
    get currentRow() {
      return this.row;
    }
    get itemHeight() {
      return this.height;
    }
    /** Создаёт DOM один раз. Длины хватает на любой spin длиной до minSpinRows + n строк. */
    setTopics(topics, minSpinRows) {
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
    homeRow(topicIndex) {
      return PAD_ROWS + topicIndex;
    }
    topicIndexAt(row) {
      return mod(row - PAD_ROWS, this.topics.length);
    }
    topicAt(index) {
      return this.topics[index];
    }
    /** translateY, при котором строка `row` стоит в центре окна. */
    translateFor(row) {
      return (PAD_ROWS - row) * this.height;
    }
    applyTranslate(y) {
      this.track.style.transform = `translate3d(0, ${y}px, 0)`;
    }
    /** Мгновенно ставит ленту на строку (без анимации). */
    setRow(row) {
      this.row = row;
      this.applyTranslate(this.translateFor(row));
    }
    markResult() {
      this.clearResult();
      this.resultEl = this.rows[this.row] ?? null;
      this.resultEl?.classList.add("is-result");
    }
    clearResult() {
      this.resultEl?.classList.remove("is-result");
      this.resultEl = null;
    }
    /** Пересчитывает высоту строки и восстанавливает позицию (при resize). */
    refresh() {
      this.measure();
      this.setRow(this.row);
    }
    observeResize(callback) {
      new ResizeObserver(callback).observe(this.viewport);
    }
    measure() {
      this.height = this.viewport.getBoundingClientRect().height / VISIBLE_ROWS;
    }
  };

  // src/reel_animation.ts
  var MIN_SPIN_ROWS = 36;
  var ACCEL_MS = 450;
  var TOTAL_MS = 3800;
  var DECEL_MS = 1700;
  var SETTLE_MS = 320;
  var OVERSHOOT_ROWS = 0.14;
  var easeOutCubic = (u) => 1 - (1 - u) ** 3;
  var easeInOutSine = (u) => -(Math.cos(Math.PI * u) - 1) / 2;
  function planSteps(currentIndex, target, n) {
    let steps = ((target - currentIndex) % n + n) % n;
    if (steps < MIN_SPIN_ROWS) steps += n * Math.ceil((MIN_SPIN_ROWS - steps) / n);
    return steps;
  }
  var ReelAnimator = class {
    constructor(reel) {
      this.reel = reel;
    }
    reel;
    running = false;
    get isRunning() {
      return this.running;
    }
    spin(targetIndex) {
      const { reel } = this;
      const n = reel.topicCount;
      if (this.running) return Promise.reject(new Error("\u0420\u0443\u043B\u0435\u0442\u043A\u0430 \u0432\u0436\u0435 \u043A\u0440\u0443\u0442\u0438\u0442\u044C\u0441\u044F."));
      if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= n) {
        return Promise.reject(new Error("\u041D\u0435\u0434\u0456\u0439\u0441\u043D\u0438\u0439 \u0456\u043D\u0434\u0435\u043A\u0441 \u0442\u0435\u043C\u0438."));
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
      const distAccel = vmax * ACCEL_MS / 2;
      const distCruise = vmax * cruiseMs;
      const distDecel = reach - distAccel - distCruise;
      const baseY = reel.translateFor(startRow);
      const endMs = TOTAL_MS + SETTLE_MS;
      this.running = true;
      return new Promise((resolve) => {
        let t0 = null;
        const frame = (now) => {
          if (t0 === null) t0 = now;
          const t = now - t0;
          if (t >= endMs) {
            this.running = false;
            resolve(this.finish(endRow));
            return;
          }
          let offset;
          if (t < ACCEL_MS) {
            offset = vmax * t * t / (2 * ACCEL_MS);
          } else if (t < ACCEL_MS + cruiseMs) {
            offset = distAccel + vmax * (t - ACCEL_MS);
          } else if (t < TOTAL_MS) {
            offset = distAccel + distCruise + distDecel * easeOutCubic((t - ACCEL_MS - cruiseMs) / DECEL_MS);
          } else {
            offset = reach - overshoot * easeInOutSine((t - TOTAL_MS) / SETTLE_MS);
          }
          reel.applyTranslate(baseY - offset);
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
    }
    /**
     * Бесшовная нормализация: тема на endRow переносится на "домашнюю" строку
     * с тем же индексом. Тексты идентичны, высота строки одна — картинка не меняется.
     */
    finish(endRow) {
      const { reel } = this;
      const index = reel.topicIndexAt(endRow);
      reel.setRow(reel.homeRow(index));
      reel.markResult();
      return { index, topic: reel.topicAt(index) };
    }
  };

  // src/main.ts
  function byId(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`\u0415\u043B\u0435\u043C\u0435\u043D\u0442 #${id} \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E`);
    return el;
  }
  async function init() {
    const app = byId("app");
    const viewport = byId("reel-viewport");
    const track = byId("reel-track");
    const button = byId("spin-button");
    const status = byId("status");
    const resultEl = byId("result");
    const showError = (message) => {
      app.dataset.state = "error";
      status.hidden = false;
      status.classList.add("is-error");
      status.setAttribute("role", "alert");
      status.textContent = message;
      button.disabled = true;
    };
    let topics;
    try {
      topics = await loadTopics("./topics.txt");
    } catch (error) {
      showError(error instanceof Error ? error.message : "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0442\u0435\u043C\u044B.");
      return;
    }
    if (topics.length < MIN_TOPICS) {
      showError(`\u0423 topics.txt \u043C\u0430\u0454 \u0431\u0443\u0442\u0438 \u043C\u0456\u043D\u0456\u043C\u0443\u043C ${MIN_TOPICS} \u0442\u0435\u043C\u0438, \u0437\u0430\u0440\u0430\u0437: ${topics.length}.`);
      return;
    }
    const reel = new Reel(viewport, track);
    reel.setTopics(topics, MIN_SPIN_ROWS);
    const animator = new ReelAnimator(reel);
    reel.observeResize(() => {
      if (!animator.isRunning) reel.refresh();
    });
    let state = "idle";
    let lastResult = null;
    status.hidden = true;
    app.dataset.state = "idle";
    button.disabled = false;
    button.addEventListener("click", async () => {
      if (state !== "idle") return;
      state = "spinning";
      app.dataset.state = state;
      button.setAttribute("aria-disabled", "true");
      viewport.setAttribute("aria-busy", "true");
      const resultIndex = getRandomTopicIndex(topics, lastResult?.index ?? null);
      try {
        const result = await animator.spin(resultIndex);
        if (result.index !== resultIndex) console.error("\u0412\u0456\u0437\u0443\u0430\u043B\u044C\u043D\u0438\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043D\u0435 \u0437\u0431\u0456\u0433\u0441\u044F \u0437 \u043E\u0431\u0440\u0430\u043D\u0438\u043C \u0456\u043D\u0434\u0435\u043A\u0441\u043E\u043C");
        lastResult = result;
        resultEl.textContent = result.topic;
      } catch (error) {
        console.error(error);
        resultEl.textContent = "\u0429\u043E\u0441\u044C \u043F\u0456\u0448\u043B\u043E \u043D\u0435 \u0442\u0430\u043A. \u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0449\u0435 \u0440\u0430\u0437.";
      } finally {
        state = "idle";
        app.dataset.state = state;
        button.removeAttribute("aria-disabled");
        viewport.removeAttribute("aria-busy");
      }
    });
  }
  void init();
})();
