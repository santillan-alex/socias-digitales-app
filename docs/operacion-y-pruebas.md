# Operación y pruebas de aceptación

Fecha: 15/10/2026. Complementa el inventario de `estado-plataforma.md`. No incluye credenciales ni autoriza envíos o cambios sobre usuarias reales.

## Formación y comunidad: Avances — 05/11/2026

**Panel de Flor → Formación y comunidad → Avances** (`/admin/lanzamiento`) ahora consulta el seguimiento de la biblioteca actual. Elegir programa o clase/material, alternar **Por alumna / Por clase**, buscar por nombre y combinar tipo de cuenta, acceso actual y avance. Los indicadores resumen el recorrido elegido, sin cambiar por una búsqueda de personas. **Ver avance** abre una ficha de solo lectura; **Ver alumnas de esta clase** acota el recorrido a esa clase. Clases → Seguimiento conserva su resumen y enlaza a este detalle.

Cada alumna tiene su propio denominador: solo clases publicadas, con video y permiso actual según las reglas de la biblioteca. Las muestras gratuitas conservan su regla existente, incluso en cuentas pausadas. Sin acceso actual no significa sin actividad; sin actividad registrada no prueba que nunca haya visto una clase. Completada es una marca manual, no una certificación de reproducción. No se incluyen equipo ni cuenta de prueba. Al reemplazar el video se excluye el progreso de la revisión anterior, conservando el registro en la base. Los datos comerciales anteriores quedan accesibles en `/admin/lanzamiento/historico`, identificados como históricos; no se borran ni se usan para medir formación. Se retiraron sus cálculos con comisión/precio fijo y el enlace de métricas utiliza UUID, no email.

`GET /api/admin/formacion` comprueba sesión y rol de base antes de leer. Usa la sesión con RLS, sin cliente privilegiado, sin escrituras ni filtros/identidades por URL. Devuelve únicamente clases, nombres/tipo/estado/habilitación y avances mínimos; nunca email, contacto, rol, clave privada, enlace de video o revisión. Páginas con conteo exacto y orden estable, avance por cantidad realmente recibida, límites de 5.000 alumnas, 1.000 clases y 50.000 registros. Ante límite excedido, lectura incompleta, count cambiante o fallo se muestra error, no un total parcial definitivo. Actualizar revalida la sesión y retira los datos anteriores si falla. Respuestas privadas sin caché. La audiencia Socias de agenda exige tipo Socia explícito; un rol heredado de Afiliadas no la concede.

Comunidad conserva su muro, fotos y respuestas del equipo. La moderación confirmada reconcilia el contador una sola vez, conserva las versiones de comentarios ya moderadas e ignora páginas anteriores. **Preguntas por acompañar del muro nuevo**, enlaces a conversaciones y avisos personales de respuesta continúan pendientes; el filtro de consultas anteriores no debe presentarse como seguimiento del muro actual. Esta entrega no envía mensajes, emails ni push.

## Negocio y herramientas: Productos — 05/11/2026

Flor puede crear/editar y activar/desactivar productos. Cada acción confirma la fila devuelta; los fallos mantienen la ficha y sus datos abiertos, con error visible. Las altas conservan UUID durante un reintento para no duplicar una escritura cuya respuesta se perdió. Una imagen fallida conserva la anterior. No hay borrado físico desde esta interfaz: desactivar conserva resultados y enlaces históricos. Evitar editar la misma ficha simultáneamente desde dos administraciones: la edición completa aún no tiene control de versión; activar/desactivar sí comprueba el estado previo.

Precios y comisión estimada muestran la moneda del producto (USD/ARS/MXN/EUR). La aproximación a ARS existe solo para USD con cotización comprobada; una cotización fallida no se sustituye por 1000. Una lectura incompleta del catálogo muestra error y bloquea altas, sin inventar catálogo vacío. El módulo de Productos de alumna conserva su bloqueo actual: esta corrección no lo habilita ni define checkout, cuotas o condiciones de compra. Resultados ya tiene comprobantes, aprobación, gráficos y exportación; su siguiente etapa es **atribución por plataforma de cobro y canal de llegada**. No inventar fuentes para ventas anteriores. Recursos/contactos sigue siendo CRM manual; ManyChat y SendFlow todavía no están conectados por esta entrega.

## Todas las alumnas — directorio unificado incorporado el 05/11/2026

Entrar en **Panel de Flor → Alumnas y accesos → Todas las alumnas** (`/admin/alumnas`). La vista reúne las cuentas de alumnas en una sola lista, sin administradoras ni Alex Prueba. Cada persona aparece una sola vez, con su acceso principal y su permiso adicional de Afiliadas. Los indicadores se pueden pulsar para filtrar; búsqueda por nombre, email, WhatsApp o país, acceso principal, Afiliadas y estado se pueden combinar. **Limpiar filtros** vuelve a la lista completa. Los indicadores generales no cambian al filtrar y no se deben sumar grupos que se superponen.

**Ver ficha** abre una consulta de contacto, email confirmado, alta, último ingreso y habilitaciones. No cambia datos ni permisos: desde ahí se puede ir a Acceso y actividad, a gestionar Afiliadas o al seguimiento de Socias. Las modificaciones siguen usando los circuitos existentes. Último ingreso proviene de Auth; no es una medición de la actividad diaria ni del avance en clases. Una cuenta pausada/cancelada conserva sus permisos asignados, pero eso no significa que pueda usarlos mientras esté suspendida.

**Actualizar** vuelve a verificar la sesión administrativa y la lectura. Un fallo general retira la lista anterior y ofrece Reintentar. Si no se pueden comprobar identidades o permisos de Afiliadas, se muestra una advertencia y valores sin comprobar, nunca ceros o cuentas sin confirmar inventados. Los perfiles se leen por páginas con conteo exacto; los permisos se consultan por lotes y el directorio Auth se restringe a los IDs ya autorizados. El límite técnico es de cinco mil cuentas: si se alcanza o la lectura no se puede completar, se indica lista parcial y los totales quedan sin confirmar. No confundir el límite de esta vista con un límite de altas de la app.

La API `GET /api/admin/alumnas` solo devuelve el DTO mínimo tras comprobar Auth y el rol administrativo desde el perfil. No acepta filtros/identidades por URL ni tiene escrituras. Respuestas `private, no-store`, `nosniff` y `no-referrer`. Conservar la paginación, la distinción entre desconocido y falso y las exclusiones de pruebas/equipo al ampliar la vista; no usar metadata editable para conceder permisos.

## Recorrido de Afiliadas completado — 05/11/2026

Producción `6ec94b3932fb221980fbe63c8ba4e57a2f8b0b6e`, deployment `dpl_AntmBT73oLt19vKxnKQCDEH6AZV3`, READY. Consultar el cierre de la misma fecha en `estado-plataforma.md` para evidencia y límites; el recorrido de alumna pendiente que figura más abajo ya se completó.

Flor administra en **Panel de Flor → Afiliadas**. La alumna habilitada entra en **Afiliadas**, elige campaña o tipo y puede buscar un recurso. **Ver texto completo** amplía los copys largos; **Copiar texto completo** copia todo, aunque esté plegado. Solo una copia confirmada muestra **Copiado** y el mensaje local. Si el dispositivo no permite copiar, la ayuda aparece junto a esa tarjeta e indica cómo seleccionar el texto completo y reintentar.

**Descargar video** y **Descargar archivo** corresponden a archivos propios de la app. Los enlaces externos conservan **Abrir** y dependen de sus permisos. Cada descarga propia vuelve a comprobar la sesión, la habilitación y la publicación. Si se retira el material, su enlace anterior vuelve a Afiliadas con un aviso claro; si la sesión terminó, solicita ingresar de nuevo. La API sigue respondiendo JSON a solicitudes sin `Accept: text/html`.

La prueba real utilizó exclusivamente los tres recursos técnicos ya existentes y la cuenta de prueba. Al terminar quedaron **archivados**: copy versión 5, PDF/video versión 3; habilitación temporal **retirada**, versión 4. Cero recursos publicados y cero Afiliadas habilitadas al cierre. Se conservan filas, archivos e historial. No borrar los ensayos ni presentar su publicación temporal como contenido comercial. El panel administrativo queda abierto y se cierran las pestañas de ensayo; no quedan rutas ficticias, servidores QA ni configuración temporal nuevos.

## Afiliadas: subida de archivos y organización — cierre del 03/11/2026

**Publicado y READY confirmado, con subida y descarga administrativas reales.** Commit `5bfdfab03840d054b2e6fe8755d78e2c3cf8b1c6`, árbol `c96cfbf827e702910ec35e54bc0f277d445907b5`, deployment `dpl_BJ25xb7ZCmM7urk8NEJxA6uXgLoQ`; `app.sociasdigitales.com`, `flor.sociasdigitales.com` y aliases conservados. Las instrucciones de este bloque amplían las de Afiliadas que antes solo admitían enlaces externos; no cambian las reglas de acceso, seguimiento de Socias o comunicaciones. El ensayo se hizo con sesión administrativa desde el origen app, no como alumna.

En `/admin/afiliadas`, crear o editar un recurso. Para **Videos para anuncios** o **Archivos y guías**, elegir **Desde mi dispositivo** y seleccionar el archivo; **Usar enlace** conserva la alternativa HTTPS de Drive, Canva u otro destino. El UUID del recurso se mantiene desde que se abre el editor y permite subir antes del primer guardado. No hace falta crear una clase o guardar una ficha vacía para habilitar el selector.

