import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappTurnTelemetryService } from './whatsapp-turn-telemetry.service';
import type { WhatsappCatalogProduct } from './whatsapp-catalog.service';

describe('WhatsappTurnTelemetryService', () => {
  it('guarda ring buffer y recorta a max', () => {
    const tel = new WhatsappTurnTelemetryService();
    for (let i = 0; i < 5; i++) {
      tel.record({
        path: 'agent_v1',
        outcome: 'replied',
        userTextPreview: `msg-${i}`,
      });
    }
    const recent = tel.getRecent(3);
    expect(recent).toHaveLength(3);
    expect(recent[2].userTextPreview).toBe('msg-4');
  });
});

describe('WhatsappAgentService tools (sin OpenAI)', () => {
  const products: WhatsappCatalogProduct[] = [
    {
      id: 1,
      code: 1,
      name: '1 Pollo Frito',
      price: 44000,
      hasAttributes: true,
      attributes: [
        { attributeName: 'Arepas', options: ['Blancas', 'Fritas', 'Sin arepas'] },
      ],
      availableNow: true,
      categoryName: 'Pollo',
    },
    {
      id: 5,
      code: 5,
      name: '1/2 Pollo Broaster',
      price: 26000,
      hasAttributes: true,
      attributes: [
        { attributeName: 'Arepas', options: ['Blancas', 'Fritas', 'Sin arepas'] },
      ],
      availableNow: true,
      categoryName: 'Pollo',
    },
    {
      id: 28,
      code: 28,
      name: 'Gaseosa 400ml',
      price: 4000,
      hasAttributes: true,
      attributes: [
        {
          attributeName: 'Sabor',
          options: ['Colombiana', 'Manzana', 'Pepsi'],
        },
      ],
      availableNow: true,
      categoryName: 'Bebidas',
    },
  ];

  const catalogStub = {
    swapIntent: (_text: string) => null,
    hostedMenuDrink: () => null,
    similarNamedProducts: () => [],
    resolveStandaloneDrinkOrder: () => null,
    shouldOfferMenuDrinks: () => false,
    menuDrinkProducts: () => [],
    missingStyleAlternatives: () => [],
    comesWithOffer: () => null,
    extractCookingStyleBrowseIntent: () => null,
    findProductsByCookingStyle: () => [],
    listAvailableCookingStyles: () => [],

    extractCodeFromMessage: (t: string) => {
      const m = t.match(/\b(\d{1,4})\b/);
      return m ? parseInt(m[1], 10) : null;
    },
    findByCode: (code: number, list: WhatsappCatalogProduct[]) =>
      list.find((p) => p.code === code) || null,
    uncoveredDishWords: () => [],
    listCartAttributeOptionsNamedInText: () => [],
    matchAttributeOptionValue: (value: string, options: string[]) =>
      options.find((o) => o.toLowerCase() === String(value).toLowerCase()) || null,
    uncoveredWordsAnchoredByProduct: () => [],
    productsAnchoringDish: () => [],
    isCategoryBrowseQuestion: () => false,
    isMenuExploreIntent: () => false,
    isAvailabilityInquiry: () => false,
    isProductDescriptionInquiry: () => false,
    findCategoryBrowseHit: () => null,
    findProductVariantFamily: () => null,
    resolveNamedMenuDishProduct: (q: string, list: WhatsappCatalogProduct[]) => {
      if (!/\b(ejecutivo|menu\s+especial|de\s+la\s+casa)\b/i.test(q)) return null;
      return (
        list.find((p) => /\bejecutivo\b/i.test(p.name) && /\bfrito\b/i.test(q) && /\bfrito\b/i.test(p.name)) ||
        list.find((p) => /\bejecutivo\b/i.test(p.name)) ||
        list.find((p) => /\bespecial\b/i.test(p.name) && /\bespecial\b/i.test(q)) ||
        list.find((p) => /\bcasa\b/i.test(p.name) && /\bcasa\b/i.test(q)) ||
        null
      );
    },
    resolveMultiProductOrder: (q: string, list: WhatsappCatalogProduct[]) => {
      if (!/\by\b/i.test(q)) return null;
      const hits = list.filter((p) =>
        q.toLowerCase().split(/\s+y\s+/i).some((seg) =>
          p.name.toLowerCase().includes(seg.trim().slice(0, 8)),
        ),
      );
      if (hits.length < 2) return null;
      return {
        segments: hits.map((p) => p.name),
        confident: hits.map((p) => ({ segment: p.name, product: p, score: 80 })),
        ambiguous: [],
        unresolved: [],
        needsAttributes: [],
      };
    },
    resolveEjecutivoOrderProduct: (q: string, list: WhatsappCatalogProduct[]) => {
      if (!/\bejecutivo\b/i.test(q)) return null;
      return (
        list.find((p) => /\bejecutivo\b/i.test(p.name) && /\bfrito\b/i.test(q) && /\bfrito\b/i.test(p.name)) ||
        list.find((p) => /\bejecutivo\b/i.test(p.name)) ||
        null
      );
    },
    searchByNameScored: (q: string, list: WhatsappCatalogProduct[]) =>
      list
        .filter((p) => p.name.toLowerCase().includes(q.toLowerCase().slice(0, 8)))
        .map((p) => ({ p, score: 50 })),
    isStrongProductMatch: (scored: Array<{ p: WhatsappCatalogProduct; score: number }>) => {
      if (!scored.length) return false;
      const top = scored[0].score;
      if (top >= 80) return true;
      if (scored.length === 1 && top >= 50) return true;
      return false;
    },
    findProductEmbeddedInMessage: (q: string, list: WhatsappCatalogProduct[]) =>
      list.find((p) => q.toLowerCase().includes('broaster') && /broaster/i.test(p.name)) ||
      null,
    fillDefaultAttributes: (
      product: WhatsappCatalogProduct,
      already: { attributeName: string; attributeValue: string }[] = [],
    ) => {
      const selected = [...already];
      for (const a of product.attributes || []) {
        if (selected.some((s) => s.attributeName === a.attributeName)) continue;
        if (a.options?.[0]) {
          selected.push({ attributeName: a.attributeName, attributeValue: a.options[0] });
        }
      }
      return selected;
    },
  };

  const settingsStub = {
    getEffectiveConfig: async () => ({
      openaiApiKey: null,
      openaiModel: 'gpt-4o-mini',
      systemPrompt: 'test',
      aiTemperature: 0.2,
      localContext: { publicPhone: '3118866823' },
    }),
  };

  it('sin API key responde error controlado', async () => {
    const agent = new WhatsappAgentService(
      settingsStub as never,
      catalogStub as never,
    );
    const result = await agent.runTurn({
      userMessage: 'medio broaster',
      sessionSummary: 'carrito vacío',
      recentMessages: [],
      businessRulesBlock: 'reglas',
      brandName: 'PPP',
      products,
    });
    expect(result.error).toBe('no_openai_key');
    expect(result.reply).toMatch(/3118866823/);
    expect(result.actions).toEqual({});
  });

  it('no llama a OpenAI ni agrega SKUs ante un ambiguo "2 de cada una"', async () => {
    const agent = new WhatsappAgentService(
      { getEffectiveConfig: jest.fn().mockResolvedValue({ openaiApiKey: 'dummy', localContext: {}, systemPrompt: '', openaiModel: 'gpt-4o-mini' }) } as never,
      catalogStub as never,
    );
    const result = await agent.runTurn({
      userMessage: 'Por favor me das 2 de cada una',
      sessionSummary: 'carrito vacío',
      recentMessages: ['Bot: Sopa de Ajiaco, Sopa de Menudencias y Sopa pequeña'],
      businessRulesBlock: 'solo productos válidos',
      brandName: 'PPP',
      products,
    });
    expect(result.actions).toEqual({});
    expect(result.toolCalls).toEqual([]);
    expect(result.reply).toMatch(/cu[aá]les platos/i);
  });

  it('corrige exactamente dos tipos de sopa sin inventar productos ni sumar al error', async () => {
    const agent = new WhatsappAgentService(
      { getEffectiveConfig: jest.fn().mockResolvedValue({ openaiApiKey: 'dummy', localContext: {}, systemPrompt: '', openaiModel: 'gpt-4o-mini' }) } as never,
      catalogStub as never,
    );
    const soups: WhatsappCatalogProduct[] = [
      { id: 20, code: 20, name: 'Sopa De Menudencias', categoryName: 'Sopas', price: 12000, availableNow: true, hasAttributes: false, attributes: [] },
      { id: 21, code: 21, name: 'Sopa De Ajiaco', categoryName: 'Sopas', price: 15000, availableNow: true, hasAttributes: false, attributes: [] },
      { id: 40, code: 40, name: 'Sopa pequeña', categoryName: 'Sopas', price: 8500, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sopa', options: ['Ajiaco', 'Menudencias'] }] },
      { id: 1, code: 1, name: 'Pollo Frito', categoryName: 'Pollo', price: 44000, availableNow: true, hasAttributes: false, attributes: [] },
    ];
    const result = await agent.runTurn({
      userMessage: 'No, son 4 sopas, 2 de ajiaco y 2 de menudencias',
      sessionSummary: 'carrito contiene pollo por error',
      recentMessages: [],
      businessRulesBlock: 'reglas',
      brandName: 'PPP',
      products: soups,
      cart: [{ productId: 1, name: 'Pollo Frito' }],
    });
    expect(result.actions.clearCart).toBe(true);
    expect(result.actions.addItems).toEqual([
      { productId: 21, quantity: 2 },
      { productId: 20, quantity: 2 },
    ]);
    expect(result.toolCalls).toEqual([]);
  });

  it('dirección sola no revive un pedido anterior ni agrega una pechuga sin elegir variante', async () => {
    const agent = new WhatsappAgentService(
      { getEffectiveConfig: jest.fn().mockResolvedValue({ openaiApiKey: 'dummy', localContext: {}, systemPrompt: '', openaiModel: 'gpt-4o-mini' }) } as never,
      catalogStub as never,
    );
    const result = await agent.runTurn({
      userMessage: 'Es para Casa 11 terrazas de Castilla 3',
      sessionSummary: 'carrito vacío',
      recentMessages: ['Cliente: un arroz con pollo y una pechuga'],
      businessRulesBlock: 'reglas',
      brandName: 'PPP',
      products,
    });
    expect(result.actions).toEqual({
      setAddress: 'Casa 11 terrazas de Castilla 3',
      setOrderType: 'delivery',
    });
    expect(result.actions.addItems).toBeUndefined();
    expect(result.toolCalls).toEqual([]);
  });

  it('arroz con pollo y pechuga: conserva la nota y pregunta la variante sin añadirla', async () => {
    const agent = new WhatsappAgentService(
      { getEffectiveConfig: jest.fn().mockResolvedValue({ openaiApiKey: 'dummy', localContext: {}, systemPrompt: '', openaiModel: 'gpt-4o-mini' }) } as never,
      catalogStub as never,
    );
    const dishes: WhatsappCatalogProduct[] = [
      { id: 60, code: 60, name: 'Arroz Con Pollo', categoryName: 'Arroces', price: 25000, availableNow: true, hasAttributes: false, attributes: [] },
      { id: 77, code: 77, name: 'Pechuga A La Plancha', categoryName: 'Pollo', price: 28000, availableNow: true, hasAttributes: false, attributes: [] },
      { id: 78, code: 78, name: 'Pechuga Gratinada', categoryName: 'Pollo', price: 32000, availableNow: true, hasAttributes: false, attributes: [] },
    ];
    const result = await agent.runTurn({
      userMessage: 'Un arroz con pollo sin ensalada, cambia por yuca frita. Y una pechuga, la ensalada también por yuca frita.',
      sessionSummary: 'carrito vacío',
      recentMessages: [],
      businessRulesBlock: 'reglas',
      brandName: 'PPP',
      products: dishes,
    });
    expect(result.actions.addItems).toHaveLength(1);
    expect(result.actions.addItems?.[0]).toEqual(
      expect.objectContaining({ productId: 60, quantity: 1, note: expect.stringMatching(/yuca frita/i) }),
    );
    expect(result.actions.setCustomerNotes).toMatch(/pechuga/i);
    expect(result.reply).toMatch(/plancha|gratinada/i);
    expect(result.toolCalls).toEqual([]);
  });

  it('observación de ají no duplica el carrito ni cambia el nombre del cliente', async () => {
    const agent = new WhatsappAgentService(
      { getEffectiveConfig: jest.fn().mockResolvedValue({ openaiApiKey: 'dummy', localContext: {}, systemPrompt: '', openaiModel: 'gpt-4o-mini' }) } as never,
      catalogStub as never,
    );
    const result = await agent.runTurn({
      userMessage: 'Y envías mucho ají',
      sessionSummary: 'un arroz con pollo en el carrito',
      recentMessages: ['Bot: ¿Qué más te agrego?'],
      businessRulesBlock: 'reglas', brandName: 'PPP', products,
      cart: [{ productId: 1, name: '1 Pollo Frito' }],
    });
    expect(result.actions.setCustomerNotes).toMatch(/ají/i);
    expect(result.actions.addItems).toBeUndefined();
    expect(result.actions.setCustomerName).toBeUndefined();
    expect(result.toolCalls).toEqual([]);
  });

  it('arroz chino sin presentación consulta variantes; pregunta de broaster no agrega pollo suelto', async () => {
    const agent = new WhatsappAgentService(
      { getEffectiveConfig: jest.fn().mockResolvedValue({ openaiApiKey: 'dummy', localContext: {}, systemPrompt: '', openaiModel: 'gpt-4o-mini' }) } as never,
      catalogStub as never,
    );
    const dishes: WhatsappCatalogProduct[] = [
      { id: 26, code: 26, name: 'Arroz Chino', categoryName: 'Arroces', price: 34000, availableNow: true, hasAttributes: true, attributes: [] },
      { id: 36, code: 36, name: 'Arroz Chino Con Medio Pollo', categoryName: 'Arroces', price: 45000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Pollo', options: ['Frito', 'Broaster'] }] },
    ];
    const browse = await agent.runTurn({
      userMessage: 'Para pedirte por fa un arroz chino',
      sessionSummary: 'carrito vacío', recentMessages: [],
      businessRulesBlock: 'reglas', brandName: 'PPP', products: dishes,
    });
    expect(browse.reply).toMatch(/arroz chino/i);
    expect(browse.reply).toMatch(/cu[aá]l/i);
    expect(browse.actions).toEqual({});

    const question = await agent.runTurn({
      userMessage: 'Veci, ¿el arroz chino con pollo podría ser con pollo broaster?',
      sessionSummary: 'carrito vacío', recentMessages: [],
      businessRulesBlock: 'reglas', brandName: 'PPP', products: dishes,
    });
    expect(question.reply).toMatch(/sí, el arroz chino/i);
    expect(question.reply).toMatch(/broaster/i);
    expect(question.actions).toEqual({});
  });

  it('presupuesto para almuerzo ofrece solo platos por debajo del límite', async () => {
    const agent = new WhatsappAgentService(
      { getEffectiveConfig: jest.fn().mockResolvedValue({ openaiApiKey: 'dummy', localContext: {}, systemPrompt: '', openaiModel: 'gpt-4o-mini' }) } as never,
      catalogStub as never,
    );
    const menu: WhatsappCatalogProduct[] = [
      { id: 22, code: 22, name: 'Ejecutivo Con Pollo Frito', price: 24000, availableNow: true, hasAttributes: true, attributes: [] },
      { id: 17, code: 17, name: 'Churrasco', price: 38000, availableNow: true, hasAttributes: true, attributes: [] },
      { id: 20, code: 20, name: 'Sopa De Menudencias', price: 10500, availableNow: true, hasAttributes: true, attributes: [] },
    ];
    const result = await agent.runTurn({
      userMessage: 'Voy a almorzar, qué plato tienen de menos de 25 mil?',
      sessionSummary: 'carrito vacío', recentMessages: [], businessRulesBlock: 'reglas', brandName: 'PPP', products: menu,
    });
    expect(result.reply).toMatch(/Ejecutivo Con Pollo Frito/);
    expect(result.reply).not.toMatch(/Churrasco/);
    expect(result.actions).toEqual({});
    expect(result.toolCalls).toEqual([]);
  });

  it('consulta de domicilios en Castilla no se interpreta como dirección final', async () => {
    const agent = new WhatsappAgentService(
      { getEffectiveConfig: jest.fn().mockResolvedValue({ openaiApiKey: 'dummy', localContext: {}, systemPrompt: '', openaiModel: 'gpt-4o-mini' }) } as never,
      catalogStub as never,
    );
    const result = await agent.runTurn({
      userMessage: '¿Hacen domicilios? estoy por Castilla',
      sessionSummary: 'carrito vacío', recentMessages: [], businessRulesBlock: 'reglas', brandName: 'PPP', products,
    });
    expect(result.reply).toMatch(/domicilio|cobertura/i);
    expect(result.actions).toEqual({});
    expect(result.toolCalls).toEqual([]);
  });

  it('no añade porción extra de arepas si ya son opción del pollo', () => {
    const agent = new WhatsappAgentService(settingsStub as never, new WhatsappCatalogService({} as never));
    const dishes: WhatsappCatalogProduct[] = [
      { id: 1, code: 1, name: '1 Pollo Frito', price: 41000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Arepas', options: ['Blancas', 'Fritas', 'Sin arepas'] }] },
      { id: 11, code: 11, name: 'Porcion De Arepas', price: 3500, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Arepas', options: ['Blancas', 'Fritas', 'sin arepas'] }] },
    ];
    const actions: { addItems?: unknown[] } = {};
    const response = (agent as any).executeTool('add_item', { productId: 11, quantity: 1 }, {
      products: dishes, byId: new Map(dishes.map(p=>[p.id,p])),
      actions, userMessage: 'Un pollo frito con arepas fritas',
      setNeedsAttr: () => undefined,
    });
    expect(JSON.parse(response).error).toBe('included_attribute_not_extra');
    expect(actions.addItems).toBeUndefined();
  });

  it('convierte atributos inventados en notas sin cambiar la elección válida', () => {
    const agent = new WhatsappAgentService(settingsStub as never, new WhatsappCatalogService({} as never));
    const dishes: WhatsappCatalogProduct[] = [
      { id: 23, code: 23, name: 'Arroz Con Pollo', price: 29500, availableNow: true,
        hasAttributes: true, attributes: [] },
    ];
    const actions: { addItems?: Array<{ note?: string; attributes?: unknown[] }> } = {};
    const response = (agent as any).executeTool('add_item', {
      productId: 23, quantity: 1, note: 'sin ensalada',
      attributes: [{ attributeName: 'Cambio de papas', attributeValue: 'por yuca' }],
    }, {
      products: dishes, byId: new Map(dishes.map(p=>[p.id,p])),
      actions, userMessage: 'Un arroz con pollo sin ensalada y cambia las papas por yuca',
      setNeedsAttr: () => undefined,
    });
    expect(JSON.parse(response).ok).toBe(true);
    expect(actions.addItems?.[0]?.note).toMatch(/yuca/);
    expect(actions.addItems?.[0]?.attributes).toEqual([]);
  });

  it('primera opción por defecto sin pisar atributos expresos', () => {
    const catalog = new WhatsappCatalogService({} as never);
    const item: WhatsappCatalogProduct = {
      id:36,code:36,name:'Arroz Chino Con Medio Pollo',price:45000,
      hasAttributes:true,availableNow:true,
      attributes:[{attributeName:'Pollo',options:['Frito','Broaster']}],
    };
    expect(catalog.fillDefaultAttributes(item, [])).toEqual([
      {attributeName:'Pollo',attributeValue:'Frito'},
    ]);
    expect(catalog.fillDefaultAttributes(item, [
      {attributeName:'Pollo',attributeValue:'Broaster'},
    ])).toEqual([{attributeName:'Pollo',attributeValue:'Broaster'}]);
  });

  it('executeTool search_menu por código vía reflexión de instancia', () => {
    const agent = new WhatsappAgentService(
      settingsStub as never,
      catalogStub as never,
    );
    const exec = (
      agent as unknown as {
        executeTool: (
          name: string,
          args: Record<string, unknown>,
          ctx: {
            products: WhatsappCatalogProduct[];
            byId: Map<number, WhatsappCatalogProduct>;
            actions: Record<string, unknown>;
            setNeedsAttr: (id: number) => void;
          },
        ) => string;
      }
    ).executeTool.bind(agent);

    const byId = new Map(products.map((p) => [p.id, p]));
    const actions: Record<string, unknown> = {};
    let needsAttr: number | undefined;
    const raw = exec('search_menu', { query: 'código 5' }, {
      products,
      byId,
      actions: actions as never,
      setNeedsAttr: (id) => {
        needsAttr = id;
      },
    });
    const parsed = JSON.parse(raw) as { ok: boolean; results: { id: number }[] };
    expect(parsed.ok).toBe(true);
    expect(parsed.results.some((r) => r.id === 5)).toBe(true);
    expect(needsAttr).toBeUndefined();
  });

  it('add_item sin attrs usa primera opción por defecto', () => {
    const agent = new WhatsappAgentService(
      settingsStub as never,
      catalogStub as never,
    );
    const exec = (
      agent as unknown as {
        executeTool: (
          name: string,
          args: Record<string, unknown>,
          ctx: {
            products: WhatsappCatalogProduct[];
            byId: Map<number, WhatsappCatalogProduct>;
            actions: { addItems?: unknown[] };
            setNeedsAttr: (id: number) => void;
          },
        ) => string;
      }
    ).executeTool.bind(agent);

    const byId = new Map(products.map((p) => [p.id, p]));
    const actions: { addItems?: unknown[] } = {};
    let needsAttr: number | undefined;
    const raw = exec('add_item', { productId: 1, quantity: 1 }, {
      products,
      byId,
      actions,
      setNeedsAttr: (id) => {
        needsAttr = id;
      },
    });
    const parsed = JSON.parse(raw) as {
      ok: boolean;
      needsAttributes?: boolean;
      attributes?: { attributeName: string; attributeValue: string }[];
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.needsAttributes).toBeUndefined();
    expect(needsAttr).toBeUndefined();
    expect(parsed.attributes?.[0]?.attributeValue).toBe('Blancas');
    expect(actions.addItems).toHaveLength(1);
  });

  it('add_item con attrs completa la acción', () => {
    const agent = new WhatsappAgentService(
      settingsStub as never,
      catalogStub as never,
    );
    const exec = (
      agent as unknown as {
        executeTool: (
          name: string,
          args: Record<string, unknown>,
          ctx: {
            products: WhatsappCatalogProduct[];
            byId: Map<number, WhatsappCatalogProduct>;
            actions: { addItems?: Array<{ productId: number }> };
            setNeedsAttr: (id: number) => void;
          },
        ) => string;
      }
    ).executeTool.bind(agent);

    const byId = new Map(products.map((p) => [p.id, p]));
    const actions: { addItems?: Array<{ productId: number }> } = {};
    const raw = exec(
      'add_item',
      {
        productId: 1,
        quantity: 1,
        attributes: [{ attributeName: 'Arepas', attributeValue: 'Fritas' }],
      },
      {
        products,
        byId,
        actions,
        setNeedsAttr: () => undefined,
      },
    );
    const parsed = JSON.parse(raw) as { ok: boolean };
    expect(parsed.ok).toBe(true);
    expect(actions.addItems?.[0]?.productId).toBe(1);
  });

  it('search_menu resuelve concepto carne → platos', () => {
    const productsWithMeat: WhatsappCatalogProduct[] = [
      ...products,
      {
        id: 40,
        code: 40,
        name: 'Churrasco',
        price: 28000,
        availableNow: true,
        categoryName: 'Carnes',
      },
      {
        id: 41,
        code: 41,
        name: 'Sobrebarriga',
        price: 26000,
        availableNow: true,
        categoryName: 'Carnes',
      },
    ];
    const agent = new WhatsappAgentService(
      settingsStub as never,
      catalogStub as never,
    );
    const exec = (
      agent as unknown as {
        executeTool: (
          name: string,
          args: Record<string, unknown>,
          ctx: Record<string, unknown>,
        ) => string;
      }
    ).executeTool.bind(agent);
    const byId = new Map(productsWithMeat.map((p) => [p.id, p]));
    const raw = exec(
      'search_menu',
      { query: 'tienes carne?' },
      {
        products: productsWithMeat,
        byId,
        actions: {},
        setNeedsAttr: () => undefined,
      },
    );
    const parsed = JSON.parse(raw) as {
      ok: boolean;
      mode?: string;
      concept?: string;
      results: { name: string }[];
      hint?: string;
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe('category_clean');
    expect(parsed.concept).toBe('Carne');
    expect(parsed.results.some((r) => /churrasco/i.test(r.name))).toBe(true);
    expect(parsed.hint).toMatch(/natural|NO|NUNCA/i);
  });

  it('resolve_multi_order usa el parser del catálogo', () => {
    const agent = new WhatsappAgentService(
      settingsStub as never,
      catalogStub as never,
    );
    const exec = (
      agent as unknown as {
        executeTool: (
          name: string,
          args: Record<string, unknown>,
          ctx: Record<string, unknown>,
        ) => string;
      }
    ).executeTool.bind(agent);
    const byId = new Map(products.map((p) => [p.id, p]));
    const raw = exec(
      'resolve_multi_order',
      { text: '1 Pollo Frito y Gaseosa 400ml' },
      {
        products,
        byId,
        actions: {},
        setNeedsAttr: () => undefined,
      },
    );
    const parsed = JSON.parse(raw) as {
      ok: boolean;
      confident: { id: number; name: string }[];
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.confident.length).toBeGreaterThanOrEqual(2);
  });

  it('order_status marca la consulta del pedido ya hecho', () => {
    const agent = new WhatsappAgentService(
      settingsStub as never,
      catalogStub as never,
    );
    const exec = (
      agent as unknown as {
        executeTool: (
          name: string,
          args: Record<string, unknown>,
          ctx: Record<string, unknown>,
        ) => string;
      }
    ).executeTool.bind(agent);
    let lookedUp: number | undefined = -1;
    const raw = exec(
      'order_status',
      {},
      {
        products,
        byId: new Map(),
        actions: {},
        setNeedsAttr: () => undefined,
        setLookupOrder: (n?: number) => {
          lookedUp = n;
        },
      },
    );
    expect(JSON.parse(raw).ok).toBe(true);
    expect(lookedUp).toBeUndefined();
  });
});
