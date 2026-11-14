import { harness, products } from './whatsapp-accuracy.test-support';

const families = [
  { meal: 'Pollo Broaster', drink: 'Gaseosa 1.5L', flavors: ['Colombiana', 'Manzana'] },
  { meal: 'Pizza Margarita', drink: 'Jugo Natural', flavors: ['Mango', 'Lulo'] },
];

function setup(family: typeof families[number], agent: boolean) {
  const menu = [
    { id: 53801, code: 81, name: family.meal, price: 24000, availableNow: true, attributes: [] },
    { id: 53802, code: 82, name: family.drink, price: 8000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Sabor', options: family.flavors }] },
  ];
  const h = harness(menu, agent);
  h.cfg.ignoreBusinessHours = false;
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 538, dailyOrderNumber: 538 });
  h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
  Object.assign(h.conv.sessionData, {
    fulfillmentChosen: true, phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true,
  });
  return h;
}

for (const agent of [false, true]) for (const mealCode of [4, 5]) for (const drinkCode of [42, 95]) {
  it(`catalog chicken and drink quotation retains both products ${agent}/${mealCode}/${drinkCode}`, async () => {
    const menu = structuredClone(products);
    const meal = menu.find(product => product.code === mealCode)!;
    const drink = menu.find(product => product.code === drinkCode)!;
    const h = harness(menu, agent);
    h.cfg.ignoreBusinessHours = false;
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 538, dailyOrderNumber: 538 });
    h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
    Object.assign(h.conv.sessionData, {
      fulfillmentChosen: true, phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true,
    });
    const quote = await h.sendQueued(`Qué cuesta ${meal.name} y una ${drink.name}?`);
    expect(quote).toContain(meal.name);
    expect(quote).toContain(drink.name);
    expect(quote).not.toMatch(/no te ofrecemos/i);
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.conv.sessionData.pendingAddOffer?.productIds).toEqual([meal.id, drink.id]);
    await h.sendQueued('Sí por favor');
    for (let step = 0; step < 3 && h.conv.sessionData.pendingAttribute; step++) {
      const pending = h.conv.sessionData.pendingAttribute;
      const attribute = pending.attributes.find(item => !pending.selected.some(value => value.attributeName === item.attributeName))!;
      await h.sendQueued(attribute.options[0]);
    }
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.sessionData.cart.map(line => [line.productId, line.quantity]).sort())
      .toEqual([[meal.id, 1], [drink.id, 1]].sort());
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`Solo sería el ${meal.name} y la ${drink.name}`);
    expect(h.conv.sessionData.cart).toEqual(before);
    await h.sendQueued('Por favor');
    expect(h.conv.sessionData.cart).toEqual(before);
    await h.sendQueued('No más');
    await h.sendQueued('contraentrega');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(2);
  });
}