1. Elegir un MP4 de hasta **1 GiB**, o un PDF, DOCX, XLSX, PPTX, TXT, PNG, JPG/JPEG o WebP de hasta **25 MiB**. Se admite un archivo principal por recurso. Los enlaces externos conservan sus permisos de origen.
2. Usar **Subir archivo** y esperar la confirmación. **Pausar** y **Continuar carga** reutilizan las partes confirmadas; conservar la ventana y el archivo elegido. **Cancelar y elegir otro** descarta la sesión incompleta, sin borrar el archivo anterior. Una respuesta ambigua exige reintentar la misma carga, no afirmar que ya terminó.
3. Después de **Archivo listo**, revisar título, mensaje/descripción, campaña y estado. La carga sola no publica ni guarda la ficha. **Guardar borrador** la conserva para el equipo; **Guardar y publicar** la hace visible a las Afiliadas habilitadas; **Guardar archivado** la retira. Un recurso multimedia en modo dispositivo sin archivo confirmado no se puede guardar.
4. Recargar y comprobar la persistencia. Al reemplazar, el archivo anterior sigue asociado hasta guardar el nuevo. Alternar dispositivo/enlace conserva sus borradores separados. Durante carga o guardado no se puede descartar el editor; los callbacks de una carga desmontada no deben modificar otro recurso. Cerrar con cambios pendientes requiere la confirmación interna y salir de la pestaña mantiene la advertencia que permita el navegador.

**Campaña o tema** permite elegir una existente o escribir otra. Se reutiliza la misma campaña al variar mayúsculas, espacios o representación Unicode NFC; no se crean permisos ni ventas por agrupar contenido. Administración y alumnas tienen campañas plegables, búsqueda, filtros y destacados. La alumna puede ampliar un mensaje, copiar el copy completo y descargar el archivo propio; los enlaces externos continúan abriéndose en su destino. El límite de catálogo sigue siendo doscientos recursos cargados y los filtros se aplican a esa lectura.

Contrato técnico: `POST /api/admin/afiliadas/archivos`, con `action` `iniciar`, `firmar`, `estado`, `completar` o `cancelar`; lectura administrativa de metadata por `recursoId` y `archivoId`. Todas las operaciones verifican sesión administrativa; las escrituras exigen origen y JSON acotado. Los binarios van directo a R2 mediante multipart de 16 MiB. El token HMAC de Afiliadas dura doce horas, está ligado a administradora/recurso/archivo y no sirve para cargas de clases. Se comprueban partes reales, tamaño, MIME y cabecera de formato con GET Range de hasta 32 bytes. La metadata se confirma con escritura condicional inmutable; reintentar una finalización confirmada devuelve el mismo archivo, sin duplicarlo ni publicar un recurso.

La ficha almacena una referencia estable `https://app.sociasdigitales.com/api/afiliadas/<recursoId>/archivo/<archivoId>`, no una URL firmada R2. Guardar esa referencia exige metadata confirmada y correspondencia de recurso/tipo. Cada apertura comprueba sesión, habilitación activa de Afiliadas, estado Publicado salvo administradoras, referencia vigente y metadata. Después emite una redirección privada de **60 segundos**, con descarga como adjunto y nombre seguro; respuestas sin caché pública ni claves de almacenamiento en el DTO. El alias Flor usa la misma ruta con la sesión de su propio origen. Retirar acceso, archivar o reemplazar impide nuevas descargas de la referencia anterior; una firma ya emitida puede seguir válida hasta vencer y no se revocan archivos descargados.

No hay DRM, antivirus, transcodificación ni limpieza automática de multipart abandonados, binarios sin referencia o índices antiguos. TXT se valida por el prefijo y Office por cabecera ZIP; eso no certifica todo el contenido. Un MP4 no se convierte automáticamente a otro códec. Un `iniciar` cuya respuesta se pierde puede dejar una carga huérfana, sin crear un segundo recurso publicado. Mantener esos límites y respaldar los objetos privados; no borrar objetos para ocultar un fallo de UI. Esta etapa reutiliza R2 y la tabla de recursos existente, **sin migración, credenciales o proveedor nuevos**. No activa mensajes, email, push, cobros, comisiones o automatizaciones externas.

Aceptación local: **777/777 pruebas**, build completo y ESLint con salida 0. **40 combinaciones** administración/alumna × lleno/vacío/error/texto largo × 320/360/390/430/1280 px CSS, sin desborde. El editor de video se comprobó además en esos cinco anchos y altura CSS 600: campos de texto a 16 px; la medición de 14 px del checkbox no corresponde a un campo de texto. Esto no prueba transporte, guardado o descarga autenticados en producción.

**Aceptación administrativa real completada en Chrome:** desde `app.sociasdigitales.com` se subieron un PDF técnico de **601 bytes** y un MP4 técnico de **2324 bytes**, de un segundo y color rosa; ambos llegaron a 100 % y archivo verificado. Se guardó cada recurso directamente como **Archivado**, sin publicarlo. Las fichas se recuperaron tras recargar y **Revisar archivo cargado** descargó ambos a Downloads. Se comparó SHA-256 de cada descarga con su fixture y coincidió, comprobando recepción de los bytes completos. No afirmar reproducción del MP4 o interpretación del PDF si la evidencia es la igualdad de sus archivos descargados.

| Ensayo que se conserva | UUID del recurso | UUID del archivo | Resultado final |
| --- | --- | --- | --- |
| PDF técnico, 601 bytes | `8ee0e387-aeef-4785-affd-634bab3474e2` | `57a18a0a-570b-4f98-97c9-76c1839b8ecb` | Archivado, versión 1; descarga SHA-256 coincidente |
| MP4 técnico, 2324 bytes | `5e50cd1c-2e94-4918-979d-5563c4cdab0e` | `5916ce75-eda0-4633-8dda-1d9489189d6b` | Archivado, versión 1; descarga SHA-256 coincidente |

Al comenzar había cero habilitaciones Afiliadas activadas. No se publicaron estos recursos ni se cambiaron grants, plan o rol; no hubo email/push. Las fichas, binarios e índices privados siguen persistidos y recuperables: no borrarlos ni reescribir datos para afirmar cero filas. Conservar también la QA anterior archivada/anulada y su auditoría. La captura `afiliadas-video-cargado-20261103.jpg` está fuera del repositorio, en outputs privados. La ruta QA no está en el build y su servidor está apagado; el enlace temporal de configuración fue retirado al cierre operativo. La consulta final de logs de diez minutos no encontró error/fatal, sin extender esa evidencia a otros períodos.

Las denegaciones reales de producción devolvieron POST de origen cruzado **403**, GET administrativo de archivos anónimo **401** y GET privado de archivo anónimo **401**, con `private, no-store` y `nosniff`. Estas pruebas no sustituyen la descarga autorizada de una alumna. **Pendiente:** recorrido desde una Socia con Afiliadas, visibilidad antes/después de publicar, descarga y revocación conservando otros accesos; revisión móvil autenticada y subida por alias Flor/CORS. Los cuarenta estados/tamaños anteriores son QA local; tampoco convertir pruebas locales de reemplazo, reintento o conservación de borradores en acciones de producción no realizadas. Antes de subir por el alias, comprobar su origen permitido: el inventario anterior solo registra app y no se validó CORS de Flor en este cierre.

## Navegación publicada y aceptación restante — 03/11/2026

La navegación lateral ya está **publicada** en commit `b64446eb6122266f77c12439322688e96f7aa596`, árbol `f8d20b84aebb8f097b25a04dbfb5dbd0c747e485`, deployment `dpl_5isvmUu5cpLLvfebMxg1P2Qt1Gq2`, READY, con `app.sociasdigitales.com`, `flor.sociasdigitales.com` y aliases conservados. Este es el estado vigente; las menciones de navegación en QA o build pendiente de los bloques inferiores son cortes anteriores.

Pasaron **740/740 pruebas**, build completo Turbopack/TypeScript con salida 0 y ESLint sin errores; se conservaron tres avisos preexistentes de imágenes nativas en `AdminDashboard`. La navegación se midió localmente en 320/360/390/430/1280 px CSS sin desborde. Menú abre el diálogo; Escape lo cierra y devuelve el foco al botón. La comprobación DOM de desplazamiento confirmó el lateral fijo y el encabezado en 0.

En la producción real, con Chrome nativo, se verificó Afiliadas → Clases y `/admin/classroom` con Desafío expandido: al llegar mediante scroll hasta Material de apoyo, el menú permaneció fijo a la izquierda, Clases activo y Nueva clase/Editar/Subir video visibles. No se subió un video para comprobar esta navegación. La extensión se trabó y se recuperó con la interfaz nativa; detener la depuración devolvió el viewport visible a su tamaño normal. **Los cinco anchos móviles/escritorio se comprobaron localmente, no como una matriz móvil autenticada en producción.**

La ventana de diez minutos de logs consultada del nuevo deployment no mostró error/fatal; no extender esa observación a otros períodos. La captura validada `menu-admin-publicado-20261103.jpg` se conserva fuera del repositorio. El enlace temporal de configuración se retiró, no hay rutas ficticias en el build y el servidor QA está apagado. Se dejó de interactuar con Chrome cuando el usuario empezó a usar otras pestañas.

Estado SQL final de la prueba conservada: recurso archivado versión 3; cobro **QA Seguimiento 03/11/2026 — SIN PAGO REAL** anulado versión 2, con monto/moneda/`pagado_en` nulos y dos auditorías; grant Afiliadas de la cuenta de prueba deshabilitado versión 2; cero ciclos guardados y cero habilitaciones de Afiliadas activadas. No borrar estos registros archivados/anulados ni su auditoría. No hubo pagos reales, emails/push ni cambios del plan/rol de la cuenta por el ensayo.

Para completar aceptación queda el recorrido desde la interfaz de una Socia autorizada y la revisión móvil real de producción. La sesión administrativa comprobó sus operaciones y la navegación señalada; no reemplaza la experiencia de la alumna. Mantener separadas estas evidencias de la RLS transaccional previa. Una reversión de código debe conservar tablas, permisos, registros e historial.

## Ensayo autenticado de producción y conservación de QA — 03/11/2026

Se ejecutaron las siguientes operaciones con sesión **administrativa auténtica** sobre la producción `d4ef51de175e226855629a8def54592994812630`. Son posteriores al corte técnico de abajo: sus cifras de cero filas corresponden a antes de este ensayo y **no deben reutilizarse como estado actual**.

