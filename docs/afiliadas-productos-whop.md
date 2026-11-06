# Afiliadas · Productos físicos y Whop

Preparación del 06/11/2026. **Integración comercial pendiente. Propuesta visual privada implementada; ver aceptación al final de este documento y en estado-plataforma.md.** No es una migración ni autoriza cobros o habilitaciones reales. Complementa `estado-plataforma.md` y conserva el contrato visual de `diseno-plataforma.md`.

## Decisiones confirmadas por el usuario

- Flor vende los productos físicos y se ocupa del despacho.
- Cada afiliada comparte un enlace propio para vender los productos que Flor le autorice.
- La central y los materiales viven en Socias Digitales; Whop procesa el checkout y la afiliación comercial.
- Existe una cuenta comercial de Whop. El usuario enviará su enlace después; aún no se identificó ni conectó.
- Ser Afiliada sigue siendo un permiso adicional. No sustituir tipo Socia/Desafío/Gratuito ni cambiar roles para abrir Productos.
- Porcentajes, importes, moneda, catálogo concreto y reglas comerciales no están definidos. No adoptar como decisión nueva el 20% histórico del catálogo.

Flor como vendedora permite usar una comisión por venta referida. No se necesita revenue share para que Flor conserve el importe restante. La base, las deducciones, los reversos y el momento de disponibilidad deben coincidir con la configuración real de Whop; no representar venta, comisión y retiro como el mismo estado.

## Experiencia propuesta

**Flor → Productos:** conservar el editor actual y agregar vinculación con el producto/variantes de Whop, disponibilidad comprobada, afiliadas autorizadas y materiales asociados. Separar publicación de ficha, autorización para promocionar y preparación del checkout.

**Afiliadas → Productos / Recursos / Mis ventas:** mostrar solo productos autorizados, con foto, descripción, variantes, precio y moneda comprobados, comisión correspondiente, materiales y enlace personal. Recursos mantiene los avisos y campañas que ya funcionan. Una vinculación incompleta se muestra como En configuración; no ofrece un enlace ficticio para vender.

**Comprador:** abre un enlace público de producto y afiliada, elige variante y cantidad, completa checkout y dirección de entrega; no necesita una cuenta de alumna. La devolución del navegador sirve para mostrar que se está verificando el pago. La confirmación autoritativa llega del servidor y los eventos verificados de Whop.

**Flor → Pedidos:** consultar pago, producto/variante, cantidades y datos necesarios para preparar el envío. Registrar despacho y seguimiento por separado. La afiliada ve su atribución y comisión, no la dirección ni datos privados del comprador.

## Lo que existe y lo que falta

Base local revisada: HEAD `3dc3bd0922f138ec9d129ae7d4e6268b0688f5c3`; producción `960b33ede60c11ff12d433a28c67d3859a7ccf24`. Reutilizar `ProductosAdmin`, `accesos_afiliadas`, la biblioteca de recursos, sus cargas privadas y el diseño aprobado.

El 06/11 se consultaron solo columnas, constraints y políticas del proyecto Supabase `yfsyotuykanbugxwxefv`; sin filas de personas ni escrituras. Se confirmó:

- `productos` tiene catálogo y comisión, pero no variantes, stock ni versión de edición.
- `links_afiliadas` tiene código único y unicidad de afiliada/producto; ambos UUID pueden ser nulos y sus relaciones borran en cascada. No usar esta tabla como autorización comercial.
- `ventas_afiliadas` no tiene referencia a producto ni transacción externa o moneda. No convertir sus registros en ventas Whop confirmadas.
- Las tres tablas siguen protegidas por una política restrictiva administrativa. Además existen políticas permisivas anteriores; quitar solo la restrictiva expondría más datos de lo deseado.
- La UI anterior construye `/ref/{codigo}`, sin resolver público implementado. Su RPC exige roles heredados y no consulta habilitación por producto. Reemplazar el circuito, no reactivarlo como si ya vendiera.

## Responsabilidades y datos propios propuestos

Los nombres siguientes son propuestas, no tablas ya creadas.

