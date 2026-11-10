# Catálogo de productos para Afiliadas

Guía de operación del catálogo, sus materiales y los permisos por producto. **El catálogo está publicado y se comprobó la entrega de los archivos técnicos de prueba.** La vinculación comercial con Whop y Hotmart continúa pendiente; los enlaces de venta permanecen deshabilitados.

## Estado de publicación y verificación

La publicación completó su compilación y **885 pruebas automáticas**. En el recorrido real de Flor se creó una ficha con foto, se guardó como borrador, se publicó, se asociaron un copy, un PDF y un video y se autorizó exclusivamente una cuenta de prueba.

Desde esa cuenta, el borrador permaneció oculto aunque tuviera permiso; al publicarse se mostró el producto autorizado y sus tres materiales. La copia mostró **Copiado** y **Mi enlace** conservó su estado **Pendiente**, con el botón deshabilitado. Al retirar el permiso, el producto dejó de aparecer. En ese ensayo inicial se archivaron la ficha y los materiales, se retiraron sus permisos temporales y se conservaron las fichas anteriores.

Las pantallas y sus diálogos se revisaron localmente a anchos de **320, 360, 390, 430 y 1280 píxeles**, con catálogo lleno, texto largo, vacío y error. Esta comprobación local complementa el recorrido autenticado; no representa una prueba en todos los dispositivos físicos.

### Descargas verificadas el 10 de noviembre de 2026

Con una cuenta de alumna habilitada para Afiliadas y autorizada para el producto de prueba, se descargaron realmente un **PDF de 601 bytes** y un **MP4 de 2.324 bytes**, tanto desde Recursos generales como desde Materiales del producto. Los archivos recibidos desde ambos recorridos coincidieron entre sí, byte por byte y en SHA-256. El PDF abrió como documento válido de una página y se renderizó correctamente; el MP4 se decodificó completo, con 25 cuadros, resolución de 320 × 240, 25 cuadros por segundo y un segundo de duración.

La comprobación técnica utilizó la descarga del navegador iniciada con **Alt+clic**. Verifica la entrega de esos dos archivos; no prueba una carga o descarga de un video de gran tamaño, todos los dispositivos ni la captura automática del evento de descarga con un clic simple. Las **20 pruebas enfocadas de archivos** también pasaron, sin cambios de código en esta comprobación.

Antes de retirar el permiso, ambos materiales estaban publicados y disponibles. Después, abrir sus direcciones estables llevó a un aviso de archivo no disponible en Afiliadas. Esta revocación impide nuevas descargas desde la app, sin revocar los archivos ya recibidos. No se enviaron comunicaciones durante el ensayo.

Al cerrar esta comprobación se archivaron de nuevo el producto y los dos materiales técnicos, se restauraron sus asociaciones generales y se retiraron ambos permisos temporales de la cuenta de prueba. La lectura final confirmó los estados esperados y las fichas comerciales anteriores sin cambios.

**Verificación pendiente:** no se comparó el contenido exacto del portapapeles; la aceptación de copia confirma únicamente el estado visual **Copiado**.

## Origen comercial y próxima vinculación

Los productos comerciales se crean y administran en **Whop o Hotmart**. La app debe vincularlos y organizar sus materiales, visibilidad y afiliadas autorizadas. El editor local descrito en esta guía es la interfaz existente; la próxima acción **Vincular producto** todavía no está implementada.

La vinculación futura deberá guardar el proveedor y la referencia externa del producto o variante y consultar únicamente los datos que su API permita comprobar. Precio, moneda, comisión y disponibilidad necesitan una fuente comercial verificada antes de presentarse como sincronizados. No se presume sincronización de stock físico para Hotmart ni equivalencia de funciones entre proveedores.

Cada enlace de afiliada debe ser un enlace real reconocido por el proveedor. El permiso de la app controla el acceso a la ficha y a sus materiales; retirarlo no revoca por sí solo un enlace externo ya compartido. La integración comercial y ese comportamiento de revocación requieren su propia prueba antes de habilitar **Mi enlace**.

## Flor administra el catálogo

