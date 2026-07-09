function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

export function verifyImportWebhookSecret(request: Request): boolean {
  const secret = Deno.env.get('IMPORT_WEBHOOK_SECRET')?.trim();
  if (!secret) return false;

  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return safeEqual(auth.slice(7), secret);
  }

  const headerSecret = request.headers.get('x-import-webhook-secret');
  if (headerSecret) {
    return safeEqual(headerSecret, secret);
  }

  return false;
}