for (const family of families) for (const agent of [false, true]) {
  for (const guard of ['closed', 'unavailable', 'limit']) {
    it(`acceptance retains purchase restrictions ${family.meal}/${agent}/${guard}`, async () => {
      const h = setup(family, agent);
      await h.sendQueued(`Cuánto cuesta ${family.meal}?`);
      expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(53801);
      if (guard === 'closed') {
        h.cfg.ignoreBusinessHours = false;
        h.service.businessService.getStatus = jest.fn().mockResolvedValue({ isOpen: false, message: 'Cerrado' });
      }
      if (guard === 'unavailable') {
        const menu = await h.service.catalogService.getMenuProducts();
        menu[0].availableNow = false;
      }
      if (guard === 'limit') Object.assign(h.cfg, { maxTotalUnits: 1, maxUnitsPerItem: 1 });
      await h.sendQueued(guard === 'limit' ? 'Sí, agrégame las dos' : 'Sí por favor');
      expect(h.conv.sessionData.cart).toEqual([]);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }

  for (const decline of ['No gracias', 'Mejor no']) {
    it(`declined quotation is retired ${family.meal}/${agent}/${decline}`, async () => {
      const h = setup(family, agent);
      await h.sendQueued(`Cuánto cuesta ${family.meal}?`);
      expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(53801);
      await h.sendQueued(decline);
      expect(h.conv.sessionData.cart).toEqual([]);
      expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
      await h.sendQueued('Por favor');
      expect(h.conv.sessionData.cart).toEqual([]);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }

  for (const acceptance of ['Sí por favor', 'Sí, porfa', 'Claro que sí', 'Listo, agrégalo']) {
    for (const multiple of [false, true]) {
      it(`saved quote accepts courtesy once ${family.meal}/${agent}/${multiple}/${acceptance}`, async () => {
        const h = setup(family, agent);
        await h.sendQueued(`Cuánto cuestan dos ${family.meal}${multiple ? ` y una ${family.drink}` : ''}?`);
        expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(53801);
        if (multiple) expect(h.conv.sessionData.pendingAddOffer?.productIds).toEqual([53801, 53802]);
        h.agent.runTurn.mockClear();
        await h.sendQueued(acceptance);
        expect(h.agent.runTurn).not.toHaveBeenCalled();
        if (multiple) {
          expect(h.conv.sessionData.pendingAttribute?.productId).toBe(53802);
          await h.sendQueued(family.flavors[0]);
        }
        expect(h.conv.sessionData.cart.find(line => line.productId === 53801)?.quantity).toBe(2);
        expect(h.conv.sessionData.cart).toHaveLength(multiple ? 2 : 1);
        expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
        const before = structuredClone(h.conv.sessionData.cart);
        for (const courtesy of ['Por favor', 'Gracias', 'Me repites porfa']) {
          await h.sendQueued(courtesy);
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
        }
        await h.sendQueued('No más');
        await h.sendQueued('contraentrega');
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(multiple ? 3 : 2);
      });
    }
  }

  it(`accepted quotation consumes its proposal before polite followups ${family.meal}/${agent}`, async () => {
    const h = setup(family, agent);
    await h.sendQueued(`Cuánto cuesta un ${family.meal}?`);
    expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(53801);
    await h.sendQueued('Sí por favor');
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 53801, quantity: 1 })]);
    const before = structuredClone(h.conv.sessionData.cart);
    for (const message of ['Por favor', 'Gracias', 'Listo']) {
      await h.sendQueued(message);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
    }
    await h.sendQueued(`Cuánto vale ${family.drink}?`);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.replies.at(-1)).toContain(family.drink);
    expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
    expect(h.replies.at(-1)).toContain('8.000');
    await h.sendQueued('No');
    expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
    expect(h.conv.sessionData.cart).toEqual(before);
  });

  it(`recap keeps an already chosen drink and adds the missing meal once ${family.meal}/${agent}`, async () => {
    const h = setup(family, agent);
    await h.sendQueued(`Una ${family.drink}`);
    if (h.conv.sessionData.pendingMatch) await h.sendQueued('#82');
    expect(h.conv.sessionData.pendingAttribute?.productId).toBe(53802);
    await h.sendQueued('1');
    const drink = structuredClone(h.conv.sessionData.cart[0]);
    const message = `Solo sería un ${family.meal} y una ${family.drink}`;
    await h.sendQueued(message);
    expect(h.conv.sessionData.cart.map(line => [line.productId, line.quantity]).sort())
      .toEqual([[53801, 1], [53802, 1]]);
    expect(h.conv.sessionData.cart.find(line => line.productId === 53802)).toEqual(drink);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
    await h.sendQueued(message);
    expect(h.conv.sessionData.cart.map(line => [line.productId, line.quantity]).sort())
      .toEqual([[53801, 1], [53802, 1]]);
    await h.sendQueued('No más');
    await h.sendQueued('contraentrega');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(2);
  });

  it(`option questions preserve the cart and wait for the requested flavor ${family.meal}/${agent}`, async () => {
    const h = setup(family, agent);
    await h.sendQueued(`Una ${family.drink} ${family.flavors[0]}`);
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Qué otros sabores tienes?');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.replies.at(-1)).toContain(family.flavors[1]);
    await h.sendQueued('Cambio sabor');
    expect(h.conv.sessionData.cart).toEqual(before);
    await h.sendQueued(family.flavors[1]);
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({
      productId: 53802, quantity: 1,
      attributes: [{ attributeName: 'Sabor', attributeValue: family.flavors[1] }],
    })]);
  });
}
