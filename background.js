import OBR from "@owlbear-rodeo/sdk";
import { EXT_ID, watchQueue, raiseHand, lowerHand } from "./shared.js";

// ───────── Настройки ─────────
// Горячие клавиши. Формат как в Owlbear Rodeo: "Q", "Shift+Q", "Ctrl+Q" и т.п.
// Если клавиша конфликтует с другим расширением, поменяйте её здесь и пересоберите.
const RAISE_SHORTCUT = "Q"; // встать в очередь
const LOWER_SHORTCUT = "Shift+Q"; // выйти из очереди
// ──────────────────────────────

// Иконки должны быть абсолютными ссылками, иначе при размещении
// не в корне домена (GitHub Pages: /имя-репозитория/) они не найдутся.
const asset = (name) => new URL(name, window.location.href).href;

const RAISE_ID = `${EXT_ID}/raise`;
const LOWER_ID = `${EXT_ID}/lower`;

let latest = null; // последнее состояние очереди
let seen = null; // заявки, о которых уже сообщали: "id:ts"
let wasFirst = false;

function positionOf(state, id) {
  return state.queue.findIndex((e) => e.id === id) + 1; // 0 = не в очереди
}

async function onRaise() {
  if (!latest) return;
  const pos = positionOf(latest, latest.me.id);
  if (pos > 0) {
    OBR.notification.show(`Вы уже в очереди: №${pos}`, "WARNING");
    return;
  }
  await raiseHand(OBR);
}

async function onLower() {
  if (!latest) return;
  if (positionOf(latest, latest.me.id) === 0) {
    OBR.notification.show("Вас нет в очереди", "WARNING");
    return;
  }
  await lowerHand(OBR);
  OBR.notification.show("Вы вышли из очереди", "INFO");
}

function handleState(state) {
  latest = state;
  const count = state.queue.length;

  // Значок с числом заявок на кнопке расширения
  OBR.action.setBadgeText(count > 0 ? String(count) : undefined);

  const keys = new Set(state.queue.map((e) => `${e.id}:${e.ts}`));

  if (seen === null) {
    // Первое срабатывание после загрузки: запоминаем, ничего не показываем
    seen = keys;
    wasFirst = state.queue[0]?.id === state.me.id;
    return;
  }

  for (const [i, entry] of state.queue.entries()) {
    const key = `${entry.id}:${entry.ts}`;
    if (seen.has(key)) continue;
    if (entry.id === state.me.id) {
      OBR.notification.show(`Вы в очереди: №${i + 1}`, "SUCCESS");
    } else if (state.me.role === "GM") {
      OBR.notification.show(`✋ ${entry.name} просит слова (№${i + 1})`, "INFO");
    }
  }
  seen = keys;

  const isFirst = state.queue[0]?.id === state.me.id;
  if (isFirst && !wasFirst && state.queue.length > 0) {
    OBR.notification.show("Ваша очередь говорить!", "SUCCESS");
  }
  wasFirst = isFirst;
}

OBR.onReady(async () => {
  OBR.action.setBadgeBackgroundColor("#d94f4f");

  await OBR.tool.createAction({
    id: RAISE_ID,
    icons: [{ icon: asset("icon.svg"), label: `Встать в очередь (${RAISE_SHORTCUT})` }],
    shortcut: RAISE_SHORTCUT,
    onClick: onRaise,
  });

  await OBR.tool.createAction({
    id: LOWER_ID,
    icons: [{ icon: asset("icon-lower.svg"), label: `Выйти из очереди (${LOWER_SHORTCUT})` }],
    shortcut: LOWER_SHORTCUT,
    onClick: onLower,
  });

  await watchQueue(OBR, handleState);
});
