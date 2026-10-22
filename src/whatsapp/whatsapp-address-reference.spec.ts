import { canonicalStreetAddress, splitAddressReference, splitDeliveryAddressParts } from './whatsapp-address-parts';
import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappDeliveryRoutingService } from './whatsapp-delivery-routing.service';
import { customerLocationLabel } from './whatsapp-location-label';
import { composeWhatsappOrderAddress } from './whatsapp-order-address';

describe('canonical numbered streets', () => {
  it.each([
    ['calle 38 sur 72 j 15', 'Calle 38 Sur # 72J-15'],
    ['Calle 38 Sur # 72J-15', 'Calle 38 Sur # 72J-15'],
    ['cll 38 sur #72j-15', 'Calle 38 Sur # 72J-15'],
    ['carrera 64 c 39 b 20 sur', 'Carrera 64C # 39B-20 Sur'],
    ['cra 64c #39b-20 sur', 'Carrera 64C # 39B-20 Sur'],
    ['Cra. 64c #39b - 20 Sur, Bogotá', 'Carrera 64C # 39B-20 Sur'],
    ['kr 78c no. 6d-48', 'Carrera 78C # 6D-48'],
    ['kra 78 c n° 6 d 48', 'Carrera 78C # 6D-48'],
    ['transversal 78 c 6 d 48', 'Transversal 78C # 6D-48'],
    ['tv 78c # 6d-48', 'Transversal 78C # 6D-48'],
    ['diagonal 32 # 8-15 torre 2', 'Diagonal 32 # 8-15'],
    ['dg 32 8 15', 'Diagonal 32 # 8-15'],
    ['Calle 6 bis a # 79-10', 'Calle 6 Bis A # 79-10'],
    ['calle 45 numero 12-10 apto 301', 'Calle 45 # 12-10'],
    ['av cra 68 # 5-10', 'Avenida Carrera 68 # 5-10'],
    ['avenida calle 26 # 69-76', 'Avenida Calle 26 # 69-76'],
    ['carrera 80 # 40 sur 20', 'Carrera 80 # 40-20 Sur'],
    ['carrera 7 a 20 30', 'Carrera 7A # 20-30'],
    ['Quiero que me lo lleven a la calle 10 # 5-20 por favor', 'Calle 10 # 5-20'],
    ['Conjunto Los Pinos, calle 10 #81a-20', 'Calle 10 # 81A-20'],
  ])('«%s» reads as %s', (text, street) => {
    expect(canonicalStreetAddress(text)).toBe(street);
  });
  it.each(['calle 10', 'carrera 81', 'Combo TV 78', 'Kr 78', 'frente al parque principal', 'Conjunto Los Pinos torre 3 apto 102', '2 pollos y 3 gaseosas', 'calle 10 sur'])(
    '«%s» is not a full numbered street', text => {
      expect(canonicalStreetAddress(text)).toBeNull();
    });
});

