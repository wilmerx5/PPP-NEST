# Tanda377: notas parciales con referencia explícita

## VIGENTE — tanda377: nota para algunas unidades sin añadir productos

Código `c773c7cf`. «A dos de los tres churrascos sin arroz y el otro normal» podía pasar de3a6unidades. Reconoce la preposición inicial únicamente ante cantidad+«de los/las» y reutiliza el reparto existente. La variante interrogativa también podía agregar3unidades; ahora conserva el carrito y pide indicar el cambio. Sin nombres/IDs/precios del restaurante en producción.

60 regresiones nuevas:48 recorridos con DTO en PPP/catálogo sintético × agente off/mock × carrito/confirmación × nota previa presente/ausente × dígito/palabra/preposición;8guardas de ambigüedad/sumas/pregunta y4contrastes del parser. Baseline con referencia explícita:16/48fallan;32pasaban. Ampliación detectó2fallos de pregunta; foco final194/3 aprobado. Global y despliegue pendientes.

Fuentes congeladas; runner privado `.git/codex-validation-377`, worktree persistente `/home/levi/Documents/programming/PPP/ppp-staging-374-recovery`. No editar fuentes hasta terminar. Staging sigue375 (`e1256172`), controles376 integrados; producción349/Kamppo321 sin cambios. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto.

Alcance: una línea de3unidades identificada por nombre,2con nota y1sin esa nota; preserva atributos, nota previa, bebida aparte, total de unidades y checkout. Frase sin producto en carrito múltiple pide aclaración. No acredita resolución posterior de esa aclaración, múltiples líneas del mismo SKU con opciones distintas ni toda la gramática coloquial. La exploración inicial exigía modificación sin nombrar producto en carrito múltiple; esa premisa se descartó y no se contabiliza como fallo corregido. Casos derivados del problema de churrascos30/10 y de alcance de notas01/11, no replay literal de todos los chats.

Próximo: referencias «al pimer churrasco», notas distintas en varias líneas y correcciones/repeticiones tras repartir notas, verificando que no dupliquen ni borren opciones.

