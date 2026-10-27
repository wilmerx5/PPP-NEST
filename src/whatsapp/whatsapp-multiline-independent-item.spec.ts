import { harness } from './whatsapp-accuracy.test-support';
const menus = [
  {
    side: 'Sopa De Menudencias',
    main: 'Ejecutivo Con Pollo Broaster',
    attribute: 'Sopa',
    option: 'Menudencias',
    typo: 'menundecias',
    other: 'Ajiaco',
  },
  {
    side: 'Limonada Natural',
    main: 'Pizza Margarita',
    attribute: 'Bebida',
    option: 'Limonada',
    typo: 'limnoada',
    other: 'Agua',
  },
  {
    side: 'Crema De Champiñones',
    main: 'Bowl Vegetal',
    attribute: 'Crema',
    option: 'Champiñones',
    typo: 'champinnoes',
    other: 'Calabaza',
  },
];
for (const f of menus)
  for (const agent of [false, true])
    for (const inquiry of [false, true]) {
      it(`independent item and component ${f.main}/${agent}/${inquiry}`, async () => {
        const menu = [
          {
            id: 901,
            code: 901,
            name: f.side,
            price: 5000,
            availableNow: true,
            attributes: [],
          },
          {
            id: 902,
            code: 902,
            name: f.main,
            price: 20000,
            availableNow: true,
            hasAttributes: true,
            attributes: [
              { attributeName: f.attribute, options: [f.other, f.option] },
            ],
          },
        ];
        const h = harness(menu, agent);
        h.service.ordersService.create = jest
          .fn()
          .mockResolvedValue({ id: 999, dailyOrderNumber: 99 });
        h.service.ordersService.findTodayOrdersByPhone = jest
          .fn()
          .mockResolvedValue([]);
        Object.assign(h.conv.sessionData, {
          phoneConfirmed: true,
          contactPhone: h.conv.phoneE164,
          notesCollected: true,
        });
        await h.sendQueued(
          `Buenas tardes para un domicilio\nUna ${f.side}\nY me regala un ${f.main} con ${f.attribute} de ${f.typo}\nPara villa Serena\nApto 150\nEntrada 25${inquiry ? '\nCuánto sería para pagar por Nequi\nMe envía el número gracias' : ''}`,
        );
        expect(h.conv.sessionData.cart).toHaveLength(2);
        expect(h.conv.sessionData.cart.map((x) => x.quantity)).toEqual([1, 1]);
        expect(
          h.conv.sessionData.cart.find((x) => x.productId === 902)?.attributes,
        ).toContainEqual({
          attributeName: f.attribute,
          attributeValue: f.option,
        });
        expect(h.conv.sessionData.address).toMatch(/villa Serena/i);
        expect(h.conv.sessionData.address).toMatch(/apto 150/i);
        expect(h.conv.sessionData.address).toMatch(/Entrada 25/i);
        expect(h.replies.join('\n')).not.toMatch(
          /Cotización|Te los agrego|no manejamos/i,
        );
        if (inquiry)
          expect(h.replies.join('\n')).toMatch(/datos de cuenta|titular/);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        await h.sendQueued('contraentrega');
        expect(h.replies.at(-1)).toMatch(/confirmar/i);
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto = h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items.map((x) => x.productId).sort()).toEqual([901, 902]);
        expect(
          dto.items.find((x) => x.productId === 902).attributes,
        ).toContainEqual({
          attributeName: f.attribute,
          attributeValue: f.option,
        });
        expect(dto.address).toMatch(/villa Serena/i);
        expect(dto.address).toMatch(/apto 150/i);
        expect(h.conv.state).toBe('completed');
      });
    }
for (const [text, options, expected] of [
  ['sopa de menundecias', ['Ajiaco', 'Menudencias'], 'Menudencias'],
  [
    'sopa de menundecias',
    ['Menudencias', 'Menundecias especiales'],
    'Menundecias especiales',
  ],
  ['sopa de calabxzy', ['Calabaza', 'Calabazo'], null],
  ['con menundecias', ['Ajiaco', 'Menudencias'], null],
  ['no quiero sopa de menundecias', ['Ajiaco', 'Menudencias'], null],
] as Array<[string, string[], string | null]>)
  it(`labelled option ${text}/${options.join(',')}`, () => {
    const h = harness();
    expect(
      h.service.catalogService.pickAttributeOptionFromText(text, {
        attributeName: 'Sopa',
        options,
      }),
    ).toBe(expected);
  });
