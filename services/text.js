const WHATSAPP_TEXT_LIMIT = 4096;

function stripThink(raw) {
  if (!raw) return '';
  let text = String(raw).replace(/<think>[\s\S]*?<\/think>/g, '');
  const open = text.indexOf('<think>');
  if (open !== -1) text = text.slice(0, open);
  return text.trim();
}

function isResetCommand(text) {
  const normalized = String(text || '').trim().toLowerCase();
  return normalized === '新对话' || normalized === '/reset' || normalized === '/new';
}

function isHighSurrogate(str, index) {
  if (index <= 0) return false;
  const code = str.charCodeAt(index - 1);
  return code >= 0xd800 && code <= 0xdbff;
}

function splitWhatsAppText(text) {
  const source = String(text || '').trim();
  if (!source) return [];

  const parts = [];
  let rest = source;
  while (rest.length > WHATSAPP_TEXT_LIMIT) {
    let cut = rest.lastIndexOf('\n', WHATSAPP_TEXT_LIMIT);
    if (cut < Math.floor(WHATSAPP_TEXT_LIMIT / 2)) cut = WHATSAPP_TEXT_LIMIT;
    if (isHighSurrogate(rest, cut)) cut -= 1;
    const chunk = rest.slice(0, cut).trimEnd();
    if (chunk) parts.push(chunk);
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

module.exports = {
  WHATSAPP_TEXT_LIMIT,
  stripThink,
  isResetCommand,
  splitWhatsAppText,
};
