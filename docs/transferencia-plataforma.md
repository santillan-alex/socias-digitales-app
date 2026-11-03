# Transferencia a Flor — preparada, no ejecutada

Fecha: **15/10/2026**. Este documento reemplaza el estado de transferencia anterior del 08/10. No confirma que se haya movido ningún servicio.

## Ampliación de respaldo: archivos propios de Afiliadas — cierre del 03/11/2026

El código publicado de esta ampliación corresponde al commit `5bfdfab03840d054b2e6fe8755d78e2c3cf8b1c6`, árbol `c96cfbf827e702910ec35e54bc0f277d445907b5`, deployment `dpl_BJ25xb7ZCmM7urk8NEJxA6uXgLoQ`, **READY confirmado**, con dominios app/Flor y aliases conservados. Las **777 pruebas**, build local completo y ESLint con salida 0 corresponden a esa versión. Desde Chrome con sesión administrativa, origen app, se subieron realmente PDF y MP4 técnicos, se guardaron archivados, se recargaron y descargaron; los SHA-256 de los archivos recibidos coinciden con sus fixtures. Esta aceptación no confirma una transferencia, respaldo ejecutado o restauración probada. Consultar el corte más reciente de `estado-plataforma.md` antes de operar.

Afiliadas incorpora archivos propios en el **mismo bucket privado R2 existente**, además de los enlaces externos anteriores. No se agrega migración SQL, tabla, credencial, servicio o proveedor. Respaldar coordinadamente `recursos_afiliadas` —incluyendo UUID, referencia HTTPS estable, campaña, tipo, estado y versión— y estos prefijos privados cuando se usen:

| Prefijo R2 | Qué debe conservarse |
| --- | --- |
| `afiliadas/archivos/<recursoId>/<archivoId>.<extension>` | Binarios confirmados e inmutables: MP4 hasta 1 GiB y documentos/imágenes permitidos hasta 25 MiB |
| `afiliadas/indices/<recursoId>/<archivoId>.json` | Metadata privada que liga el archivo a su recurso, nombre, tamaño, MIME, extensión, creadora y fecha; necesaria para validar y emitir una descarga |

Copiar solo la tabla, el código o los binarios por separado no restaura la entrega. Conservar los mismos UUID y relaciones, MIME y contenido del índice; probar la apertura autenticada tras restaurar. La referencia estable usa la ruta `/api/afiliadas/<recursoId>/archivo/<archivoId>` de la app; no guardar una firma R2 como destino permanente. Las firmas se generan al abrir y duran sesenta segundos. La publicación, el permiso Afiliadas y la referencia actual deben seguir comprobándose después del traslado; no sustituirlos por un bucket público o enlaces de duración indefinida.

Inventario QA nuevo confirmado y conservado: PDF de **601 bytes**, recurso `8ee0e387-aeef-4785-affd-634bab3474e2`, archivo `57a18a0a-570b-4f98-97c9-76c1839b8ecb`; MP4 de **2324 bytes**, de un segundo y color rosa, recurso `5e50cd1c-2e94-4918-979d-5563c4cdab0e`, archivo `5916ce75-eda0-4633-8dda-1d9489189d6b`. Ambos recursos terminaron directamente **Archivados, versión 1**, sin publicación. Sus binarios e índices privados existen y son recuperables: incluirlos en el inventario del próximo respaldo, no eliminarlos para volver a declarar cero filas. Al inicio había cero habilitaciones Afiliadas activadas; no se modificaron grants, plan/rol ni se enviaron email/push. Las pruebas desde una alumna habilitada y la carga por alias Flor/CORS siguen pendientes. La evidencia de los cinco anchos y estados de la nueva interfaz es local.

Las subidas multipart pueden dejar sesiones abandonadas u objetos sin referencia si se corta la conexión o se descarta el formulario. No hay limpieza automática ni borrado definitivo de esos objetos en esta ampliación. Inventariar y revisar esos casos en una operación separada; no eliminar índices, originales o material archivado durante el traslado. No hay DRM, antivirus ni transcodificación: TXT solo comprueba el prefijo, Office cabecera ZIP y MP4 su cabecera/tamaño/MIME. Un archivo ya descargado no se revoca al mover el servicio o retirar el permiso.

