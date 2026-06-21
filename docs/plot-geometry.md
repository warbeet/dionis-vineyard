# 📐 Модель геометрии участка v3

## Структура `plot`

```typescript
interface Plot {
  id: string;
  name: string;
  area_ha: number;
  notes: string;

  // ============ ГЕОМЕТРИЯ ============
  geometry: {
    orientation: 'NS' | 'EW' | 'custom';   // С-Ю, В-З, произвольный
    azimuth_deg: number;                    // 0-359° (0=С, 90=В, 180=Ю, 270=З)
    anchor_point?: LatLng;                  // GPS точки "Ряд1,Поз1"
    slope_deg: number;                      // 0-45° уклон участка
    exposure: 'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW'|'flat';  // экспозиция склона
    polygon?: LatLng[];                     // полигон участка (для карты)
  };

  // ============ АГРОТЕХНИКА ============
  agronomy: {
    row_spacing_m: number;                  // расстояние между рядами
    vine_spacing_m: number;                 // расстояние между кустами
    trellis_type: 'vertical' | 'v_shape' | 't_shape' | 'lyre' | 'pergola' | 'none';
    trellis_height_m: number;
    support_type: 'concrete' | 'metal' | 'wood' | 'mixed' | 'none';
    soil_type: 'chernozem' | 'sand' | 'clay' | 'loam' | 'stony' | 'calcareous' | 'peat' | 'mixed';
    drainage: 'natural' | 'artificial' | 'none';
    irrigation: 'drip' | 'sprinkler' | 'flood' | 'none';
  };

  // ============ РЯДЫ ============
  rows: Row[];
  row_groups?: RowGroup[];     // террасы/секции (опционально)

  // ============ БЛОКИ-СОРТА ============
  blocks: Block[];
}

interface RowGroup {
  id: string;
  name: string;                // "Верхняя терраса", "Северный сектор"
  color?: string;
  row_ids: string[];           // какие ряды входят в группу
}

interface Row {
  id: string;                  // уникальный ID для редактирования
  number: number | string;     // 1, 2, 3... или "A1", "A2", "Б3"
  name?: string;               // опц. человеческое имя ("Северный край")
  group_id?: string;           // привязка к группе рядов

  // Геометрия
  positions_count: number;     // сколько посадочных мест
  start_position: number;      // с какой позиции начинается (по умолчанию 1)
  length_m?: number;           // авто = positions_count * vine_spacing
  start_gps?: LatLng;          // GPS точки начала ряда (опц.)
  end_gps?: LatLng;            // GPS точки конца ряда (опц.)
  azimuth_deg?: number;        // если ряд имеет свой угол (отличный от участка)

  // Пропуски и каскады
  gaps: Gap[];
  cascades: Cascade[];

  // Опоры (концы ряда)
  start_anchor?: 'concrete' | 'metal' | 'wood' | 'none';
  end_anchor?: 'concrete' | 'metal' | 'wood' | 'none';

  notes?: string;
}

interface Gap {
  position: number;            // на какой позиции пропуск
  length: number;              // сколько позиций (1, 2, 3+)
  reason: 'road' | 'pole' | 'tree' | 'rock' | 'drainage' | 'water' | 'building' | 'planned' | 'unknown';
  notes?: string;
}

interface Cascade {
  position: number;            // на какой позиции каскад
  type: 'pair' | 'triple' | 'quad' | 'custom';   // 2 / 3 / 4 / N кустов
  vines_count: number;         // сколько кустов в каскаде (по умолчанию 2)
  layout?: 'geneva' | 'lyre' | 'parallel' | 'fan';
  notes?: string;
}

interface LatLng { lat: number; lng: number; }
```

## Алгоритм генерации саженцев из rows

```
для каждого row в plot.rows:
  для pos от row.start_position до row.start_position + row.positions_count - 1:
    skip = есть ли gap с position <= pos < position+length?
    если skip → создаём seedling со статусом 'empty'
    иначе:
      cascade = есть ли cascade на этой позиции?
      если cascade:
        для i от 0 до cascade.vines_count - 1:
          создаём seedling со статусом 'cascade'
      иначе:
        создаём обычный seedling со статусом 'normal'
```

## Алгоритм размещения на карте

Если есть `geometry.anchor_point` + `azimuth_deg`:
1. От anchor_point по азимуту откладываем `row_spacing` × (row_number - 1) → начало ряда
2. От начала ряда по перпендикуляру к азимуту откладываем `vine_spacing` × (position - 1) → координата куста
3. Применяем уклон если нужно (3D в перспективе)

## Нумерация рядов

```
'numbers'  → 1, 2, 3, 4, 5...
'alpha'    → А, Б, В, Г... (после Я → АА, АБ...)
'alpha_block' → A1, A2, B1, B2 (с привязкой к row_groups)
```

## UI

3 вкладки редактора:
- **📋 Таблица** — табличный редактор всех рядов
- **🪄 Мастер** — быстрое создание сетки + клик по схеме для правок
- **{ } JSON** — экспорт/импорт всей структуры
