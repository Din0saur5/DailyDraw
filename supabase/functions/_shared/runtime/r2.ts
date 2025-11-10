import { R2Signer, SignedUrl } from '../core/r2.ts';
import { createHttpError } from '../core/errors.ts';

const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
const bucketName = Deno.env.get('R2_BUCKET_NAME');
const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
const publicEndpoint = Deno.env.get('R2_PUBLIC_ENDPOINT');

const encoder = new TextEncoder();
const region = 'auto';

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const sha256Hex = async (input: string) => {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return toHex(hash);
};

const hmac = async (keyData: ArrayBuffer | string, data: string) => {
  const key = typeof keyData === 'string' ? encoder.encode(keyData) : keyData;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
};

const getSignatureKey = async (secretKey: string, dateStamp: string) => {
  const kDate = await hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
};

const buildQueryString = (entries: [string, string][]) =>
  entries
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

const ensureConfigured = () => {
  if (!accountId || !bucketName || !accessKeyId || !secretAccessKey || !publicEndpoint) {
    throw createHttpError(500, 'Missing Cloudflare R2 configuration');
  }
};

const signUrl = async (
  method: 'PUT' | 'GET',
  key: string,
  expiresInSeconds = 300,
): Promise<SignedUrl> => {
  ensureConfigured();
  const endpointUrl = new URL(publicEndpoint!);
  const host = endpointUrl.host;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalUri = `/${bucketName}/${key}`;
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const queryEntries: [string, string][] = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', `${expiresInSeconds}`],
    ['X-Amz-SignedHeaders', signedHeaders],
  ];

  const canonicalQueryString = buildQueryString(queryEntries);
  const canonicalRequest = [
    method,
    encodeURI(canonicalUri),
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSignatureKey(secretAccessKey!, dateStamp);
  const signature = toHex(await hmac(signingKey, stringToSign));

  const signedQuery = `${canonicalQueryString}&X-Amz-Signature=${signature}`;
  const url = `${publicEndpoint}/${bucketName}/${encodeURI(key)}?${signedQuery}`;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  return { url, expiresAt };
};

export const createR2Signer = (): R2Signer => ({
  signPutObject: (key, _contentType, expires) => signUrl('PUT', key, expires),
  signGetObject: (key, expires) => signUrl('GET', key, expires),
});
