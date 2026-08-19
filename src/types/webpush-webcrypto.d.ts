/**
 * Deklarasi tipe untuk paket `webpush-webcrypto` (paket JS murni tanpa .d.ts).
 * Paket ini hanya memakai WebCrypto standar sehingga kompatibel dengan
 * runtime Cloudflare Worker (tidak ada dependensi Node.js).
 */
declare module "webpush-webcrypto" {
  export class ApplicationServerKeys {
    constructor(publicKey: CryptoKey, privateKey: CryptoKey);
    publicKey: CryptoKey;
    privateKey: CryptoKey;
    toJSON(): Promise<{ publicKey: string; privateKey: string }>;
    static fromJSON(keys: {
      publicKey: string;
      privateKey: string;
    }): Promise<ApplicationServerKeys>;
    static generate(): Promise<ApplicationServerKeys>;
  }

  export function setWebCrypto(crypto: Crypto): void;

  export function generatePushHTTPRequest(options: {
    applicationServerKeys: ApplicationServerKeys;
    payload: string;
    target: { endpoint: string; keys: { p256dh: string; auth: string } };
    adminContact: string;
    ttl?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
  }): Promise<{ headers: Record<string, string>; body: ArrayBuffer; endpoint: string }>;
}
