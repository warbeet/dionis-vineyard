# 📐 Модель данных Dionis vineyard v2

## Иерархия

```
Vineyard (виноградник, корневой объект)
└── Plot (участок) ──────── полигон GPS + матрица рядов
    ├── Block (блок-сорт)──── привой/подвой/дата посадки
    │   └── Seedling (куст) ─ позиция, статус, история, AI-данные
    └── Block ...
```

## Структура (TypeScript-style)

```typescript
interface Plot {
  id: string;
  name: string;                // "Северный участок"
  area_ha: number;             // расчётная площадь (га)
  
  // Геометрия
  polygon?: LatLng[];          // GPS-контур участка [{lat, lng}, ...]
  center?: LatLng;             // центр карты для фокуса
  
  // Сетка рядов (для матричного отображения)
  rows: Row[];                 // массив рядов с возможными пропусками
  
  // Технические параметры
  row_spacing_m: number;       // расстояние между рядами (2.5)
  vine_spacing_m: number;      // расстояние между кустами в ряду (1.0)
  orientation_deg?: number;    // ориентация рядов (Север-Юг = 0°)
  
  // Блоки — разные сорта на одном участке
  blocks: Block[];
  
  notes: string;
  created_at: string;
  updated_at: string;
}

interface Row {
  number: number;              // 1, 2, 3...
  length_m: number;            // длина ряда
  positions_count: number;     // сколько посадочных мест в ряду
  caskads?: number[];          // позиции с каскадом (двойной/тройной куст)
  gaps?: number[];             // позиции с пропуском (вынужденные)
}

interface Block {
  id: string;
  name: string;                // "Блок А (Каберне)"
  color: string;               // #6b8e5a — цвет на схеме
  
  // Сорт
  scion: string;               // ПРИВОЙ — "Каберне Совиньон"
  scion_clone?: string;        // "169" — клон
  rootstock: string;           // ПОДВОЙ — "Riparia Gloire de Montpellier"
  rootstock_clone?: string;
  
  // Посадка
  planting_year: number;       // 2018
  planting_date?: string;      // YYYY-MM-DD
  supplier: string;            // питомник-поставщик
  batch_number?: string;       // номер партии
  
  // Формировка
  training_system: string;     // "Гюйо двуплечий", "Кордон"
  
  // Зона: какие ряды/позиции входят в этот блок
  zone: ZoneRef[];             // [{row: 1, from: 1, to: 50}, ...]
  
  notes: string;
}

interface ZoneRef {
  row: number;                 // номер ряда
  from: number;                // позиция начала
  to: number;                  // позиция конца (включительно)
}

interface Seedling {
  id: string;                  // уникальный ID
  plot_id: string;
  block_id: string;
  
  // Локация
  row: number;                 // номер ряда
  position: number;            // позиция в ряду
  gps?: LatLng;                // точные GPS-координаты (опционально, для робота)
  
  // Статус
  status: VineStatus;
  status_changed_at?: string;
  status_reason?: string;      // "Признаки филлоксеры"
  
  // Технические данные
  is_replanted: boolean;       // подсаженный взамен погибшего
  replanted_date?: string;
  parent_seedling_id?: string; // предыдущий куст на этой позиции
  
  // AI-поля (заполняются роботом или вручную)
  ai_data?: {
    last_scan?: string;        // дата последнего скана робота
    height_cm?: number;        // высота куста
    shoots_count?: number;     // количество побегов
    leaves_count_est?: number; // оценка количества листьев
    canopy_density?: number;   // 0-1, плотность кроны
    vegetation_index?: number; // NDVI-аналог 0-1
    clusters_count?: number;   // количество гроздей (для прогноза урожая)
    cluster_size_avg_g?: number; // средний вес грозди
    yield_forecast_kg?: number;  // прогноз урожая с куста
    health_score?: number;     // 0-100 общая оценка здоровья от ИИ
    disease_signs?: string[];  // ["мильдю_подозрение", "хлороз_ранний"]
    confidence?: number;       // 0-1 уверенность ИИ
  };
  
  // История осмотров
  inspections: Inspection[];
  
  // Связи с другими сущностями
  photo_report_ids?: string[];
  treatment_ids?: string[];
  harvest_ids?: string[];
  
  created_at: string;
  updated_at: string;
}

enum VineStatus {
  PLANTED = 'planted',         // 🌱 Посажен (не плодоносит) — голубой
  HEALTHY = 'healthy',         // 🟢 Здоров — ярко-зелёный
  NORMAL = 'normal',           // 🟡 Норма — салатовый
  ATTENTION = 'attention',     // 🟠 Требует внимания — жёлтый
  SICK = 'sick',               // 🔴 Болеет — оранжевый
  DEAD = 'dead',               // ⚫ Погиб — красный/чёрный
  EMPTY = 'empty',             // ⚪ Пустая позиция (пропуск)
  CASCADE = 'cascade',         // 🟣 Каскад (двойной куст)
}

interface Inspection {
  id: string;
  date: string;
  type: 'manual' | 'robot' | 'photo';
  inspector: string;           // имя или 'robot-001'
  status_before: VineStatus;
  status_after: VineStatus;
  notes: string;
  photos?: string[];
  ai_data_snapshot?: any;      // снимок AI-полей на момент осмотра
}

interface LatLng {
  lat: number;
  lng: number;
}
```

## Цветовая палитра статусов (для карты)

| Статус | Цвет | HEX | Описание |
|---|---|---|---|
| 🌱 Posажен | Небесный | `#7CB9E8` | Молодой, не плодоносит |
| 🟢 Здоров | Ярко-зелёный | `#4CAF50` | Идеальное состояние |
| 🟡 Норма | Салатовый | `#A3C08F` | Без проблем |
| 🟠 Внимание | Жёлто-оранжевый | `#F39C12` | Лёгкие признаки |
| 🔴 Болеет | Оранжевый | `#E67E22` | Активные проблемы |
| ⚫ Погиб | Красно-чёрный | `#8B2020` | Куст мёртв |
| ⚪ Пусто | Светло-серый | `#D6DBCC` | Пропуск, не сажено |
| 🟣 Каскад | Фиолетовый | `#8E44AD` | Двойной/тройной куст |

## API для робота (будущее)

```
POST /api/vineyards/:id/robot-scan
Body: {
  "robot_id": "rover-001",
  "scan_date": "2026-06-16T10:30:00Z",
  "scans": [
    {
      "gps": {"lat": 46.482, "lng": 30.723},
      "seedling_id": "auto" | "s_xxx",  // или поиск ближайшего
      "ai_data": { ... }
    }
  ]
}

GET /api/vineyards/:id/route?date=2026-06-16
→ Возвращает оптимальный маршрут робота по межрядьям
```

## Миграция со старой структуры

Старая структура `plot` имела поля прямо на участке:
- variety, year, vines, rootstock, form

В новой версии они переезжают в `blocks[0]`, чтобы старые данные не потерялись.
