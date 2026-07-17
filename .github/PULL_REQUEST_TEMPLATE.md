# 📋 Pull Request

## 📝 Descripción

Breve descripción de qué hace este PR y por qué. Referencia el issue relacionado con `Closes #XXX` o `Refs #XXX`.

## 🔄 Tipo de cambio

Marca con una `x` las que apliquen:

- [ ] 🐛 Bug fix (cambio que no rompe nada y corrige un bug)
- [ ] ✨ Nueva funcionalidad (cambio que no rompe nada y agrega funcionalidad)
- [ ] 💥 Breaking change (fix o feature que rompe compatibilidad existente)
- [ ] ♻️ Refactor (sin cambio funcional)
- [ ] 🎨 Estilo / UI (sin cambio de lógica)
- [ ] 📚 Documentación
- [ ] ⚙️ Configuración / chores
- [ ] 🚀 Performance

## ✅ Checklist

- [ ] Mi código sigue el estilo del proyecto (lint pasa: `bun run lint`)
- [ ] Hice self-review de mi código
- [ ] Comenté partes complejas o no obvias
- [ ] Actualicé la documentación relevante (README, .env.example, etc.)
- [ ] No dejé `console.log` ni comentarios TODO sin resolver
- [ ] Mis cambios no generan warnings nuevos en el build (`bun run build`)
- [ ] Si cambio el schema de Prisma, ejecuté `bun run db:push` y verifiqué la migración

## 🧪 ¿Cómo se probó?

Describe los tests que ejecutaste o los pasos manuales que seguiste para verificar tus cambios.

1. ...
2. ...
3. ...

## 📸 Capturas (si aplica)

Si tu cambio afecta la UI, agrega antes/después.

## 📝 Notas para el reviewer

Cualquier cosa que el reviewer deba saber antes de mergear.
