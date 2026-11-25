const session = require('./session');
const dify = require('./dify');
const whatsapp = require('./whatsapp');
const { stripThink, splitWhatsAppText, isResetCommand } = require('./text');

const UNSUPPORTED = '目前只能回复文字消息，请用文字描述你的问题。';
const RESET_ACK = '已开始新对话，请直接发送你的问题。';
const FALLBACK = '暂时无法回复，请稍后再试。';

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function sessionKey(phoneNumberId, from) {
  return `${phoneNumberId}:${from}`;
}

function processWebhook(body) {
  if (!body || body.object !== 'whatsapp_business_account') return;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field && change.field !== 'messages') continue;

      const value = change.value || {};
      const phoneNumberId = value.metadata && value.metadata.phone_number_id;
      if (!phoneNumberId || !Array.isArray(value.messages)) continue;

      const businessDigits = digits(value.metadata.display_phone_number);
      for (const message of value.messages) {
        if (!message || !message.id || !message.from) continue;
        if (!session.claimMessage(message.id)) {
          console.log(`[whatsapp] duplicate ${message.id}`);
          continue;
        }
        if (businessDigits && digits(message.from) === businessDigits) continue;

        const key = sessionKey(phoneNumberId, message.from);
        session.enqueue(key, () => handleMessage(phoneNumberId, message));
      }
    }
  }
}

async function handleMessage(phoneNumberId, message) {
  const to = message.from;
  try {
    if (message.type === 'reaction' || message.type === 'system') return;

    if (message.type !== 'text' || !message.text || !message.text.body) {
      await whatsapp.markRead(phoneNumberId, message.id);
      await whatsapp.sendText(phoneNumberId, to, UNSUPPORTED);
      return;
    }

    const query = String(message.text.body).trim();
    if (!query) return;

    const key = sessionKey(phoneNumberId, to);
    if (isResetCommand(query)) {
      session.clearConversation(key);
      await whatsapp.markRead(phoneNumberId, message.id);
      await whatsapp.sendText(phoneNumberId, to, RESET_ACK);
      return;
    }

    console.log(`[whatsapp] ${to} -> dify (${message.id})`);
    await whatsapp.markRead(phoneNumberId, message.id, { typing: true });

    const result = await dify.chat({
      query,
      user: to,
      conversationId: session.getConversation(key),
    });
    if (result.conversationId) {
      session.setConversation(key, result.conversationId);
      console.log(`[dify] conversation ${result.conversationId} for ${to}`);
    }

    const parts = splitWhatsAppText(stripThink(result.answer));
    if (!parts.length) {
      await whatsapp.sendText(phoneNumberId, to, FALLBACK);
      return;
    }

    for (const part of parts) {
      await whatsapp.sendText(phoneNumberId, to, part);
    }
  } catch (err) {
    console.error('[handler]', message.id, err.message || err);
    try {
      await whatsapp.sendText(phoneNumberId, to, FALLBACK);
    } catch (sendErr) {
      console.error('[handler] fallback failed', sendErr.message || sendErr);
    }
  }
}

module.exports = { processWebhook };
