require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const { processWebhook } = require('./services/handler');

const app = express();
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));

function verifySignature(req) {
  const secret = process.env.APP_SECRET;
  if (!secret) return true;

  const signature = req.get('x-hub-signature-256');
  if (!signature || !req.rawBody) return false;

  const expected = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex')}`;
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

app.post('/', (req, res) => {
  if (!verifySignature(req)) {
    console.warn('Rejected webhook: invalid signature');
    res.sendStatus(403);
    return;
  }

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n\nWebhook received ${timestamp}\n`);
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).end();

  try {
    processWebhook(req.body);
  } catch (err) {
    console.error('[webhook]', err.message || err);
  }
});

for (const name of ['VERIFY_TOKEN', 'WHATSAPP_TOKEN', 'DIFY_BASE_URL', 'DIFY_API_KEY']) {
  if (!process.env[name]) console.warn(`[config] missing ${name}`);
}
if (!process.env.APP_SECRET) {
  console.warn('[config] APP_SECRET unset, webhook signature check skipped');
}

app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
