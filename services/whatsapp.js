function graphVersion() {
  return process.env.GRAPH_API_VERSION || 'v21.0';
}

async function postMessage(phoneNumberId, body) {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error('WHATSAPP_TOKEN is not set');
  if (!phoneNumberId) throw new Error('phone_number_id is missing');

  const url = `https://graph.facebook.com/${graphVersion()}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = (data && data.error && data.error.message) || raw.slice(0, 500);
    throw new Error(`Graph API ${res.status}: ${detail}`);
  }

  return data;
}

async function markRead(phoneNumberId, messageId, options = {}) {
  const body = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  };
  if (options.typing) {
    body.typing_indicator = { type: 'text' };
  }

  try {
    await postMessage(phoneNumberId, body);
  } catch (err) {
    console.error('[whatsapp] mark read failed', err.message || err);
  }
}

async function sendText(phoneNumberId, to, text) {
  return postMessage(phoneNumberId, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body: text,
    },
  });
}

module.exports = {
  markRead,
  sendText,
};
