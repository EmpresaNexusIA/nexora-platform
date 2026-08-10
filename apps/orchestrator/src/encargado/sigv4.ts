/**
 * 🧔 Firma AWS SigV4 — a mano, sin SDK (patrón de la casa: fetch nativo).
 *
 * Validada contra el test-suite oficial de AWS (awslabs/aws-sig-v4-test-suite,
 * 6/6 vectores: canonical request + firma idénticas) y contra un MinIO REAL
 * (5/5: crear bucket, subir objeto, listar buckets, listar con prefijo, bajar).
 *
 * Uso: MinIO (S3) — /traeme del Encargado (Parto 2).
 */

import { createHmac, createHash } from 'node:crypto';

export const sha256 = (s: string): string =>
  createHash('sha256').update(s, 'utf8').digest('hex');

/** Hash del payload vacío (GET sin cuerpo) — constante de la spec. */
export const SHA_EMPTY =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/**
 * URI-encoding AWS: %XX en mayúsculas y además escapa ! ' ( ) *.
 * En paths se dejan las "/" como separadores; en query se escapan.
 */
export function uriEncode(s: string, encodeSlash = false): string {
  let out = encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
  if (!encodeSlash) out = out.replace(/%2F/gi, '/');
  return out;
}

/**
 * Query canónica: lista de pares [clave, valor] (admite duplicados),
 * ordenada por clave y luego por valor, cada par URI-encoded.
 */
export function canonicalQuery(pares: [string, string][] = []): string {
  return [...pares]
    .map(([k, v]): [string, string] => [uriEncode(k, true), uriEncode(v, true)])
    .sort((a, b) =>
      a[0] === b[0]
        ? a[1] < b[1]
          ? -1
          : a[1] > b[1]
            ? 1
            : 0
        : a[0] < b[0]
          ? -1
          : 1
    )
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

export interface FirmaV4Params {
  method: string;
  host: string; // "127.0.0.1:9000" (sin esquema)
  path: string; // ya URI-encoded, con "/" como separador
  queryPares?: [string, string][];
  extraHeaders?: Record<string, string>;
  payloadHash?: string;
  accessKey: string;
  secretKey: string;
  region?: string;
  service?: string;
  amzDate: string; // "YYYYMMDDTHHmmssZ"
}

export interface FirmaV4Resultado {
  canonicalRequest: string;
  authz: string;
}

/**
 * Firma una request S3 estilo SigV4 y devuelve la cabecera Authorization.
 * Los headers firmados: host + x-amz-date (+ extraHeaders que se pasen,
 * ej. x-amz-content-sha256).
 */
export function firmarV4(p: FirmaV4Params): FirmaV4Resultado {
  const {
    method,
    host,
    path,
    queryPares = [],
    extraHeaders = {},
    payloadHash = SHA_EMPTY,
    accessKey,
    secretKey,
    region = 'us-east-1',
    service = 'service',
    amzDate,
  } = p;

  const headers: Record<string, string> = {
    host,
    'x-amz-date': amzDate,
    ...extraHeaders,
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => `${k}:${headers[k]}\n`)
    .join('');

  const canonicalRequest = [
    method,
    path,
    canonicalQuery(queryPares),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join('\n');

  const kSigning = hmacChain(secretKey, dateStamp, region, service);
  const signature = createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  return {
    canonicalRequest,
    authz: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function hmacChain(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Buffer {
  const h = (k: string | Buffer, s: string): Buffer =>
    createHmac('sha256', k).update(s, 'utf8').digest();
  return h(h(h(h('AWS4' + secretKey, dateStamp), region), service), 'aws4_request');
}
