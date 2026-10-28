/** CHAT2510-28 follow-up: abbreviated lists must not partially mutate a cart. */
import { harness, products } from './whatsapp-accuracy.test-support';

const portableMenus = [
  { names: ['Pollo Frito', 'Medio Pollo Frito', 'Combo De Arroz Chino Con Costillas', 'Combo De Arroz Chino Con Pollo', 'Limonada'], short: 'el pollo y el combo de arroz', incomplete: 'el pollo frito y el combo de arroz chino' },
  { names: ['Pizza Hawaiana', 'Media Pizza Hawaiana', 'Combo De Pasta Con Hongos', 'Combo De Pasta Con Queso', 'Limonada'], short: 'la pizza y el combo de pasta', incomplete: 'la pizza hawaiana y el combo de pasta' },
  { names: ['Rollo California', 'Medio Rollo California', 'Combo De Ramen Con Tofu', 'Combo De Ramen Con Hongos', 'Limonada'], short: 'el rollo y el combo de ramen', incomplete: 'el rollo california y el combo de ramen' },
];
const fixtures = portableMenus.map(({ names, ...rest }) => ({
  ...rest, label: names[0],
  menu: names.map((name, i) => ({ id: 9801 + i, code: 9801 + i, name, price: 10000 + i * 1000, availableNow: true, hasAttributes: false, attributes: [] })),
  ids: [9801, 9802, 9803, 9804, 9805],
}));
fixtures.push({
  label: 'PPP fixture', menu: products, ids: [1, 2, 85, 97, 37],
  short: 'el pollo y el combo de arroz', incomplete: 'el pollo frito y el combo de arroz chino',
});

for (const fixture of fixtures) for (const agent of [false, true]) {
  for (const state of ['building_cart', 'awaiting_payment', 'awaiting_final_confirm']) {
    it(`${fixture.label}/${agent}/${state}: clarify the whole list, then remove only the two fully specified products`, async () => {
      const h = harness(fixture.menu, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 999, dailyOrderNumber: 99 });
      const selected = fixture.ids.map(id => fixture.menu.find(p => p.id === id)!);
      Object.assign(h.conv.sessionData, {
        cart: selected.map((p, i) => ({ productId: p.id, code: p.code, name: p.name, quantity: i === 4 ? 2 : 1, unitPrice: p.price, attributes: [], note: i === 4 ? 'Sin hielo' : undefined })),
        phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true,
      });
      h.conv.state = state;
      const before = structuredClone(h.conv.sessionData.cart);
      for (const request of [fixture.short, fixture.incomplete]) {
        await h.sendQueued(`elimina ${request}`);
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.state).toBe(state);
        expect(h.replies.at(-1)).toMatch(/No cambié el pedido/);
        expect(h.replies.at(-1)).toMatch(/nombre completo/);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      }
      const explicit = `elimina el ${selected[0].name} y el ${selected[2].name}`;
      await h.sendQueued(explicit);
      const kept = [before[1], before[3], before[4]];
      expect(h.conv.sessionData.cart).toEqual(kept);
      expect(h.conv.state).toBe(state);
      expect(h.replies.at(-1)).toMatch(/retiré los productos indicados/);
      // A retransmission cannot remove similarly named siblings.
      await h.sendQueued(explicit);
      expect(h.conv.sessionData.cart).toEqual(kept);
      expect(h.replies.at(-1)).toMatch(/no están en el carrito/);
      await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(4);
      expect(dto.items.map((item: { productId: number }) => item.productId).sort()).toEqual([fixture.ids[1], fixture.ids[3], fixture.ids[4], fixture.ids[4]].sort());
      expect(dto.items.filter((item: { productId: number }) => item.productId === fixture.ids[4]).every((item: { note: string }) => item.note === 'Sin hielo')).toBe(true);
      expect(h.replies.at(-1)).toMatch(/Sin hielo/);
    });
  }
}
