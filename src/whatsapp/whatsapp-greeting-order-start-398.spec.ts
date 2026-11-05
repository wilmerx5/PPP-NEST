import { harness } from './whatsapp-accuracy.test-support';

for (const agent of [false, true]) for (const brand of ['Cocina del barrio', 'Bistro Verde']) {
  for (const greeting of ['Buena tarde', 'Buen día', 'Buena noche']) {
    it(`${brand}: singular greeting then order start agent=${agent}: ${greeting}`, async () => {
      const h = harness([], agent);
      h.cfg.brandName = brand;
      h.cfg.menuUrl = 'https://example.test/menu';
      await h.sendQueued(greeting);
      expect(h.replies).toHaveLength(1);
      expect(h.replies[0]).toMatch(/hola|buen[ao]s? (?:d[ií]as?|tardes?|noches?)/i);
      expect(h.replies[0]).toContain(brand);
      await h.sendQueued('Para hacer un pedido');
      expect(h.replies).toHaveLength(2);
      expect(h.replies[1]).not.toBe(h.replies[0]);
      expect(h.replies[1]).toMatch(/qu[eé].*(?:antoja|pedir)|dime.*plato/i);
      expect(h.agent.runTurn).not.toHaveBeenCalled();
      expect(h.conv.sessionData.cart).toEqual([]);
      expect(h.conv.customerName).toBe('Wilmer');
      expect(h.replies.join('\n')).not.toMatch(/ll[aá]manos|puedes llamar/i);
    });
  }
  it(`${brand}: combined greeting and vague order welcomes once agent=${agent}`, async () => {
    const h = harness([], agent);
    h.cfg.brandName = brand;
    h.cfg.menuUrl = 'https://example.test/menu';
    h.service.conversationService.countInboundMessages = async () => 1;
    await h.sendQueued('Buena tarde\nPara hacer un pedido');
    expect(h.replies).toHaveLength(1);
    expect(h.replies[0]).toMatch(/hola|buenas? tardes?/i);
    expect(h.replies[0]).toContain(brand);
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
  });
}

for (const agent of [false, true]) {
  it(`singular greeting preserves an open cart agent=${agent}`, async () => {
    const h = harness(undefined, agent);
    await h.sendQueued('un arroz con pollo');
    const before = structuredClone(h.conv.sessionData.cart);
    expect(before.length).toBeGreaterThan(0);
    await h.sendQueued('Buena tarde');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.replies.at(-1)).toMatch(/sigues con tu pedido/i);
  });
  it(`singular greeting with a dish still adds the dish agent=${agent}`, async () => {
    const h = harness(undefined, agent);
    await h.sendQueued('Buena tarde, un arroz con pollo');
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({quantity: 1, name: expect.stringMatching(/arroz con pollo/i)})]);
  });
}