Mantener CORS restringido al origen de carga autorizado y las credenciales de servidor fuera de documentos/Git. El inventario previo registra `https://app.sociasdigitales.com`; no asumir que un alias Flor, preview o dominio receptor puede subir hasta comprobarlo y autorizar su origen concreto. No se modificó CORS como parte de este corte. La nueva organización por campañas y la copia de textos completos no transfieren propiedad de destinos externos ni conectan ManyChat/Sndflow. Las afirmaciones de «solo enlaces externos» del inventario del 02/11 describen la etapa anterior y no deben usarse para excluir estos nuevos prefijos del próximo respaldo.

## Actualización de inventario y respaldo — 02/11/2026

GitHub redirige con HTTP 301 desde `Lombardomercato/socias-digitales-app` al **mismo repositorio ID `1411000015`**, ahora `santillan-alex/socias-digitales-app`, público y con `main` predeterminada. Metadata pública y redirección verificadas el 02/11; esta entrega no efectuó ese cambio de propietario. Las referencias al nombre anterior de las secciones históricas no son el destino vigente por defecto. Antes de transferir o desplegar comprobar de nuevo ID, propietario, remoto, rama de producción e integración GitHub/Vercel. El proyecto Vercel y el dominio de la app siguen siendo los mismos; esta comprobación no demuestra que se haya transferido un servicio ni publicado código nuevo.

La entrega de Afiliadas y seguimiento, aún en revisión final, agregó cinco tablas en la base de la app. Incluirlas en el próximo respaldo autorizado de Supabase junto con Auth/perfiles y las dependencias existentes; copiar el repositorio o transferir Vercel no copia estos datos. La migración local `20261103020325_afiliadas_y_seguimiento_socias.sql` está registrada remotamente como `20261103021207`: es la misma incorporación ya aplicada, no dos cambios por repetir.

| Tabla | Qué debe conservarse |
| --- | --- |
| `accesos_afiliadas` | Habilitación explícita por cuenta, versión y fecha; ausencia de fila significa sin acceso |
| `recursos_afiliadas` | Textos, campaña, tipo, destino HTTPS, estado borrador/publicado/archivado, destacado, versiones y fechas |
| `acompanamientos_socias` | Inicio confirmado y fin exclusivo calculado de seis meses calendario, versión y fecha |
| `cobros_socias` | Registros administrativos de concepto, vencimiento, importe/moneda opcionales, estado, fecha de pago, nota y versión |
| `seguimientos_socias_historial` | Auditoría administrativa de antes/después, identidad de quien cambió y fecha; no reconstruirla desde la pantalla ni permitir escritura cliente |

Conservar también RLS, grants restringidos, constraints, índices y las funciones/triggers privados de protección y auditoría. Restaurar con los mismos identificadores y relaciones; no inferir permisos de roles antiguos ni recalcular comienzos a partir de creación de cuentas. La auditoría y los cobros pueden contener información privada: guardar respaldos cifrados, sin incluirlos en Git, capturas públicas o documentos para Claude, con acceso solo a responsables autorizadas. Esta entrega no creó ni certificó una restauración de respaldo.

Los videos/archivos de Afiliadas son enlaces externos en esta etapa, sin binarios nuevos en R2. Respaldar la tabla no traslada ni da propiedad de archivos Drive, videos u otros destinos; revisar esas cuentas y permisos por separado. El fin del acompañamiento no revoca clases/herramientas, y estos cobros no equivalen a una integración de Mercado Pago. No activar campañas, renovaciones o bloqueos durante el traslado. La prueba SQL real terminó en ROLLBACK, sin identidades QA, accesos concedidos o cobros reales nuevos.

## Recomendación

Transferir primero **el proyecto Vercel existente** al equipo de Flor, manteniendo el mismo dominio y los proveedores actuales. Conservar a nuestro equipo como colaborador técnico con capacidad de despliegue. Luego, en otra ventana controlada, decidir la titularidad de GitHub, Supabase, R2 y Resend. Evitar una migración simultánea de todos los sistemas y de sus credenciales.

Solo se ve actualmente el equipo Vercel de origen. Falta identificar email/equipo receptor y que Flor invite a nuestra cuenta técnica. No asumir que su email de administradora de la app es su cuenta Vercel. El directorio privado de accesos se entrega fuera de este repositorio, que era público al revisar la entrega.

## Inventario y dependencias

