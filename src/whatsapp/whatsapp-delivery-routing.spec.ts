import { WhatsappDeliveryRoutingService } from './whatsapp-delivery-routing.service';

describe('Named destinations must match before pricing coverage', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  const result = (name: string, partial = false) => ({
    formatted_address: `${name}, Kennedy, Bogotá, Colombia`, partial_match: partial,
    geometry: { location: { lat: 4.62, lng: -74.15 } },
    address_components: [{long_name:name}, {short_name:'CO',types:['country']}],
  });
  function setup(results: unknown[]) {
    const service = new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
    global.fetch = jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results})});
    const route = jest.spyOn(service as any, 'directionsDistance').mockResolvedValue({distanceKm:0.5,durationMinutes:3});
    return {service,route};
  }
  const params = {customerAddress:'plazuelas de san esteban',restaurant:{lat:4.62,lng:-74.15},
    tiers:[{maxKm:5.5,fee:2000}],maxKm:5.5,fallbackFee:2000};
  it('does not price or reject coverage from a different nearby landmark', async () => {
    const {service,route}=setup([result('San Cristóbal')]);
    expect(await service.quoteDeliveryFee(params)).toEqual(expect.objectContaining({ok:false,reason:'address_ambiguous'}));
    expect(route).not.toHaveBeenCalled();
  });
  it('selects the matching landmark after an unrelated first result', async () => {
    const {service,route}=setup([result('San Cristóbal'),result('Plazuela de San Esteban')]);
    expect(await service.quoteDeliveryFee(params)).toEqual(expect.objectContaining({ok:true,distanceKm:0.5}));
    expect(route).toHaveBeenCalledTimes(1);
  });
  it('does not treat a partial place match as a verified address', async () => {
    const {service,route}=setup([result('San Esteban',true)]);
    expect(await service.quoteDeliveryFee(params)).toEqual(expect.objectContaining({reason:'address_ambiguous'}));
    expect(route).not.toHaveBeenCalled();
  });
  it('applies the same rule to another business and destination', async () => {
    const {service,route}=setup([result('Hotel Las Palmas')]);
    expect(await service.quoteDeliveryFee({...params,customerAddress:'hotel los robles'}))
      .toEqual(expect.objectContaining({reason:'address_ambiguous'}));
    expect(route).not.toHaveBeenCalled();
  });
  it('keeps explicit coordinates independent of the landmark spelling', async () => {
    const {service,route}=setup([]);
    expect(await service.quoteDeliveryFee({...params,customerCoords:{lat:4.62,lng:-74.15}}))
      .toEqual(expect.objectContaining({ok:true}));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(route).toHaveBeenCalledTimes(1);
  });
});
