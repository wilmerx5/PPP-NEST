# Instrucciones para agentes de PPP

Antes de continuar el agente de WhatsApp, leer `docs/AGENT-HANDOFF-WHATSAPP.md`: estado verificado, próximos casos, rutas, presupuesto compartido y despliegue. Revisar también el estado actual del repositorio; el relevo es una fotografía del trabajo al 2026-10-10.

## Rama y colaboración
- La rama permanente de integración y pruebas es `staging` en `wilmerx5/PPP-NEST`; no usar las ramas históricas como fuente de deploy.
- Antes de editar: leer estas instrucciones, revisar `git status`, traer `origin/staging` y comparar el HEAD. Preservar cambios ajenos y archivos privados.
- Trabajar y publicar sobre `staging`. No crear nuevas ramas por rutina. No cambiar `Main`, fusionar a producción ni eliminar ramas sin solicitud del usuario.
- Las mejoras deben funcionar por catálogo y reglas generales; no codificar nombres, IDs o precios de PPP como excepciones de producción. Los fixtures de pruebas sí pueden usar productos concretos. Probar también catálogos sintéticos de otros restaurantes.

## Procedimiento de pruebas
- Prioridad actual: comprensión, intención de compra frente a consulta, cantidades, variantes, notas, interrupciones, correcciones y checkout breve. No desviar el trabajo hacia cocina/pagos sin necesidad de esta tarea.
- Reproducir fallos con el router completo y dependencias externas simuladas. Comprobar carrito, estado y contenido de respuesta; un carrito correcto no acredita una respuesta clara.
- Añadir regresiones por comportamiento. Ejecutar las suites afectadas, TypeScript y la suite completa cuando cambien reglas compartidas. Registrar commit, modelo, casos y resultados; no declarar vendible solo porque las pruebas pasan.
- Las pruebas gratuitas no llaman a OpenAI, Meta ni crean órdenes en sistemas externos. Nunca usar un runner con inferencia por defecto.
- La autorización de esta sesión fue de 20 solicitudes de modelo: 8 usadas, 12 restantes al 2026-10-10. Ver `docs/whatsapp-model-budget.json` y actualizar cada intento, incluidos fallos/reintentos. No reiniciar el presupuesto al cambiar agente, proceso o rama. Este registro no es permiso permanente para futuras sesiones.
- En inferencia real fijar límite explícito al saldo restante, casos focalizados, una repetición y detención ante fallo. Revisar el fallo gratis antes de gastar más. No imprimir credenciales ni subirlas a Git.

## Staging y despliegue
- Servidor autorizado: `root@76.13.119.125`; checkout `/opt/ppp-staging`; dominio `https://dev.prontopolloportal.com`.
- Usar únicamente `docker-compose.staging.yml`, `.env.staging` privado y proyecto `ppp-staging`. No usar el compose general, `--remove-orphans` ni borrar volúmenes; el aviso de `mariadb_local` no es motivo para tocarlo.
- Actualizar con `git fetch origin` y `git merge --ff-only origin/staging` estando en `staging`. Si el clon solo trae una rama vieja, añadir el refspec `+refs/heads/staging:refs/remotes/origin/staging` antes de fetch. No forzar resets sobre trabajo ajeno.
- Construir con `docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml up -d --build api`.
- Verificar HEAD, imagen/contenedor activo y health después del despliegue. Publicar una rama no equivale a desplegar. Mantener efectivo y transferencia como alcance del piloto; Mercado Pago queda fuera de esta fase.
- No confirmar órdenes externas de prueba sin comprobar aislamiento efectivo. Mantener bloqueos de avisos/cocina y destinatarios de prueba. El usuario autorizó reiniciar sus pedidos de prueba; esto no incluye borrar datos de clientes reales.
