import { SignJWT, jwtVerify, importSPKI, importPKCS8, type JWTPayload } from "jose";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";

export interface NexoraJWTPayload extends JWTPayload {
  sub: string;
  tenantId: string;
  type: "access" | "refresh";
  role?: string; // U2: "Dueño" | "Empleado" | undefined (tokens viejos)
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

export async function signAccessToken(userId: string, tenantId: string, role?: string): Promise<string> {
  const key = await getPrivateKey();
  const payload: Record<string, unknown> = { type: "access", tenantId };
  if (role) payload.role = role;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.jwt.accessTtl)
    .sign(key);
}

export async function signRefreshToken(userId: string, tenantId: string, role?: string): Promise<string> {
  const key = await getPrivateKey();
  const payload: Record<string, unknown> = { type: "refresh", tenantId };
  if (role) payload.role = role;
  return new SignJWT(payload)
    // jti aleatorio: sin él, dos refresh firmados en el MISMO segundo son
    // byte-iguales (RS256 determinístico + iat en segundos) y la rotación
    // se vuelve indistinguible (detectado en E2E 2026-09-24).
    .setJti(randomUUID())
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
