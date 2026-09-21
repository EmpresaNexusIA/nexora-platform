#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ingest.py — Ingesta por tandas de zips/carpetas con conversaciones y adjuntos.

Diseñado para zips de hasta 1 GB y miles de archivos. Hace todo lo pesado y devuelve
un corpus de TEXTO navegable, sin reventar el espacio de trabajo ni el contexto.

Pipeline:
  1. Detecta automáticamente lo que hay en ~/uploads, ~/inbox, uploads/, attachments/, o las rutas que le pases.
  2. Inspección previa (--inspect): qué trae cada zip, sin extraer.
  3. Extracción segura (sin path-traversal, arregla nombres UTF-8 rotos, filtra basura de macOS/Windows).
  4. Desarma zips/tar anidados.
  5. Normaliza a texto: txt/md/json/jsonl/csv/código/html/rtf/docx/xlsx/pptx/pdf/eml...
     - Reconstruye hilos de conversación (export ChatGPT / Claude / listas de mensajes) a Markdown legible.
     - Convierte exports de WhatsApp (chat.txt) a Markdown.
  6. Deduplica por SHA-1 (también entre lotes distintos).
  7. Empaqueta el texto en bundles grandes (_text/part-NNN.md) para leer con pocas operaciones.
  8. Escribe manifiesto CSV + índice maestro + aviso de espacio.
  9. --publish copia el digest (índice, manifiestos, bundles) a una carpeta versionada.

Ejemplos:
  python3 ingest.py --inspect --auto              # ¿qué hay en uploads/inbox?
  python3 ingest.py --auto --remove-source        # procesa todo lo subido
  python3 ingest.py lote1.zip lote2.zip --publish tools/corpus/digest
  python3 ingest.py --auto --drop-media           # descarta imágenes/audio tras ficharlas
  python3 ingest.py --report
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html as html_mod
import io
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/home/user")
REPO = ROOT / "nexora-platform"
DEFAULT_OUT = ROOT / "corpus"
WATCH_DIRS = [ROOT / "uploads", ROOT / "inbox", ROOT / "attachments",
              REPO / "uploads", REPO / "inbox", REPO / "attachments"]

TEXT_BUDGET = 400_000          # bytes de texto por bundle
SOFT_FILE_CAP = 9_000          # límite práctico de archivos del snapshot
SOFT_BYTES_CAP = 120 * 1024 * 1024
MAX_HASH_BYTES = 200 * 1024 * 1024

TEXT_EXT = {
    ".txt", ".text", ".md", ".markdown", ".mdx", ".rst", ".org",
    ".json", ".jsonl", ".ndjson", ".csv", ".tsv", ".psv", ".json5",
    ".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf", ".properties",
    ".html", ".htm", ".xhtml", ".xml", ".xsl", ".svg", ".rtf", ".eml",
    ".py", ".pyw", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".vue", ".svelte",
    ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd",
    ".sql", ".graphql", ".gql", ".prisma",
    ".java", ".kt", ".kts", ".scala", ".groovy", ".go", ".rs", ".rb", ".php",
    ".c", ".h", ".cc", ".cpp", ".hpp", ".cs", ".swift", ".m", ".mm", ".dart", ".lua", ".r", ".jl",
    ".css", ".scss", ".sass", ".less", ".styl",
    ".log", ".diff", ".patch", ".vtt", ".srt", ".ass", ".tex", ".bib", ".ipynb", ".http",
}
DOC_EXT = {".docx", ".xlsx", ".pptx", ".pdf", ".doc", ".xls", ".ppt", ".odt", ".ods", ".odp", ".pages"}
IMG_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tif", ".tiff", ".heic", ".heif", ".avif", ".ico"}
AV_EXT = {".mp3", ".wav", ".ogg", ".opus", ".m4a", ".flac", ".aac", ".mp4", ".mov", ".avi", ".mkv", ".webm"}
ARCH_EXT = {".zip", ".rar", ".7z", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".zst"}
JUNK_NAMES = {"thumbs.db", "desktop.ini", ".ds_store", "icon\r"}
JUNK_DIR_PARTS = {"__macosx", ".git", "node_modules", "__pycache__", ".idea", ".vscode"}

EXPORT_HINTS = {
    "conversations.json": "export ChatGPT (hilos completos)",
    "chat.html": "export ChatGPT/Claude en HTML",
    "conversations.html": "export ChatGPT en HTML",
    "users.json": "export ChatGPT (metadatos de usuario)",
    "messages.json": "posible export de chat",
    "chat.json": "posible export de chat",
    "chat.txt": "posible export de WhatsApp",
    "_chat.txt": "posible export de WhatsApp",
    "takeout": "export Google Takeout",
}

_pypdf = None
_pypdf_failed = False


