import crypto from 'node:crypto';

// Master key resolution: derived to a consistent 32-byte (256-bit) buffer
function getMasterKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.BETTER_AUTH_SECRET ||
    'menugo-theatre-encryption-secret-key-32-chars';

  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a sensitive string (e.g. gateway secret, webhook key) using AES-256-GCM.
 * Output format: <iv-hex>:<authTag-hex>:<ciphertext-hex>
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) {
    throw new Error('Cannot encrypt empty or null secret');
  }

  const key = getMasterKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted payload.
 * Verifies authenticity with the GCM authentication tag.
 */
export function decryptSecret(payload: string): string {
  if (!payload) {
    throw new Error('Cannot decrypt empty or null payload');
  }

  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret payload format');
  }

  const ivHex = parts[0];
  const authTagHex = parts[1];
  const encryptedHex = parts[2];

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted secret payload format');
  }

  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

/**
 * Masks a secret string for safe display and API responses.
 * Never reveals more than the last 4 characters.
 * Example: 'rzp_live_secretkey1234' -> '••••••••1234'
 */
export function maskSecret(secret: string): string {
  if (!secret) return '';
  const trimmed = secret.trim();
  if (trimmed.length <= 4) {
    return '••••••••';
  }
  return `••••••••${trimmed.slice(-4)}`;
}
