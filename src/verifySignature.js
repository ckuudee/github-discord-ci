const crypto = require('node:crypto');

// GitHub signs the raw request body with HMAC-SHA256 using the webhook secret and
// sends it as "sha256=<hex>" in X-Hub-Signature-256.
function verifySignature(secret, rawBody, signatureHeader) {
  if (!secret || !signatureHeader || !Buffer.isBuffer(rawBody)) return false;

  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  // timingSafeEqual throws on length mismatch, so check length first.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { verifySignature };
