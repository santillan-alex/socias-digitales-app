@AGENTS.md
@docs/diseno-plataforma.md

# Socias Digitales — continuar el producto existente

Esta es una aplicación operativa con usuarias reales. No reconstruirla como artifact, nueva landing, preview aislada ni proyecto paralelo. El objetivo es extender lo aprobado sin perder funciones, permisos ni datos.

## Precedencia del estado actualizado — 02/11/2026

Los checkpoints del 15/10 y otros cortes antiguos de este archivo son históricos. Ante una diferencia de inventario, módulos, agenda, pruebas o publicación, prevalece el bloque fechado más reciente de `docs/estado-plataforma.md`, junto con la operación vigente de `docs/operacion-y-pruebas.md`. No reutilizar un commit viejo como si fuera la producción actual. La agenda ya se edita desde Próximo hito; Comunidad y Logros tienen desarrollos posteriores al corte inicial.

GitHub redirige ahora `Lombardomercato/socias-digitales-app` al mismo repositorio ID `1411000015`, **`santillan-alex/socias-digitales-app`**, público y con `main` predeterminada; metadata pública y HTTP 301 verificados el 02/11, sin cambio de propiedad realizado en esta entrega. Las referencias al propietario anterior quedan como historia. Antes de operar verificar otra vez el ID, remoto, propietario y rama de producción vigentes; el nombre de `main` o una redirección no demuestran qué está publicado. Vercel y el dominio de la app se conservan.

La entrega del 02/11 incorpora Afiliadas como permiso **adicional**, compatible con Socia, y seguimiento administrativo del acompañamiento. No deducir Afiliadas de roles heredados ni metadata. Al vencer seis meses vence solo el acompañamiento; clases/herramientas conservan sus permisos. No hay cobros ni renovaciones automáticas o precios definidos; videos/archivos de Afiliadas usan enlaces HTTPS externos. Migración aplicada y build correcto; la aceptación exacta en navegador sigue pendiente: **no anunciar esta entrega como terminada o publicada**. Antes de continuar, releer el estado más reciente por si esa revisión ya se cerró.

## Antes de tocar código

1. Leer `docs/estado-plataforma.md`, `docs/operacion-y-pruebas.md` y, si hay un cambio de infraestructura, `docs/transferencia-plataforma.md`.
2. Verificar la versión actualmente publicada, la rama, los remotos y el estado local. El repositorio correcto es `Lombardomercato/socias-digitales-app`; un remoto antiguo llamado `origin` puede apuntar a `herramientas-max/socias-digitales`: no publicar allí por accidente.
3. El punto de entrega del 15/10/2026 parte del código de producción `cc1e1e1438cdf280c87d2206f56a4c818c2074ef`, rama `codex/progreso-clases-20261014`. La rama `codex/entrega-flor-20261015` agrega documentación. No asumir que `main` contiene lo más reciente; tampoco asumir que este checkpoint seguirá siendo la producción futura.
4. Crear una rama para la tarea. Preservar cambios ajenos y copias con sufijo ` 2`; no borrarlas ni usarlas como fuente automáticamente.
5. Explicar qué se va a modificar y cómo se probará. Cambiar solo lo pedido. Publicar, transferir servicios, cambiar DNS/permisos, contratar planes, enviar campañas y borrar datos reales requieren una solicitud concreta de la responsable, no se deducen de un pedido de revisión.

## Contrato de producto y permisos

- `/inicio` es el panel real de la alumna; `/admin` el de Flor. `/preview/*` no demuestra un circuito real ni debe sustituirlo.
- `/registro` crea una cuenta gratuita. `/registro/desafio` genera una solicitud para que Flor la habilite, rechace o modifique. `/registro/socias` no confirma un pago ni otorga acceso de pago automáticamente.
- `rol` administrativo y `tipo_usuario` (gratuito/desafio/socia) son cosas diferentes. Conservar compatibilidad con `afiliada`/`afiliada_lanzamiento`. Un administrador de la app no obtiene por eso acceso a GitHub, Vercel o Supabase.
- Comprobar permisos en el servidor y RLS. Nunca concederlos usando `user_metadata` editable desde el navegador ni solo ocultando botones.
- Desafío habilitado permite sus grabaciones; Estrategia tiene autorización propia. Resultados, Métricas y Mi día están desarrollados: requieren Socia activa y su permiso individual. No volver a tratarlos como módulos inexistentes ni abrirlos a todo el mundo.
- Productos, Objetivos, Comunidad, Logros y Ranking no se consideran módulos de alumna terminados por el solo hecho de tener una tarjeta o una pantalla heredada.
- La encuesta inicial es obligatoria: no agregar “completar después”. Mantener normalización de nombres, edición posterior, respuestas existentes y opción de no informar en datos personales opcionales.
- La exclusión de la cuenta de prueba está centralizada en `src/lib/test-accounts.ts`; usarla en estadísticas, listas y campañas. No excluir usuarias reales por llamarse Alex ni por patrones de email.

