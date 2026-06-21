# 🍇 Dionis vineyard

Smart-PWA для управления коммерческим виноградником.

**🔒 Это приватный репозиторий исходников.**
**🌐 Публичный сайт:** https://warbeet.github.io/dionis-vineyard/

## Архитектура

```
🔒 warbeet/dionis-vineyard-src   ← вы здесь (исходники)
        │ git push main
        ▼
🤖 GitHub Actions (.github/workflows/deploy.yml)
        │
        ▼
🌍 warbeet/dionis-vineyard       ← публичный
        │
        ▼
🌐 https://warbeet.github.io/dionis-vineyard/
```

## Деплой

Автоматический при `git push origin main`:
1. Workflow `deploy.yml` срабатывает
2. Копирует файлы в публичный репо `warbeet/dionis-vineyard`
3. GitHub Pages обновляет сайт за 30-60 секунд

## Локальная разработка

```bash
# Запуск локального сервера
python3 -m http.server 8000
# Открыть http://localhost:8000
```

## Версионирование

SemVer (см. `version.json`):
- **patch** (+0.0.1) — багфикс
- **minor** (+0.1.0) — новый функционал
- **major** (+1.0.0) — стабильный production

Обновление версии:
```bash
python3 scripts/bump-version.py patch "Описание" "Изменение 1" "Изменение 2"
```

## Секреты

В GitHub Settings → Secrets:
- `DEPLOY_TOKEN` — Personal Access Token с правами `repo` для публичного репо

## Структура

```
├── index.html              ← главный HTML
├── manifest.json           ← PWA-манифест
├── sw.js                   ← Service Worker
├── version.json            ← версия + changelog
├── assets/                 ← логотипы
├── icons/                  ← иконки PWA
├── css/                    ← модули стилей
├── js/                     ← модули JS (24 модуля)
├── sections/               ← HTML-фрагменты разделов
├── scripts/                ← bump-version.py
└── .github/workflows/      ← GitHub Actions
```

## Лицензия

Приватный проект. Все права защищены.