| Servicio | Recurso que se conserva | Decisión |
| --- | --- | --- |
| Vercel | `socias-digitales-flor-preview`, `prj_sSqoKpVKyh399hf0zgHH9dD7QIz7` | Candidato a transferencia al equipo confirmado de Flor |
| Equipo de origen | `alex-santillan-projects`, `team_MtCKfyDkoBd20Qtc5HdJrTEw` | No transferir el equipo completo ni otros proyectos |
| Producción al corte | `cc1e1e1438cdf280c87d2206f56a4c818c2074ef`, `dpl_5o5Y63u4kownqugCunUC7exPVFjN` | Registrar nuevamente antes de ejecutar |
| Dominios | `app.sociasdigitales.com`, alias `flor.sociasdigitales.com` | Mantenerlos; no tocar toda la zona de Socias |
| GitHub | `Lombardomercato/socias-digitales-app` | Puede permanecer inicialmente; Flor necesita acceso a este repositorio para Claude |
| Supabase de la app | `yfsyotuykanbugxwxefv` | Mantener Auth/datos/RLS; una transferencia de organización es un paso separado |
| Supabase de marketing | `kxwqevrmiznycmtgmxiz` | Fuera del alcance; no mover ni mezclar |
| Cloudflare R2 | Bucket privado `sd-desafio-socias-videos` | Mantener contenido, privacidad y credencial limitada del servidor |
| Resend | Dominio/remitente Socias ya configurados | Mantener remitente, banner, consentimientos e historial |
| Push | Claves VAPID actuales | Mantener continuidad de suscripciones; no rotarlas como parte de un simple cambio de equipo |
| Sheet de encuesta | Copia dedicada referenciada en `src/lib/survey.ts` | Compartir por separado con las personas autorizadas; no confundir con sincronización automática |

## Accesos: son capas independientes

Flor debe conservar propiedad/facturación del equipo receptor. Nuestra cuenta debe seguir como colaboradora capaz de ver configuración, investigar y desplegar según el alcance que permita el plan; un rol únicamente de lectura no sirve para mantener la app. No compartir una contraseña entre personas.

Vercel Hobby no admite colaboración de equipo y es para uso personal no comercial. Revisar un plan apto para esta operación comercial y sus miembros antes de transferir; no contratar nada sin definición de la responsable. El nombre de cada rol disponible depende del plan: verificar las capacidades efectivas, no prometer una etiqueta universal.

La administradora de `/admin/equipo` puede administrar la aplicación, no por ello editar código. Para Claude hacen falta repositorio, entorno de desarrollo seguro y permisos técnicos independientes. No entregar a una IA acceso directo irrestricto a producción como sustituto de previews y revisión.

## Antes de la ventana de transferencia

1. Confirmar equipo receptor, titular de facturación, plan y colaborador técnico que debe permanecer. Aceptar/verificar las invitaciones de ambos lados.
2. Registrar deployment/commit/rama actuales, dominios, variables por nombre, integración Git y roles. Revisar cambios de Flor pendientes, subidas abiertas y correos en cola.
3. Crear respaldos autorizados de base/Auth y contenido/configuración relevante; guardarlos cifrados fuera de Git. Comprobar cómo se restauran. **Esta entrega no hizo ni certificó una restauración de respaldo.**
4. Preparar una preview segura y datos de prueba, sin campañas ni modificaciones a alumnas reales. Congelar cambios durante la comprobación, no interrumpir una clase en vivo.
5. Documentar rollback de código y de datos por separado. Conservar al menos un deployment funcional anterior accesible.

## Paso Vercel

Con la cuenta que administra el origen y acceso al equipo receptor, abrir Settings → General → Transfer Project del **proyecto exacto**. Elegir el equipo de Flor confirmado. Según la documentación de Vercel, el traslado conserva deployments, configuración y variables de proyecto; integraciones y otras dependencias requieren revisión específica. No hacer una nueva app vacía ni mover toda la cuenta.

Tras la transferencia, verificar en el equipo receptor y desde nuestra cuenta:

- Dominio/HTTPS y aliases correctos, sin cambios indiscriminados de DNS.
- Repositorio, rama de producción y capacidad real de desplegar una preview; revisar integraciones que necesiten reconexión.
- Variables en el entorno correspondiente (no basta ver sus nombres en otro entorno). Logs/observabilidad e integraciones no se presumen trasladados.
- Registro/confirmación/login, encuesta, permisos, clase privada, progreso, carga de clase y avisos con prueba controlada.
- Enlaces de confirmación/recuperación en Supabase siguen usando el dominio final; remitente/email y push conservan configuración.
- Flor es responsable del recurso y nosotros seguimos con el acceso técnico pactado. Registrar acta y deployment de aceptación.

No decir “transferido todo” si solo se transfirió Vercel.

