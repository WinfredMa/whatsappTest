const SEEN_TTL_MS = 10 * 60 * 1000;

const conversations = new Map();
const seenMessages = new Map();
const chains = new Map();

function pruneSeen(now) {
  for (const [id, timestamp] of seenMessages) {
    if (now - timestamp > SEEN_TTL_MS) seenMessages.delete(id);
  }
}

function claimMessage(messageId) {
  const now = Date.now();
  pruneSeen(now);
  if (seenMessages.has(messageId)) return false;
  seenMessages.set(messageId, now);
  return true;
}

function getConversation(key) {
  return conversations.get(key) || '';
}

function setConversation(key, conversationId) {
  if (!conversationId) return;
  conversations.set(key, conversationId);
}

function clearConversation(key) {
  conversations.delete(key);
}

function enqueue(key, task) {
  const prev = chains.get(key) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(() => task());
  chains.set(key, next);
  next.then(
    () => {
      if (chains.get(key) === next) chains.delete(key);
    },
    (err) => {
      console.error('[queue]', key, err && err.message ? err.message : err);
      if (chains.get(key) === next) chains.delete(key);
    },
  );
  return next;
}

module.exports = {
  claimMessage,
  getConversation,
  setConversation,
  clearConversation,
  enqueue,
};