# ----------------------------------------------------------------------------- utils
def sha1_of(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha1()
    with path.open("rb") as fh:
        while True:
            b = fh.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def slugify(name: str, maxlen: int = 60) -> str:
    s = re.sub(r"\.(zip|rar|7z|tar|gz|tgz|bz2|xz)$", "", name.strip(), flags=re.I)
    s = re.sub(r"[^\w.\- ]+", "_", s, flags=re.UNICODE).strip(" ._-")
    s = re.sub(r"[\s_]+", "-", s)
    return (s[:maxlen] or "lote").lower().strip("-")


def human(n: float) -> str:
    n = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f}{unit}" if unit == "B" else f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}GB"


def decode_text(raw: bytes) -> tuple[str, str]:
    if raw.startswith(b"\xef\xbb\xbf"):
        return raw[3:].decode("utf-8", "replace"), "utf-8-sig"
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        try:
            return raw.decode("utf-16", "replace"), "utf-16"
        except Exception:
            pass
    for enc in ("utf-8", "cp1252"):
        try:
            return raw.decode(enc), enc
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", "replace"), "latin-1"


def ensure_pypdf():
    global _pypdf, _pypdf_failed
    if _pypdf is not None or _pypdf_failed:
        return _pypdf
    try:
        import pypdf  # type: ignore
        _pypdf = pypdf
        return _pypdf
    except ImportError:
        pass
    try:
        target = "/tmp/pylibs"
        os.makedirs(target, exist_ok=True)
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "--disable-pip-version-check",
                        "--target", target, "pypdf"], check=True, capture_output=True, timeout=240)
        if target not in sys.path:
            sys.path.insert(0, target)
        import pypdf  # type: ignore
        _pypdf = pypdf
    except Exception:
        _pypdf_failed = True
    return _pypdf


def fix_zip_name(info: zipfile.ZipInfo) -> str:
    name = info.filename
    if info.flag_bits & 0x800:
        return name
    try:
        return name.encode("cp437").decode("utf-8")
    except Exception:
        return name


def safe_extract(zf: zipfile.ZipFile, dest: Path) -> int:
    files = 0
    dest = dest.resolve()
    for info in zf.infolist():
        name = fix_zip_name(info).replace("\\", "/")
        if not name or name.endswith("/"):
            continue
        parts = [p for p in name.split("/") if p not in ("", ".")]
        if any(p == ".." for p in parts):
            continue
        parts = [p for p in parts if p.lower() not in JUNK_DIR_PARTS]
        parts = [p for p in parts if not (p.startswith("._") or p.startswith("~$"))]
        if not parts:
            continue
        target = dest / Path(*parts)
        try:
            if not str(target.resolve()).startswith(str(dest)):
                continue
        except OSError:
            continue
        if target.name.lower() in JUNK_NAMES or target.name.startswith(("._", "~$")):
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            with zf.open(info) as src, target.open("wb") as out:
                shutil.copyfileobj(src, out, 1 << 20)
            files += 1
        except Exception as exc:
            print(f"   ! no pude extraer {name}: {exc}")
    return files


# ----------------------------------------------------------------------------- conversores
def strip_html(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?i)<br\s*/?>", "\n", raw)
    raw = re.sub(r"(?i)</(p|div|li|tr|h[1-6]|section|article|header|footer|blockquote)>", "\n", raw)
    raw = re.sub(r"(?i)<li[^>]*>", "- ", raw)
    raw = re.sub(r"<[^>]+>", " ", raw)
    raw = html_mod.unescape(raw)
    raw = re.sub(r"[ \t\u00a0]+", " ", raw)
    return re.sub(r"\n\s*\n\s*\n+", "\n\n", raw).strip()


def strip_rtf(raw: str) -> str:
    raw = re.sub(r"\\'([0-9a-fA-F]{2})", lambda m: bytes.fromhex(m.group(1)).decode("cp1252", "replace"), raw)
    raw = re.sub(r"\\par[d]?\b", "\n", raw)
    raw = re.sub(r"\\[a-zA-Z]+-?\d* ?", "", raw)
    raw = raw.replace("{", "").replace("}", "")
    return re.sub(r"\n{3,}", "\n\n", raw).strip()


def docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        names = sorted((n for n in z.namelist() if re.fullmatch(
            r"word/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml", n)),
            key=lambda n: (n != "word/document.xml", n))
        chunks = []
        for n in names:
            xml = z.read(n).decode("utf-8", "ignore")
            paras = []
            for p in re.findall(r"(?s)<w:p[ >].*?</w:p>|<w:p/>", xml):
                txt = "".join(re.findall(r"(?s)<w:t[^>]*>(.*?)</w:t>", p))
                if "<w:tab/>" in p:
                    txt += "\t"
                paras.append(html_mod.unescape(re.sub(r"<[^>]+>", "", txt)))
            body = "\n".join(paras).strip()
            if body:
                chunks.append(body if n == "word/document.xml" else f"--- {n} ---\n{body}")
    return "\n\n".join(chunks)


