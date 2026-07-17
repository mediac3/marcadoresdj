# Contribuir a MarcadoresDJ

¡Gracias por tu interés en contribuir! 🎉

## 🚀 Cómo empezar

1. **Haz fork** del repositorio a tu cuenta de GitHub.
2. **Clona** tu fork localmente:
   ```bash
   git clone https://github.com/mediac3/marcadoresdj.git
   cd marcadoresdj
   ```
3. **Agrega el upstream** para mantener sincronizado tu fork:
   ```bash
   git remote add upstream https://github.com/USUARIO_ORIGINAL/marcadoresdj.git
   ```
4. **Instala dependencias**:
   ```bash
   bun install
   ```
5. **Configura entorno**:
   ```bash
   cp .env.example .env
   bun run db:push
   bunx prisma db seed
   ```
6. **Inicia el dev server**:
   ```bash
   bun run dev
   ```

## 🔄 Flujo de trabajo

1. Crea una rama desde `main`:
   ```bash
   git checkout -b feature/mi-feature
   ```
2. Haz tus cambios siguiendo las convenciones (ver abajo).
3. Verifica que todo pasa:
   ```bash
   bun run lint
   bun run build
   ```
4. Commitea con mensajes siguiendo [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: agrega exportación CSV de eventos
   fix: corrige cálculo de tiempo en segundo tiempo
   docs: actualiza README con sección de Docker
   ```
5. Push a tu fork:
   ```bash
   git push origin feature/mi-feature
   ```
6. Abre un Pull Request hacia `main` del repo original.

## 📜 Convención de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

| Tipo     | Uso                                              |
| -------- | ------------------------------------------------ |
| `feat`   | Nueva funcionalidad                              |
| `fix`    | Corrección de bug                                |
| `docs`   | Solo documentación                               |
| `style`  | Formato, espacios, comas (sin cambio de lógica) |
| `refactor` | Refactor sin cambio de comportamiento         |
| `perf`   | Mejora de performance                            |
| `test`   | Agrega o corrige tests                           |
| `chore`  | Tareas de mantenimiento, deps, configs          |
| `ci`     | Cambios en CI/CD                                 |
| `build`  | Cambios en sistema de build o deps              |

### Ejemplos

```
feat: agrega exportación CSV de eventos

- Nuevo endpoint GET /api/events/export
- Botón en panel admin
- Soporta filtros por deporte y fecha
```

## 🎨 Estilo de código

- **TypeScript estricto** activado.
- **Prettier** + **ESLint** con config de Next.js.
- 2 espacios de indentación.
- Usa `single quotes` para strings.
- Comentarios JSDoc en funciones exportadas.
- Componentes React: PascalCase.
- Hooks: `use-kebab-case`.
- Utilidades: `camelCase`.

## 🧪 Tests

Actualmente no hay suite de tests automatizados. Si agregas funcionalidad
crítica, considera:

- Tests unitarios con Vitest (cuando se configure).
- Tests E2E con Playwright (cuando se configure).

## 🗄️ Cambios en la BD

Si modificas `prisma/schema.prisma`:

1. Ejecuta `bun run db:push` para sincronizar.
2. Si es un cambio destructivo, prefiere crear migración:
   ```bash
   bunx prisma migrate dev --name descripcion_corta
   ```
3. Actualiza `prisma/seed.ts` si agregas modelos nuevos que requieran datos iniciales.

## 📦 Antes de abrir el PR

- [ ] `bun run lint` pasa sin errores.
- [ ] `bun run build` pasa sin errores.
- [ ] No hay `console.log` olvidados.
- [ ] Documentación actualizada si aplica.
- [ ] Screenshots si el cambio es visual.

## 🐛 Reportar bugs

Abre un issue usando la plantilla **Bug Report**. Incluye:

- Pasos para reproducir.
- Comportamiento esperado vs. actual.
- Entorno (OS, navegador, versión).
- Capturas o logs.

## ✨ Proponer funcionalidades

Abre un issue con la plantilla **Feature Request**. Describe:

- Caso de uso.
- Solución propuesta.
- Alternativas consideradas.

## ❓ Preguntas

Abre un issue con label `question`. No uses issues para soporte privado.

---

¡Gracias por contribuir! 💛
