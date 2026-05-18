function getEncryptionKey(): string {
  return process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function toBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function encryptToken(plaintext: string): Promise<string> {
  const keyBytes = toBytes(getEncryptionKey()).slice(0, 32);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = toBytes(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded as BufferSource
  );
  const ciphertext = new Uint8Array(encrypted as ArrayBuffer);
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, iv.length);
  return toHex(combined);
}

export async function decryptToken(hex: string): Promise<string> {
  const combined = fromHex(hex);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const keyBytes = toBytes(getEncryptionKey()).slice(0, 32);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}
