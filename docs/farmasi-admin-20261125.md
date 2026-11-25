# Farmasi: acceso pendiente y aprobación desde el Panel de Flor

Complemento de la identificación publicada en c46b8fe. El flujo de alta y la autorización permanecen iguales: una inscripción Farmasi es una solicitud, no un derecho de acceso. El email debe estar confirmado y la cuenta activa antes de que Flor acepte el permiso exclusivo Farmasi.

- En Vista general (`/admin`), las solicitudes y alumnas habilitadas Farmasi tienen indicadores/filtros propios. No se muestran ni cuentan como Gratuitas. La misma ficha de alumna muestra el estado Farmasi y el control de aprobación antes de los campos editables.
- Los permisos combinados (Socias Digitales, Desafío y Farmasi) se muestran por separado; el plan base existente se conserva. Un resultado de consulta desconocido no equivale a una ausencia de Farmasi.
- El menú distingue Solicitudes Desafío de Invitaciones y Farmasi. `/admin/desafio` no es el registro de Farmasi y enlaza de forma explícita a las solicitudes correctas.
- `/admin/invitar#solicitudes-farmasi` muestra las solicitudes Farmasi primero. La administradora revisa y acepta cada cuenta, no se conceden derechos por una visita o registro.
- El enlace público para las alumnas continúa siendo `https://app.sociasdigitales.com/registro/farmasi`; después de la aprobación se dirige al aula.

No hay migración ni modificación retroactiva de cuentas en esta corrección de interfaz.