| Ensayo identificado | Secuencia confirmada | Estado que se conserva |
| --- | --- | --- |
| Recurso `fa83e6a3-6559-4bcf-a574-a6db4edc8e64`, Prueba técnica · Afiliadas (03/11) | Borrador → Publicado → Archivado; persistencia comprobada al recargar | Archivado, versión 3 |
| Cobro «QA Seguimiento 03/11/2026 — SIN PAGO REAL», de la cuenta de prueba `06bb7999-997b-49c8-ba80-b8d05bca4a84` | Pendiente sin monto/moneda → Anulado | Anulado, versión 2, sin `pagado_en`; dos auditorías |
| Permiso Afiliadas de esa misma cuenta de prueba | Habilitado → Retirado | Deshabilitado; plan y rol conservados |

Antes de publicar el recurso se comprobó que no había habilitaciones de Afiliadas activadas. No se enviaron emails ni push. El cobro no tiene importe o moneda, no corresponde a un pago real y no se marcó Pagado. No se guardó un ciclo de acompañamiento. Estos registros técnicos quedan archivados/anulados y el historial permanece: **no borrar filas ni auditorías para limpiar la prueba**, ni confundir el cobro QA con una deuda o ingreso.

La sesión administrativa y las recargas prueban estas operaciones concretas; no prueban el recorrido completo de una Socia desde su propia interfaz. Sigue pendiente esa aceptación con una cuenta de alumna autorizada, incluyendo visibilidad antes/después de publicar, copiar/abrir, revocar y conservar campus/permisos independientes. La verificación RLS previa pasó dentro de su transacción con ROLLBACK y sigue siendo una evidencia separada.

Un cambio posterior de **navegación lateral** está en QA: **740 pruebas correctas, build final pendiente y todavía sin publicar**. La producción continúa en `d4ef`; no presentar la navegación nueva ni la suite de 740 como validación de un deployment aún inexistente. Mantener el registro de publicación y sus 731 pruebas/build anteriores como corte histórico.

## Publicación de Afiliadas y seguimiento — cierre técnico del 03/11/2026, Argentina

**Publicado, con aceptación administrativa real aún pendiente.** Producción usa commit `d4ef51de175e226855629a8def54592994812630`, árbol `9e580590d7462ad6f214956af3204ead38b90b87`, deployment `dpl_GW6XHzNrdPonea7s7LZqWhg6ccTt`, READY en `app.sociasdigitales.com` y aliases conservados. Vercel informó Build Completed en veinte segundos y el dominio fue confirmado. Las 731 pruebas y el build previos corresponden exactamente a este código. La revisión final de solo lectura no encontró bloqueantes; este corte reemplaza únicamente el estado de publicación/QA pendiente descrito el 02/11, conservando sus instrucciones y contratos.

Aceptación visual con datos ficticios: ochenta combinaciones de cuatro vistas (Afiliadas alumna, catálogo admin, accesos y seguimiento), cuatro estados (lleno/vacío/error/texto largo) y cinco anchos CSS 320/360/390/430/1280. Cero desbordes horizontales y campos a 16 px. En los cinco anchos y altura CSS 500, Crear recurso conservó scroll propio y Guardar visible; el formulario rechazó una URL insegura antes de enviar y mantuvo los datos. No confundir esta matriz con el recorrido autenticado de una administradora real.

Al confirmar Cerrar para descartar el borrador ficticio, Chrome dejó de responder. Lectura del diálogo, estado de pestaña e interacción nativa agotaron sus esperas; no se confirmó una nueva escritura real. La única sesión disponible era Alex Prueba como alumna y al cerrar el corte no se confirmó todavía una sesión administrativa. El servidor QA está detenido; la ruta ficticia y el enlace temporal local de `.env` fueron retirados. **Al retomar:** el usuario debe descartar manualmente la confirmación del borrador e ingresar como administrador; no elevar la cuenta de prueba ni suplantar otra sesión. Después completar creación/edición/publicación/archivo, habilitación/revocación, ciclo/cobro/historial y recargas con una identidad/entorno de prueba autorizados, y restaurar viewport/emulación. Este recorrido sigue pendiente y no debe darse por aprobado solo porque la versión ya esté publicada.

Las seis comprobaciones HTTP de APIs de producción pasaron: 401 sin autenticación y 403 para origen cruzado, respuestas privadas `no-store` y sin información sensible. Comprueban denegaciones, no el éxito de una escritura administrativa autorizada. En los diez minutos de logs consultados del deployment no se encontraron error/fatal. La consulta de drains respondió 404 y queda **indisponible**; no inferir de esa respuesta que no haya drains ni otras garantías sobre los registros.

Base verificada el 03/11: las cinco tablas nuevas siguen con cero filas y no quedaron identidades QA. No hubo emails/push, accesos concedidos o cobros reales nuevos. Mantener estas condiciones durante la aceptación; no usar una campaña ni un cobro real como prueba.

Rollback de código de referencia: commit `b9ddf69b2683c5ef69130546f619ecd4bdb9be4f`, deployment `dpl_Dik7Kwg8YizN3oD9GB3tVTFwyvGB`. Conservar las cinco tablas, RLS, guards, auditorías y futuros datos; no aplicar un downgrade destructivo ni un reset para revertir la interfaz. La vuelta al código anterior no revierte cambios de datos o comunicaciones.

## Afiliadas y seguimiento de Socias — operación incorporada el 02/11/2026

**Código en revisión, sin publicación confirmada al corte.** Estas instrucciones describen los nuevos módulos para su aceptación y operación después de publicar la versión revisada. Consultar primero el bloque más reciente de `docs/estado-plataforma.md`; no interpretar los cortes históricos como estado actual.

### Acceso adicional a Afiliadas

1. Entrar al Panel de Flor → **Afiliadas** → **Gestionar accesos** (`/admin/afiliadas/accesos`). Buscar la cuenta y comprobar nombre, tipo y estado antes de cambiarla. La búsqueda actúa sobre la lista cargada; si se alcanza el límite de quinientas cuentas, se informa que la vista y las cifras son parciales.
2. Elegir **Habilitar Afiliadas** o **Retirar acceso**, revisar la cuenta de la confirmación y pulsar **Confirmar acceso**. Solo una cuenta activa puede recibir una nueva habilitación; retirar sigue permitido cuando la cuenta está pausada. La cuenta de prueba se incluye mediante su control explícito y no suma a los indicadores.
3. Confirmar el mensaje de guardado y volver a comprobar desde la sesión de alumna. Un timeout no demuestra éxito ni rechazo: **Reintentar mismo envío** conserva la operación. Ante conflicto de versión, actualizar la lista y revisar el estado antes de editar de nuevo.

Afiliadas se suma a los permisos existentes: no cambia el tipo Socia/Desafío/Gratuito ni concede clases, herramientas, agenda privada o administración. Una Socia puede tener ambos espacios. Un rol antiguo `afiliada`/`afiliada_lanzamiento` o metadata de registro no sustituye la habilitación explícita. No crear ni promover una administradora para solucionar este acceso.

### Mensajes, copies y materiales de Afiliadas

En `/admin/afiliadas`, usar **Crear recurso +**. Completar Título y Tipo de recurso; Campaña o tema es opcional. Aviso/Copy requieren texto; Video/Archivo/Enlace requieren un enlace HTTPS completo. Se admite título de hasta 140 caracteres, cuerpo de hasta 12.000, campaña de hasta 120 y URL de hasta 2.000. El contenido se muestra como texto plano, sin interpretar HTML.

Los videos y archivos se abren en su **destino externo**: este formulario no sube binarios, no carga videos a R2 y no cambia la privacidad del destino. Revisar que el enlace sea el material autorizado para ese público, sin credenciales en la URL. No confundirlo con el editor de adjuntos privados de las clases, que conserva su circuito independiente.

Elegir Borrador para preparación interna, Publicado para las Afiliadas habilitadas o Archivado para retirarlo sin borrar; **Destacar al comienzo** ordena primero los destacados. Guardar con el botón correspondiente y comprobar la respuesta. **Editar** permite modificar o volver a publicar un archivado. Los conflictos no deben pisar una edición ajena; conservar el mismo intento ante una respuesta ambigua y actualizar antes de cambiar los datos. No hay borrado definitivo desde esta interfaz.

En `/afiliadas`, la alumna puede buscar por texto/campaña, filtrar tipo/campaña, ampliar textos largos, copiar un copy completo y abrir enlaces. **Actualizar recursos** vuelve a leer; un error se distingue de un catálogo vacío. La lista muestra hasta doscientos recursos y avisa si hay más; los filtros solo afectan lo cargado. Publicar, archivar, copiar o abrir no envía emails/push, no confirma una venta y no incorpora seguimiento de descargas o comisiones.

### Seguimiento de acompañamiento de cada Socia

En Panel de Flor → **Seguimiento de Socias** (`/admin/socias`), revisar vigentes, renovaciones en treinta días, acompañamientos vencidos, fechas por confirmar y cobros pendientes/vencidos. Buscar por nombre o WhatsApp, filtrar el estado de acompañamiento y abrir **Ver seguimiento**. Solo se incluyen cuentas con `tipo_usuario='socia'` explícito; Desafío y el permiso Afiliadas se gestionan aparte. Si una lectura es parcial o falla, respetar su advertencia y no presentar cifras incompletas como definitivas.

Para una cuenta sin ciclo, elegir **Confirmar inicio del acompañamiento**. Revisar cuándo ya estaban confirmados el pago y el alta, escribir la fecha y marcar esa comprobación antes de **Confirmar ciclo**. La fecha no puede preceder al alta ni estar en el futuro según Argentina. No usar automáticamente la fecha de creación de la cuenta como fecha de compra. Si aún no está confirmada, dejarla Por confirmar.