| Responsabilidad | Modelo propuesto | Regla |
| --- | --- | --- |
| Cuenta comercial | `integraciones_comercio` | Proveedor, ambiente y cuenta vendedora verificada. Secretos fuera de tablas públicas y DTOs. |
| Identidad | `identidades_comercio` | UUID local vinculado a identidad Whop comprobada. Sin emparejar automáticamente por nombre/email. |
| Catálogo | Productos existentes + referencias externas + variantes | Conservar UUID e historial; enlazar por cuenta/ambiente/ID externo, nunca por nombre o SKU libre. |
| Autorización | `afiliadas_productos` | PK usuaria/producto, habilitada=false inicialmente, versión y autoría. Exige cuenta activa y grant general de Afiliadas. |
| Vinculación de comisiones | Referencia afiliada/variante | Estado pendiente/verificada/revocada y configuración devuelta por Whop. Un producto no habilita variantes desconocidas por inferencia. |
| Materiales | Asociación recurso/producto | Recursos generales conservan su alcance; los de producto exigen autorización también al descargar. |
| Operación | Pedidos, items y envíos | IDs externos únicos; cantidades, moneda e importes de cada compra preservados. Estado de envío independiente del pago. |
| Comisión | Registro y conciliación propios | Separar estimación, comisión registrada, reverso y pago comprobado. Sin recalcular compras históricas con el porcentaje actual. |
| Integración | Eventos recibidos + trabajos de conciliación | Evento único por proveedor/ambiente/cuenta/ID. Reintentos, duplicados y orden de llegada no duplican ventas. |

Aplicar permisos en API y RLS; una tarjeta oculta no protege sus datos. La aprobación de Flor y la configuración de Whop tienen que coincidir. El programa global o para miembros no debe conceder afiliación que contradiga la selección de Flor. Una inscripción automática en Whop tampoco equivale a aprobación manual.

## Contrato de Whop verificado