describe('references are separated from the map destination', () => {
  it.each([
    ['calle 38 sur 72 j 15, frente al parque', 'calle 38 sur 72 j 15', 'frente al parque'],
    ['calle 38 sur 72 j 15 frente al parque', 'calle 38 sur 72 j 15', 'frente al parque'],
    ['Carrera 64C # 39B-20 Sur, al lado de la droguería', 'Carrera 64C # 39B-20 Sur', 'al lado de la droguería'],
    ['transversal 78 c 6 d 48 porton negro', 'transversal 78 c 6 d 48', 'porton negro'],
    ['tv 78c # 6d-48, casa de color verde, timbre 2', 'tv 78c # 6d-48', 'casa de color verde, timbre 2'],
    ['carrera 80 # 40 sur 20 diagonal al colegio', 'carrera 80 # 40 sur 20', 'diagonal al colegio'],
    ['calle 45 # 12-10 cerca del supermercado', 'calle 45 # 12-10', 'cerca del supermercado'],
    ['calle 45 # 12-10, a dos cuadras de la estación', 'calle 45 # 12-10', 'a dos cuadras de la estación'],
    ['calle 45 # 12-10 en la esquina', 'calle 45 # 12-10', 'en la esquina'],
    ['calle 45 # 12-10, llamar al llegar', 'calle 45 # 12-10', 'llamar al llegar'],
    ['calle 45 # 12-10 (detrás de la iglesia)', 'calle 45 # 12-10', 'detrás de la iglesia'],
    ['Conjunto Los Pinos torre 3 apto 102 al lado de la iglesia', 'Conjunto Los Pinos', 'torre 3 apto 102, al lado de la iglesia'],
    ['calle 45 # 12-10 apto 301, referencia: reja blanca', 'calle 45 # 12-10', 'apto 301, referencia: reja blanca'],
  ])('«%s»', (source, base, details) => {
    expect(splitDeliveryAddressParts(source)).toEqual({ base, details });
  });
  it.each([
    'frente al parque principal', 'cerca de la estación de Banderas', 'Puerta de Teja calle 10 # 5-20', 'Diagonal 32 # 8-15',
    'Calle 10 #81A-20, Conjunto Santa Catalina Club House', 'Edificio Torre del Sol', 'Casa Blanca 2', 'Conjunto Los Pinos 2',
  ])('«%s» keeps the whole text as destination', source => {
    expect(splitAddressReference(source)).toEqual({ address: source, reference: '' });
  });
  it('the order and the customer label show the reference apart', () => {
    const session = { address: 'calle 38 sur 72 j 15, frente al parque', paymentMethod: undefined, cashChangeFor: undefined, customerNotes: undefined };
    expect(composeWhatsappOrderAddress(session as never)).toBe('calle 38 sur 72 j 15 / Ref: frente al parque');
    expect(customerLocationLabel(session.address)).toBe('calle 38 sur 72 j 15 · Referencia: frente al parque');
    expect(composeWhatsappOrderAddress({ ...session, address: 'calle 45 # 12-10' } as never)).toBe('calle 45 # 12-10');
    expect(customerLocationLabel('calle 45 # 12-10')).toBe('calle 45 # 12-10');
  });
});

type Case = { written: string; formatted: string; reference: RegExp };
const CASES: Case[] = [
  { written: 'calle 38 sur 72 j 15, frente al parque', formatted: 'Cl. 38 Sur #72j-15, Bogotá, Colombia', reference: /parque/i },
  { written: 'carrera 64 c 39 b 20 sur al lado de la droguería', formatted: 'Cra. 64c #39b-20 Sur, Bogotá, Colombia', reference: /drogu/i },
  { written: 'transversal 78 c 6 d 48, porton negro, timbre 2', formatted: 'Tv. 78c #6d-48, Bogotá, Colombia', reference: /porton|timbre/i },
];

describe('map lookup of a street with a reference', () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; });
  // Maps reports partial_match whenever extra words that are not part of the street reach the query.
  const google = (formatted: string, reference: RegExp, queries: string[]) => jest.fn().mockImplementation(async (url: string) => {
    const q = new URL(url).searchParams.get('address') || '';
    queries.push(q);
    return { status: 200, json: async () => ({ status: 'OK', results: [{ formatted_address: formatted, partial_match: reference.test(q) || !/#/.test(q),
      geometry: { location: { lat: 4.635, lng: -74.16 } }, address_components: [{ short_name: 'CO', types: ['country'] }] }] }) };
  });
  const quote = (service: WhatsappDeliveryRoutingService, customerAddress: string) => service.quoteDeliveryFee({ customerAddress,
    restaurant: { lat: 4.63, lng: -74.15 }, tiers: [{ maxKm: 2, fee: 2000 }, { maxKm: 5.5, fee: 5000 }], maxKm: 5.5, fallbackFee: 2000 });

  it.each(CASES)('$written is priced from its street', async c => {
    const service = new WhatsappDeliveryRoutingService({ get: () => 'mock-key' } as never);
    jest.spyOn(service as any, 'directionsDistance').mockResolvedValue({ distanceKm: 1.4, durationMinutes: 6 });
    const queries: string[] = [];
    global.fetch = google(c.formatted, c.reference, queries);
    expect(await quote(service, c.written)).toMatchObject({ ok: true, fee: 2000 });
    expect(queries.every(q => !c.reference.test(q))).toBe(true);
    expect(queries[0]).toContain('#');
  });

  it.each(CASES)('$written still rejects a different door from Maps', async c => {
    const service = new WhatsappDeliveryRoutingService({ get: () => 'mock-key' } as never);
    const route = jest.spyOn(service as any, 'directionsDistance');
    global.fetch = google(c.formatted.replace(/-(\d+)/, (_, n) => `-${Number(n) + 2}`), c.reference, []);
    expect(await quote(service, c.written)).toMatchObject({ ok: false, reason: 'address_ambiguous' });
    expect(route).not.toHaveBeenCalled();
  });

  it.each(CASES)('$written still rejects a partial street result', async c => {
    const service = new WhatsappDeliveryRoutingService({ get: () => 'mock-key' } as never);
    const route = jest.spyOn(service as any, 'directionsDistance');
    global.fetch = jest.fn().mockResolvedValue({ status: 200, json: async () => ({ status: 'OK', results: [{ formatted_address: c.formatted, partial_match: true,
      geometry: { location: { lat: 4.635, lng: -74.16 } }, address_components: [{ short_name: 'CO', types: ['country'] }] }] }) });
    expect(await quote(service, c.written)).toMatchObject({ ok: false, reason: 'address_ambiguous' });
    expect(route).not.toHaveBeenCalled();
  });

  it('the zone written after the cross street matches Maps writing it after the road', () => {
    const service = new WhatsappDeliveryRoutingService({ get: () => 'mock-key' } as never) as any;
    expect(service.resultMatchesNamedPlace('calle 51 a 81 h 39 sur', { formatted_address: 'Cl. 51a Sur #81h-39, Bogotá', partial_match: false })).toBe(true);
    expect(service.resultMatchesNamedPlace('calle 51 a 81 h 39 sur', { formatted_address: 'Cl. 51a #81h-39, Bogotá', partial_match: false })).toBe(false);
  });
});

