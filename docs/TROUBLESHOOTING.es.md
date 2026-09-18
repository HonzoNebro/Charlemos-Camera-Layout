# Solución de problemas de cámaras

[English](TROUBLESHOOTING.md) · [Galego](TROUBLESHOOTING.gl.md)

Trabaja en una copia del mundo. No reinstales sobre producción ni borres los ajustes para investigar un fallo A/V.

## Un ajuste no se ve

Comprueba la escena de la cabecera: el borrador pertenece a esa escena y debes volver a ella para aplicar. La previsualización es local; los demás clientes solo ven lo guardado tras Aplicar. Un marco necesita estar activado y tener un recurso válido: los presets y la mezcla conservan su visibilidad.

Para posición y tamaño, selecciona el control de Charlemos y desacopla la cámara explícitamente. El dock mantiene las restricciones nativas; Cancelar no revierte el desacoplamiento. Revisa errores, referencias relativas y conflictos. Que un usuario esté desconectado no impide editarlo.

## Desaparece la cámara o el avatar

Comprueba primero permisos, dispositivo de entrada y recepción del vídeo con los controles A/V de Foundry y posición nativa. Charlemos no inicia la cámara ni recupera un stream ausente. En una copia del mundo, compara con la composición desactivada y con Charlemos desactivado, conservando antes el borrador pendiente.

Prueba solo con Charlemos y el proveedor A/V necesario y reactiva los demás módulos de cámara uno a uno. Reutilizar archivos de Falemos no equivale a poder ejecutar dos gestores de posición sobre el mismo DOM. El fallback de tamaño solo corrige contenedores internos colapsados con geometría de Charlemos y una vista de tamaño útil; no fuerza elementos ocultos o minimizados.

## El marco se recorta o cambia de color

Usa límites Expandidos para sobresalir; Dentro de la cámara conserva el recorte. La silueta depende del canal alfa del PNG/WebM. Los presets son puntos de partida: ajusta el hueco transparente mediante encuadre, extensiones, desplazamiento y escala. El vídeo conserva sus dimensiones.

Usa mezcla Normal para ilustraciones y retratos. Automático conserva Pantalla para rutas que contienen `/frame`; Pantalla y Luz suave cambian el resultado según el fondo. Esta mezcla es independiente del tinte. Los bordes del navegador siguen siendo el límite; indica si ocurre en una ventana desacoplada de Foundry 14.

## El fondo de cámara muestra el fondo nativo

Con vídeo apagado, desconectado o sin dimensiones útiles se conserva la fuente y se muestra el fondo nativo hasta recuperar el feed. Incluye el estado local, versión de Foundry y cambios de Level al informar. No se crea un Tile ni se guarda el stream como textura de escena.

## Copias y conflictos

Herramientas lista composiciones guardadas por nombre e ID de escena. Duplicar carga un borrador destino: sustituye las cámaras del origen, conserva los demás usuarios y excluye el fondo. Revisa los IDs afectados. Resuelve o excluye usuarios eliminados mediante copia selectiva; no se hacen coincidencias por nombre.

Si otro GM o una macro cambia el mismo campo, resuelve explícitamente el valor guardado o el del borrador. No pulses Aplicar repetidamente. Ante recuperación incompleta, descarga diagnóstico y copia de seguridad antes de seguir cambiando ajustes.

## Informar del fallo

Anota pasos, resultado esperado y observado, build de Foundry, navegador, rol y dock/popout/ventana desacoplada. Activa Renderer debug mode, reproduce una vez y usa Herramientas → Descargar diagnóstico JSON. La ventana Diagnóstico permite revisar, copiar y descargar su informe actual.

Revisa el archivo antes de compartirlo: incluye potencialmente nombres, IDs, rutas, CSS y configuraciones guardadas o pendientes. No incluye vídeo ni audio, pero no está anonimizado. Descargar no envía datos a ningún servidor. Adjunta el informe revisado y logs relevantes en las incidencias del proyecto. Desactiva debug al terminar y conserva los logs hasta confirmar la corrección.

Las pruebas automáticas no sustituyen la [validación visual](UX_ACCEPTANCE.md) con cámaras reales en Foundry 13.351 y 14.361.
