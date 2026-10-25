# Tanda 175 — pin rotulado con el mismo conjunto

Base36617ddc; solo staging. Pregunta del usuario: un reconocimiento de dirección no debe dejar la impresión de que el mapa ya la resolvió.

Se comprobó por router que, tras mapa ambiguo, la respuesta contiene «No pude identificar» y solicita ubicación; no confirma dirección lista ni marcada como confirmada. Esto no prueba que Maps real reconozca la calle del ejemplo. La copia puede indicar que los datos fueron anotados, acompañada de la aclaración de que no se localizaron; no se cambia esa copia en esta tanda.

Nuevo hueco reproducido: pin con locationName igual al conjunto previo (sin locationAddress nueva) descartaba torre/apto. Baseline12/12 falla. Corrección: igualdad normalizada entre locationName y base del destino previo permite conservar el destino no resuelto con sus interiores. No es coincidencia difusa; no usa nombres concretos. Pin con dirección explícita nueva sigue sustituyendo el destino. Se mantienen guardas de destino no resuelto, sin coordenadas previas, no fuera de cobertura y sin solicitud explícita de dirección nueva.

12 recorridos:3menús×agente simulado on/off×dentro/fuera cobertura. Se verifica respuesta de ambigüedad, destinatario sembrado, carrito con2unidades y nota, pin y conservación de345.6 positivos cierran orden simulada;6 negativos impiden confirmar fuera de cobertura. Suites de174 cubren pin sin nombre/enlace/destino nuevo como controles adicionales.

Foco107/107,4suites,25,802s; TypeScript general/build y Node92/92 OK. Global18.157/18.157,244suites,542hashes,683,33s; inventario exacto/fuente congelada. /tmp/ppp-175-global-summary.json. Publicado en rama staging, sin desplegar; servidor continúa hasta174. Main/producción intactas. Logs /tmp/ppp-175-{baseline,focus,tsc,node}.log. Modelos/mapas simulados; cero API/Meta/órdenes externas. Main y producción intactas. No acredita geocodificación real ni precisión de inferencia. Próximo: nombre/preguntas en recuperación, pines con nombre y dirección explícita del mismo lugar, alias del conjunto sin asumir equivalencia dudosa.
