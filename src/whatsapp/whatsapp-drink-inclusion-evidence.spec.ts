import { harness } from './whatsapp-accuracy.test-support';

describe('Drink inclusion requires explicit catalogue evidence', () => {
  for (const name of ['Bowl Del Huerto','Pizza Vegetal','Arroz Marinero']) {
    for (const enabled of [false,true]) {
      for (const [description, expected] of [
        ['No incluye bebida', 'no'],
        ['Sin gaseosa', 'no'],
        ['Incluye jugo natural', 'unknown'],
        ['Con bebida de 400ml', 'unknown'],
        ['Con papas', 'unknown'],
        ['Gaseosa opcional con costo adicional', 'unknown'],
        ['Incluye gaseosa de 400ml', 'yes'],
        ['Sin papas y con gaseosa', 'yes'],
      ] as const) {
        it(`${name}: ${description}, agent=${enabled}`, async () => {
          const h=harness([{id:88001,code:88001,name,price:25000,description,availableNow:true,attributes:[]}],enabled);
          const before=structuredClone(h.conv.sessionData.cart);
          const reply=await h.sendQueued(`el ${name.toLowerCase()} trae gaseosa?`);
          if(expected==='yes') expect(reply).toContain('Sí trae gaseosa');
          if(expected==='no') expect(reply).toContain('No trae gaseosa');
          if(expected==='unknown') {
            expect(reply).toMatch(/no tengo confirmado/i);
            expect(reply).not.toMatch(/Sí trae|No trae gaseosa/);
          }
          expect(h.conv.sessionData.cart).toEqual(before);
        });
      }
    }
  }
});