describe.each([false, true])('agent %s: new address with a reference during checkout', agent => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; });
  const product = { id: 990, code: 990, name: 'Combo Pollo Asado', price: 40000, categoryName: 'Combos', availableNow: true, hasAttributes: false, attributes: [] };
  const start = async (c: Case) => {
    const h = harness([product] as never, agent);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Algo más?', actions: {} });
    h.agent.runTurn.mockResolvedValue({ reply: '¿Algo más?', actions: {}, toolCalls: [] });
    Object.assign(h.cfg, { deliveryFeeMode: 'distance', deliveryFeeTiers: [{ maxKm: 2, fee: 2000 }, { maxKm: 5.5, fee: 5000 }], deliveryMaxKm: 5.5, restaurantLat: 4.63, restaurantLng: -74.15 });
    const routing = new WhatsappDeliveryRoutingService({ get: () => 'mock-key' } as never);
    jest.spyOn(routing as any, 'directionsDistance').mockResolvedValue({ distanceKm: 1.4, durationMinutes: 6 });
    const queries: string[] = [];
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      const q = new URL(url).searchParams.get('address') || '';
      queries.push(q);
      return { status: 200, json: async () => ({ status: 'OK', results: [{ formatted_address: c.formatted, partial_match: c.reference.test(q) || !/#/.test(q),
        geometry: { location: { lat: 4.635, lng: -74.16 } }, address_components: [{ short_name: 'CO', types: ['country'] }] }] }) };
    });
    (h.service as unknown as { deliveryRouting: unknown }).deliveryRouting = routing;
    await h.sendQueued('dame un combo pollo asado');
    h.conv.sessionData.lastDeliveryAddress = 'Conjunto Las Acacias torre 2 apto 101';
    h.conv.sessionData.orderType = 'delivery';
    await h.sendQueued('nada mas');
    await h.sendQueued('a una nueva');
    return { h, queries };
  };

  it.each(CASES)('$written is accepted with its fee and keeps the reference for the driver', async c => {
    const { h, queries } = await start(c);
    const reply = String(await h.sendQueued(c.written));
    expect(reply).not.toMatch(/no pude identificar/i);
    expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
    expect(h.conv.sessionData.address).toBe(c.written);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every(q => !c.reference.test(q))).toBe(true);
    expect(composeWhatsappOrderAddress(h.conv.sessionData as never)).toMatch(/ \/ Ref: /);
  });

  it('contrast: a landmark alone is the destination and reaches Maps whole', async () => {
    const { h, queries } = await start(CASES[0]);
    await h.sendQueued('frente al parque principal');
    expect(h.conv.sessionData.address).toContain('frente al parque principal');
    expect(queries.some(q => q.includes('frente al parque principal'))).toBe(true);
  });
});
