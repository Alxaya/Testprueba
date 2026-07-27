"""Tests de integridad del repositorio.

Verifican que lo que hay en disco es lo que llega a un clon limpio. Los tests
normales pasan sobre el árbol de trabajo local, así que **no detectan** que un
fichero se haya quedado fuera del repositorio: el código está ahí, simplemente
no se ha subido.

Regresión concreta que motivó este fichero: la regla `data/` del `.gitignore`
coincide con cualquier directorio llamado así a cualquier profundidad, y se
tragó `bot/data/` (el paquete de proveedores de velas) entero. La suite pasaba
al 100 % y un clon limpio no arrancaba.
"""

from __future__ import annotations

import importlib
import pkgutil
import subprocess
from pathlib import Path

import pytest

import bot

REPO_ROOT = Path(__file__).resolve().parent.parent


def _git(*args: str) -> str | None:
    """Ejecuta git en el repositorio, o `None` si no hay git disponible."""
    try:
        result = subprocess.run(
            ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, timeout=30, check=False
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stdout if result.returncode == 0 else None


def test_every_source_file_reaches_a_clean_clone() -> None:
    """Ningún `.py` del paquete puede estar excluido del repositorio."""
    if _git("rev-parse", "--git-dir") is None:
        pytest.skip("no es un repositorio git (instalación desde tarball)")

    sources = sorted(
        p for p in (REPO_ROOT / "bot").rglob("*.py") if "__pycache__" not in p.parts
    )
    assert sources, "no se encontró código fuente; ¿ruta equivocada?"

    # `--no-index` es imprescindible: sin él, git check-ignore calla sobre los
    # ficheros ya rastreados, y el test solo detectaría el problema en ficheros
    # nuevos. Queremos que salte también si la regla existe desde hace meses.
    ignored = _git("check-ignore", "--no-index", *(str(p) for p in sources)) or ""
    excluded = [line.strip() for line in ignored.splitlines() if line.strip()]

    assert not excluded, (
        "Estos ficheros del paquete están excluidos por .gitignore y NO llegarían "
        "a un clon limpio:\n  " + "\n  ".join(excluded)
    )


def test_all_modules_import() -> None:
    """Todo módulo del paquete debe importarse sin efectos secundarios sorpresa.

    Detecta `__init__.py` que falten, imports circulares y dependencias que solo
    existen en la máquina de quien lo escribió.
    """
    failures: list[str] = []
    for module in pkgutil.walk_packages(bot.__path__, prefix="bot."):
        if module.name.endswith(".__main__"):
            continue  # ejecutaría el CLI al importarlo
        try:
            importlib.import_module(module.name)
        except Exception as exc:
            failures.append(f"{module.name}: {type(exc).__name__}: {exc}")

    assert not failures, "Módulos que no importan:\n  " + "\n  ".join(failures)


def test_config_example_is_tracked_but_real_config_is_not() -> None:
    """La plantilla se versiona; la configuración real (con tus ajustes) no."""
    if _git("rev-parse", "--git-dir") is None:
        pytest.skip("no es un repositorio git")

    assert (REPO_ROOT / "config" / "config.example.yaml").is_file()
    assert _git("check-ignore", "config/config.yaml") is not None, (
        "config/config.yaml debe estar en .gitignore: puede contener ajustes propios"
    )
    assert _git("check-ignore", ".env") is not None, ".env NUNCA debe subirse"
