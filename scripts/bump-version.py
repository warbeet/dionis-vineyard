#!/usr/bin/env python3
"""
🚀 Скрипт обновления версии Dionis vineyard (SemVer)

Схема MAJOR.MINOR.PATCH:
  major (X.0.0)  → +1 в major (например, 0.5.3 → 1.0.0). Стабильный production.
  minor (0.X.0)  → +1 в minor, patch=0 (0.5.3 → 0.6.0). Новые функции.
  patch (0.0.X)  → +1 в patch (0.5.3 → 0.5.4). Багфиксы, мелочи.

Использование:
    python3 scripts/bump-version.py minor "Канбан в плане" "Drag&drop" "Назначение"
    python3 scripts/bump-version.py patch "Багфикс UI" "Поправил отступы"
    python3 scripts/bump-version.py major "Стабильный релиз" "v1.0 production"
"""

import json
import sys
import re
import os
from datetime import date

def usage():
    print(__doc__)
    sys.exit(1)

if len(sys.argv) < 3:
    usage()

bump_type = sys.argv[1].lower()
title = sys.argv[2]
changes = sys.argv[3:] if len(sys.argv) > 3 else []

if bump_type not in ('major', 'minor', 'patch'):
    print(f'❌ Неизвестный тип: {bump_type}')
    usage()

# Корень проекта
script_dir = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(script_dir)
os.chdir(root)

# Загружаем текущую версию
with open('version.json') as f:
    data = json.load(f)

current = data['version']
# SemVer: MAJOR.MINOR.PATCH
parts = current.split('.')
if len(parts) != 3:
    print(f'⚠️  Версия "{current}" не SemVer. Конвертирую в 0.{current.replace(".","")}.0')
    if len(parts) == 2:
        major, minor_old = int(parts[0]), int(parts[1])
        major, minor, patch = 0, minor_old // 10 if minor_old >= 10 else minor_old, 0
    else:
        major, minor, patch = 0, 1, 0
else:
    major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])

if bump_type == 'major':
    major += 1
    minor = 0
    patch = 0
elif bump_type == 'minor':
    minor += 1
    patch = 0
elif bump_type == 'patch':
    patch += 1

new_version = f'{major}.{minor}.{patch}'
today = date.today().isoformat()

print(f'📦 Bumping {bump_type}: v{current} → v{new_version}')
print(f'📅 Date: {today}')
print(f'📝 Title: {title}')
print(f'📋 Changes ({len(changes)}):')
for ch in changes:
    print(f'   • {ch}')

# Обновляем version.json
new_release = {
    'version': new_version,
    'date': today,
    'type': bump_type,
    'title': title,
    'changes': changes
}
data['version'] = new_version
data['release_date'] = today
data['changelog'].insert(0, new_release)

with open('version.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print(f'✓ version.json обновлён')

# Обновляем data.js
with open('js/data.js') as f:
    js = f.read()
js = re.sub(r"const APP_VERSION = '[^']+';", f"const APP_VERSION = '{new_version}';", js)
js = re.sub(r"const APP_VERSION_DATE = '[^']+';", f"const APP_VERSION_DATE = '{today}';", js)
with open('js/data.js', 'w') as f:
    f.write(js)
print(f'✓ js/data.js обновлён')

# Обновляем sw.js
with open('sw.js') as f:
    sw = f.read()
sw = re.sub(r"const CACHE_NAME = '[^']+';", f"const CACHE_NAME = 'dionis-v{new_version}';", sw)
sw = re.sub(r"const RUNTIME_CACHE = '[^']+';", f"const RUNTIME_CACHE = 'dionis-runtime-v{new_version}';", sw)
with open('sw.js', 'w') as f:
    f.write(sw)
print(f'✓ sw.js → dionis-v{new_version}')

# Обновляем manifest.json
with open('manifest.json') as f:
    m = json.load(f)
m['version'] = new_version
with open('manifest.json', 'w', encoding='utf-8') as f:
    json.dump(m, f, indent=2, ensure_ascii=False)
print(f'✓ manifest.json обновлён')

# Обновляем бейджи в index.html
with open('index.html') as f:
    html = f.read()
html = re.sub(
    r'<span id="version-badge" class="version-badge">v[\d.]+</span>',
    f'<span id="version-badge" class="version-badge">v{new_version}</span>',
    html
)
html = re.sub(r'<span class="auth-version">[\d.]+</span>', f'<span class="auth-version">{new_version}</span>', html)
with open('index.html', 'w') as f:
    f.write(html)
print(f'✓ index.html обновлён')

print(f'\n🎉 Готово! Версия теперь v{new_version}')
print(f'\n📋 Следующие шаги:')
print(f'   git add -A && git commit -m "🔖 v{new_version}: {title}" && git push')
