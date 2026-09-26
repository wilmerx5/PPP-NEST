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
    searchByNameScored: (q: string, list: WhatsappCatalogProduct[]) =>
      list
        .filter((p) => p.name.toLowerCase().includes(q.toLowerCase().slice(0, 8)))
        .map((p) => ({ p, score: 50 })),
    findProductEmbeddedInMessage: (q: string, list: WhatsappCatalogProduct[]) =>
      list.find((p) => q.toLowerCase().includes('broaster') && /broaster/i.test(p.name)) ||
      null,
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

  it('add_item sin attrs marca needsAttributes', () => {
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
    const parsed = JSON.parse(raw) as { ok: boolean; needsAttributes?: boolean };
    expect(parsed.ok).toBe(false);
    expect(parsed.needsAttributes).toBe(true);
    expect(needsAttr).toBe(1);
    expect(actions.addItems).toBeUndefined();
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
});
