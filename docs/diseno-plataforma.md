# Contrato visual — Socias Digitales

Fecha: 15/10/2026. Mantener el diseño editorial que ya está aprobado, no reinterpretar la marca en cada tarea. Una solicitud puntual de funcionalidad no autoriza un rediseño global.

Manual: https://socias-digitales-identidad-v5.alekeiii.chatgpt.site/manual

Las referencias del manual y los assets del repositorio prevalecen sobre estilos genéricos. Si el manual externo no carga, partir de estos tokens, los componentes actuales y las capturas; no inventar un reemplazo.

Desde el 05/11, en Afiliadas la confirmación y los errores de copiar pertenecen a la tarjeta del copy, junto al botón; no moverlos a un aviso global que pueda quedar fuera de pantalla. Mantener un anuncio accesible local y **Copiado** solo después de confirmar el portapapeles. La recuperación de una descarga retirada usa un aviso fijo con fondo blush y borde rose dentro del espacio de Afiliadas, conservando navegación y filtros; no mostrar mensajes técnicos crudos ni parámetros de la URL.

Las campañas de Afiliadas se distinguen por un encabezado verde con título blanco y cantidad clara. El verde pertenece solo al `summary`, para no aclarar por cascada los títulos de las tarjetas interiores. Avisos destacados: rose; copys: blush con texto en una superficie blanca cálida; videos: surface; archivos: crema con borde rose. El color depende del tipo de recurso y se conserva al filtrar; no alternarlo por posición. Las etiquetas siguen indicando el tipo, por lo que el color no es la única señal. Los textos secundarios sobre los rosas usan verde (contraste 6,70:1 sobre blush y 4,66:1 sobre rose); reservar el muted para fondos claros. Mantener bordes finos, controles legibles y el interior de cada campaña en paper.

## Tipografías y ritmo

| Uso | Familia | Criterio |
| --- | --- | --- |
| Título editorial principal | Playfair Display | Jerarquía clara; no volver todo italic |
| Títulos secundarios, cifras y botones de impacto | Poppins | Mezclar pesos; bold selectivo, no toda la interfaz en negrita |
| Lectura, etiquetas y controles | DM Sans | Legibilidad y consistencia |
| Identidad/acento puntual | Playlist Script | Solo como corresponde al logo/manual; no sustituir fuentes generales |

Las fuentes funcionales ya se cargan desde `src/app/layout.tsx`. H1 editorial con peso 600 y tracking cercano a -0.035em; h2/h3 Poppins. Los números deben ser claros, no una serif fina ilegible. No incorporar Geist, Inter u otra familia por usar un template nuevo.

## Tokens aprobados

| Token | Color | Aplicación |
| --- | --- | --- |
| Crema | `#F4EFEA` | Fondo general |
| Paper | `#FAF7F3` | Superficie clara |
| Surface | `#FFFDFA` | Tarjeta blanca cálida |
| Blush | `#F4CAD8` | Apoyo, selección, paneles suaves |
| Rose | `#EC9BB6` | Énfasis rosa moderado |
| Verde | `#294A38` | Acción, acento y bloques de impacto |
| Tinta | `#211C19` | Texto principal |
| Secundario | `#746A64` | Etiquetas, metadatos |
| Borde | `#E7DDD5` | Separación fina de tarjetas claras |
| Alerta | `#B01B30` | Error/advertencia equivalente al rojo; no decoración |

En verde oscuro: títulos, números y textos claros. En fondos crema/rosa: texto oscuro. No repetir el error de títulos oscuros sobre verde. Toda tarjeta que se mezcle con el fondo lleva borde fino visible. Campo monetario: una sola superficie integrada (`.sd-input-integrated`), sin rectángulo blanco interno aislando la cifra.

## Componentes que se reutilizan

- `PlatformAppearance`, `AdminSectionMenu`, `MobileNavigation`, `NavigationIcon` y `ArrowIcon`: misma navegación, flechas e iconos; no volver a emojis genéricos ni borrar iconos al cambiar texto.
- `ClassroomCliente`, `ClassroomAdmin`, `ClassPlayer` y `ClassProgressAdmin`: ampliar los existentes, no hacer otro catálogo o reproductor paralelo.
- Logo, favicon global y fotografías oficiales ya presentes. No generar gente parecida a Flor ni usar fotos sintéticas para llenar espacios.
- Radios de tarjeta del orden de 20–26 px y botones redondeados, bordes discretos y espaciado compacto coherente. Mantener la escala existente en vez de imponer un kit nuevo.
- Transiciones cortas, funcionales (aprox. 160 ms), foco visible, estados de guardado/error y botones deshabilitados honestos.

No glow, brillos, neón, degradados decorativos, sombras ornamentales fuertes o estética “IA”. No llenar el panel de explicaciones obvias como “un solo panel para todo”. Priorizar títulos, datos, fotos reales y acciones concretas.

