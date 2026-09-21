# Ingesta del corpus de conversaciones

Herramienta de trabajo para digerir zips grandes (exports de ChatGPT/Claude, WhatsApp,
Google Takeout, documentos y adjuntos) sin saturar el espacio de trabajo ni el contexto.

## Por qué vive dentro del repo

En la sesión anterior dejé esta herramienta en `~/corpus-tools/` (fuera del repo) y **desapareció**
cuando el sandbox se reinició: lo único que sobrevive entre reinicios es lo que está
**comprometido en la rama** `arena/01a0c496-nexora-platform`.

Conclusión operativa:

| Ubicación | ¿Sobrevive entre turnos? |
|---|---|
| Dentro del repo **y commiteado** | Sí |
| Dentro del repo sin commitear | A verificar (hay archivos testigo) |
| Fuera del repo (ej. `~/corpus/`) | No — se pierde si el sandbox se recrea |

Por eso: **el código y los digests van al repo; los bytes crudos quedan afuera** (son descartables
una vez que el texto quedó extraído y el manifiesto registrado).

## Uso

```bash
# 1. ¿Qué hay para procesar? (barato: no extrae nada, sirve para zips de 1 GB)
python3 tools/corpus/ingest.py --auto --inspect

# 2. Procesar todo lo subido, borrar los originales y publicar el digest en el repo
python3 tools/corpus/ingest.py --auto --remove-source --publish tools/corpus/digest

# 3. Estado actual del corpus
python3 tools/corpus/ingest.py --report

# Buscar en todo el material ya digerido
rg -n "palabra clave" tools/corpus/digest
```

Opciones útiles:

| Flag | Para qué |
|---|---|
| `--auto` | toma todo lo que haya en `~/uploads`, `~/inbox`, `~/attachments` (y equivalentes en el repo) |
| `--inspect` | solo informe previo: tipos, extensiones, export detectado, top de archivos pesados |
| `--publish DIR` | copia índice + manifiestos + bundles de texto a una carpeta versionada |
| `--publish-max-mb N` | tope de texto a publicar (default 40 MB) |
| `--remove-source` | borra el zip original una vez verificado el inventario |
| `--drop-media` | descarta imágenes/audio/video tras ficharlos en el manifiesto |

## Qué resuelve

- **Extracción segura**: sin path-traversal, arregla nombres UTF-8 mal marcados, filtra
  `__MACOSX`, `._archivo`, `~$temp`, `Thumbs.db`, `.DS_Store`.
- **Zips/tar anidados**: los desarma (hasta `--max-depth`, default 3).
- **Normalización a texto**: `txt md json jsonl csv yml toml html rtf eml docx xlsx pptx pdf`
  y código de todo tipo. PDF vía `pypdf` (se instala solo en `/tmp` si falta).
- **Reconstrucción de conversaciones**: exports de **ChatGPT** (`conversations.json` con
  `mapping`), de **Claude** (`chat_messages`), listas de mensajes `{role, content}` y
  **chats de WhatsApp** (`chat.txt`) → Markdown legible con autor y fecha.
- **Bundles**: el texto se empaqueta en pocos archivos grandes (`_text/part-NNN.md`, ~400 KB)
  con separadores `### ARCHIVO: ruta`. En vez de 3.000 archivos chiquitos, un puñado de
  archivos que se leen y se buscan de una sola pasada.
- **Deduplicación SHA-1**, también entre lotes distintos (columna `duplicado_de`).
- **Manifiesto por lote** (`_MANIFEST.csv`): ruta, tipo, bytes, líneas, caracteres, hash,
  duplicado de, y nota de lo que no se pudo leer (PDF escaneado, `.doc` viejo, binario…).
- **Índice maestro** (`INDEX.md` + `index.json`) acumulativo.
- **Aviso de espacio**: cuánta holgura queda contra los límites del snapshot.

## Límites de la plataforma (adjuntos)

El panel de adjuntos permite subir hasta **1 GB por mensaje** y **hasta 3.000 archivos**.
Aun así conviene subir **1–3 zips por vez**:

- el snapshot del turno se corta alrededor de ~128 MB / ~10.000 archivos, así que una subida
  enorme puede recortarse;
- procesar en tandas permite revisar, corregir el parser si aparece un formato raro, y
  publicar el digest antes de seguir.

## Estrategia de espacio

1. Dentro del turno: extraer afuera del repo → normalizar a texto → publicar digest en el repo.
2. Borrar el zip original (`--remove-source`) una vez verificado el manifiesto.
3. Si el material pesado (imágenes, audio, video) no aporta, correr `--drop-media`: se conserva
   la ficha (nombre, tamaño, hash) pero no los bytes.
4. El crudo que queda en `~/corpus/` es desechable: lo que importa ya está publicado.
