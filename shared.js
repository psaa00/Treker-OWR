// Общая логика очереди заявок. Используется и фоновой страницей (горячая клавиша,
// уведомления, значок), и окном расширения (список очереди).
//
// Как это работает:
//  - Когда игрок «поднимает руку», в его собственные метаданные игрока пишется время нажатия.
//    У каждого игрока своя запись, поэтому одновременные нажатия никогда не перезаписывают друг друга.
//  - Все клиенты читают метаданные всех игроков комнаты и строят одну и ту же очередь,
//    отсортировав заявки по времени.
//  - Мастер отмечает «выступил» / очищает очередь через метаданные комнаты:
//    туда пишется время той заявки, которая закрыта. Если игрок поднимет руку снова,
//    время будет новее и заявка снова станет активной.

export const EXT_ID = "com.handqueue";
export const HAND_KEY = `${EXT_ID}/hand`; // метаданные игрока: { ts: число | null }
export const CLEARED_KEY = `${EXT_ID}/cleared`; // метаданные комнаты: { [playerId]: ts }

/** Строит упорядоченную очередь из списка игроков. */
export function computeQueue(players, cleared) {
  const queue = [];
  for (const p of players) {
    const ts = p.metadata?.[HAND_KEY]?.ts;
    if (typeof ts !== "number") continue;
    if (ts <= (cleared[p.id] ?? 0)) continue; // заявку уже закрыл мастер
    queue.push({ id: p.id, name: p.name || "Без имени", color: p.color, role: p.role, ts });
  }
  queue.sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
  return queue;
}

/**
 * Подписывается на изменения и вызывает callback(state) при каждом обновлении:
 *   state = { me: {id, role}, queue: [...], cleared: {...} }
 * Возвращает функцию отписки.
 */
export async function watchQueue(OBR, callback) {
  let self = {
    id: await OBR.player.getId(),
    name: await OBR.player.getName(),
    color: await OBR.player.getColor(),
    role: await OBR.player.getRole(),
    metadata: await OBR.player.getMetadata(),
  };
  let others = await OBR.party.getPlayers();
  let roomMeta = await OBR.room.getMetadata();

  const emit = () => {
    const cleared = roomMeta[CLEARED_KEY] || {};
    callback({
      me: { id: self.id, role: self.role },
      queue: computeQueue([self, ...others], cleared),
      cleared,
    });
  };

  const offs = [
    OBR.player.onChange((player) => {
      self = player;
      emit();
    }),
    OBR.party.onChange((players) => {
      others = players;
      emit();
    }),
    OBR.room.onMetadataChange((metadata) => {
      roomMeta = metadata;
      emit();
    }),
  ];

  emit();
  return () => offs.forEach((off) => off());
}

/** Игрок поднимает руку (встаёт в конец очереди). */
export function raiseHand(OBR) {
  return OBR.player.setMetadata({ [HAND_KEY]: { ts: Date.now() } });
}

/** Игрок опускает руку (выходит из очереди). */
export function lowerHand(OBR) {
  return OBR.player.setMetadata({ [HAND_KEY]: { ts: null } });
}

/** Мастер закрывает одну заявку. */
export function dismissEntry(OBR, state, entry) {
  return OBR.room.setMetadata({
    [CLEARED_KEY]: { ...state.cleared, [entry.id]: entry.ts },
  });
}

/** Мастер очищает всю очередь. */
export function clearQueue(OBR, state) {
  const cleared = { ...state.cleared };
  for (const entry of state.queue) cleared[entry.id] = entry.ts;
  return OBR.room.setMetadata({ [CLEARED_KEY]: cleared });
}
