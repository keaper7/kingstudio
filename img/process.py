"""
Обработка фото из инстаграма под слоты сайта.
Пред-кроп -> кроп по пропорции -> ресайз в 400/800/1600 -> WebP.
Список источников и параметры кропа — в manifest.py.
"""
import json
from PIL import Image, ImageOps, ImageFilter
from pathlib import Path
from manifest import SHOTS

BASE = Path(__file__).parent
WIDTHS = [400, 800, 1600]


def crop_to_ratio(im, ratio, offset):
    w, h = im.size
    cur = w / h
    if cur > ratio:                      # шире нужного — режем по бокам
        new_w = int(round(h * ratio))
        x0 = (w - new_w) // 2
        return im.crop((x0, 0, x0 + new_w, h))
    if cur < ratio:                      # выше нужного — режем сверху/снизу
        new_h = int(round(w / ratio))
        y0 = int(round((h - new_h) * offset))
        y0 = max(0, min(y0, h - new_h))
        return im.crop((0, y0, w, y0 + new_h))
    return im


def resolve(src):
    """Источник можно задавать маской: 'raw/*DU-wV4wDY1Q_0.jpg'.

    Выгрузка называет файлы по своему шаблону (профиль_дата_шорткод_N),
    и угадывать префикс заранее — лишний повод сломать прогон. Шорткод
    поста и номер слайда однозначны, остального знать не нужно.
    """
    if "*" not in src:
        return BASE / src
    hits = sorted(BASE.glob(src))
    if not hits:
        raise FileNotFoundError(src)
    return hits[0]


def process(name, src, ratio, offset, pre):
    im = ImageOps.exif_transpose(Image.open(resolve(src)).convert("RGB"))
    if pre:
        w, h = im.size
        x0, y0, x1, y1 = pre
        im = im.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))
    im = crop_to_ratio(im, ratio, offset)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=2))

    # к стандартным ширинам добавляем родную ширину источника: у сторис это
    # 750 или 763 px, и без неё в srcset остаётся только 400 — заметно мылит
    # на ретине, хотя пиксели в исходнике есть
    cands = {w for w in WIDTHS if w <= im.width} | {min(im.width, WIDTHS[-1])}

    written = []
    for w in sorted(cands):
        h = max(1, round(w / ratio))
        im.resize((w, h), Image.LANCZOS).save(
            BASE / f"{name}-{w}.webp", "WEBP", quality=82, method=6)
        written.append(w)
    return written


if __name__ == "__main__":
    made = {}
    for name, src, ratio, offset, pre in SHOTS:
        try:
            ws = process(name, src, ratio, offset, pre)
            made[name] = {"w": ws, "r": round(ratio, 4)}
            print(f"{name:9} {'/'.join(map(str, ws))}")
        except FileNotFoundError:
            print(f"{name:9} НЕТ ФАЙЛА: {src}")

    # Максимальная ширина у слотов разная: она упирается в размер исходника
    # после кропа (у 4:3 из 1440×960 это 1280, а не 1440). Держать список
    # ширин в JS руками — гарантированный источник битых srcset, поэтому
    # пайплайн сам пишет, что произвёл.
    js = "window.KS_SHOTS = " + json.dumps(made, separators=(",", ":")) + ";\n"
    (BASE / "shots.js").write_text(js, encoding="utf-8")
    print(f"\nshots.js: {len(made)} слотов")