def xlsx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            xml = z.read("xl/sharedStrings.xml").decode("utf-8", "ignore")
            for si in re.findall(r"(?s)<si>(.*?)</si>", xml):
                shared.append(html_mod.unescape("".join(re.findall(r"(?s)<t[^>]*>(.*?)</t>", si))))
        out = []
        for sh in sorted(n for n in z.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n)):
            xml = z.read(sh).decode("utf-8", "ignore")
            out.append(f"--- {sh} ---")
            for row in re.findall(r"(?s)<row[^>]*>(.*?)</row>", xml):
                cells = []
                for c in re.findall(r"(?s)<c\b[^>]*?(?:/>|>.*?</c>)", row):
                    t = re.search(r'\bt="([^"]+)"', c)
                    v = re.search(r"(?s)<v>(.*?)</v>", c)
                    ins = re.findall(r"(?s)<is>.*?</is>", c)
                    if t and t.group(1) == "s" and v and v.group(1).isdigit():
                        idx = int(v.group(1))
                        cells.append(shared[idx] if idx < len(shared) else "")
                    elif ins:
                        cells.append(html_mod.unescape("".join(re.findall(r"(?s)<t[^>]*>(.*?)</t>", "".join(ins)))))
                    elif v:
                        cells.append(html_mod.unescape(v.group(1)))
                    else:
                        cells.append("")
                line = "\t".join(cells).rstrip("\t")
                if line.strip():
                    out.append(line)
        return "\n".join(out)


