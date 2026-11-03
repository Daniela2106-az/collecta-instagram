# Collecta · Publicador de Instagram

Este repo publica automáticamente en el Instagram de Collecta (finanzas compartidas, «cuentas claras»).
La usuaria (Daniela) no es técnica: explícale todo en español, claro y paso a paso, y no la hagas preguntar de más.

## Cómo funciona
- `schedule.json`: calendario. Una entrada por publicación: `id`, `type` (`post` | `carousel` | `story`), `title`, `files`, `when` (ISO, zona America/Bogota -05:00), `status`, `caption`, `hashtags`.
- `media/<ID>/<n>.jpg`: imágenes de cada publicación, en orden (1.jpg, 2.jpg…). Posts y carruseles 1080×1080; stories 1080×1920. Instagram solo acepta JPEG.
- `scripts/publish.mjs`: publica lo que esté `approved` y ya haya vencido. Usa la API de Instagram (`graph.instagram.com`, «Instagram API con inicio de sesión de Instagram»). Las imágenes se sirven desde `raw.githubusercontent.com` (por eso el repo es público).
- `.github/workflows/publish.yml`: corre cada 15 min (y a mano con `workflow_dispatch`). Registra lo publicado en `state/published.json`.
- `.github/workflows/refresh-token.yml`: el día 1 de cada mes renueva el token (dura 60 días) y actualiza el secreto.
- Secretos del repo: `IG_ACCESS_TOKEN` (token de Instagram) y `SECRETS_PAT` (token de GitHub con permiso Secrets: read/write solo sobre este repo).

- `SECRETS_PAT` se crea con vencimiento de 1 año: avísale a la usuaria cuando falten ~30 días (revisa la fecha con `gh` o pregúntale cuándo lo creó) para que genere uno nuevo y actualice el secreto.

## Reglas (importantes)
1. **Nunca publiques algo que la usuaria no haya aprobado.** Solo `status: "approved"` se publica. Estados: `draft` (borrador), `needs_review` (hay algo que decidir; ver campo `review`), `approved`.
2. **No cambies un `status` a `approved` por tu cuenta.** Pregunta primero, muestra la imagen y la descripción final, y espera un «sí» explícito de ella para esa publicación.
3. **Nunca imprimas ni guardes tokens** en archivos, commits, logs ni en el chat. Si ella te pega uno, úsalo solo para `gh secret set` y no lo repitas.
4. Antes de cualquier publicación real corre una validación: `DRY_RUN=1` (o el workflow con `dry_run=1`). Verifica que cada imagen sea pública y JPEG.
5. No re-publiques lo que ya está en `state/published.json`.
6. Tono de las descripciones: cercano, claro, en español de Colombia, sin exagerar. No prometas funciones que no existen: hoy Collecta **no guarda ni mueve dinero** (cada quien paga por su banco y quien recibe confirma). El escáner con IA ya funciona pero es **premium**. El primer y el último post de cada serie llevan el enlace de la app: https://collecta-xi.vercel.app
7. **Gratis vs premium** (según el pitch deck): la versión beta gratuita incluye grupos, 4 formas de dividir (iguales, montos exactos, por ítem con propina, por noches), registro y confirmación de pagos y captura manual con foto del comprobante. Son **premium**: metas de ahorro, gastos automáticos, préstamos en cuotas y escáner con IA. Distinción discreta; no pongas precios en las publicaciones. Para lo premium el llamado es «adquiérela desde la app» (nunca «escríbenos»).
8. Hashtags: pocos (4–8), relevantes. Se agregan al final de la descripción al publicar.

## Tareas habituales
- **Configurar por primera vez**: comprobar con `gh` que el repo sea público y que existan los secretos (`gh secret list`); lanzar el workflow «Publicar en Instagram» con `dry_run=1` (`gh workflow run publish.yml -f dry_run=1`) y leer el resultado (`gh run watch` / `gh run view --log`). Explicar cualquier error en palabras simples.
- **Mostrar el calendario**: tabla con id, tipo, fecha (hora de Bogotá), estado y primera línea de la descripción.
- **Aprobar / reprogramar / editar descripción**: editar `schedule.json`, hacer commit y push.
- **Publicar ya una pieza aprobada**: `gh workflow run publish.yml -f only=P01`.
- **Ver qué se publicó**: leer `state/published.json` (trae el enlace de cada una).
- **Nueva publicación**: crear `media/<ID>/` con JPEGs 1080×1080 (o 1080×1920 para stories), agregar la entrada a `schedule.json` con `status: "draft"`, escribir la descripción y pedir aprobación. Las imágenes originales se diseñan en el lienzo de Claude («Collecta · Primeras publicaciones de Instagram»); si faltan JPEGs, pídele a la usuaria que los exporte de ahí.

## Errores típicos
- `code 190` / «token»: el token venció o fue revocado. Hay que generar uno nuevo en el panel de Meta (app → Instagram → configuración de la API con inicio de sesión de Instagram → generar token) y actualizar el secreto `IG_ACCESS_TOKEN`.
- «La imagen no es pública»: el repo es privado, o el archivo no se ha subido a la rama principal.
- «Instagram solo acepta JPEG»: reexportar la imagen como JPEG.
- Límite: 100 publicaciones por API cada 24 h (no es un problema a este ritmo).
- Los carruseles se recortan a la proporción de la primera imagen (1:1). Las stories no llevan descripción.
- GitHub pausa los workflows programados si el repo pasa 60 días sin actividad; los commits de `state/published.json` cuentan como actividad.
