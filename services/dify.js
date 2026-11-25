function baseUrl() {
  return String(process.env.DIFY_BASE_URL || '').replace(/\/+$/, '');
}

async function chat({ query, user, conversationId }) {
  const apiKey = process.env.DIFY_API_KEY;
  const root = baseUrl();
  if (!apiKey) throw new Error('DIFY_API_KEY is not set');
  if (!root) throw new Error('DIFY_BASE_URL is not set');

  const payload = {
    inputs: {},
    query,
    response_mode: 'blocking',
    user,
  };
  if (conversationId) payload.conversation_id = conversationId;

  const timeoutMs = Number(process.env.DIFY_TIMEOUT_MS || 180000);
  const res = await fetch(`${root}/v1/chat-messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = (data && (data.message || data.code)) || raw.slice(0, 500);
    throw new Error(`Dify ${res.status}: ${detail}`);
  }

  return {
    answer: data && typeof data.answer === 'string' ? data.answer : '',
    conversationId: data && data.conversation_id ? data.conversation_id : '',
  };
}

module.exports = { chat };
