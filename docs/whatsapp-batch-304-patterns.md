## VIGENTE — tanda304: opciones conjuntas en cambios mixtos (29/10)

Base `08b17ed2`. Resuelve «fresa y vaso», orden inverso, coma/punto y coma, etiquetas «Sabor: Fresa; Presentacion: Vaso», con/en y cortesía final. Usa valores exactos normalizados del catálogo, exige todas las opciones restantes, una asignación inequívoca por atributo y conserva los atributos previamente elegidos. Todas las unidades añadidas comparten esa elección. Retirada y adición siguen siendo atómicas; reutiliza controles de catálogo, carrito, precio, pago y límites. No interpreta combinaciones distintas por unidad ni lenguaje libre general.

326 pruebas nuevas:288 recorridos (3 catálogos ×agente simulado off/on ×origen único/ambiguo ×destino nuevo/existente ×cantidad1/3 ×6 frases),16 rechazos con recuperación,20 controles y2 casos tras atributo previo. Baseline304/304 fallidos; foco inicial940/3 aprobado. Los22 controles finales incluidos en global: 28890 pruebas/371 suites, inventario exacto y fuentes congeladas. TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-304-validation.json`.

Despliegue staging pendiente. Último runtime verificado: staging302, producción292, Kamppo282. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. Pendiente: reparto de varios atributos por unidad y opciones sin separadores explícitos. Sin revisión nueva de medios originales.

