import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';

const catalog = new WhatsappCatalogService({} as never);
for (const dish of ['Pollo Frito', 'Pescado Asado', 'Berenjena Gratinada']) {
  for (const verb of ['Me das', 'Quiero', 'Dame', 'Me regalas']) {
    it(`conditional purchase is not preparation browse: ${verb} ${dish}`, () => {
      expect(catalog.extractCookingStyleBrowseIntent(`${verb} un ${dish} si tienes yuca mejor`)).toBeNull();
    });
  }
}
for (const query of ['qué tienes frito', 'tienes algo asado', 'qué hay gratinado']) {
  it(`real preparation query is preserved: ${query}`, () => {
    expect(catalog.extractCookingStyleBrowseIntent(query)).toBeTruthy();
  });
}
for (const name of ['Pollo Frito','Pescado Asado','Berenjena Gratinada']) for (const enabled of [false,true]) {
  it(`router delegates the whole conditional order instead of listing styles: ${name}/${enabled}`, async () => {
    const menu = [name, `Combo De ${name}`].map((name,i) => ({id:99001+i,code:91+i,name,price:15000,availableNow:true,attributes:[]}));
    const h = harness(menu,enabled);
    await h.sendQueued(`Me das un ${name} si tienes yuca mejor`);
    if (enabled) expect(h.agent.runTurn).toHaveBeenCalledTimes(1);
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    expect(h.replies.join('\n')).not.toMatch(/Esto lo manejamos|cómo lo quieres|Escribe el número/i);
    if (enabled) expect(h.conv.sessionData.cart).toEqual([]); // Empty semantic result must never promise or invent an addition.
  });
}