Consultar la [API actual y sus excepciones Legacy](https://docs.whop.com/api-reference/stability) antes de implementar. La especificación pública revisada el 06/11 está en [OpenAPI](https://api.whop.com/api/v1/openapi.json); no mezclar esquemas de SDKs antiguos con rutas actuales. Fijar versión y ambiente explícitos.

- Identificar la cuenta vendedora y vincular producto/variantes existentes. Las variantes mantienen prefijo `plan_`; representan precio, atributos y disponibilidad. [Variantes](https://docs.whop.com/api-reference/variants/variant).
- La afiliación personalizada admite selección y condiciones por variante. Usar la identidad Whop y conservar los IDs/enlaces confirmados, sin fabricar un código de afiliada a partir de su UUID local. [Custom Affiliates](https://docs.whop.com/affiliates/setup-custom).
- La configuración de checkout puede llevar atribución y referencia interna de pedido fijadas en servidor. El cliente no decide precio, comisión, cuenta vendedora ni beneficiaria. [Checkout](https://docs.whop.com/api-reference/checkout-configurations/checkout-configuration).
- Recibir eventos firmados, deduplicar y consultar estado actual cuando haya discrepancias. No registrar una venta cobrada solo por un click, retorno o captura. [Webhooks](https://docs.whop.com/developer/guides/webhooks).

Stock: usar Whop como fuente de disponibilidad cuando gestione todo el inventario del piloto. Una lectura ausente, fallida o desactualizada es Sin comprobar, nunca cero ni ilimitado. Si hay ventas por fuera, será necesaria conciliación con ese canal. La existencia del campo stock no certifica reservas, reposición al devolver ni comportamiento bajo concurrencia: probarlos. El tracking registra el envío; no acredita que Whop prepare paquetes o compre etiquetas por Flor. [Físicos](https://docs.whop.com/supported-business-models/dtc-ecommerce), [Shipment](https://docs.whop.com/api-reference/shipments/shipment).

## Enlaces y revocación

Generar enlaces solo después de comprobar usuaria activa, habilitación general, aprobación de producto y configuración comercial válida. La ruta pública resolverá un código aleatorio hacia una asociación guardada. No acepta un destino, afiliada, precio o comisión arbitrarios por query.

Revocar impide emitir nuevos enlaces y resolver los propios de la app. Los enlaces directos de Whop ya compartidos requieren también la operación soportada en Whop: la app no puede prometer revocarlos solo escondiendo el producto. Conservar historia y conciliación; no borrar productos, pedidos o comisiones al revocar.

## Orden de implementación

1. Identificar cuenta Whop de Flor y un producto físico de ejemplo. Definir variantes, moneda, comisión, despacho y política de cambios/devoluciones del piloto.
2. Configurar entorno de prueba independiente. Validar lectura de catálogo, identidad comercial, atribución y restricciones antes de habilitar ventas.
3. Extender administración y central de Afiliadas: catálogo autorizado, materiales y enlaces comprobados. Revisar permisos y concurrentes sin alterar los accesos actuales.
4. Implementar pedidos/eventos/comisiones/envíos y conciliación. Los resultados Whop confirmados tienen procedencia explícita, separados de las cargas manuales previas.
5. Probar una compra completa del piloto, reembolso, duplicados, stock concurrente, retiro de permiso y recuperación de fallo. Recién entonces publicar y activar la venta real.

## Criterios de aceptación

- Dos afiliadas con autorizaciones distintas ven solo sus productos/materiales y no los de la otra; una Socia sin Afiliadas conserva sus módulos y no recibe estos permisos.
- La compra de un enlace pertenece a la afiliada correcta, con variante/cantidad/moneda y comisión verificadas; acceso sin sesión de alumna para el comprador.
- No se puede modificar la beneficiaria o el precio enviando otro dato desde el navegador.
- Un evento repetido, fuera de orden o con firma inválida no duplica ni confirma un cobro. Pago fallido/pendiente/reembolsado conserva su estado correspondiente.
- Despacho y comisión pagada requieren evidencia propia; el pago del comprador no basta para ambas cosas.
- Retirar acceso bloquea futuras operaciones propias y se comprueba su efecto real en Whop sin borrar el historial.
- Probar celular 320/360/390/430 y escritorio, texto largo, vacío, cargando, error y permisos; conservar bordes y navegación de marca.

## Estado de la preparación comercial

Cuenta comercial, producto de ejemplo y condiciones del piloto pendientes del usuario. La preparación comercial incluyó este contrato y lectura de esquema; no modificó permisos, tablas, productos, stock ni credenciales. La propuesta visual incorporada después se describe a continuación. No se ejecutaron pruebas de compra ni movimientos de dinero.

## Propuesta visual implementada — 06/11/2026

Se incorporó una vista de revisión privada para administradoras en `/propuesta/afiliadas-productos`, enlazada desde Panel de Flor → Afiliadas → Propuesta de Productos. Permite alternar Afiliada, Flor y Compradora sin cambiar la sesión o los permisos reales. Usa únicamente nombre, descripción e imagen del catálogo físico actual; no inventa importes, stock, variantes, comisiones o afiliaciones. Las consultas incompletas muestran recuperación, nunca un catálogo vacío simulado. La captura de permisos push está excluida en esta ruta de revisión.

La afiliada tiene Productos, Mis enlaces y Materiales; las fichas se recorren y el enlace queda pendiente. Flor puede revisar los apartados de catálogo, variantes, comisión, afiliadas y materiales. La ficha compradora usa imagen, nombre, descripción existente, precio/opciones por confirmar, Envíos, Cambios y devoluciones y **Comprar**. Copiar enlaces de venta y Comprar permanecen deshabilitados en la propuesta. El flujo comercial recomendado para el primer piloto es ficha propia → Comprar → checkout alojado de Whop; la ficha no nombra al proveedor en sus acciones.

Esta entrega implementa presentación y navegación de la propuesta, no las tablas/modelos comerciales ni su integración. La publicación y su aceptación se registran en `estado-plataforma.md` una vez comprobadas. Los componentes no consultan APIs de comercio ni modifican datos. El catálogo se lee en servidor después de verificar rol administrativo. Las rutas y datos de QA local no forman parte de la publicación.