**Decisión vigente del 23/10/2026:** retirar el efecto vidrio y las transparencias de superficies/navegación. Usar fondos sólidos de marca y bordes finos; no reintroducir blur ni glassmorphism. Se conserva el oscurecimiento de fondo habitual de los diálogos, sin desenfoque. Las celebraciones reutilizan `SuccessCelebration`: mensaje confirmado, papelitos breves y deterministas, sin sonidos, vibración ni robo de foco. Con movimiento reducido queda solo el mensaje estático. Las historias para redes reutilizan colores y tipografías de marca, sin nombres, comprobantes ni cifras privadas incorporadas automáticamente.

## Menú administrativo — ajuste del 03/11/2026

`AdminSidebar` mantiene la columna de escritorio de 264 px, con iconos alineados y títulos de grupo en estilo oración a 13 px, sin tracking amplio ni cajas redondeadas alrededor de cada grupo. Usar separadores finos, submenú con línea lateral discreta y selección rosa en la ruta activa. Conservar los 18 destinos y sus iconos; los tres grupos tienen además su propio icono. Evitar recortar o truncar nombres como «Seguimiento de Socias» y «Formación y comunidad».

El fondo de `nav[data-admin-menu]` es transparente mediante una regla limitada a `.sd-admin-shell`: neutraliza el fondo global de nav que creaba el rectángulo claro. No cambiar todos los menús para resolver este caso. Se conservan navegación fija al desplazarse, grupos plegables, badges y diálogo móvil con Escape y devolución de foco. Comprobar tanto Inicio como un grupo desplegado, además de los anchos de celular requeridos.

## Jerarquía y estados

Mantener un título principal por vista y acciones localizadas. Flor necesita operar: gestionar usuarias, clases, avisos y equipo; la alumna necesita continuar lo suyo. No mezclar menús de administración y estudio para conseguir una captura.

Los links de invitación pertenecen a su apartado, no dominan la portada administrativa. El anuncio del próximo evento es una barra fina; el contador compacto queda en la navegación lateral. No inventar una fecha nueva si la anterior ya pasó.

La alerta de no leído se ve en Avisos/Notificaciones y deja de molestar tras abrir el aviso. No reinstalar banners redundantes persistentes. Las cifras y el perfil de encuesta provienen de datos reales; no fijarlas para copiar una referencia histórica.

Un botón cuyo destino todavía no existe se muestra deshabilitado y aclarado, no como acción falsa. El acceso bloqueado puede explicar “Incluido en tu plan Socias”, pero no prometer una compra funcional mientras el destino comercial siga indefinido.

## Mobile-first, también para Flor

Verificar ancho CSS real en 320, 360, 390 y 430 px, además de 1280 o similar en escritorio. Medir `innerWidth` y `scrollWidth`, no confiar en el tamaño exterior del navegador.

- Objetivos táctiles de 44 px; inputs de al menos 16 px sin achicar las cifras protagonistas.
- Reorganizar listas operativas como tarjetas; tablas realmente anchas en región de scroll explícita.
- Video, modales, teclado y acciones fijas respetan safe areas y `100dvh`; la navegación no tapa Guardar ni controles.
- Probar texto largo, vacío, cargando, error y permiso denegado; conservar zoom de accesibilidad.
- No esconder overflow global para disimular un defecto. No bloquear pinch zoom.

## Referencias y control de cambios

Las capturas actuales están en `docs/referencias-visuales/`. Sirven como comparación de composición/jerarquía, no para copiar números o fijar contenido que cambia.

1. Capturar antes de editar, en la vista y el rol reales.
2. Cambiar un componente reutilizable o una regla acotada. Revisar qué pantallas consumen esa regla antes de tocar `globals.css`.
3. Capturar después con el mismo viewport/estado. Comparar contraste, títulos, alturas, bordes y acciones; comprobar también una vista vecina.
4. Ejecutar pruebas y build, y detallar las vistas verificadas. No sustituir una prueba de permisos por una captura bonita.

Las vistas aisladas de QA de componentes de la plataforma deben incluir `.platform-design` y su variante de alumna o administración. Un preview sin ese envoltorio no reproduce los títulos, fuentes y colores globales. Las tarjetas verdes reutilizan `bg-[#294A38]` junto con `text-white` para conservar los títulos claros bajo el tema real; comprobar también el color calculado después de publicar.

Precedente importante: el diálogo nativo del reproductor es claro; sus títulos son oscuros. Una regla anterior del overlay oscuro aplicaba títulos claros globalmente y hubo que acotarla a `.sd-video-dialog:not(dialog)`. No deshacer esa separación al “uniformar” colores.

Estas reglas reducen regresiones, pero no garantizan que una IA no rompa nada: hacen falta ramas, previews, revisión, pruebas y rollback.
