import { WhatsappDeliveryRoutingService } from './whatsapp-delivery-routing.service';

const originalFetch = global.fetch;
afterEach(() => {global.fetch = originalFetch; jest.restoreAllMocks();});
const cases = [
  ['Calle 10 #81A-20 torre 4 apto 201', 'Calle 10 # 81A-20'],
  ['Carrera 81H #51A-39 Sur, frente al parque', 'Carrera 81H # 51A-39 Sur'],
  ['Tv 78C #6D-48 casa 2', 'Transversal 78C # 6D-48'],
];
for (const [address, canonical] of cases) {
 for (const scenario of ['repeat', 'origin', 'radius', 'door', 'expiry', 'negative']) {
  it(`recovered geocode cache ${scenario}: ${address}`, async () => {
   const service = new WhatsappDeliveryRoutingService({get: () => 'fake-key'} as never);
   let now = 1000000;
   jest.spyOn(Date, 'now').mockImplementation(() => now);
   const queries: string[] = [];
   const plain = canonical.replace(/[#-]/g, ' ').replace(/\s+/g, ' ').trim();
   let available = scenario !== 'negative';
   global.fetch = jest.fn().mockImplementation(async (url: string) => {
    const q = new URL(url).searchParams.get('address') || ''; queries.push(q);
    return {status: 200, json: async () => available && q.startsWith(plain + ',') ? {status: 'OK', results: [{
     formatted_address: canonical + ', Bogotá, Colombia', geometry: {location: {lat: 4.63, lng: -74.15}},
     address_components: [{short_name: 'CO', types: ['country']}],
    }]} : {status: 'ZERO_RESULTS', results: []}};
   });
   const route = jest.spyOn(service as any, 'directionsDistance').mockResolvedValue({distanceKm: 0.6, durationMinutes: 4});
   const params = {customerAddress: address, restaurant: {lat: 4.6301, lng: -74.1501}, tiers: [{maxKm: 8.5, fee: 2000}], maxKm: 8.5, fallbackFee: 2000};
   const first = await service.quoteDeliveryFee(params);
   expect(first.ok).toBe(scenario !== 'negative');
   const firstCount = queries.length;
   if (scenario !== 'negative') expect(firstCount).toBe(3);
   if (scenario === 'origin') params.restaurant = {lat: 4.6302, lng: -74.1502}; // same former rounded bucket
   if (scenario === 'radius') params.maxKm = 5;
   if (scenario === 'door') params.customerAddress = canonical.replace(/-\d+/, '-999');
   if (scenario === 'expiry') now += 12 * 60 * 60 * 1000 + 1;
   available = true;
   const second = await service.quoteDeliveryFee(params);
   if (scenario === 'repeat') {
    expect(second).toMatchObject({ok: true, fee: 2000});
    expect(queries).toHaveLength(firstCount);
    expect(route).toHaveBeenCalledTimes(2); // Fee/route never reused with geocode.
   } else {
    expect(queries.length).toBeGreaterThan(firstCount);
    if (['origin', 'radius', 'expiry'].includes(scenario)) expect(queries.length - firstCount).toBe(3);
    expect(second.ok).toBe(scenario !== 'door');
    if (scenario === 'door') expect(route).toHaveBeenCalledTimes(1);
   }
  });
 }
}
