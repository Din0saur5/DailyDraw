export interface R2Signer {
  signPutObject(key: string, contentType: string, expiresInSeconds?: number): Promise<SignedUrl>;
  signGetObject(key: string, expiresInSeconds?: number): Promise<SignedUrl>;
}

export interface SignedUrl {
  url: string;
  expiresAt: string;
}
