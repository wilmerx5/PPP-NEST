/** Open diagnostic: execute explicitly; do not count failures as approved regressions. */
import { writeFileSync } from 'fs';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  ['Hamburguesa Clasica', 'Hamburguesa Vegetariana', 'Platano Con Queso'],
  ['Taco De Res', 'Taco De Hongos', 'Flan De Coco'],
  ['Ramen De Pollo', 'Ramen De Tofu', 'Mochi De Fresa'],
];
for (const [index, names] of menus.entries()) for (const agent of [false, true]) {
  for (const condition of ['', 'si tienes yuca mejor', 'si tienes yuca mejor para que uno venga con papas y el otro con yuca']) {
    it(`purchase preserved: menu=${index}, agent=${agent}, condition=${condition || 'none'}`, async () => {
      const products = names.map((name, i) => ({id: 99001 + i, code: 91 + i, name, price: 15000, availableNow: true, attributes: []}));
      // Actual sides exist, so accidental extra purchases are observable.
      products.push({id:99004,code:94,name:'Porcion De Yuca Frita',price:5000,availableNow:true,attributes:[]});
      products.push({id:99005,code:95,name:'Porcion De Papa Francesa',price:5000,availableNow:true,attributes:[]});
      const h = harness(products, agent);
      const catalog = new WhatsappCatalogService({} as never);
      const text = `Me das un ${names[0]} y un ${names[1]} ${condition} y 2 ${names[2]} por favor`;
      await h.sendQueued(text);
      const label = condition ? (condition.includes('para que') ? 'split' : 'conditional') : 'control';
      writeFileSync(`/tmp/ppp-192-${index}-${agent}-${label}.json`, JSON.stringify({text,replies:h.replies,cart:h.conv.sessionData.cart,state:h.conv.state,session:h.conv.sessionData,agentCalls:h.agent.runTurn.mock.calls.length,classification:{styleBrowse:catalog.extractCookingStyleBrowseIntent(text),conditionalPurchase:catalog.conditionalPurchaseText(text,products),availability:catalog.isAvailabilityInquiry(text)}},null,2));
      expect(h.conv.sessionData.cart.map(line => [line.productId,line.quantity]).sort()).toEqual([[99001,1],[99002,1],[99003,2]]);
      expect(h.replies.join('\n')).not.toMatch(/no manejamos|no pude añadir|¿qué se te antoja/i);
      expect(h.conv.state).toBe('building_cart');
    });
  }
}
