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
    extractCodeFromMessage: (t: string) => {
      const m = t.match(/\b(\d{1,4})\b/);
      return m ? parseInt(m[1], 10) : null;
    },
    findByCode: (code: number, list: WhatsappCatalogProduct[]) =>
      list.find((p) => p.code === code) || null,
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
});
