# Arquitectura funcional — Plataforma Socias Digitales

Estado: propuesta para aprobación antes de implementar.

Para el cambio comercial confirmado el 06/11/2026 —Flor vende y despacha físicos, Afiliadas vende con enlaces propios y Whop como checkout— consultar [Afiliadas · Productos físicos y Whop](./afiliadas-productos-whop.md). Es preparación técnica, no una integración ya activada. El estado real de producción permanece en `estado-plataforma.md`.

## 1. Principio central

La plataforma tiene **un solo acceso** y tres experiencias. La usuaria no elige un rol al iniciar sesión: el sistema reconoce su cuenta y la lleva al lugar correcto.

1. **Gratis** — conoce el método, completa su perfil y prueba una parte acotada de la experiencia.
2. **Socia** — accede al negocio, formación, comunidad, lanzamientos, resultados y beneficios habilitados.
3. **Administración** — Flor y las personas autorizadas controlan usuarias, accesos, contenidos, actividad y resultados.

Los permisos se separan de los productos. Ser administradora es una autorización; ser Gratis o Socia es una membresía. Participar de un lanzamiento es un acceso puntual. No deben volver a mezclarse en un único campo.

## 2. Lo que existe hoy y debe preservarse

- Autenticación con Supabase y un único formulario de ingreso.
- Perfil, métricas, objetivos, checklist, formación, productos, comunidad y resultados.
- Panel administrativo con personas, productos, contenidos, resultados, notificaciones y lanzamiento.
- Escritorio de lanzamiento con etapas, tareas, red social, métricas y meta de venta.
- Enlaces de afiliadas y registro de ventas/comisiones.

Problema actual: `rol` mezcla autoridad y producto (`alumna`, `afiliada`, `afiliada_lanzamiento`, `admin`). Esto obliga a redirecciones rígidas y hace difícil que una misma persona tenga varios accesos.

## 3. Modelo de acceso definitivo

### Identidad

Una cuenta en Supabase Auth representa a una persona. El perfil contiene solamente información personal y estado operativo.

### Autoridad

`perfiles.rol` queda reducido a:

- `usuario`
- `admin`

Nunca se decide autorización con datos editables por la usuaria.

### Membresía

La membresía define la experiencia comercial:

- `gratis`
- `socia`

Estados:

- `activa`
- `pausada`
- `vencida`
- `cancelada`

Debe registrar origen, fecha de inicio, fecha de fin opcional y referencia de compra o asignación administrativa.

### Accesos puntuales

Los módulos especiales se conceden por separado:

- Participación en un lanzamiento.
- Curso o programa específico.
- Beneficio, premio o contenido temporal.

Cada acceso tiene estado, fuente y vigencia. Una Socia puede participar en varios lanzamientos sin cambiar de rol.

## 4. Estructura de datos objetivo

| Entidad | Responsabilidad |
| --- | --- |
| `perfiles` | Identidad visible, contacto, país, rol administrativo y estado general. |
| `membresias` | Nivel Gratis/Socia, vigencia, origen y estado. |
| `modulos` | Catálogo de capacidades o áreas habilitables. |
| `accesos_modulos` | Qué persona puede usar qué módulo y hasta cuándo. |
| `lanzamientos` | Nombre, producto, fechas, estado y configuración de cada lanzamiento. |
| `lanzamiento_participantes` | Participación de una persona en uno o varios lanzamientos. |
| `metricas_lanzamiento` | Avance por persona y lanzamiento, nunca un registro global ambiguo. |
| `pagos` | Compras y renovaciones; fuente para activar membresías. |
| `ventas_afiliadas` | Ventas atribuidas y comisiones. |
| `links_afiliadas` | Enlaces únicos de venta por persona y producto. |

Reglas obligatorias:

- Todas las tablas expuestas tienen RLS.
- Una usuaria solo lee o modifica sus propios datos, salvo información comunitaria expresamente pública para miembros.
- Administración se valida en servidor y base de datos.
- Las compras activan accesos mediante un proceso idempotente: repetir una notificación no duplica membresías ni ventas.
- No se elimina el modelo anterior hasta migrar y comprobar sus datos.

## 5. Navegación por experiencia

### Público

- Presentación de la plataforma.
- Registro gratuito.
- Ingreso y recuperación de acceso.
- Compra o solicitud de información.

### Gratis

- Inicio simple con próximo paso.
- Perfil.
- Muestra limitada de formación.
- Muestra limitada de comunidad y resultados.
- Propuesta clara para convertirse en Socia.

### Socia

- Inicio personalizado.
- Formación completa según sus accesos.
- Comunidad, logros y resultados.
- Productos y enlaces de afiliada.
- Métricas, objetivos y herramientas de negocio.
- Lanzamientos en los que esté inscripta.
- Beneficios, premios y comunicaciones.

### Flor / Administración

- Resumen ejecutivo.
- Personas y accesos.
- Membresías, pagos y estado de actividad.
- Contenidos y productos.
- Lanzamientos y participantes.
- Resultados, testimonios y métricas.
- Comunicaciones y notificaciones.
- Configuración.

