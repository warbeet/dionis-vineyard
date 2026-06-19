#!/usr/bin/env python3
"""
🚀 Скрипт обновления версии Dionis vineyard

Использование:
    python3 scripts/bump-version.py minor "Название релиза" "Изменение 1" "Изменение 2" ...
    python3 scripts/bump-version.py patch "Багфикс UI" "Поправил отступы в шапке"
    python3 scripts/bump-version.py major "Полная переработка" "v1.0 — стабильный релиз"

Типы:
    major  → +1.00  (например, 0.50 → 1.50)
    minor  → +0.10  (например, 0.50 → 0.60)
    patch  → +0.01  (например, 0.50 → 0.51)
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

# Найдём корень проекта (где version.json)
script_dir = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(script_dir)
os.chdir(root)

# Загружаем текущую версию
with open('version.json') as f:
    data = json.load(f)

current = data['version']
parts = current.split('.')
major = int(parts[0])
minor = int(parts[1])

if bump_type == 'major':
    major += 1
    minor = 10  # сбрасываем минор на 10 (X.10)
elif bump_type == 'minor':
    # 0.50 → 0.60. Шаг +10 в minor (поскольку минор — двузначный)
    minor_tens = (minor // 10) + 1
    minor = minor_tens * 10
elif bump_type == 'patch':
    minor += 1

new_version = f'{major}.{minor:02d}'
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
print(f'✓ sw.js обновлён до dionis-v{new_version}')

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
print(f'   git add -A')
print(f'   git commit -m "🔖 v{new_version}: {title}"')
print(f'   git push')