El fin se calcula en la base sumando seis meses calendario, ajustando el día al último del mes destino cuando sea necesario. **Renueva el** es un fin exclusivo: por ejemplo, inicio 31/08/2023 → último día incluido 28/02/2024 → renueva 29/02/2024. El cálculo no usa 180 días. La ficha permite **Actualizar o renovar ciclo** después de revisar el acuerdo; conserva los ciclos anteriores en el historial.

Al llegar al fin vence **solo el acompañamiento**, como confirmó el usuario. Clases y herramientas conservan los permisos que ya tienen. Cambiar el ciclo no cobra, acredita pagos, modifica el plan, bloquea la cuenta ni envía recordatorios. No hay renovación automática.

### Cobros operativos e historial

En la ficha, **Pagos y recordatorios → Registrar cobro +** registra lo acordado manualmente: concepto y vencimiento obligatorios; importe/moneda y nota interna opcionales. Dejar importe y moneda ambos vacíos conserva **Importe por definir**. Si se completa un importe, debe ser positivo, de hasta dos decimales y con ARS o USD; no sumar ni convertir monedas distintas.

Los estados son Pendiente, Pagado y Anulado. Usar **Editar o confirmar pago** para revisarlos. Pagado requiere fecha no futura y comprobación humana del pago; los otros estados no conservan una fecha de pago. Anular conserva el registro y su historial. No guardar datos de tarjetas ni contraseñas en la nota. Una ficha sin cobros no prueba que la socia deba o haya pagado.

Este panel no procesa transacciones ni crea una deuda bancaria; tampoco envía recordatorios o integra la suscripción de Mercado Pago. Precios, importes y condiciones comerciales siguen por definir. No mezclar estos cobros de la membresía con los resultados, ventas o comisiones que declaran las alumnas.

**Historial de seguimiento** muestra los últimos treinta cambios de ciclo/cobro, con fecha Argentina y antes/después; avisa si hay cambios anteriores conservados. Es administrativo y no se edita desde la UI/API. El servidor registra a la administradora real; nunca escribir auditoría desde el cliente ni pasar una identidad elegida en el formulario.

### Contrato de datos, aceptación y reversión de esta entrega

Se incorporan `accesos_afiliadas`, `recursos_afiliadas`, `acompanamientos_socias`, `cobros_socias` y `seguimientos_socias_historial`, sin semillas ni conversión de permisos heredados. RLS y servidor verifican sesión/perfil; los guards exigen administradora identificada incluso ante `service_role`. Las versiones y fechas las controla la base. Los reintentos conservan identificador, contenido y versión esperada; un conflicto exige volver a leer, sin sobrescribir.

La migración ya aplicada es el archivo local `20261103020325_afiliadas_y_seguimiento_socias.sql`, registrado remotamente como `20261103021207` en la base de la app. **No volver a aplicarla ni ejecutar un push de todo el historial local por esa diferencia de versión.** La prueba `supabase/tests/afiliadas_y_seguimiento_rls.sql` se ejecuta completa, con rol de mantenimiento y ROLLBACK obligatorio: crea identidades ficticias solo dentro de la transacción, comprueba acceso cruzado, borradores, revocación, fechas, meses calendario, versiones, importes y auditoría. Ante un error, ejecutar ROLLBACK; nunca COMMIT ni registro por red para estas fixtures. La ejecución real al corte pasó y dejó cero identidades QA y cero filas nuevas reales persistidas, sin avisos de seguridad nuevos.

Al corte pasaron **731/731 pruebas**, build completo Turbopack/TypeScript y ESLint sin errores, con un aviso preexistente de imagen del header compartido. La exportación limpia y la instalación de 383 paquetes están comprobadas. El error de tipos del primer build se corrigió, se comprobó la corrección del helper de origen Next/Vercel y la ruta ficticia fue retirada antes del build final. La rama de entrega es `codex/afiliadas-seguimiento-20261102`; consultar su commit de cabecera. La publicación de producción sigue pendiente. Se retiró el enlace temporal de configuración usado para compilar; no se incluyen `.env` ni sus valores en la entrega.

Falta la aceptación exacta 320/360/390/430 px y escritorio, estados vacío/cargado/error, formularios, teclado, foco y sesión administrativa real. El primer ensayo Chrome con datos ficticios midió 355/400/433/477/1422 px CSS al 90 % de zoom sin desborde; tres timeouts posteriores impidieron completarlo. La inspección nativa confirmó **Mac bloqueada**: el usuario debe desbloquearla manualmente. No intentar desbloqueo automático ni usar credenciales. Después, completar la revisión y restaurar viewport/emulación de prueba. No sustituir la matriz requerida por los tamaños anteriores ni afirmar publicación.

Comprobar el recorrido completo: administradora crea borrador → Afiliada no lo ve → publica → Afiliada explícita lo ve/copia/abre → retira acceso → lectura denegada; Socia con Afiliadas conserva su campus y una gratuita explícita no recibe formación/agenda/herramientas ni una falsa compra. Verificar también que un fallo de Afiliadas no elimina los otros accesos. Para seguimiento: confirmar ciclo de prueba, recargar, revisar fin exclusivo, editar cobro y verificar historial, duplicación y conflicto de dos administradoras. Realizar escrituras únicamente en entorno/identidad de prueba autorizados, sin activar campañas ni alterar acuerdos reales.

Reversión de código: recuperar el deployment anterior comprobado retira las nuevas entradas, pero no borra las cinco tablas, auditorías o datos que ya se hayan cargado. No desactivar RLS, eliminar historial ni revertir permisos heredados para ocultar un módulo. Respaldar primero datos y protecciones según `docs/transferencia-plataforma.md`; cualquier reversión de datos necesita su operación específica revisada.

## Operación de Flor

### Resumen operativo de Inicio

Inicio reúne disponibilidad y avance de clases, video para retomar, tareas del día en Argentina, comunicados y accesos a las herramientas. Se retiraron el bloque Cada paso cuenta y el título motivacional grande. La próxima clase de la agenda conserva su barra fina y el contador lateral. Los programas no llevan miniaturas y sus tarjetas de avance son compactas.

Desde el 26/10, el marco de Inicio con formación habilitada se comparte con las secciones de alumnas: Programa/materiales, Estrategia, Comunidad, Perfil/cuenta, Notificaciones y herramientas. Desde 1024 px el encabezado queda fijo arriba y menú/contador permanecen juntos al desplazarse; el lateral tiene scroll propio y foco de teclado para pantallas bajas. En celular el encabezado también permanece arriba, continúa la navegación inferior y Menú abre el listado completo en un diálogo nativo: Cerrar o Escape lo descartan y elegir sección lo cierra. La sección actual lleva fondo rosa y aria-current. No extender las reglas a administración, login, registro o bienvenida, ni cambiar la audiencia del hito.

El marco no entrega permisos: cada página/API mantiene su control. Se presenta solo tras comprobar identidad propia y formación; las vistas gratuitas, pendientes, suspendidas y administrativas conservan su recorrido. Si no se pudo confirmar la identidad, el layout devuelve la página original sin mostrar información privada adicional. Los avisos se leen con su proveedor existente y no se marcan al navegar. Perfil conserva Cerrar sesión, sus campos y preferencias; los headers redundantes se ocultan únicamente mediante una marca explícita dentro del marco. El coste de las lecturas de navegación fuera de Inicio se suma al lector de la página; no se añadió caché compartida ni se alteraron los lectores administrativos.

Mi día aparece solo cuando su permiso está confirmado; no se habilita por tener clases. La portada muestra totales diarios exactos y hasta dos pendientes propias, sin archivadas ni acciones de completado. Organizar mi día abre la agenda y Plan de estudio abre su formulario existente. Si el lector limita la lista a 500 filas, el total procede del agregado existente y los títulos solo de las tareas realmente leídas; no se inventa una tarea para completar la lista. Error, falta de permiso y día vacío son estados distintos. Es una instantánea al cargar o regresar a Inicio, no sincronización continua entre dispositivos.

Avisos usa el mismo contador del encabezado y menú. Abrir Inicio no marca mensajes como leídos; abrir el comunicado en la bandeja conserva el circuito actual. Sin nuevos mensajes, la tarjeta pierde el énfasis y muestra al día. Una lectura fallida no se presenta como cero. No se reinstala la alerta redundante sobre el evento ni se envían mensajes.

Mis herramientas muestra primero los módulos habilitados; el resto queda en Otros espacios del plan Socias, plegado por defecto. Un permiso fallido se identifica como acceso sin comprobar, no bloqueado. Las rutas de destino conservan sus controles. Gratuitas mantienen sus muestras y presentación comercial, sin una compra simulada.

Mi perfil reemplaza el porcentaje heredado por el mismo avance real de la biblioteca: completadas, en curso y disponibles, con enlace para continuar. No escribe ni borra el campo antiguo, ni modifica encuesta, contraseña o preferencias. Administradoras, accesos suspendidos y cuentas sin formación privada no consultan ni reciben este resumen.

### Campus personal en Inicio

Las alumnas con formación habilitada ven su próximo paso, clases disponibles, completadas, en curso y avance por programa. **Retomar mi clase** abre el video concreto en `/classroom?clase=<uuid>`, sin reproducirlo automáticamente, con el minuto propio guardado. Sin una clase en curso, se propone la primera disponible no completada: Bienvenida primero, luego el orden del programa y su material de apoyo. Toda mi formación abre la biblioteca completa con sus filtros.

El campus reutiliza el catálogo publicado y el progreso de esa sesión; no depende de permisos de Mi día, Métricas o Resultados ni los habilita. Gratuitas comunes conservan las muestras; solicitudes pendientes, accesos suspendidos y administradoras conservan sus recorridos. Un enlace inválido, retirado o sin acceso muestra un aviso y no solicita el video privado.

El avance cuenta solo clases publicadas, autorizadas y reproducibles de la revisión actual. Es la marca manual de la alumna, no una certificación. Un programa con contenido bloqueado o sin video no se declara completo. Ante un fallo del progreso se conserva el catálogo pero no se inventan ceros, porcentajes ni una próxima clase; si falla el catálogo, su disponibilidad queda desconocida. Reintentar vuelve a consultar sin modificar datos. No hay diplomas, puntos, nuevos permisos, envíos ni cambios de esquema.