def pptx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        slides = sorted((n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
                        key=lambda n: int(re.search(r"(\d+)", n).group(1)))  # type: ignore
        out = []
        for s in slides:
            xml = z.read(s).decode("utf-8", "ignore")
            txts = [html_mod.unescape(re.sub(r"<[^>]+>", "", t)) for t in re.findall(r"(?s)<a:t>(.*?)</a:t>", xml)]
            if txts:
                out.append(f"--- {s} ---\n" + "\n".join(txts))
        return "\n\n".join(out)


def pdf_text(path: Path) -> tuple[str | None, str]:
    pypdf = ensure_pypdf()
    if pypdf is None:
        return None, "pdf sin lector disponible"
    try:
        reader = pypdf.PdfReader(str(path))
        pages, empty = [], 0
        for i, page in enumerate(reader.pages[:800], 1):
            try:
                t = page.extract_text() or ""
            except Exception:
                t = ""
            if not t.strip():
                empty += 1
            pages.append(f"--- pág {i} ---\n{t.strip()}")
        return "\n\n".join(pages), "pdf" + (f"; {empty} pág sin texto (¿escaneado?)" if empty else "")
    except Exception as exc:
        return None, f"pdf-error: {type(exc).__name__}"


def chat_obj_to_md(obj, depth: int = 0) -> str | None:
    """Reconstruye hilos de conversación a Markdown legible. None si no reconoce el formato."""
    if depth > 2:
        return None

    # ChatGPT: {"title": ..., "mapping": {id: {"message": {...}}}, ...}
    if isinstance(obj, dict) and isinstance(obj.get("mapping"), dict):
        title = str(obj.get("title") or "conversación sin título").strip()
        create = obj.get("create_time")
        msgs = []
        for node in obj["mapping"].values():
            m = node.get("message") if isinstance(node, dict) else None
            if not isinstance(m, dict):
                continue
            author = ((m.get("author") or {}).get("role")) or "?"
            content = m.get("content") or {}
            text = ""
            parts = content.get("parts")
            if isinstance(parts, list):
                text = "\n".join(p for p in parts if isinstance(p, str))
            if not text.strip():
                text = str(content.get("text") or "")
            if not text.strip():
                continue
            msgs.append((m.get("create_time") or 0, author, text.strip()))
        if not msgs:
            return None
        msgs.sort(key=lambda x: x[0])
        head = f"# {title}"
        if create:
            head += f"\n\n*inicio: {datetime.fromtimestamp(create, timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}*"
        body = []
        for ts, author, text in msgs:
            when = datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d %H:%M") if ts else ""
            body.append(f"**{author}**{f' · {when}' if when else ''}\n\n{text}")
        return head + "\n\n" + "\n\n---\n\n".join(body)

    # Contenedor con lista de conversaciones / mensajes
    for key in ("conversations", "chats", "threads"):
        if isinstance(obj, dict) and isinstance(obj.get(key), list) and obj[key]:
            chunks = [md for md in (chat_obj_to_md(o, depth + 1) for o in obj[key][:600]) if md]
            if chunks:
                return "\n\n\n---\n\n\n".join(chunks)

    # Export de Claude: {"name": ..., "chat_messages": [{"sender": "human", "text": ...}]}
    if isinstance(obj, dict) and isinstance(obj.get("chat_messages"), list):
        title = str(obj.get("name") or obj.get("title") or "conversación").strip()
        lines = [f"# {title}", ""]
        for m in obj["chat_messages"]:
            if not isinstance(m, dict):
                continue
            who = m.get("sender") or m.get("role") or "?"
            txt = m.get("text") or m.get("content") or ""
            if isinstance(txt, list):
                txt = "\n".join(str(p.get("text") if isinstance(p, dict) else p) for p in txt)
            if str(txt).strip():
                when = str(m.get("created_at") or "")[:16]
                lines.append(f"**{who}**{f' · {when}' if when else ''}\n\n{str(txt).strip()}\n\n---\n")
        if len(lines) > 2:
            return "\n".join(lines)

    # Listas
    if isinstance(obj, list) and obj and all(isinstance(x, dict) for x in obj[:20]):
        # ¿lista de conversaciones enteras? (export ChatGPT: [{title, mapping}, ...])
        if any(("mapping" in x) or isinstance(x.get("chat_messages"), list)
               or (isinstance(x.get("messages"), list) and x.get("title")) for x in obj[:20]):
            chunks = [md for md in (chat_obj_to_md(o, depth + 1) for o in obj[:600]) if md]
            if chunks:
                return "\n\n\n---\n\n\n".join(chunks)

        # Lista de mensajes [{"role": ..., "content"/"text": ...}]
        keys = set().union(*[set(x.keys()) for x in obj[:50]])
        if keys & {"role", "author", "sender"} and keys & {"content", "text", "message", "body"}:
            lines = []
            for m in obj:
                role = m.get("role") or m.get("author") or m.get("sender") or "?"
                c = m.get("content") if m.get("content") is not None else (m.get("text") or m.get("message") or m.get("body") or "")
                if isinstance(c, list):
                    c = "\n".join(str(p.get("text") if isinstance(p, dict) else p) for p in c)
                elif isinstance(c, dict):
                    c = str(c.get("text") or json.dumps(c, ensure_ascii=False)[:2000])
                if str(c).strip():
                    lines.append(f"**{role}**\n\n{str(c).strip()}")
            if lines:
                return "\n\n---\n\n".join(lines)
    return None


WA_LINE = re.compile(
    r"^\[?(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[APap]\.?[Mm]\.?)?\]?\s*[-–]?\s*"
    r"([^:]{1,60}?):\s?(.*)$")
WA_SYS = re.compile(r"^\[?(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–]?\s*(.*)$")


def whatsapp_to_md(text: str) -> str | None:
    lines = text.splitlines()
    if not any(WA_LINE.match(l) for l in lines[:400]):
        return None
    out, current = [], None
    for line in lines:
        m = WA_LINE.match(line)
        if m:
            if current:
                out.append(current)
            date, hour, who, msg = m.groups()
            out.append(f"**{who}** · {date} {hour}\n\n{msg}")
        else:
            s = WA_SYS.match(line)
            if s:
                if current:
                    out.append(current)
                    current = None
                out.append(f"> *{s.group(3)}*")
            elif out:
                out[-1] += "\n" + line
            else:
                out.append(line)
    return "\n\n".join(out)


def extract_text(path: Path, ext: str, name: str) -> tuple[str | None, str]:
    try:
        if ext == ".docx":
            return docx_text(path), "docx"
        if ext == ".xlsx":
            return xlsx_text(path), "xlsx"
        if ext == ".pptx":
            return pptx_text(path), "pptx"
        if ext == ".pdf":
            return pdf_text(path)
        if ext in (".doc", ".xls", ".ppt", ".odt", ".ods", ".odp", ".pages"):
            return None, f"{ext} binario antiguo (requiere conversión)"

        size = path.stat().st_size
        if size > 300 * 1024 * 1024:
            return None, "archivo demasiado grande para normalizar"
        raw = path.read_bytes()
        if b"\x00" in raw[:8192] and ext != ".rtf":
            return None, "binario (no texto)"
        text, enc = decode_text(raw)

        if ext in (".html", ".htm", ".xhtml", ".xml", ".svg", ".eml"):
            return strip_html(text), f"texto/{enc}"
        if ext == ".rtf":
            return strip_rtf(text), f"texto/{enc}"
        if ext in (".json", ".jsonl", ".ndjson"):
            if size < 120 * 1024 * 1024:
                try:
                    if ext == ".json":
                        md = chat_obj_to_md(json.loads(text))
                        if md:
                            return md, "conversación reconstruida"
                    else:
                        convs = []
                        for line in text.splitlines():
                            if line.strip():
                                try:
                                    md = chat_obj_to_md(json.loads(line))
                                except Exception:
                                    md = None
                                if md:
                                    convs.append(md)
                        if convs:
                            return "\n\n---\n\n".join(convs), "conversaciones reconstruidas (jsonl)"
                except Exception:
                    pass
            return text, f"texto/{enc}"
        if name.lower().endswith(("chat.txt", "_chat.txt")) or "whatsapp" in name.lower():
            md = whatsapp_to_md(text)
            if md:
                return md, "chat de WhatsApp reconstruido"
        return text, (f"texto/{enc}" if enc != "utf-8" else "texto")
    except Exception as exc:
        return None, f"error: {type(exc).__name__}"


def classify(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in ARCH_EXT:
        return "archivo-comprimido"
    if ext in DOC_EXT:
        return "documento"
    if ext in TEXT_EXT:
        return "texto"
    if ext in IMG_EXT:
        return "imagen"
    if ext in AV_EXT:
        return "audio-video"
    if ext == "":
        return "sin-extension"
    return "otro"


# ----------------------------------------------------------------------------- inspección
def tally_source(src: Path) -> dict:
    info = {"nombre": src.name, "bytes": 0, "archivos": 0, "ext": {}, "tipo": {}, "tipo_bytes": {},
            "nested": 0, "encrypted": 0, "hints": set(), "top": [], "error": ""}

    def tally(name: str, fsize: int) -> None:
        ext = Path(name).suffix.lower()
        info["ext"][ext or "(sin ext)"] = info["ext"].get(ext or "(sin ext)", 0) + 1
        kind = classify(Path(name))
        info["tipo"][kind] = info["tipo"].get(kind, 0) + 1
        info["tipo_bytes"][kind] = info["tipo_bytes"].get(kind, 0) + fsize
        info["archivos"] += 1
        info["bytes"] += fsize
        if ext in ARCH_EXT:
            info["nested"] += 1
        base = Path(name).name.lower()
        if base in EXPORT_HINTS:
            info["hints"].add(f"{base} → {EXPORT_HINTS[base]}")
        info["top"].append((fsize, name))

    if src.is_file() and zipfile.is_zipfile(src):
        try:
            with zipfile.ZipFile(src) as zf:
                for i in zf.infolist():
                    if i.filename.endswith("/"):
                        continue
                    if i.flag_bits & 0x1:
                        info["encrypted"] += 1
                    tally(fix_zip_name(i), i.file_size)
        except Exception as exc:
            info["error"] = f"{type(exc).__name__}: {exc}"
    elif src.is_file():
        tally(src.name, src.stat().st_size)
    else:
        for p in src.rglob("*"):
            if p.is_file():
                rel = str(p.relative_to(src))
                if any(part.lower() in JUNK_DIR_PARTS for part in Path(rel).parts):
                    continue
                tally(rel, p.stat().st_size)
    return info


def print_inspection(infos: list[dict]) -> None:
    grand_files = grand_bytes = 0
    for i in infos:
        print(f"\n🔍 {i['nombre']}   ({human(i['bytes'])} descomprimido)")
        if i["error"]:
            print(f"   ⚠️  no pude leerlo: {i['error']}")
            continue
        print(f"   {i['archivos']} archivos · por tipo: " +
              ", ".join(f"{k}={v}" for k, v in sorted(i["tipo"].items(), key=lambda kv: -kv[1])))
        print("   por extensión: " + ", ".join(f"`{k}`={v}" for k, v in
              sorted(i["ext"].items(), key=lambda kv: -kv[1])[:14]))
        txt = sum(v for k, v in i["tipo_bytes"].items() if k in ("texto", "documento"))
        media = sum(v for k, v in i["tipo_bytes"].items() if k in ("imagen", "audio-video"))
        print(f"   {human(txt)} texto/documentos · {human(media)} imágenes/AV · {human(i['bytes'] - txt - media)} resto")
        if i["nested"]:
            print(f"   ⚠️  {i['nested']} comprimido(s) anidado(s): se desarman al ingerir")
        if i["encrypted"]:
            print(f"   ⚠️  {i['encrypted']} archivo(s) cifrado(s) con contraseña: ilegibles")
        if i["hints"]:
            print("   🧩 detecté: " + " | ".join(sorted(i["hints"])))
        if i["archivos"] > 1500:
            print(f"   ⚠️  {i['archivos']} archivos: conviene procesarlo solo, sin más zips en la misma tanda")
        print("   Top 8 más pesados:")
        for s, n in sorted(i["top"], reverse=True)[:8]:
            print(f"     · {human(s):>9}  {n[:90]}")
        grand_files += i["archivos"]
        grand_bytes += i["bytes"]
    print(f"\nTOTAL: {len(infos)} fuente(s) · {grand_files} archivos · {human(grand_bytes)} descomprimidos")
    print(f"Espacio libre en disco: {human(shutil.disk_usage('/').free)}")


# ----------------------------------------------------------------------------- ingesta
def ingest_source(src: Path, out: Path) -> Path:
    slug = slugify(src.stem if src.is_file() else src.name)
    dest = out / slug
    n = 1
    marker = dest / ".source"
    while dest.exists() and marker.exists() and marker.read_text(encoding="utf-8").strip() != str(src.resolve()):
        dest = out / f"{slug}-{n}"
        marker = dest / ".source"
        n += 1

    print(f"\n▶ {src.name}  →  {dest}")
    dest.mkdir(parents=True, exist_ok=True)
    marker.write_text(str(src.resolve()), encoding="utf-8")

    if src.is_file() and zipfile.is_zipfile(src):
        with zipfile.ZipFile(src) as zf:
            bad = zf.testzip()
            if bad:
                print(f"   ! zip dañado en {bad} (sigo con el resto)")
            count = safe_extract(zf, dest)
        print(f"   extraídos {count} archivos")
    elif src.is_dir():
        for item in src.rglob("*"):
            if item.is_file() and not any(p.lower() in JUNK_DIR_PARTS
                                          for p in item.relative_to(src).parts):
                tgt = dest / item.relative_to(src)
                tgt.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item, tgt)
        print("   carpeta copiada")
    else:
        shutil.copy2(src, dest / src.name)
        print("   archivo único copiado")
    return dest


def unzip_nested(dest: Path, max_depth: int) -> int:
    removed = 0
    for _ in range(max_depth):
        nested = [p for p in sorted(dest.rglob("*"))
                  if p.is_file() and p.suffix.lower() in ARCH_EXT and p.stat().st_size > 0
                  and p.parent.name != "_comprimidos"]
        if not nested:
            break
        found = False
        for nz in nested:
            out = nz.parent / f"{nz.stem}_extraido"
            try:
                if nz.suffix.lower() == ".zip" and zipfile.is_zipfile(nz):
                    out.mkdir(parents=True, exist_ok=True)
                    with zipfile.ZipFile(nz) as zf:
                        c = safe_extract(zf, out)
                    print(f"   ↳ zip anidado {nz.relative_to(dest)} ({c} archivos)")
                    nz.unlink()
                    removed += 1
                    found = True
                elif nz.suffix.lower() in (".tar", ".tgz", ".gz", ".bz2", ".xz"):
                    out.mkdir(parents=True, exist_ok=True)
                    if subprocess.run(["tar", "-xf", str(nz), "-C", str(out)],
                                      capture_output=True).returncode == 0:
                        print(f"   ↳ tar anidado {nz.relative_to(dest)}")
                        nz.unlink()
                        removed += 1
                        found = True
                else:
                    hold = nz.parent / "_comprimidos"
                    hold.mkdir(exist_ok=True)
                    print(f"   · {nz.name}: comprimido sin soporte (rar/7z) — se conserva aparte")
                    nz.rename(hold / nz.name)
            except Exception as exc:
                print(f"   ! falló {nz.name}: {exc}")
        if not found:
            break
    return removed


def process_dir(dest: Path, hashes: dict[str, str], drop_media: bool) -> list[dict]:
    rows: list[dict] = []
    text_dir = dest / "_text"
    text_dir.mkdir(exist_ok=True)
    part = 1
    buf = io.StringIO()
    bundles: list[str] = []

    def flush():
        nonlocal part, buf
        body = buf.getvalue()
        if not body.strip():
            return
        target = text_dir / f"part-{part:03d}.md"
        target.write_text(body, encoding="utf-8")
        bundles.append(f"{target.name}  ({human(len(body.encode('utf-8')))} de texto)")
        part += 1
        buf = io.StringIO()

    for path in sorted(dest.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(dest)
        if rel.parts and rel.parts[0] in ("_text",):
            continue
        if path.name == ".source":
            continue
        ext = path.suffix.lower()
        kind = classify(path)
        size = path.stat().st_size
        digest = sha1_of(path) if size < MAX_HASH_BYTES else ""
        dup_of = hashes.get(digest, "") if digest else ""
        if digest and not dup_of:
            hashes[digest] = str(rel)
        note, chars, lines = "", 0, 0

        if kind in ("texto", "documento"):
            text, note = extract_text(path, ext, path.name)
            if text:
                chars, lines = len(text), text.count("\n") + 1
                buf.write(f"\n\n{'=' * 100}\n### ARCHIVO: corpus/{dest.name}/{rel}\n"
                          f"### {kind} {ext or ''} · {human(size)} · {lines} líneas · {note}\n{'=' * 100}\n\n")
                buf.write(text.strip() + "\n")
                if buf.tell() >= TEXT_BUDGET:
                    flush()
            elif kind == "texto" and size <= 8 * 1024 * 1024:
                raw = path.read_bytes()
                txt, enc = decode_text(raw)
                chars, lines = len(txt), txt.count("\n") + 1
                buf.write(f"\n\n{'=' * 100}\n### ARCHIVO: corpus/{dest.name}/{rel}\n"
                          f"### {kind} {ext} · {human(size)} · {lines} líneas · texto/{enc} (crudo)\n{'=' * 100}\n\n")
                buf.write(txt.strip() + "\n")
                if buf.tell() >= TEXT_BUDGET:
                    flush()

        rows.append({"lote": dest.name, "ruta": str(rel), "ext": ext, "tipo": kind,
                     "bytes": size, "lineas": lines or "", "caracteres": chars or "",
                     "nota": note, "sha1": digest[:12], "duplicado_de": dup_of})

        if drop_media and kind in ("imagen", "audio-video") and not dup_of:
            try:
                path.unlink()
            except OSError:
                pass
    flush()

    fields = ["lote", "ruta", "ext", "tipo", "bytes", "lineas", "caracteres", "nota", "sha1", "duplicado_de"]
    with (dest / "_MANIFEST.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    if bundles:
        (dest / "_BUNDLES.md").write_text(
            f"# Texto normalizado de `{dest.name}`\n\n" + "\n".join(f"- {b}" for b in bundles) + "\n",
            encoding="utf-8")
    return rows


def summarize(rows: list[dict]) -> dict:
    by_kind: dict[str, int] = {}
    by_ext: dict[str, int] = {}
    for r in rows:
        by_kind[r["tipo"]] = by_kind.get(r["tipo"], 0) + 1
        by_ext[r["ext"] or "(sin ext)"] = by_ext.get(r["ext"] or "(sin ext)", 0) + 1
    dups = [r for r in rows if r["duplicado_de"]]
    return {
        "archivos": len(rows), "bytes": sum(r["bytes"] for r in rows),
        "por_tipo": dict(sorted(by_kind.items(), key=lambda kv: -kv[1])),
        "por_ext": dict(sorted(by_ext.items(), key=lambda kv: -kv[1])[:25]),
        "duplicados": len(dups), "bytes_duplicados": sum(r["bytes"] for r in dups),
        "con_texto": sum(1 for r in rows if r["caracteres"]),
    }


def write_index(out: Path, index: dict) -> None:
    (out / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = ["# Índice maestro del corpus", ""]
    tf = tb = 0
    for slug, info in index.get("lotes", {}).items():
        s = info["resumen"]
        tf += s["archivos"]
        tb += s["bytes"]
        lines += [f"## `{slug}`",
                  f"- Origen: `{info.get('origen', '?')}` · ingerido {info.get('fecha', '?')}",
                  f"- {s['archivos']} archivos · {human(s['bytes'])} · {s['con_texto']} legibles · "
                  f"{s['duplicados']} duplicados ({human(s['bytes_duplicados'])})",
                  f"- Por tipo: " + ", ".join(f"{k}={v}" for k, v in s["por_tipo"].items()),
                  f"- Por extensión: " + ", ".join(f"`{k}`={v}" for k, v in list(s["por_ext"].items())[:12]),
                  f"- Texto: `{slug}/_text/` (ver `_BUNDLES.md`) · Manifiesto: `{slug}/_MANIFEST.csv`", ""]
    lines += ["---", f"**TOTAL: {tf} archivos · {human(tb)}** "
                     f"(límites de snapshot: ~{SOFT_FILE_CAP} archivos / ~{human(SOFT_BYTES_CAP)})"]
    (out / "INDEX.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def publish(out: Path, target: Path, max_mb: float) -> None:
    target.mkdir(parents=True, exist_ok=True)
    copied = skipped = 0
    budget = max_mb * 1024 * 1024
    for rel in ["INDEX.md", "index.json"]:
        if (out / rel).exists():
            shutil.copy2(out / rel, target / Path(rel).name)
            copied += 1
    for d in sorted(p for p in out.iterdir() if p.is_dir()):
        for rel in ["_MANIFEST.csv", "_BUNDLES.md"]:
            if (d / rel).exists():
                shutil.copy2(d / rel, target / f"{d.name}_{rel.lstrip('_')}")
                copied += 1
        bundle_dir = d / "_text"
        if bundle_dir.is_dir():
            for b in sorted(bundle_dir.glob("*.md")):
                size = b.stat().st_size
                if budget - size < 0:
                    skipped += 1
                    continue
                tgt = target / f"{d.name}--{b.name}"
                shutil.copy2(b, tgt)
                budget -= size
                copied += 1
    print(f"\n📦 Digest publicado en {target}: {copied} archivo(s)"
          + (f" · {skipped} bundle(s) omitidos por tamaño" if skipped else ""))


def footprint() -> tuple[int, int]:
    files = size = 0
    for p in ROOT.rglob("*"):
        if any(part in (".git", "node_modules") for part in p.parts):
            continue
        try:
            if p.is_file():
                files += 1
                size += p.stat().st_size
        except OSError:
            pass
    return files, size


# ----------------------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser(description="Ingesta por tandas de zips con conversaciones y adjuntos.")
    ap.add_argument("sources", nargs="*", help="zips, carpetas o archivos")
    ap.add_argument("--auto", action="store_true", help="tomar todo lo que haya en uploads/inbox/attachments")
    ap.add_argument("--inspect", action="store_true", help="solo inspeccionar, sin extraer (barato y rápido)")
    ap.add_argument("--report", action="store_true", help="mostrar el índice actual")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="carpeta de trabajo del corpus")
    ap.add_argument("--publish", default="", help="carpeta versionada donde copiar el digest")
    ap.add_argument("--publish-max-mb", type=float, default=40.0, help="tope de bundles a publicar")
    ap.add_argument("--remove-source", action="store_true", help="borrar el zip original tras procesarlo")
    ap.add_argument("--drop-media", action="store_true", help="descartar imágenes/AV tras ficharlas en el manifiesto")
    ap.add_argument("--max-depth", type=int, default=3, help="profundidad de comprimidos anidados")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    if args.report:
        idx = out / "INDEX.md"
        print(idx.read_text(encoding="utf-8") if idx.exists() else "El corpus está vacío todavía.")
        return 0

    sources = [Path(s) for s in args.sources]
    if args.auto:
        for d in WATCH_DIRS:
            if d.is_dir():
                sources += [p for p in sorted(d.rglob("*")) if p.is_file()]
    seen, unique = set(), []
    for s in sources:
        if s.exists() and str(s.resolve()) not in seen:
            seen.add(str(s.resolve()))
            unique.append(s)

    if not unique:
        print("No encontré nada para ingerir.")
        print("Busqué en: " + ", ".join(str(d) for d in WATCH_DIRS) + " y en las rutas que me pases.")
        return 1

    if args.inspect:
        print_inspection([tally_source(s) for s in unique])
        return 0

    index_path = out / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {"lotes": {}}

    hashes: dict[str, str] = {}
    for p in out.rglob("_MANIFEST.csv"):
        try:
            with p.open(encoding="utf-8") as fh:
                for r in csv.DictReader(fh):
                    if r.get("sha1") and not r.get("duplicado_de"):
                        hashes.setdefault(r["sha1"], r["ruta"])
        except Exception:
            pass

    grand: list[dict] = []
    for src in unique:
        try:
            dest = ingest_source(src, out)
            removed = unzip_nested(dest, args.max_depth)
            rows = process_dir(dest, hashes, args.drop_media)
            res = summarize(rows)
            index["lotes"][dest.name] = {
                "origen": str(src.resolve()),
                "fecha": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                "resumen": res, "archivos": rows}
            grand += rows
            print(f"   ✓ {res['archivos']} archivos · {human(res['bytes'])} · {res['con_texto']} legibles · "
                  f"{res['duplicados']} duplicados" + (f" · {removed} anidados desarmados" if removed else ""))
            if args.remove_source and src.is_file():
                src.unlink()
                print(f"   · original borrado: {src}")
        except Exception as exc:
            print(f"! error ingiriendo {src}: {type(exc).__name__}: {exc}")

    write_index(out, index)

    if grand:
        res = summarize(grand)
        print("\n" + "=" * 64)
        print(f"TANDA: {res['archivos']} archivos · {human(res['bytes'])} · {res['duplicados']} duplicados "
              f"({human(res['bytes_duplicados'])})")
        print("  " + ", ".join(f"{k}={v}" for k, v in res["por_tipo"].items()))
        print(f"  con texto extraído: {res['con_texto']} archivo(s) → bundles listos para leer")

    if args.publish:
        publish(out, Path(args.publish), args.publish_max_mb)

    files, size = footprint()
    print(f"\nWorkspace: {files} archivos · {human(size)}  "
          f"(holgura: {SOFT_FILE_CAP - files} archivos, {human(max(0, SOFT_BYTES_CAP - size))})")
    if files > SOFT_FILE_CAP or size > SOFT_BYTES_CAP:
        print("⚠️  Cerca o pasado el límite de snapshot: conviene podar (duplicados, media, anidados) o publicar y limpiar.")
    print(f"\nÍndice: {out}/INDEX.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
