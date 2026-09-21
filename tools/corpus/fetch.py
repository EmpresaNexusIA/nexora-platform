#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch.py — Trae material desde GitHub y lo ingestta automáticamente.

El sandbox tiene internet con lista blanca: solo pasan github.com, api.github.com,
codeload.github.com y pypi.org. Dropbox, Drive, WeTransfer, Mega y los "drop boxes"
están bloqueados, igual que raw.githubusercontent.com y los assets de Releases
(redirigen a hosts bloqueados). Por eso la vía que funciona es: los archivos
DENTRO de un repositorio, y bajar el repo entero como zip.

Uso:
  python3 fetch.py owner/repo                      # rama por defecto
  python3 fetch.py owner/repo --branch intake      # una rama puntual
  python3 fetch.py owner/repo --path intake/lote1  # solo una carpeta
  python3 fetch.py owner/repo --list               # listar ramas y archivos, sin bajar nada
  python3 fetch.py owner/repo --inspect            # informe de lo que trae, sin ingerir

Funciona con repos públicos (sin token) y con los privados donde la app tenga acceso
(usa GH_TOKEN del entorno).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
INGEST = HERE / "ingest.py"
TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
API = "https://api.github.com"


def api_get(path: str, accept: str = "application/vnd.github+json"):
    req = urllib.request.Request(API + path, headers={
        "Accept": accept,
        "User-Agent": "arena-corpus-fetch",
        **({"Authorization": f"token {TOKEN}"} if TOKEN else {}),
    })
    return urllib.request.urlopen(req, timeout=60)


def api_json(path: str, default=None):
    try:
        with api_get(path) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except Exception as exc:
        print(f"   ! API {path}: {type(exc).__name__}: {exc}")
        return default


def human(n: float) -> str:
    n = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f}{unit}" if unit == "B" else f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}GB"


def resolve_branch(repo: str, branch: str) -> str:
    if branch:
        return branch
    info = api_json(f"/repos/{repo}", {}) or {}
    return info.get("default_branch") or "main"


def download_archive(repo: str, branch: str, dest: Path) -> Path:
    """Baja el zip del repo. Intenta API (funciona en privados) y si no, codeload."""
    headers = {"User-Agent": "arena-corpus-fetch"}
    if TOKEN:
        headers["Authorization"] = f"token {TOKEN}"
    attempts = [
        (f"{API}/repos/{repo}/zipball/{branch}", "api.github.com (zipball)"),
        (f"https://codeload.github.com/{repo}/zip/refs/heads/{branch}", "codeload.github.com"),
    ]
    for url, label in attempts:
        try:
            print(f"   ↓ bajando vía {label} …")
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=300) as r, dest.open("wb") as out:
                shutil.copyfileobj(r, out, 1 << 20)
            if dest.stat().st_size > 0 and zipfile.is_zipfile(dest):
                print(f"   ✓ {human(dest.stat().st_size)}")
                return dest
            print("   ! lo bajado no es un zip válido, pruebo la otra vía")
        except Exception as exc:
            print(f"   ! falló vía {label}: {type(exc).__name__}: {exc}")
    raise SystemExit(f"No pude bajar el archivo de {repo}@{branch}.")


def list_repo(repo: str, branch: str) -> None:
    info = api_json(f"/repos/{repo}", {}) or {}
    if not info:
        print("No pude leer el repo (¿es privado y sin permisos, o no existe?).")
        return
    print(f"\n📦 {repo}  ({info.get('visibility', '?')})  · rama por defecto: {info.get('default_branch', '?')}")
    print(f"   tamaño: {human(info.get('size', 0) * 1024)}")
    if info.get("description"):
        print(f"   {info['description']}")
    branches = api_json(f"/repos/{repo}/branches", []) or []
    if branches:
        print("   ramas: " + ", ".join(b["name"] for b in branches[:25]))
    target = branch or info.get("default_branch") or "main"
    tree = api_json(f"/repos/{repo}/git/trees/{target}?recursive=1", {}) or {}
    entries = [e for e in tree.get("tree", []) if e.get("type") == "blob"]
    if not entries:
        print(f"   (no pude listar archivos de '{target}')")
        return
    print(f"\n   {len(entries)} archivos en '{target}':")
    for e in sorted(entries, key=lambda x: -x.get("size", 0))[:25]:
        print(f"     · {human(e.get('size', 0)):>9}  {e['path']}")
    if tree.get("truncated"):
        print("   (listado truncado por tamaño)")


def main() -> int:
    ap = argparse.ArgumentParser(description="Baja un repo de GitHub y lo ingestta.")
    ap.add_argument("repo", help="owner/repo")
    ap.add_argument("--branch", default="", help="rama (por defecto: la del repo)")
    ap.add_argument("--path", default="", help="subcarpeta a ingerir (opcional)")
    ap.add_argument("--list", action="store_true", help="listar ramas/archivos y salir")
    ap.add_argument("--inspect", action="store_true", help="informe sin ingerir")
    ap.add_argument("--out", default="/home/user/corpus")
    ap.add_argument("--publish", default="")
    ap.add_argument("--drop-media", action="store_true")
    ap.add_argument("--keep", action="store_true", help="no borrar el temporal")
    args = ap.parse_args()

    repo = args.repo.strip().rstrip("/")
    if repo.startswith("https://github.com/"):
        repo = repo[len("https://github.com/"):]
    if repo.endswith(".git"):
        repo = repo[:-4]

    if args.list:
        list_repo(repo, args.branch)
        return 0

    tmp = Path(tempfile.mkdtemp(prefix="ghfetch-"))
    try:
        print(f"\n▶ {repo}" + (f" @ {args.branch}" if args.branch else ""))
        branch = resolve_branch(repo, args.branch)
        print(f"   rama: {branch}")
        archive = download_archive(repo, branch, tmp / "repo.zip")

        extract = tmp / "src"
        extract.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive) as zf:
            roots = {n.split("/")[0] for n in zf.namelist() if "/" in n}
            zf.extractall(extract)
        # GitHub mete todo dentro de una carpeta raíz tipo "owner-repo-sha/"
        base = extract / roots.pop() if len(roots) == 1 else extract
        target = (base / args.path) if args.path else base
        if not target.exists():
            print(f"   ! no existe la ruta '{args.path}' dentro del repo")
            return 1

        cmd = [sys.executable, str(INGEST), str(target), "--out", args.out]
        if args.inspect:
            cmd.append("--inspect")
        if args.publish:
            cmd += ["--publish", args.publish]
        if args.drop_media:
            cmd.append("--drop-media")
        return subprocess.call(cmd)
    finally:
        if not args.keep:
            shutil.rmtree(tmp, ignore_errors=True)
        else:
            print(f"   (temporal conservado en {tmp})")


if __name__ == "__main__":
    sys.exit(main())