Entrar en **Afiliadas → Productos** (`/admin/afiliadas/productos`). Crear o editar una ficha permite completar nombre, descripción, categoría, marca, foto, precio, moneda, comisión y orden. Precio o comisión vacíos se muestran como **A definir**, sin sustituirlos por cero.

Cada producto tiene un estado **Borrador / Publicado / Archivado** y un control de activo. Una afiliada solo puede consultar una ficha física publicada y activa cuando tenga su permiso específico. Guardar una ficha no la publica en Whop ni confirma su stock, precio o comisión en ese proveedor.

**Afiliadas** abre los permisos de la ficha. La cuenta debe estar activa y tener habilitado el espacio general de Afiliadas antes de recibir una autorización por producto. Se pueden retirar autorizaciones anteriores aunque la cuenta haya perdido su acceso general o esté inactiva. Estos permisos no cambian el plan, el rol ni el acceso a clases.

El guardado utiliza versiones para detectar ediciones simultáneas y confirma los datos devueltos. Si la respuesta se pierde, se puede reintentar el mismo envío sin duplicar la ficha. Si otra administradora modificó el registro, actualizar antes de volver a editarlo. Las asignaciones y revocaciones conservan su historial.

## Materiales de cada producto

**Materiales** lleva al editor de recursos con ese producto seleccionado. Se pueden preparar copys, enlaces, videos y archivos propios sin crear una clase. Cada recurso conserva su estado y versión; asociarlo a un producto no lo publica automáticamente.

Un material puede ser **General** o pertenecer a un producto. Los generales siguen disponibles para las afiliadas habilitadas; los asociados requieren además acceso efectivo a esa ficha. No convertir un material específico en general para resolver un problema de permisos.

## La afiliada consulta sus productos

En `/afiliadas/productos` puede buscar, filtrar por categoría y abrir **Ver producto**. La ficha reúne **Detalle / Materiales / Mi enlace**. Solo aparecen los productos y materiales autorizados para su cuenta; un rol heredado no sustituye las habilitaciones explícitas.

Los copys se copian completos y muestran confirmación únicamente después de copiar. Los archivos propios vuelven a comprobar sesión, permisos y publicación antes de generar una descarga privada válida durante **60 segundos**. Los enlaces externos dependen también de los permisos de su destino.

Retirar un permiso, archivar un material o dejar un producto inactivo impide nuevas lecturas y firmas. No revoca archivos ya descargados ni una firma emitida hasta que venza. **Mi enlace → Pendiente**, con **Copiar enlace** deshabilitado, se mantiene hasta completar y probar la conexión comercial.

## Lecturas incompletas y recuperación

El catálogo y las listas de permisos comprueban conteos completos, con un límite de **1.000 filas por fuente**. Los materiales de productos se consultan por lotes de hasta **100 productos**, con un máximo de **1.000 recursos**. Un fallo o límite excedido muestra error y permite reintentar; no se presenta como una lista completa ni como un catálogo vacío.

Las operaciones de administración comprueban la sesión y el rol antes de leer o escribir. Las escrituras validan el origen, el tamaño del envío y los campos permitidos. Las respuestas del catálogo no incluyen contactos, credenciales ni datos del historial administrativo.

## Respaldo y comprobaciones de futuras entregas

Conservar coordinadamente las fichas, sus imágenes, los permisos generales y específicos, las asociaciones de materiales, sus archivos e índices privados y el historial. Mantener identificadores, relaciones, versiones y reglas de acceso al restaurar; no reconstruir permisos a partir del plan o de un enlace compartido.

Antes de cerrar una futura entrega, repetir el recorrido de Flor y el de una afiliada: guardar una ficha, asociar materiales, conceder y retirar permisos, copiar textos y descargar archivos. Comparar el texto copiado y los archivos recibidos con los originales. Comprobar dos cuentas con autorizaciones distintas, cuentas sin acceso o inactivas y productos en cada estado. Revisar anchos de celular de 320, 360, 390 y 430 píxeles, además de escritorio, incluyendo contenido largo, carga, vacío y error.

La publicación del catálogo no equivale a habilitar compras. Checkout, atribución de ventas, comisiones, pedidos y stock sincronizados requieren una aceptación comercial separada.
