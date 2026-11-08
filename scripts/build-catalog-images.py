"""Prepara las fotos referenciales de It. 8. Requiere Python, Pillow y curl.

Fuentes y licencias: docs/catalogo-imagenes.json. No descarga imágenes de marcas.
Ejecutar desde la raíz: python scripts/build-catalog-images.py
"""
import io
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = json.loads((ROOT / 'docs/catalogo-imagenes.json').read_text(encoding='utf-8'))


def prepare(photo):
    target = ROOT / 'assets/images' / f"{photo['id']}.jpg"
    if target.exists():
        return
    url = (f"https://images.pexels.com/photos/{photo['photo']}/"
           f"pexels-photo-{photo['photo']}.jpeg?auto=compress&cs=tinysrgb&w=1200")
    url = photo.get('download', url)
    data = subprocess.run(
        ['curl.exe', '--fail', '--location', '--silent', '--show-error',
         '--retry', '2', '--max-time', '30', url], check=True, capture_output=True,
    ).stdout
    original = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB')
    image = ImageOps.fit(original, (800, 800), method=Image.Resampling.LANCZOS)
    for quality in range(85, 19, -5):
        encoded = io.BytesIO()
        image.save(encoded, format='JPEG', quality=quality, optimize=True, progressive=True)
        if encoded.tell() < 80_000:
            target.write_bytes(encoded.getvalue())
            print(f"{photo['id']}: {encoded.tell()} bytes", flush=True)
            return
    raise ValueError(f"No se pudo comprimir {photo['id']} a menos de 80 KB")


if __name__ == '__main__':
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(prepare, PHOTOS))
