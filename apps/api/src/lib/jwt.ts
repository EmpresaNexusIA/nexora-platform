import { SignJWT, jwtVerify, importSPKI, importPKCS8, type JWTPayload } from "jose";
import { config } from "../config.js";

export interface NexoraJWTPayload extends JWTPayload {
  sub: string;
  tenantId: string;
  type: "access" | "refresh";
}

// Cargar claves asincrónicamente (jose requiere objetos CryptoKey, no strings)
let privateKey: CryptoKey | null = null;
let publicKey: CryptoKey | null = null;

async function getPrivateKey(): Promise<CryptoKey> {
  if (!privateKey) {
    privateKey = await importPKCS8(config.jwt.privateKey, "RS256");
  }
  return privateKey;
}

async function getPublicKey(): Promise<CryptoKey> {
  if (!publicKey) {
    publicKey = await importSPKI(config.jwt.publicKey, "RS256");
  }
  return publicKey;
}

// Readiness criptografico: demuestra que ambas claves cargan y forman
// un par RS256 valido, sin emitir credenciales de usuario.
export async function checkJwtReadiness(): Promise<void> {
  const [signingKey, verificationKey] = await Promise.all([
    getPrivateKey(),
    getPublicKey(),
  ]);
  const probe = await new SignJWT({ readiness: true })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("30s")
    .sign(signingKey);
  await jwtVerify(probe, verificationKey, { algorithms: ["RS256"] });
}

export async function signAccessToken(userId: string, tenantId: string): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ type: "access", tenantId })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.jwt.accessTtl)
    .sign(key);
}

export async function signRefreshToken(userId: string, tenantId: string): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ type: "refresh", tenantId })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.jwt.refreshTtl)
    .sign(key);
}

export async function verifyToken(token: string): Promise<NexoraJWTPayload> {
  const key = await getPublicKey();
  const { payload } = await jwtVerify(token, key, {
    algorithms: ["RS256"],
  });
  return payload as NexoraJWTPayload;
}