### Plan de estudio y resumen semanal

Desde Inicio, **Plan de estudio** lleva al bloque integrado en Mi día. Solo permite planificar con formación y Mi día habilitados; no abre ese módulo a Desafío ni cambia la decisión de Flor. El plan propone la próxima clase disponible de cada programa, priorizando la que tiene minuto guardado. Elegir programa y fecha de hoy en adelante, revisar el nombre editable y la fecha escrita, y presionar **Confirmar en mi agenda**. Se puede elegir Hoy/Mañana o una fecha manual. La primera confirmación toma los valores visibles del formulario, también ante autocompletado nativo; un reintento conserva la intención enviada. No se guarda nada al abrir, elegir o cancelar.

La confirmación crea una tarea pendiente normal de **Negocio digital**, con una nota legible sobre la clase y su programa. No crea una relación permanente clase–tarea: editar o renombrar la clase no actualiza la nota, y completar la tarea no marca el video como visto. Después puede editarse, reprogramarse, completarse o archivarse desde Mi día. No agrega asistencia, certificados, avisos, emails ni recordatorios automáticos.

El formulario y el nombre se conservan ante un error. Un doble clic queda bloqueado; reintentar una respuesta perdida conserva UUID y contenido enviados. Si no se confirmó el guardado, los campos quedan congelados y se ofrece revisar la fecha antes de crear otra tarea. Un conflicto, sesión vencida o permiso revocado exige volver a comprobar la agenda. El mismo envío se recupera sin duplicarse, pero no hay unicidad por clase/fecha entre visitas o dispositivos. Cerrar o recargar solicita advertencia nativa cuando el navegador la admite; no se intercepta toda la navegación de la plataforma ni se conserva el borrador después de cerrar.

**Tu semana** resume lunes a domingo de la fecha elegida: planeadas, completadas, por hacer y días con tareas. Excluye archivadas y usa el agregado existente, no solo las primeras 500 tareas visibles del día. Cada día abre su agenda; con un formulario activo se bloquea el cambio local de fecha. Los errores y agregados incoherentes se muestran como desconocidos, no como cero o porcentajes inventados. El campus y los logros conservan sus reglas independientes.

### Celebraciones y nivel personal

Desde el 23/10, Mis logros incluye un nivel personal calculado desde las fuentes propias ya autorizadas. Inicio pasa a En marcha con una clase o una tarea; En foco requiere tres clases y actividad en tres días distintos; En acción suma diez tareas; Socia TOP suma un programa completo, incluido su material de apoyo. Tareas y días usan la fecha asignada a cada tarea dentro de los últimos treinta días, no la hora del clic. Clases y programas usan el progreso actual. No hay XP permanente ni clasificación pública: desmarcar, archivar, reprogramar o cambiar contenido puede modificar el nivel. Un error o módulo sin habilitar no se cuenta como cero y no produce una imagen de rango.

**Preparar mi historia** genera localmente un PNG vertical 1080×1920 con nivel, conteos y fechas. No incluye nombre, email, textos de tareas, ventas ni comprobantes. La alumna revisa la imagen y elige Descargar PNG o Compartir imagen; el selector del dispositivo depende de su soporte, con descarga de respaldo. Nada se publica automáticamente en Instagram. Inicio sin avances no habilita una historia.

Completar una tarea o marcar una clase, enviar un resultado a revisión y guardar un análisis pueden mostrar una felicitación breve, solo después de la respuesta confirmada del guardado. En resultados no significa aprobación de Flor; en clases no acredita reproducción íntegra. No se celebra una carga inicial, un error, desmarcar ni reprogramar. Mi día, clases y resultados deduplican por registro durante la visita; Métricas usa registro y versión. Sin sonidos ni vibración; con movimiento reducido se conserva el mensaje y no caen papelitos. El reproductor conserva el mensaje dentro de su diálogo nativo.

**Actualización 26/10:** Comunidad ya tiene muro voluntario, comentarios, felicitaciones y moderación. Ver la sección de operación al final de este documento; no reutilizar resultados privados ni comprobantes como publicaciones automáticas. La restricción de conexión mencionada en el corte anterior se resolvió con la conexión específica de la app.

### Accesos de alumnas

1. Copiar el enlace correspondiente desde Invitaciones: Gratuito, Desafío o Socias.
2. Revisar Solicitudes para Desafío; habilitar/rechazar según corresponda. Se puede cambiar la decisión después.
3. En Usuarias / Acceso y actividad, revisar tipo, estado y permisos de la ficha. Gratis, Desafío y Socias no son roles administrativos.
4. Estrategia y los módulos Socias tienen autorizaciones propias. No promover a admin a una alumna para resolver un bloqueo.

**Identificar la cuenta por email:** Acceso y actividad permite buscar por nombre, email de acceso o país, combinado con tipo y estado. El email canónico y su confirmación aparecen en el listado y en Ver ficha, solo como consulta. Email confirmado significa dirección verificada, no compra acreditada, alta Socias ni módulos habilitados. Email sin confirmar, estado sin verificar y cuenta de acceso no encontrada son situaciones diferentes; no activar una compra solo por coincidencia de nombre.

Si falla o tarda demasiado el directorio de cuentas, la lista y las cifras siguen disponibles con un aviso y **Recargar directorio**. La falta de lectura no se presenta como un correo sin confirmar ni como una cuenta inexistente. La ficha no modifica el email o la contraseña ni envía correos. Esta mejora reutiliza la lectura de Auth que ya usa Equipo, limitada a IDs del listado administrativo; no crea una tabla o permisos nuevos.

### Subir y organizar una clase

Organización: **Programa → Sección → Clase**. Bienvenida es independiente del Desafío; su contenido se presenta directamente. Desafío Socias contiene **Clases** y **Material de apoyo**, con orden por sección. Los programas son plegables, sin portadas; las miniaturas corresponden a los videos. Elegir programa y sección en el editor o usar “Agregar a material de apoyo”. Mover una clase conserva su ID, archivo, publicación, acceso y progreso.

La alumna puede combinar programa, búsqueda y **Todas / Pendientes / En curso / Completadas**, y volver al catálogo con **Limpiar filtros**. Los conteos responden al programa y búsqueda, solo para clases autorizadas y reproducibles. Todas conserva la vitrina bloqueada, que no cuenta como pendiente. En curso requiere un minuto guardado mayor que cero; Vimeo solo registra la marca manual de completada, no minutos. Al filtrar se despliegan las coincidencias y el apoyo, conservando los números y el avance del programa completo. Continuar viendo y Siguiente no dependen del filtro. Un error de lectura del progreso muestra No disponible, sin falsos ceros ni pendientes.

Una marca de completada o desmarcada que falló conserva **Reintentar guardar**, aunque se guarde automáticamente el minuto después. Guardar el minuto no confirma esa marca. La respuesta debe corresponder a la clase y al estado solicitado antes de informar éxito. Se mantienen las celebraciones solo ante marcas positivas confirmadas, sin convertirlas en certificados.

Compatibilidad sin cambiar esquema: el campo existente `clases.modulo` conserva el programa para Clases y serializa el apoyo como `Programa › Material de apoyo`. Usar `ubicacionClase`/`clasificacionClase`, no dividir o comparar el campo a mano. Los nombres anteriores Introducción y Desafío Socias en vivo se muestran como Bienvenida y Desafío Socias sin duplicar datos. La siguiente clase y los filtros respetan programa/sección; el seguimiento agrupa por programa. Límite de nombres nuevos: 75 caracteres, sin `›`.

Miniaturas automáticas de MP4 privados: captura local de un fotograma al elegir el archivo, JPEG de hasta 20 KB, guardado en R2 privado bajo `miniaturas/<clase>/<revisión>.jpg`. Para videos anteriores, la administración genera pendientes automáticamente al mostrar cada tarjeta, de a uno; no requiere diseñar o subir una portada. Las alumnas solo leen la imagen ya generada y autorizada, sin descargar el video para obtenerla. La revisión depende del archivo: reemplazar un video no reutiliza la miniatura anterior. GET/POST verifican usuario y acceso/rol; nunca hacer público el bucket. Si un codec/navegador impide la captura, se conserva un marcador neutro y el video sigue disponible. No se garantiza captura de enlaces externos de Vimeo ni transcodificación automática. Respaldar también `miniaturas/` al transferir.

1. Entrar en `/admin/classroom`; elegir o crear el programa y completar la ficha. El editor muestra **Ficha → Video → Publicar**. Sin video, **Guardar borrador y continuar al video** conserva la clase oculta y abre el selector de archivo dentro del mismo editor; la opción de publicación permanece deshabilitada.
2. Cargar el archivo desde ese panel. Preferir MP4 H.264/AAC. Esperar la finalización de la subida y del guardado antes de cerrar la ventana.
3. Si se interrumpe, usar los controles de reintento de esa carga, sin crear clases duplicadas. No se garantiza continuar después de cerrar la ventana.
4. Comprobar video, título, programa, orden y modalidad gratuita/privada. Activar **Publicar en la biblioteca al guardar** y presionar **Guardar y publicar clase**. Subir un video a un borrador no lo publica automáticamente. Un enlace de Vimeo válido también habilita la publicación; texto o enlaces incompletos no. Las clases ya publicadas conservan su estado al guardar cambios.
5. Revisar como alumna real autorizada, no solo como admin. Comprobar también que una cuenta sin acceso no recibe el video privado.
6. Seguimiento muestra progreso por programa. Completada es una marca de la alumna, no una certificación de reproducción íntegra.

No recrear “Clase 1” vacío: Flor publicó **Bienvenida** en Desafío Socias en vivo. No eliminar archivos del bucket para ocultar una tarjeta: ocultar y borrar son operaciones diferentes.

### Materiales de cada clase