## 6. Recorridos principales

### Registro gratuito

Registro → confirmación de correo → perfil mínimo → membresía Gratis → inicio Gratis.

### Compra o alta de Socia

Pago confirmado o asignación administrativa → membresía Socia activa → accesos correspondientes → inicio Socia.

### Participación en lanzamiento

Socia seleccionada → alta en `lanzamiento_participantes` → aparece el lanzamiento en su inicio → carga avance propio → Flor ve el consolidado.

### Administración

Login común → detección de rol Admin → inicio administrativo. Flor puede entrar también en una vista de usuaria para comprobar la experiencia sin alterar permisos.

## 7. Resolución de acceso

Después de autenticar, el servidor resuelve en este orden:

1. ¿La cuenta está activa y completó el acceso inicial?
2. ¿Es administradora?
3. ¿Tiene membresía Socia vigente?
4. ¿Qué accesos puntuales tiene?
5. ¿Cuál es su próximo paso?

Destino:

- Admin → `/admin`
- Socia → `/inicio`
- Gratis → `/inicio`
- Sin perfil completo → `/bienvenida`

Las rutas vuelven a verificar el permiso en servidor. Ocultar un botón no reemplaza la seguridad.

## 8. Jerarquía de producto

La navegación no debe mostrar todas las funciones al mismo nivel.

1. **Inicio:** qué hacer hoy, progreso y una acción principal.
2. **Mi negocio:** métricas, objetivos, productos y comisiones.
3. **Aprender:** formación y recursos.
4. **Comunidad:** muro, logros y testimonios.
5. **Lanzamientos:** solo cuando exista una participación activa.
6. **Mi cuenta:** perfil, plan y ayuda.

En Admin:

1. Resumen.
2. Personas.
3. Negocio.
4. Contenido.
5. Lanzamientos.
6. Comunicación.
7. Configuración.

## 9. Qué no debemos hacer

- Tres formularios de login distintos.
- Permitir que la usuaria seleccione su propio rol o plan.
- Usar `afiliada_lanzamiento` como identidad permanente.
- Duplicar perfiles cuando una persona compra otro producto.
- Abrir módulos solo desde el frontend.
- Conectar pagos antes de definir estados, renovaciones y cancelaciones.
- Rediseñar todas las pantallas antes de estabilizar el sistema de acceso.

## 10. Orden de implementación

### Fase 0 — Inventario y respaldo

- Confirmar tablas, políticas, roles y datos reales actuales.
- Mapear las cuentas existentes a Gratis, Socia, Admin y participaciones.
- Definir responsables y fuentes de verdad.
- Preparar migración reversible.

### Fase 1 — Base de acceso

- Crear membresías, accesos y lanzamientos.
- Migrar sin borrar los campos anteriores.
- Construir un único resolutor de acceso del lado servidor.
- Añadir pruebas de permisos y rutas.

### Fase 2 — Entrada y navegación

- Unificar login, registro, bienvenida y recuperación.
- Crear `/inicio` adaptado a Gratis o Socia.
- Reemplazar redirecciones especiales por la resolución central.

### Fase 3 — Panel de Flor

- Personas y ficha completa.
- Cambios de membresía y accesos con historial.
- Participantes por lanzamiento.
- Indicadores realmente accionables.

### Fase 4 — Módulos

- Ordenar las funciones existentes dentro de la nueva jerarquía.
- Ocultar o retirar funciones sin objetivo comprobable.
- Conectar contenidos, resultados, comunidad y negocio a sus accesos.

### Fase 5 — Compra y automatización

- Definir proveedor de pago y eventos de compra.
- Activar o vencer membresías de forma segura.
- Incorporar notificaciones cuando su infraestructura esté completa.

## 11. Criterios para dar por terminada la base

- Una cuenta Gratis no puede abrir contenido de Socia escribiendo la URL.
- Una Socia conserva una única cuenta aunque compre varios productos.
- Participar en un lanzamiento no modifica su rol principal.
- Flor puede cambiar un acceso y ver quién lo cambió y cuándo.
- Una compra repetida no crea datos duplicados.
- La navegación muestra como máximo una acción principal por pantalla.
- Todas las decisiones de acceso se validan en servidor y base de datos.
- Existe una ruta de reversión antes de aplicar la migración en producción.

## 12. Decisiones pendientes de negocio

Estas decisiones deben aprobarse antes de implementar pagos o migrar datos:

1. Qué contenido exacto recibe Gratis.
2. Si Socia es pago único, suscripción o ambos.
3. Qué sucede con el acceso cuando un pago se pausa, vence o se devuelve.
4. Qué productos incluyen automáticamente la membresía Socia.
5. Quién, además de Flor, tendrá autoridad administrativa.
6. Si los lanzamientos tienen cupo, fechas de acceso y cohortes.
7. Qué datos y logros pueden mostrarse públicamente o en comunidad.

