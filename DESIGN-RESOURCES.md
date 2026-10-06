# DESIGN-RESOURCES.md — Tabla de recursos de diseño (MISIÓN premium)

| # | Recurso | Qué se tomó | Dónde se aplica (pantalla/archivo) | Licencia |
|---|---------|-------------|-------------------------------------|----------|
| 1 | Mahdi-mortazavi/app (Nava) | Filosofía "Art of Reduction"; tokens centralizados (spacing 4pt, radius, touch 44); motion springs; haptics semánticos (selection/success/warning); breathing en hero; empty states cuidados | `nodo/src/index.css` (tokens + springs), `Haptics.kt` + puente (táctil), empty states Chat/Biblioteca/Notas, hero de bienvenida con breathing | No confirmada en README (revisar LICENSE del repo antes de copiar código; solo se adoptan patrones, no código) |
| 2 | dev-apox/dynamic-island | Concepto de isla dinámica: píldora que se expande/contrae según actividad (morph + micro-animaciones) | `DynamicIsland.tsx` nuevo en Chat (descarga IA, IA pensando, dictado) + estados del Agente | MIT |
| 3 | Leonxlnx/taste-skill | Skill `redesign-existing-projects` instalada en `.agents/skills/`; se usa como protocolo de auditoría y filtro de gusto final | Auditoría de las 6 pantallas antes de cerrar; criterio anti-slop | MIT |
| 4 | simple-icons/simple-icons | Icono de marca Hugging Face (SVG inline) como badge "pesos de HF" en tarjetas de modelo; su sistema 24px/trazo único como referencia de consistencia para Icon.tsx | `nodo/src/ui/components/ModelsView.tsx` (badge por modelo), `Icon.tsx` (regla 1 grosor/1 geometría) | CC0-1.0 (dominio público; sin atribución exigida) |
| 5 | MaterialDesignInXAML | Sistema de elevaciones por capas tonales, estados hover/pressed/focus/disabled con overlays, ripple sutil, jerarquía tipográfica Display→Label, componentes card/chip/dialog/snackbar | Tokens de elevación + estados en `index.css`; ripple en botones; snackbar de avisos; jerarquía tipo en todas las pantallas; sombras suaves + hairlines (Compose también) | MIT |

## Paleta obligatoria (tokens)

- Base dark: `#0B0D12` → `#14171F`, superficies en capas tonales.
- Base light: marfil `#F5F1E8`, piedra `#E7E2D5`.
- Acento primario: esmeralda profundo `#2FA37C` (dark) / `#0E6B4F` (light).
- Acento secundario: acero apagado `#6B8CAE` (solo detalles).
- Texto: primario `#F2F4F1`, secundario `#A8B0BC`, terciario `#6E7683` (todos ≥4.5:1).
- Se implementa redefiniendo los tokens `signal/ember/cyan` en `@theme` (misma API de clases, valores sobrios; el neón terminal desaparece solo).
- Tipografía: Space Grotesk (títulos, tracking negativo) + Inter (texto) + JetBrains Mono (telemetría); escala Display 34/28/22/17/14/11.

## Detalles de nivel total (checklist de implementación)
- [x] DynamicIsland (descarga, pensando, dictado, pasos del agente) — `DynamicIsland.tsx` + `island.ts`
- [x] Haptics nativos (selección/éxito/aviso) en tabs, envío, descarga completa, errores — `Haptics.kt` + puente `haptic()`
- [x] Skeletons en listas (documentos) en vez de spinners — `Skeleton.tsx` en `LibraryView.tsx`
- [x] Empty states con ilustración sutil (breathing `animate-breathe` en Biblioteca; hero en chat)
- [x] Ripple + estados pressed/focus/disabled en botones (Material) — `index.css`
- [x] Snackbar global para avisos — `Snackbar.tsx` + `snackbar.ts` (Modelos, Ajustes)
- [x] Icono Hugging Face en tarjetas de modelo (+ Meta/Alibaba por familia) — `BrandIcon.tsx` en `ModelsView.tsx`
- [x] Modo rendimiento (blur minimal) conmutable en Ajustes — clase `.perf` + switch
- [x] Spacing 4pt auditado + touch targets ≥44px (tabs 56px mín, botones, switch con aria)
- [x] taste-skill redesign audit final por pantalla (header, tarjetas honestas, boot)