La biblioteca central de la alumna está en `/clases/materiales`, desde Inicio o **Tus clases → Materiales**. Flor sigue agregando y editando adjuntos en el editor existente de cada clase; no tiene que volver a cargarlos en otra pantalla. **Material de apoyo** sigue siendo una sección de videos de un programa. La biblioteca central reúne los documentos y enlaces adjuntos a esos videos y al resto de clases autorizadas.

Buscar por nombre, clase, programa, formato o dominio; combina palabras sin distinguir mayúsculas ni acentos. Programa y Tipo permiten acotar a archivos o enlaces. **Limpiar filtros** vuelve al listado cargado. **Descargar/Abrir enlace** usa el endpoint privado actual y vuelve a verificar acceso, publicación y vigencia; **Ver clase** abre su video concreto sin autoplay. Explorar materiales no registra una clase completada, una descarga como actividad ni una tarea.

Se revisan 20 clases autorizadas por tanda. **Cargar más materiales** amplía la consulta; hasta completar las tandas y resolver errores, los conteos y la búsqueda corresponden solo a materiales cargados. Un índice ausente confirma una clase sin adjuntos; un error conserva materiales confirmados y ofrece **Reintentar estas clases**, sin borrar filtros. Si cambió la clasificación o el catálogo autorizado entre tandas, se retira la lectura anterior y **Actualizar biblioteca** comienza de nuevo, conservando filtros. La revisión no detecta todos los cambios de adjuntos: recargar la vista vuelve a leerlos, y cada apertura consulta siempre el material vigente.

Las muestras gratuitas mantienen los mismos permisos de sus clases, también con un acceso pago pausado; esta biblioteca no habilita grabaciones privadas. El rol admin vuelve a `/admin/classroom` y no recibe navegación de alumna. La nueva API GET `/api/classroom/recursos` verifica sesión y perfil propio, rechaza parámetros de identidad y responde con DTO privados no cacheables; nunca envía claves R2, enlaces de video, URL externa de destino o historial retirado. El lector usa cuatro índices a la vez con un timeout propio de cinco segundos por GET/HEAD; el lector original conserva su plazo predeterminado de 25 segundos. No hay nuevas tablas, almacenes, roles ni escrituras.

En el editor de una clase guardada, debajo de Video, aparece **Materiales de la clase**. Elegir el tipo **Archivo** o **Enlace**, escribir un nombre para las alumnas y usar **Adjuntar archivo** o **Guardar enlace**. “Dirección del enlace” es el destino del suplemento, no el video de Vimeo. Esta acción se guarda por separado de la ficha; si la clase ya está publicada, el material queda disponible con el acceso actual de esa clase. En una clase nueva primero se guarda el borrador, sin necesidad de salir del editor. La sección de programa **Material de apoyo** sigue agrupando videos; los materiales adjuntos pertenecen a un video concreto.

Con dos o más materiales activos aparecen flechas para moverlos arriba/abajo. Cada movimiento se guarda al instante, respeta la revisión de otra administradora y se refleja en el orden de la alumna; no modifica documentos, enlaces ni historial retirado. Los extremos quedan deshabilitados. Los cambios de nombre/destino y los materiales nuevos se guardan con su propio botón. Cerrar el editor o cambiar de tipo con datos pendientes pide confirmación; recargar/cerrar la pestaña solicita la advertencia nativa si el navegador la admite. No hay autoguardado ni recuperación de un archivo tras cerrar la pestaña. El formulario se conserva ante errores de guardado; un bloqueo inmediato evita doble envío simultáneo, sin prometer idempotencia de enlaces ante respuestas de red perdidas.

Se admiten PDF, DOCX, XLSX, PPTX, TXT, PNG, JPG/JPEG y WebP, hasta 25 MiB por archivo y 30 materiales activos por clase. Los enlaces requieren HTTPS; los permisos externos de Drive/Docs no se cambian desde la app. **Editar** modifica nombre y, para enlaces, destino. **Retirar** deja de mostrar el material sin borrar el archivo; **Materiales retirados → Restaurar** revierte esa acción. El historial tiene un límite de 100 entradas por clase. Usar material de confianza: la validación de formato no es un antivirus.

Las alumnas encuentran los adjuntos debajo del reproductor. La lista, el enlace y cada descarga verifican sesión y el mismo permiso que el video. Los archivos se descargan, no se ejecutan como páginas de la plataforma: conservan attachment, octet-stream, nosniff y `sandbox allow-downloads; default-src 'none'`. El permiso de descarga no permite scripts, formularios, mismo origen ni popups del contenido. Un error de materiales muestra su propio reintento sin impedir la reproducción. No se envían emails o push al agregar un material. La aceptación debe confirmar un archivo real guardado y abierto, no solo un enlace visible o un evento de clic; un bloqueo de Chrome o un timeout de automatización no demuestran entrega.

Persistencia privada en el bucket R2 existente: `materiales-clases/<clase>/indice-v1.json` y `archivos/<material>.<ext>`, con escrituras condicionales para no pisar otra edición. Los archivos pasan primero por `temporales/`, con URL de carga breve y ticket firmado ligado a administradora/clase. Al confirmar se valida tamaño y firma de formato y se crea otro objeto inmutable: reutilizar la URL temporal no cambia el material publicado. El reintento de confirmación no duplica ni restaura materiales retirados. Las cargas interrumpidas pueden dejar temporales; no existe limpieza automática en esta versión. Respaldar índices y archivos al transferir. No se agrega una tabla ni se cambian Auth/RLS, permisos de clases, videos o progreso.

### Administradoras

Usar `/admin/equipo` para invitar a una persona o promover explícitamente una cuenta existente y confirmada. Confirmar la dirección antes de enviar. Una invitación administrativa concede poder sobre la app y sus alumnas: no es un alta Socias ni una invitación a Vercel/GitHub. La responsable debe probar aceptación/login con la nueva persona; no se envió una invitación real nueva durante esta entrega documental.

### Avisos y emails

En `/admin/notificaciones`: elegir audiencia, redactar, revisar y guardar borrador. Publicar solo con autorización para ese mensaje y público. La publicación crea el aviso interno y procesa la cola de email solicitada bajo consentimiento; revisar el historial y continuar con Procesar pendientes del mismo aviso. No recrearlo para forzar un reenvío. Push requiere dispositivos suscriptos y permiso del navegador.

No afirmar recepción porque el estado diga aceptado. Ante un error, conservar el registro y comunicar el alcance real: publicado internamente, enviado al proveedor, pendiente o fallido. No reenviar los comunicados del evento pasado.

### Encuesta

Resultados en `/admin/encuesta`: filtros, gráficos y CSV. No contar cuenta de prueba ni admins. El Sheet es una copia de trabajo; su enlace no demuestra actualización automática. Cambiar preguntas hoy requiere desarrollo y compatibilidad con respuestas ya guardadas.

### Próximo hito (incorporación del 15/10)

En `/admin/agenda`, Flor puede reemplazar el próximo encuentro: título, fecha, hora Argentina, enlace HTTPS opcional y audiencia Desafío/Socias. **Publicar encuentro** actualiza el banner y el contador de las alumnas habilitadas, con refresco de hasta un minuto mientras la pestaña esté visible. **Guardar oculto** guarda el formulario pero retira ese encuentro de las alumnas; no es un segundo borrador paralelo al encuentro publicado. **Recargar última versión** descarta cambios locales con confirmación. Si otra administradora guardó primero, el conflicto no pisa sus cambios.

Publicar un hito NO envía comunicaciones. Usar Notificaciones por separado, revisar el público y consentimiento y no recrear avisos ya enviados. Si no hay enlace, “Entrar a la clase” se muestra deshabilitado; nunca reciclar un vivo anterior. Al día siguiente de un encuentro sin otro próximo, no queda un contador vencido.

Persistencia: objeto **privado** `plataforma/agenda-v1.json` en el bucket R2 existente, independiente de los videos. Lectura/escritura solo en servidor; validación de sesión, rol administrativo, origen, tamaño y campos; control de concurrencia ETag con `If-Match`/`If-None-Match`. No usar la tabla pública `configuracion` para enlaces privados. No requiere migración SQL ni nuevas credenciales. Respaldar ese objeto junto con el contenido operativo durante la transferencia; copiar solo el código no copia la agenda editada. El estado inicial autorizado, solo si el objeto no existe (404), es Clase 2 del 15/10/2026 a las 19:30, sin enlace.

Detalle de revisión: la lectura de agenda solicita `Accept-Encoding: identity` para conservar el ETag fuerte. Si aún llega `W/`, obtiene el validador fuerte por HEAD y verifica que corresponda al mismo objeto/cuerpo; de lo contrario falla sin sobrescribir. No enviar un ETag débil a If-Match ni quitar W/ a ciegas. Mantener las pruebas de conflictos y rechazo de comodines/listas/inyección.

### Cuenta de prueba

En `/admin/equipo`, “Cuenta de alumna de prueba” permite habilitar los módulos ya desarrollados para el identificador fijo definido en `test-accounts.ts`: clases del Desafío, Estrategia, Resultados, Métricas y Mi día. No permite elegir otra cuenta ni promover administradoras. Conserva respuestas, progreso y rol; asigna Socia activa y permisos individuales. Los módulos aún no desarrollados permanecen restringidos. La cuenta sigue excluida de estadísticas; las comunicaciones conservan sus reglas de audiencia y consentimiento, sin cambiar preferencias de email/push para habilitar módulos. Si falla un paso, se informa acceso parcial y se puede reintentar de forma idempotente, sin borrar datos.

Para probar ambos roles a la vez en Chrome, mantener la administración en `app.sociasdigitales.com` y abrir la alumna de prueba en el alias estable del mismo proyecto `socias-digitales-flor-preview-alex-santillan-projects.vercel.app`. Son dos sesiones por origen sobre la misma aplicación y base, no un preview ficticio. No compartir cookies ni tokens entre las dos. Los enlaces de alumnas, emails y recuperación siguen usando el dominio final; este alias es solo para la verificación interna. No usar las URLs inmutables de cada deployment como acceso habitual: exigirían volver a entrar en cada publicación.

