// In-memory chat history, keyed by routeId. Lost on server restart —
// the "route" handler persists it to MongoDB (chatlogs) before clearing it.
const chatStore = new Map();

export function getMessages(routeId) {
  return chatStore.get(routeId) || [];
}

export function addMessage(routeId, message) {
  if (!chatStore.has(routeId)) {
    chatStore.set(routeId, []);
  }
  chatStore.get(routeId).push(message);
}

export function clearMessages(routeId) {
  chatStore.delete(routeId);
}
