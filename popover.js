import OBR from "@owlbear-rodeo/sdk";
import { watchQueue, raiseHand, lowerHand, dismissEntry, clearQueue } from "./shared.js";

const $ = (id) => document.getElementById(id);
const listEl = $("list");
const emptyEl = $("empty");
const mainBtn = $("main-btn");
const mainLabel = $("main-label");
const statusEl = $("status");
const gmBar = $("gm-bar");
const clearBtn = $("clear-btn");

let state = null;

function applyTheme(theme) {
  const root = document.documentElement.style;
  root.setProperty("--bg", theme.background.default);
  root.setProperty("--paper", theme.background.paper);
  root.setProperty("--text", theme.text.primary);
  root.setProperty("--text-2", theme.text.secondary);
  root.setProperty("--primary", theme.primary.main);
  root.setProperty("--primary-text", theme.primary.contrastText);
  document.documentElement.dataset.mode = theme.mode.toLowerCase();
}

function render() {
  if (!state) return;
  const { queue, me } = state;
  const isGM = me.role === "GM";
  const myPos = queue.findIndex((e) => e.id === me.id) + 1;

  // Главная кнопка
  if (myPos > 0) {
    mainBtn.classList.add("active");
    mainLabel.textContent = "Выйти из очереди";
    statusEl.textContent = myPos === 1 ? "Сейчас ваша очередь" : `Вы в очереди: №${myPos}`;
  } else {
    mainBtn.classList.remove("active");
    mainLabel.textContent = "Встать в очередь";
    statusEl.textContent = "";
  }

  // Список
  listEl.replaceChildren();
  emptyEl.hidden = queue.length > 0;

  queue.forEach((entry, i) => {
    const li = document.createElement("li");
    if (i === 0) li.classList.add("first");
    if (entry.id === me.id) li.classList.add("me");

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(i + 1);

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = entry.color || "#888";

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = entry.name;

    li.append(num, dot, name);

    if (isGM) {
      const done = document.createElement("button");
      done.className = "done";
      done.title = "Выступил — убрать из очереди";
      done.textContent = "✓";
      done.addEventListener("click", () => dismissEntry(OBR, state, entry));
      li.append(done);
    }
    listEl.append(li);
  });

  gmBar.hidden = !(isGM && queue.length > 0);

  // Подгоняем высоту окна под содержимое
  requestAnimationFrame(() => {
    const h = Math.ceil(document.getElementById("app").getBoundingClientRect().height) + 4;
    OBR.action.setHeight(Math.min(Math.max(h, 150), 560));
  });
}

mainBtn.addEventListener("click", () => {
  if (!state) return;
  const inQueue = state.queue.some((e) => e.id === state.me.id);
  if (inQueue) lowerHand(OBR);
  else raiseHand(OBR);
});

clearBtn.addEventListener("click", () => {
  if (state) clearQueue(OBR, state);
});

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  OBR.theme.onChange(applyTheme);
  await watchQueue(OBR, (s) => {
    state = s;
    render();
  });
});
