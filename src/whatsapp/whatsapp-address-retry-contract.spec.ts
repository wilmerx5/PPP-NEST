import { WhatsappDeliveryRoutingService } from './whatsapp-delivery-routing.service';

// Destinations from reported conversations; provider replies are synthetic, not live evidence.
const destinations = [
  ['Calle 10 #81A-20 conjunto Santa Catalina club house', 'Calle 10 # 81A-20'],
  ['cra 81 b #6b 50 terrazas de castilla 2 casa 102', 'Carrera 81B # 6B-50'],
  ['Calle 10 #79-15 conjunto Castilla real etapa 1 torre 4 apto 410', 'Calle 10 # 79-15'],
  ['Carrera 81 h 51 a 39 sur, frente al parque', 'Carrera 81H # 51A-39 Sur'],
  ['Diagonal 3 #83-02 torre 3 apto 102', 'Diagonal 3 # 83-02'],
  ['Tv 78C #6D-48', 'Transversal 78C # 6D-48'],
];
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

for (const [address, canonical] of destinations) {
  for (const mode of ['first', 'plain', 'partial', 'wrongDoor']) {
    it(`${mode}: ${address}`, async () => {
      const service = new WhatsappDeliveryRoutingService({get: () => 'fake-key'} as never);
      const queries: string[] = [];
      const plain = canonical.replace(/[#-]/g, ' ').replace(/\s+/g, ' ').trim();
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        const query = new URL(url).searchParams.get('address') || '';
        queries.push(query);
        const hit = mode !== 'plain' || query.startsWith(plain + ',');
        return { status: 200, json: async () => hit ? {
          status: 'OK', results: [{
            formatted_address: (mode === 'wrongDoor' ? canonical.replace(/-\d+/, '-999') : canonical) + ', Bogotá, Colombia',
            partial_match: mode === 'partial',
            geometry: {location: {lat: 4.63, lng: -74.15}},
            address_components: [{short_name: 'CO', types: ['country']}],
          }],
        } : {status: 'ZERO_RESULTS', results: []} };
      });
      const route = jest.spyOn(service as any, 'directionsDistance').mockResolvedValue({distanceKm: 0.6, durationMinutes: 4});
      const params = {customerAddress: address, restaurant: {lat: 4.63, lng: -74.15}, tiers: [{maxKm: 8.5, fee: 2000}], maxKm: 8.5, fallbackFee: 2000};
      const quote = await service.quoteDeliveryFee(params);
      expect(queries.length).toBeLessThanOrEqual(10);
      expect(new Set(queries).size).toBe(queries.length);
      if (mode === 'first' || mode === 'plain') {
        expect(quote).toMatchObject({ok: true, fee: 2000, geocodedAddress: canonical + ', Bogotá, Colombia'});
        expect(route).toHaveBeenCalledTimes(1);
        expect(queries.length).toBe(mode === 'first' ? 1 : 3);
        if (mode === 'first') {
          const again = await service.quoteDeliveryFee(params);
          expect(again).toMatchObject({ok: true, fee: 2000});
          expect(queries).toHaveLength(1); // Geocoding reused; routing remains a separate operation.
          expect(route).toHaveBeenCalledTimes(2);
        }
      } else {
        expect(quote).toMatchObject({ok: false, reason: 'address_ambiguous'});
        expect(route).not.toHaveBeenCalled();
        if (!quote.ok) expect(quote.message).toMatch(/ubicación/);
      }
    });
  }
}
