// NEXORA · Upload de fotos de producto (POST /api/upload)
// PRIORIDAD: MinIO (S3-compatible del monorepo) si está configurado S3_ENDPOINT.
// FALLBACK: filesystem local public/uploads (dev rápido).
// Contrato idéntico para el front: { ok, url }.

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

const MAX_BYTES = 3 * 1024 * 1024;
const MIME_OK: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const s3Listo = () =>
  Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY);

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const comercio = String(form.get("comercio") || "demo").replace(/[^a-z0-9-]/gi, "");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No llegó ningún archivo." }, { status: 400 });
    }
    const ext = MIME_OK[file.type];
    if (!ext) {
      return NextResponse.json({ ok: false, error: "Formato no válido. Usá JPG, PNG o WebP." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "La foto pesa más de 3 MB. Comprimila y probá de nuevo." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ ok: false, error: "El archivo está vacío." }, { status: 400 });
    }

    const nombre = `${randomBytes(8).toString("hex")}.${ext}`;
    const key = `${comercio}/${nombre}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (s3Listo()) {
      // MinIO con AWS SDK S3 (path-style). `pnpm add @aws-sdk/client-s3` en apps/tienda.
      // Paquete OPCIONAL: solo hace falta instalarlo si S3_ENDPOINT está seteado.
      // (import con nombre de variable = TS/Next no lo resuelven en build)
      const pkg = "@aws-sdk/client-s3";
      const { S3Client, PutObjectCommand } = await import(pkg);
      const s3 = new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: "us-east-1",
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY!,
          secretAccessKey: process.env.S3_SECRET_KEY!,
        },
        forcePathStyle: true, // requerido por MinIO
      });
      await s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      }));
      const publicBase = (process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`).replace(/\/$/, "");
      return NextResponse.json({ ok: true, url: `${publicBase}/${key}` });
    }

    // Fallback local (dev sin MinIO)
    const { writeFile, mkdir } = await import("fs/promises");
    const path = (await import("path")).default;
    const dir = path.join(process.cwd(), "public", "uploads", comercio);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, nombre), buffer);
    return NextResponse.json({ ok: true, url: `/uploads/${key}` });
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo subir la foto." }, { status: 500 });
  }
}
