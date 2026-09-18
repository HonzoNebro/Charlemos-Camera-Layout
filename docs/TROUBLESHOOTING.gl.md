# Solución de problemas de cámaras

[English](TROUBLESHOOTING.md) · [Español](TROUBLESHOOTING.es.md)

Traballa nunha copia do mundo. Non reinstales sobre produción nin borres os axustes para investigar un fallo A/V.

## Un axuste non se ve

Comproba a escena da cabeceira: o borrador pertence a esa escena e debes volver a ela para aplicar. A previsualización é local; os demais clientes só ven o gardado tras Aplicar. Un marco necesita estar activado e ter un recurso válido: os preaxustes e a mestura conservan a súa visibilidade.

Para posición e tamaño, selecciona o control de Charlemos e desacopla a cámara explicitamente. O dock mantén as restricións nativas; Cancelar non reverte o desacoplamento. Revisa erros, referencias relativas e conflitos. Que un usuario estea desconectado non impide editalo.

## Desaparece a cámara ou o avatar

Comproba primeiro permisos, dispositivo de entrada e recepción do vídeo cos controis A/V de Foundry e posición nativa. Charlemos non inicia a cámara nin recupera un stream ausente. Nunha copia do mundo, compara coa composición desactivada e con Charlemos desactivado, conservando antes o borrador pendente.

Proba só con Charlemos e o provedor A/V necesario e reactiva os demais módulos de cámara un a un. Reutilizar ficheiros de Falemos non equivale a poder executar dous xestores de posición sobre o mesmo DOM. O fallback de tamaño só corrixe contedores internos colapsados con xeometría de Charlemos e unha vista de tamaño útil; non forza elementos ocultos ou minimizados.

## O marco recórtase ou cambia de cor

Usa límites Expandidos para sobresaír; Dentro da cámara conserva o recorte. A silueta depende da canle alfa do PNG/WebM. Os preaxustes son puntos de partida: axusta o oco transparente mediante encadre, extensións, desprazamento e escala. O vídeo conserva as súas dimensións.

Usa mestura Normal para ilustracións e retratos. Automático conserva Pantalla para rutas que conteñen `/frame`; Pantalla e Luz suave cambian o resultado segundo o fondo. Esta mestura é independente do tinte. Os bordos do navegador seguen sendo o límite; indica se ocorre nunha xanela desacoplada de Foundry 14.

## O fondo de cámara mostra o fondo nativo

Con vídeo apagado, desconectado ou sen dimensións útiles consérvase a fonte e móstrase o fondo nativo ata recuperar o feed. Inclúe o estado local, versión de Foundry e cambios de Level ao informar. Non se crea un Tile nin se garda o stream como textura de escena.

## Copias e conflitos

A Biblioteca de composicións garda modelos compartidos polo mundo. Gardar, renomear ou eliminar require confirmación e non se reverte con Cancelar escena. Cargar si entra no borrador: asigna os IDs ausentes, revisa os destinos e preme Aplicar só cando queiras compartir a escena. Un modelo modificado por outro GM debe actualizarse antes de usalo; as escenas que xa o usaron non cambian automaticamente. As copias antigas que non inclúen biblioteca non borran os modelos actuais.

Ferramentas lista composicións gardadas por nome e ID de escena. Duplicar carga un borrador destino: substitúe as cámaras da orixe, conserva os demais usuarios e exclúe o fondo. Revisa os IDs afectados. Resolve ou exclúe usuarios eliminados mediante copia selectiva; non se fan coincidencias por nome.

Se outro GM ou unha macro cambia o mesmo campo, resolve explicitamente o valor gardado ou o do borrador. Non premas Aplicar repetidamente. Ante recuperación incompleta, descarga diagnóstico e copia de seguridade antes de seguir cambiando axustes.

## Informar do fallo

Anota pasos, resultado esperado e observado, build de Foundry, navegador, rol e dock/popout/xanela desacoplada. Activa Renderer debug mode, reproduce unha vez e usa Ferramentas → Descargar diagnóstico JSON. A xanela Diagnóstico permite revisar, copiar e descargar o seu informe actual.

Revisa o ficheiro antes de compartilo: inclúe potencialmente nomes, IDs, rutas, CSS e configuracións gardadas ou pendentes. Non inclúe vídeo nin audio, pero non está anonimizado. Descargar non envía datos a ningún servidor. Achega o informe revisado e logs relevantes nas incidencias do proxecto. Desactiva debug ao rematar e conserva os logs ata confirmar a corrección.

As probas automáticas non substitúen a [validación visual](UX_ACCEPTANCE.md) con cámaras reais en Foundry 13.351 e 14.361.