## Clases, datos y comunicaciones que se deben preservar

- Inventario verificado el 15/10: seis clases de Introducción y **Bienvenida**, publicada por Flor en Desafío Socias en vivo. No recrear el borrador “Clase 1” que el usuario pidió eliminar, ni borrar la Bienvenida de Flor.
- Reutilizar `ClassPlayer`, `ClassroomCliente`, `ClassroomAdmin` y `ClassProgressAdmin`. Mantener búsqueda, programas, acceso gratuito/privado, continuar desde el minuto guardado, completar/desmarcar y siguiente clase.
- `progreso_clases` no es `progreso_lecciones`: pertenecen a modelos distintos. El cambio de revisión del video invalida el progreso anterior. La marca de completada es una acción de la alumna, no una certificación de visualización íntegra.
- R2 permanece privado. Las URLs de lectura son firmadas y de corta duración. Subida directa multipart desde el navegador a R2; no enviar videos grandes a través de Vercel ni abrir el bucket públicamente para resolver un error.
- No exponer claves de R2, service role, Resend o VAPID en cliente, código, capturas o logs. Solo las variables `NEXT_PUBLIC_*` previstas son públicas.
- Avisos segmentados por audiencia. Novedades por email solo con consentimiento vigente y respetando bajas. Confirmación/recuperación son correos de servicio distintos. Mantener el banner de `src/lib/email-brand.ts` y el remitente verificado de Socias.
- Cola de emails persistente e idempotente: hasta 20 por ejecución inicial, pendientes desde el panel. Aceptado por el proveedor no equivale a entregado en casilla. No reenviar comunicados históricos ni reactivar la automatización del vivo del 13/10.
- El Sheet de encuesta es una copia de trabajo, no una sincronización automática implementada. La fuente de verdad es Supabase. Las preguntas se definen en código, no existe todavía un editor visual de preguntas.
- La agenda sigue configurada en código. No inventar un nuevo evento ni reiniciar un contador con una fecha vencida.

## Cómo implementar y verificar

- Next.js 16.2.9 / React 19.2.4 / Node 24. Leer la documentación instalada de Next antes de cambiar rutas, cookies o APIs; seguir `AGENTS.md`.
- Reutilizar componentes, tokens, iconos y estilos existentes. El diseño y las referencias visuales están en `docs/diseno-plataforma.md`. No introducir otro framework visual o tipografías nuevas.
- Cambios de base: migración versionada, RLS, restricciones, pruebas y plan de reversión. Hay historia heredada: no ejecutar todas las migraciones indiscriminadamente contra producción para “igualar” una base existente.
- Leer `.env.example` solo como nombres de configuración; obtener valores por un canal seguro. No versionar `.env.local`, dumps ni registros de alumnas. El repositorio está público al momento de esta entrega.
- Ejecutar las pruebas existentes (base: 166), revisión de los archivos afectados y build. Detallar qué falló en lugar de ocultarlo o borrar pruebas.
- Comparar capturas antes/después del flujo real con la misma resolución. Probar 320, 360, 390 y 430 px y escritorio, con estados vacío/cargado/error y los roles afectados.
- No certificar el producto completo solo porque compila o porque una preview se ve bien. Verificar navegador → API → permisos/datos → respuesta.
- Entregar archivos cambiados, pruebas realizadas, limitaciones, preview y procedimiento de rollback. Las instrucciones de este archivo ayudan a mantener consistencia; no reemplazan revisión humana, permisos técnicos ni pruebas.
