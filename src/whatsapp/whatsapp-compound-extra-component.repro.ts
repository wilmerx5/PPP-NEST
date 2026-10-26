/** Opt-in: explicitly buying the compound dish AND its component. Two rice cases remain red. */
import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { writeFileSync } from 'fs';
const menus = [
  { key: 'rice', name: 'Arroz Especial Con Medio Pollo', component: 'Medio Pollo', style: 'Frito' },
  { key: 'bowl', name: 'Bowl De Quinoa Con Tofu', component: 'Tofu', style: 'Asado' },
  { key: 'pasta', name: 'Pasta Con Champinones', component: 'Champinones', style: 'Salteados' },
];
for (const m of menus) for (const agent of [false, true]) {
  const menu = [
    { id: 88101, code: 88101, name: m.name, description: 'Incluye ensalada', price: 20000,
      availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Preparación', options: [m.style, 'Normal'] }] },
    { id: 88102, code: 88102, name: m.component, description: 'Porción independiente', price: 9000,
      availableNow: true, hasAttributes: false, attributes: [] },
    { id: 88103, code: 88103, name: 'Gaseosa 400ml', description: 'Bebida independiente', price: 4000,
      availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Manzana', 'Pepsi'] }] },
  ];
  for (const reverse of [false, true]) it(`independent component ${m.key}/${agent}/${reverse}`, async () => {
    const h = harness(menu, agent);
    const meals = [`un ${m.name} ${m.style}`, `un ${m.component}`];
    if (reverse) meals.reverse();
    await h.sendQueued(`Quiero ${meals.join(' y ')} y una gaseosa 400ml Pepsi aparte`);
    expect(h.conv.sessionData.cart.map(line => line.productId).sort()).toEqual([88101, 88102, 88103]);
    expect(h.conv.sessionData.cart.every(line => line.quantity === 1)).toBe(true);
  });
}
