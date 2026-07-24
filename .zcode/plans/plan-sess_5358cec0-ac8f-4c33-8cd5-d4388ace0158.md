
# Feature: ⭐ Jugador del Partido (MVP — Most Valuable Player)

## Resumen
Añadir una característica de **"Jugador del Partido"** que calcula automáticamente el MVP basándose en las acciones registradas durante el evento. Cada acción (SportAction) tendrá un peso configurable (`mvpWeight`) que suma o resta a una base de 10. El jugador con mayor puntaje final se mostrará con una **estrella dorada** que contiene su foto y puntaje, posicionada al lado del nombre del equipo local, tanto en la **vista pública** como en la **tarjeta del evento en la lista privada**.

**Fórmula:** `Puntaje MVP = 10 + Σ(mvpWeight × cantidad_acciones)` → Clampeado a rango [1, 10]

---

## Capa 1: Base de Datos (Schema)

### `prisma/schema.prisma`
- **SportAction**: Añadir campo `mvpWeight Int @default(0)` — Peso MVP de la acción (positivo = suma, negativo = resta). Valores ejemplo: Gol = +2, Asistencia = +1, Amarilla = -1, Roja = -3.
- **No se necesita nuevo modelo ni campo en Event** — El MVP se calcula dinámicamente en el cliente a partir de las acciones ya incluidas en la respuesta.

---

## Capa 2: TypeScript Types

### `src/lib/store.ts`
- **SportAction interface**: Añadir `mvpWeight: number`

---

## Capa 3: API — SportAction CRUD

### `src/app/api/sports/[id]/actions/route.ts` (POST)
- Aceptar `mvpWeight` del body y pasarlo al `db.sportAction.create()`

### `src/app/api/sports/[id]/actions/[actionId]/route.ts` (PUT)
- Aceptar `mvpWeight` del body y pasarlo al `db.sportAction.update()`

---

## Capa 4: Admin UI — Configurar mvpWeight

### `src/components/admin/sports-panel.tsx`
- **ActionFormData**: Añadir `mvpWeight: number`
- **EMPTY_ACTION**: Añadir `mvpWeight: 0`
- **ActionModal**: Añadir campo de formulario "Peso MVP" (number input, min -10, max +10) con label descriptivo y hint que explique: "Puntos que suma (+) o resta (-) al puntaje MVP del jugador. Base: 10."
- **SportItem** (lista expandida): Mostrar el valor `mvpWeight` junto a `defaultValue` en cada acción

---

## Capa 5: Lógica de Cálculo MVP (nueva utilidad)

### `src/lib/mvp-utils.ts` (nuevo archivo)
Exportar función `calculateMVP()`:
```
Input: actions: EventAction[], sportActions: SportAction[]
Output: { playerId, playerName, playerNumber, playerPhoto, teamId, score (1-10) } | null
```
Algoritmo:
1. Construir mapa `actionType → mvpWeight` desde `sportActions`
2. Para cada EventAction con playerId ≠ null, sumar `mvpWeight × value` al acumulado del jugador
3. Aplicar base: `puntajeFinal = clamp(10 + acumulado, 1, 10)`
4. Retornar el jugador con mayor puntaje (null si no hay acciones con jugador)

---

## Capa 6: Vista Pública — EventCard con estrella MVP

### `src/components/public/public-view.tsx`
- **Importar** `Star` de lucide-react y `calculateMVP` de `@/lib/mvp-utils`
- **EventCard** (líneas ~693-724): 
  - Calcular MVP con `calculateMVP(event.actions, sportActions)` — se pasará `sportActions` como prop o se cacheará a nivel de `PublicView`
  - Al lado del nombre del **equipo local** (teamA), añadir un badge de estrella:
    ```
    [Nombre Equipo A] ⭐[Foto jugador][8.5]
    ```
  - La estrella será un pequeño badge circular (≈28px) con:
    - Fondo dorado (`#fbbf24` o `#f59e0b`)
    - Mini foto del jugador (Avatar, 20px) o initials si no hay foto
    - Puntaje numérico debajo
  - Solo se muestra si el evento está **LIVE** o **FINALIZADO** y hay un MVP calculado
  - Tooltip con nombre completo del jugador

- **PublicView**: Añadir `sportActions` al estado, fetchear desde `GET /api/sports?all=true` (ya existe en la app), pasar como prop a cada `EventCard`

---

## Capa 7: Vista Privada — EventListView con estrella MVP

### `src/components/events/event-list-view.tsx`
- **Importar** `Star` de lucide-react y `calculateMVP` de `@/lib/mvp-utils`
- **EventCard** (tarjetas): Añadir estrella MVP al lado del nombre del equipo local, mismo diseño que vista pública
- **EventTableRow** (tabla desktop): Añadir estrella MVP en la celda del equipo local
- **EventListView**: 
  - Añadir `sportActions` al estado (fetch desde `GET /api/sports?all=true`)
  - Pasar `sportActions` como prop a `EventCard` y `EventTableRow`
  - Necesario incluir `actions` en la query de `GET /api/events` (actualmente NO las incluye — solo la pública sí)

### `src/app/api/events/route.ts` (GET)
- Añadir `actions` al `include` con `player` select básico (id, name, number, nickname, teamId), para permitir cálculo MVP en la lista privada

---

## Archivos a modificar (resumen)

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | + campo `mvpWeight` en SportAction |
| `src/lib/store.ts` | + `mvpWeight` en interface SportAction |
| `src/lib/mvp-utils.ts` | **NUEVO** — función `calculateMVP()` |
| `src/app/api/sports/[id]/actions/route.ts` | + `mvpWeight` en POST |
| `src/app/api/sports/[id]/actions/[actionId]/route.ts` | + `mvpWeight` en PUT |
| `src/components/admin/sports-panel.tsx` | + campo mvpWeight en formulario y display |
| `src/app/api/events/route.ts` | + `actions` include en GET list |
| `src/components/events/event-list-view.tsx` | + estrella MVP en EventCard + EventTableRow |
| `src/components/public/public-view.tsx` | + estrella MVP en EventCard |

---

## Notas
- **No requiere migración compleja** — Solo se añade un campo con default 0 a SportAction existente (`prisma db push` es suficiente)
- **Cálculo 100% cliente** — No se almacena el MVP en la BD; se recalcula en tiempo real desde las acciones. Esto evita inconsistencias si se editan acciones.
- **Rendimiento**: La función `calculateMVP` es O(n) sobre las acciones del evento (típicamente <100 por partido). El `GET /api/events` privado necesitará incluir actions — se optimizará con select mínimo (id, playerId, actionType, value).
- ** Compatible con temas** (flashscore-dark, light, green-field) — usa variables CSS existentes.
