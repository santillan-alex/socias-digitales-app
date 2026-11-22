# Acceso complementario Socias Farmaci

No es un plan ni cambia el tipo de usuaria. Flor lo asigna de forma individual desde **Alumnas → Ver ficha → Socias Farmaci**. Solo se puede habilitar a una cuenta activa. Se puede retirar aunque haya quedado pausada. No se envían avisos ni se borran avances.

Para una clase, ir a **Clases → Editar / subir video**, marcar **Solo Socias Farmaci**, guardar el borrador, cargar el MP4 privado y publicar al guardar. Elegir el nombre de programa y sección en el editor como en el resto de la biblioteca. No admite Vimeo ni acceso de muestra. Una alumna Farmaci con plan gratuito conserva las muestras, pero no obtiene las clases pagas normales. No publicar materiales que deban mantenerse privados como enlaces públicos externos: el control de esos destinos es del proveedor. Usar las cargas privadas de la clase cuando corresponda.

## Probar antes de publicar

- Usar una base descartable con fixtures. Ejecutar `supabase/tests/socias_farmaci_rls.sql` solo localmente y solo tras habilitar su guardia de fixture. Validar Socia común, cuenta gratuita, Farmaci activa y pausada, anon y administradora.
- Verificar en una copia no productiva el alta/revocación, muestras existentes, URLs directas conocidas, catálogo, miniatura, reproducción, lista y descarga de materiales, escritura/lectura de progreso, recuperación tras reactivar, y pantallas móviles de Flor y alumna. No alcanzar por un solo control visual.
- Los MP4 del aula se entregan con enlace firmado temporal. Revocar bloquea nuevos permisos y lecturas, pero una firma ya emitida puede permanecer válida hasta cuatro horas. Nunca se pueden recuperar archivos ya descargados.

## Publicación y reversión

1. Con autorización separada, aplicar la migración aditiva a la base correcta. Todavía **no crear ni publicar contenido Farmaci**; una versión anterior de la app lee el catálogo con service role y no conoce la audiencia.
2. Desplegar y verificar la versión correspondiente de la app. Comprobar regresiones de las clases y programas actuales y el aislamiento con cuentas de prueba autorizadas. Solo entonces publicar clases Farmaci y asignar accesos reales indicados por Flor.
3. Para volver a una versión que no entiende Farmaci, **primero ocultar todas las clases Farmaci y comprobar que no quedan activas**. Recién entonces revertir la app. Conservar migración, permisos y avances; no borrar filas históricas para desactivar el cambio. Si ya hay enlaces firmados, esperar su TTL o aplicar un plan de revocación de almacenamiento autorizado antes de declarar que no pueden usarse.