## GitHub y trabajo desde Claude

Para empezar, invitar a la cuenta GitHub de Flor al repositorio correcto y conectar su Claude a ese proyecto/rama de entrega. No necesita trasladar el repo para editar con permiso. Se recomienda restringir visibilidad antes de añadir documentación privada; **no se cambió la visibilidad durante esta entrega**.

Si después se transfiere propiedad a su usuario/organización: conservar un colaborador técnico con escritura, historial, ramas y protecciones; verificar instalación GitHub/Vercel y actualizar remotos. Probar despliegue desde una rama antes de considerar terminado el traslado. No usar por error el repositorio heredado de herramientas-max.

## Backend y proveedores: segunda etapa

Supabase: preferir traslado del proyecto existente a una organización de Flor antes que recrear usuarios manualmente. Su procedimiento exige permisos adecuados en origen/destino y revisar integraciones, roles y condiciones de plan. Auth, usuarios y RLS no deben reiniciarse. Revisar el estado real y restricciones de la documentación vigente en esa fecha; nunca trasladar el proyecto de marketing por error.

R2 y Resend: la transferencia Vercel no les cambia propietario. Acordar mantener acceso delegado o migrarlos en pasos independientes con respaldo, prueba de URLs privadas, credenciales, remitentes y DNS. No rotar/eliminar claves activas ni objetos hasta validar el reemplazo. No copiar secretos a Claude, un documento o el repositorio para “facilitar” la transferencia.

Además de videos, miniaturas y agenda, respaldar `materiales-clases/`: incluye los índices privados por clase y sus archivos adjuntos. Copiar solo el código no copia estos materiales. Los enlaces externos conservan los permisos que tengan en Drive u otros servicios.

Desde el 26/10 incluir también `comunidad-fotos/` en el respaldo privado de R2 (archivos y cuotas), la columna `publicaciones.fotos` y las tres tablas administrativas `crm_recursos`, `crm_contactos`, `crm_eventos`. Conservar RLS, triggers, índices, versiones y funciones de agregado. No copiar datos de contactos a Git ni a documentos de Claude. ManyChat y Sndflow siguen siendo cuentas externas independientes; el nuevo panel no prueba una conexión, importación o traslado de sus automatizaciones.

CORS de R2 al corte: origen `https://app.sociasdigitales.com`, GET/HEAD/PUT, headers `content-type` y `range`, expuestos `ETag`, `Content-Length`, `Accept-Ranges`, `Content-Range`, max age 3600. No es un bucket público. Un preview/local distinto no puede subir con ese CORS: usar un entorno de prueba autorizado y origen explícito, no `*` por comodidad.

## Configuración que se revisa sin revelar valores

Ver `.env.example`: sitio, URL/anon Supabase, service role de servidor, Resend/remitente, R2 y VAPID. Vercel maneja los valores por entorno. Confirmar necesidad de reconfiguración en el destino; no enviarlos por email ni publicarlos. Las claves de servidor nunca llevan prefijo `NEXT_PUBLIC_`.

Si se decide rotar claves, hacerlo en una operación separada con plan de continuidad para subidas, sesiones, enlaces firmados, bajas de email y suscripciones push según la clave involucrada. Cambiar propietario de Vercel no exige por sí mismo borrar todas las credenciales.

## Cierre y pendientes de esta entrega

Preparado: inventario, instrucciones Claude, contrato visual, pruebas de aceptación y rama documental basada en producción. Pendiente: equipo receptor/invitación, revisión de plan/costos, respaldo comprobado, ejecución y aceptación con Flor. Ninguna contraseña se incluye aquí.

El acta final debe registrar quién es propietario de cada servicio, qué acceso retenemos, quién paga, commit/deployment aceptados, ubicación segura de respaldos y fecha de pruebas. Solo entonces cerrar el traspaso.

## Referencias oficiales consultadas

- [Transferencia de proyectos Vercel](https://vercel.com/docs/projects/transferring-projects)
- [Alcance del plan Hobby](https://vercel.com/docs/accounts/plans/hobby)
- [Roles de acceso Vercel](https://vercel.com/docs/rbac/access-roles)
- [Transferencia de proyectos Supabase](https://supabase.com/docs/guides/platform/project-transfer)
- [Memoria e instrucciones de proyecto de Claude Code](https://code.claude.com/docs/en/memory)

Revisar su versión vigente al ejecutar una transferencia; este procedimiento es una preparación fechada.