### Tablero de Resultados

En `/resultados`, las Socias habilitadas ven sus comisiones aprobadas con comprobante. La carga nueva exige comisión positiva en USD, mes, descripción y captura JPG/PNG/WebP hasta 3 MB; el producto sigue siendo opcional. Indicar producto y plataforma en la descripción. El servidor conserva identidad de sesión, revisión pendiente, validación de imagen, captura privada y reintento por UUID. No cargar pesos como si fueran dólares ni el precio completo del producto como comisión.

El tablero agrupa por el mes declarado, no por la fecha de carga. Permite ventanas de 6 o 12 meses hasta un mes elegido, total, mejor mes, comparación con la ventana anterior de igual duración, promedio de todos los meses y tres picos. **Línea / Barras** cambia la representación de la misma serie y escala desde cero; comienza en línea y destaca el mejor mes, sin curvas suavizadas que inventen picos. Se puede explorar cada mes y consultar todos los importes en una tabla. Sin una base previa positiva se muestra Sin comparación, no un crecimiento supuesto del 100%. Registros no equivale a cantidad de ventas: una captura puede reunir varias. Los cálculos suman centavos enteros. Solo entran aprobados con comprobante, monto positivo válido y mes español reconocible. Se conservan los históricos incompletos y se informa cuántos quedan fuera; no se borran ni se cambia su estado. Si falla una lectura o el recuento exacto supera los 1.000 registros leídos, no se exporta un total parcial.

En `/admin/resultados`, Flor conserva revisión, rechazos, regreso a pendiente y accesos individuales. El nuevo tablero permite elegir Comunidad o una cuenta concreta. El total de comunidad no es un ingreso personal de Flor. La cuenta de prueba sigue fuera. Para aprobar, la interfaz espera la carga correcta de la captura; la API rechaza la aprobación sin comprobante registrado, también si se intenta fuera de la interfaz. La revisión continúa siendo humana, no una certificación de Hotmart/Mercado Pago/Whop ni una garantía contra capturas adulteradas.

Preparar imagen abre una vista previa de historia 1080×1920 o publicación 1080×1080, con título editorial, total, gráfico mensual, importe exacto del pico y mejor mes. Se puede elegir línea o barras para el PNG, inicialmente igual al tablero. Si existe una base previa positiva, incluye la comparación; si no, muestra cuántos meses tienen resultados. Descargar PNG guarda en el dispositivo. Compartir imagen abre el selector nativo cuando permite archivos; si no, descarga el PNG. No se publica en una red automáticamente. La imagen recibe solo agregados: sin nombres, IDs, descripciones, comprobantes ni enlaces privados. Incluye USD, período, revisión de Flor y la distinción entre comisión y facturación/ganancia neta. El total de comunidad se identifica como colectivo también en la imagen. Una cuenta no puede preparar imágenes si no tiene registros aprobados con monto/evidencia en ese período. La imagen es una instantánea; un PNG ya descargado no se revoca si Flor cambia luego un estado.

Esta versión reutiliza `resultados` y su circuito existente, sin migraciones ni nuevas credenciales. No hay desglose estructurado por plataforma, múltiples monedas, facturación bruta, devoluciones ni integraciones automáticas. Para esa segunda etapa hace falta acceso autorizado al esquema real de la app; el conector lo denegó nuevamente el 20/10. No eludirlo usando credenciales privilegiadas, metadatos ocultos en la descripción o otro almacenamiento financiero paralelo. Las métricas de campañas siguen siendo snapshots y no se suman como transacciones del tablero.

Para la siguiente etapa, separar **Plataforma de cobro** (Hotmart, Mercado Pago, Whop u otra) de **Canal de llegada** (Instagram, WhatsApp, publicidad u otro). No son el mismo origen. Las cargas históricas sin esos campos deben conservarse como Sin informar; no deducir una atribución de la descripción o de la captura. Un desglose futuro debe distinguir monto de comisiones y número de registros, sin llamar cantidad de ventas a un agregado que no registra transacciones individuales.

### Mis logros

Disponible en `/logros`, desde Tu espacio Socias Digitales, para alumnas con Socias activo (incluye compatibilidad con afiliadas heredadas activas). Gratis y Desafío continúan restringidos; una administradora vuelve al panel de Flor. No tiene un permiso independiente nuevo: es un resumen personal de módulos ya existentes. Los hitos de Métricas y Mi día solo se consultan si Flor habilitó esos módulos; esta pantalla no los desbloquea.

Se calculan ocho hitos: primera clase, tres clases, un programa completo (incluye sus videos de apoyo), primer análisis, cinco análisis, primera tarea, diez tareas y actividad en tres días distintos. Clases cuentan solo con publicación, acceso y revisión actual del video; “completada” sigue siendo la marca de la alumna, no prueba de reproducción íntegra. Un programa con contenido bloqueado o no reproducible no se considera completo. Los análisis usan el recuento exacto de registros propios, no una suma de ventas ni ingresos supuestos.

Las tareas y días de actividad corresponden a los últimos 30 días inclusivos, según la fecha asignada a la tarea en Argentina, sin tareas archivadas ni futuras. La racha termina hoy o ayer y se limita a ese período; días distintos no significa consecutivos. “Actualizar avances” vuelve a consultar los registros. Un fallo conserva la última lectura, y una fuente fallida se distingue de cero o de un permiso pendiente. La cuenta de prueba ve sus propios avances sin incorporarse a estadísticas de Flor.

No se crean insignias permanentes, certificados, nuevas tablas, puntos ni datos públicos. Las tablas heredadas de insignias se conservan sin modificaciones y no se mezclan con los hitos calculados. Cambiar tareas, completar/desmarcar clases o actualizar el catálogo/video puede cambiar el avance. No se envían emails/push ni se toca la configuración comercial al abrir o actualizar esta vista. La API GET `/api/logros` verifica sesión y plan, deriva siempre la usuaria de la sesión y responde con datos privados no cacheables; no acepta una alumna ajena. Reutiliza consultas bajo RLS, el lector de progreso y `resumen_mi_dia` existentes.

### Comparar campañas en Mis métricas

En `/metricas`, el tablero superior usa el último análisis guardado por cuenta, nombre normalizado de campaña y estrategia. La fecha tiene prioridad sobre una carga tardía; un empate se resuelve por actualización e ID. Seleccionar **Campaña A** y, si existe otra propia, **Comparar con**. Las tarjetas muestran ventas declaradas, gasto real, comisiones/neto estimados, costo por venta y conversión de mensajes a ventas. Las barras alternan ventas, gasto y neto, con escala común desde cero y valores negativos sin ocultar. **Ver evolución de A/B** lleva al historial de esa campaña, sin cambiar o borrar el formulario.

La diferencia es A menos B, no ventas nuevas entre fechas ni una prueba causal. Las conversiones se comparan en puntos porcentuales; sin denominador o importe informado, se conserva —, no cero. No se suman las fotos diarias ni se elige una campaña ganadora. Fechas, productos y madurez pueden diferir. Son datos declarados y cálculos, no las comisiones con comprobante revisadas en Resultados. Si falla el historial, el tablero no muestra cifras; al llegar a 500 análisis advierte que la vista es parcial. El formulario sigue calculando antes de guardar; el tablero solo cambia con registros confirmados. No incorpora nuevas consultas, exportaciones o escrituras.

### Reprogramar una tarea en Mi día

En `/checklist`, **Reprogramar** aparece solo en tareas pendientes no archivadas. Elegir mañana (según la fecha actual de Argentina), hoy u otra fecha válida; revisar el destino y pulsar **Confirmar nueva fecha**. **Cancelar reprogramación** no guarda nada. Mientras está abierta se bloquean cambios de día locales y otras ediciones; recargar o cerrar la pestaña solicita la advertencia nativa cuando el navegador la admite. No se intercepta el historial ni toda la navegación de la app.

Se usa PATCH de la tarea existente, con el mismo ID, propietaria, texto, categoría y creación, conservando el estado pendiente y aumentando su versión. Solo una respuesta concordante confirma éxito: la tarea sale del día de origen y un enlace abre el destino. El resumen del otro día se obtiene al refrescar o entrar en él. Un error conserva fecha y formulario; un conflicto o respuesta incoherente obliga a recargar y reabrir la versión actual, sin pisarla. La espera de red tiene un límite de 20 segundos con AbortController; abortar no demuestra que el servidor no haya guardado. Reintentar la misma operación reutiliza ID, versión y datos y permite confirmar una respuesta perdida sin duplicar. No hay operación masiva, recurrencia automática ni borrado; permisos y API existentes se mantienen.

## Preparación técnica de una modificación

Verificar deployment/commit, rama y remotos antes de editar. El repositorio correcto está en `Lombardomercato/socias-digitales-app`; no publicar sobre el origen heredado por error. Trabajar con configuración de prueba segura. Nunca copiar service role a cliente o consola de navegador.

```sh
npm ci
node --test tests/*.test.cjs
npm run build
git diff --check
```

Revisar además los archivos afectados con la configuración ESLint existente. No agregar un nuevo sistema de formato/lint para esta tarea. Leer la documentación de Next instalada antes de modificar APIs de Next 16. Si una prueba falla, determinar si es una regresión o una limitación previa y reportarlo: no eliminarla para obtener verde.

## Matriz mínima según cambio

