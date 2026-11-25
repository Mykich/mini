"""
Генерує frontend/services.js з єдиного джерела цін catalog/prices.json.

    python tools/build_services.py          # перезаписати services.js
    python tools/build_services.py --check  # лише перевірити, що services.js актуальний (exit 1, якщо ні)

Ціни змінюються ТІЛЬКИ в catalog/prices.json. services.js руками не редагувати.
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRICES = os.path.join(ROOT, "catalog", "prices.json")
SERVICES_JS = os.path.join(ROOT, "frontend", "services.js")


def build() -> str:
    with open(PRICES, encoding="utf-8") as f:
        data = json.load(f)
    lines = [
        "// ======================================",
        "// Pralnya Vdoma — каталог послуг",
        f"// ЗГЕНЕРОВАНО з catalog/prices.json (версія {data['version']}).",
        "// Не редагуйте вручну: змініть prices.json і запустіть python tools/build_services.py",
        "// ======================================",
        "",
        "const servicesData = {",
    ]
    sections = [s["key"] for s in data["sections"]]
    for si, key in enumerate(sections):
        items = [i for i in data["items"] if i["section"] == key]
        lines.append(f"    {key}: [")
        for ii, item in enumerate(items):
            fields = [
                f"id: {item['id']}",
                f"name: {json.dumps(item['name'], ensure_ascii=False)}",
                f"description: {json.dumps(item['description'], ensure_ascii=False)}",
                f"price: {item['price']}",
                f"unit: {json.dumps(item['unit'], ensure_ascii=False)}",
                f"category: {json.dumps(key)}",
            ]
            if item.get("image"):
                fields.append(f"image: {json.dumps(item['image'], ensure_ascii=False)}")
            body = ",\n".join("            " + f for f in fields)
            comma = "," if ii < len(items) - 1 else ""
            lines.append("        {\n" + body + "\n        }" + comma)
        lines.append("    ]" + ("," if si < len(sections) - 1 else ""))
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def main():
    text = build()
    if "--check" in sys.argv:
        with open(SERVICES_JS, encoding="utf-8") as f:
            current = f.read()
        if current != text:
            print("❌ frontend/services.js не збігається з catalog/prices.json. Запустіть: python tools/build_services.py")
            sys.exit(1)
        print("✅ services.js збігається з prices.json")
        return
    with open(SERVICES_JS, "w", encoding="utf-8") as f:
        f.write(text)
    print("✅ services.js згенеровано з prices.json")


if __name__ == "__main__":
    main()