| Circuito | Qué verificar |
| --- | --- |
| Alta gratuita | Registro real, correo de servicio, confirmación, login, encuesta obligatoria, acceso gratuito y sin privilegios de pago |
| Alta Desafío | Pendiente sin video privado; Flor aprueba/rechaza/cambia; acceso efectivo luego de aprobación; email correcto sin duplicación |
| Alta Socias | No confirma compra automáticamente; permisos respetados por API y UI |
| Perfil/contraseña | Solo edición propia, persistencia, recuperación/cambio sin romper sesión o redirecciones |
| Encuesta | Validación, avance ágil, guardado final, recarga, edición posterior, respuestas opcionales preservadas y exclusión de prueba |
| Clases | Gratuita/privada, búsqueda/programa, reproducción, minuto guardado tras recargar, completar/desmarcar, siguiente clase, video reemplazado |
| Subida admin | Guardado y multipart, reintento, finalización, límites y publicación sin duplicados; sesión sin permisos rechazada |
| Socias | Resultados/Métricas/Mi día: estado activo y permiso propio; denegar lectura/escritura ajena o sin acceso |
| Avisos | Audiencia correcta, borrador no visible, publicación única, badge no leído y limpieza tras lectura |
| Email/push | Opt-in, bajas, cola idempotente, pendientes, errores; permiso/dispositivo para push. No lanzar campañas reales como prueba |
| Equipo | Administradora invitada/confirmada y acceso correcto; una alumna no puede autopromoverse |
| Diseño | 320/360/390/430 px y escritorio; texto largo, vacío, carga/error, teclado, foco y contraste |

Usar la cuenta de prueba autorizada comunicada en el documento privado, no crear alumnas ficticias en producción ni exportar datos reales a fixtures. La exclusión está centralizada en `src/lib/test-accounts.ts`; no cambiar roles o desactivar RLS para pasar una prueba.

## Puerta de salida antes de publicar

- Diff acotado a la solicitud; sin secretos, archivos ` 2`, dumps ni lockfiles accidentales.
- Pruebas existentes y build correctos; registrar comandos, fecha y límites de la revisión.
- Capturas antes/después de las vistas afectadas con igual viewport y contenido comparable; revisar una pantalla vecina que use el mismo estilo.
- Migraciones revisadas contra el estado real, con respaldo/restauración y reversión acordados si hay datos en juego. No aplicar indiscriminadamente toda la historia heredada.
- Preview revisada y autorización de la responsable para producción. Registrar commit y deployment anterior recuperable.
- Tras publicar: login/roles, navegación, API, lectura privada de video, preferencias y aviso no leído. No una comprobación exclusiva de la portada.

## Rollback

Una regresión solo de código permite recuperar el deployment previo verificado. Eso no restaura datos, permisos, correos enviados ni archivos eliminados. Las migraciones y cambios de contenido requieren su reversión específica y un respaldo comprobado. No usar un reset global de base como supuesto rollback.

Ante un incidente: detener la acción que duplica o modifica datos; conservar logs sin secretos; comunicar qué está afectado y restaurar el alcance mínimo. No reenviar un email o borrar contenido por segunda vez para “probar”.
# Comunidad voluntaria — incorporación del 26/10/2026

- Alumna `/comunidad`: Socia activa o compatibilidad de afiliada solo si no hay un tipo explícito válido. Gratuito/Desafío explícitos y cuenta pausada/cancelada no obtienen acceso por un rol histórico. Admin vuelve a `/admin/comunidad`.
- Publicaciones de texto: avance/pregunta/idea, 2.000 caracteres; comentarios de 1.000. Límites de 20 publicaciones y 100 comentarios en 24 horas por autora, con bloqueo transaccional. La paginación usa fecha exacta e ID; nunca convertir microsegundos a una fecha redondeada.
- Guardado confirmado, UUID estable ante respuesta perdida y control de versión al editar/retirar/moderar. Un timeout no equivale a rechazo ni a éxito: conservar el intento y reintentar sin duplicarlo. Los borradores bloquean filtros/recargas locales que los descartarían.
- Retirar conserva el mensaje y permite restaurarlo; moderar requiere razón y solo oculta/muestra. Flor no reescribe texto ajeno ni restaura una retirada propia de otra autora. No hay borrado definitivo de publicaciones o comentarios desde la UI/API.
- Felicitar expresa estado deseado, con una sola fila por publicación/cuenta. Comentarios se cargan al abrir. Los contadores se calculan completos dentro de Postgres, respetando visibilidad; errores no se presentan como cero.
- Los nombres se proyectan mediante RPC acotada a autoras de contenido visible. No abrir SELECT de perfiles ajenos. No usar service_role en las APIs de Comunidad, metadata editable para permisos, avatar externo, ventas ni comprobantes como publicaciones.
- La actividad de `Alex Prueba` queda visible para esa cuenta/administración, no para otras socias ni sus conteos. No agregar datos ficticios al muro real para hacerlo parecer activo.
- Q&A anterior se conserva separada en administración, con lectura y reintento honestos; no es un segundo muro de alumnas. No se activan notificaciones por estas acciones.
- `supabase/tests/comunidad_rls.sql` usa cuentas y mensajes dentro de una transacción y ROLLBACK obligatorio; no habilita logins ni entrega correos. Verificar después cero IDs de QA y conteos originales. La migración nueva es independiente: NO ejecutar un push indiscriminado de todo el historial local, que contiene archivos anteriores y copias conflictivas ajenas a esta entrega.
- Reversión: recuperar la aplicación anterior deshabilita la entrada; no deshacer la protección de perfiles ni borrar las tablas/filas creadas después. Si fuera necesario cerrar temporalmente Comunidad, agregar una política restrictiva de mantenimiento para no administradoras mediante una migración nueva auditada. Antes de cualquier reversión de datos, respaldo y revisión del estado actual.

## Fotos, agenda y recursos — ampliación del 26/10/2026

### Fotos en Comunidad

**Agregar fotos** permite elegir hasta cuatro JPG/PNG/WebP, con vista previa, quitar y reemplazar antes de compartir. Cada original admite hasta 20 MiB y 25 megapíxeles; el celular prepara una imagen reducida. No se sube nada hasta confirmar Compartir/Guardar. Con una foto preparada el texto es opcional; sin fotos continúa siendo obligatorio. Cerrar la pestaña no conserva los archivos elegidos.

El servidor revalida un máximo de 4 MiB de entrada y 25 megapíxeles, rechaza animación y recodifica WebP hasta 2048 px/2 MiB, aplicando orientación y retirando metadatos. No es un antivirus ni un sistema de revisión de contenido. No adjuntar comprobantes, datos de clientas o documentos privados. Hay veinte reservas de fotos por cuenta y día de Argentina, incluidos intentos fallidos/cancelados; un reintento idéntico no consume otra reserva. Texto sigue disponible al alcanzar la cuota.

Los UUID y el archivo preparado se mantienen al reintentar; respuestas ambiguas no se convierten en éxito. Primero se confirman los objetos privados y después la publicación. Una foto eliminada del listado deja de servirse por la API aunque el objeto siga almacenado; retirar o moderar la publicación respeta sus permisos e historial. Toda lectura vuelve a consultar su publicación bajo RLS. No hay caché pública, optimizador de imágenes ni URL firmada compartible. Los archivos se guardan en `comunidad-fotos/archivos/` y las cuotas en `comunidad-fotos/cuotas/` del R2 actual; no hay limpieza automática de cargas huérfanas. Respaldar ambos con los registros de publicaciones. La validación HTTP comprueba el objeto R2; SQL valida metadatos y permisos, no la existencia física del archivo.

### Tu agenda mensual

En Inicio, seleccionar un día muestra tareas propias guardadas y encuentros autorizados, cada uno con su indicador. **Abrir en Mi día** lleva a esa fecha sin completar ni crear tareas. Navegación de hasta seis meses antes/después, mes actual según Argentina y horarios explícitos. Solo se consulta el agregado del mes exacto (máximo 31 días). Sin permiso de Mi día no se consultan tareas; un fallo no se muestra como cero. El calendario no interpreta textos de tareas como vínculos de clases, ni crea recordatorios o asistencia. Los encuentros siguen siendo los que publica Flor en Próximo hito; no es todavía una agenda recurrente o de múltiples eventos.

### Recursos y contactos de Flor

En el menú de Flor → **Recursos y contactos**, crear/editar borradores con nombre, identificador, orientación y enlace HTTPS opcional. Guardar no publica ni entrega el material. El catálogo comienza vacío porque los cuatro recursos aún no están definidos. Hoy se revisan hasta 200 recursos y se informa si hay más; no esconder una lectura parcial.

**Contactos y señales** permite alta manual con nombre y al menos email o teléfono, fuente declarada y preferencia de cámara. Buscar se limita a los contactos cargados; los filtros de fuente/segmento/vínculo consultan el servidor y la lista se pagina de 25 en 25. Un correo coincidente no une perfiles ni acredita una compra; la etiqueta es Sin vínculo confirmado. La confirmación de vínculos/compras queda reservada a un circuito futuro, sin controles de escritura disponibles en esta etapa.

En la ficha se registra una señal realmente observada: solicitud, clic, entrega iniciada, pedido de información o interés vigente. Solicitud/clic/entrega requieren el recurso correspondiente. El historial es inmutable desde esta versión y la UI manual registra fecha de ahora; revisar antes de guardar. Una solicitud o clic no prueba descarga/lectura. Una referencia externa repetida genera conflicto, nunca una fusión silenciosa. No ingresar contraseñas ni claves en las referencias.

Interés comercial: diez puntos por recurso distinto solicitado (máximo treinta), cuarenta por pedido explícito de información y diez por interés vigente observado en los últimos treinta días. El agregado usa todo el historial, no solo la página visible. No es un porcentaje ni una predicción; cámara y datos sensibles no puntúan. Las alumnas no reciben este módulo ni sus datos. RLS, campos protegidos y versiones se comprueban también fuera de la interfaz; no usar service_role en estas APIs.

**ManyChat y Sndflow no sincronizan todavía con este panel.** Antes de conectar: confirmar cuentas/planes, recursos y finalidad/consentimiento, definir referencias por proveedor y eventos exactos, configurar autenticación de servidor sin exponer claves, reintentos idempotentes, correspondencias de perfil verificadas y bajas. Probar un contacto y un recurso de punta a punta antes de activar automatizaciones existentes. No se importaron datos ni se activaron envíos en esta entrega. La base no sustituye una política de privacidad ni un circuito posterior de rectificación/supresión de contactos.
