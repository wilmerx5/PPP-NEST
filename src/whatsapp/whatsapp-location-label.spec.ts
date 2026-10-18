import {googleMapsPin,customerLocationLabel,validDeliveryCoordinates} from './whatsapp-location-label';
describe('Shared pin presentation and safe Maps parsing',()=>{
 it.each(['https://maps.google.com/maps?q=4.63%2C-74.17&z=17','https://maps.google.com/?q=4.63,-74.17','https://www.google.com/maps?query=4.63,-74.17'])('reads an exact pin %s',url=>expect(googleMapsPin(url)).toEqual({lat:4.63,lng:-74.17}));
 it.each(['https://maps.google.com.evil.test/maps?q=4.63,-74.17','http://maps.google.com/?q=4.63,-74.17','https://maps.google.com/?q=91,-74','https://maps.google.com/?q=4,-181','https://maps.google.com/?q=Edificio','No https://maps.google.com/?q=4,-74','https://www.google.com/search?q=4,-74','https://maps.google.com/?q=NaN,-74'])('does not reinterpret %s',url=>expect(googleMapsPin(url)).toBeNull());
 it.each(['Calle 48 sur 87 86','Edificio Del Parque','https://example.com/?q=4,-74'])('retains ordinary address %s',address=>expect(customerLocationLabel(address)).toBe(address));
 it('keeps the label, not the technical suffix',()=>expect(customerLocationLabel('Edificio — Calle 12 34 56 — 📍 4.63, -74.17 — https://maps.google.com/?q=4.63,-74.17')).toBe('Edificio — Calle 12 34 56'));
 it('uses a readable fallback',()=>expect(customerLocationLabel('📍 4.63, -74.17 — https://maps.google.com/?q=4.63,-74.17')).toBe('Ubicación compartida'));
 it('rejects nonnumeric or nonfinite coordinates',()=>{expect(validDeliveryCoordinates('4',-74)).toBe(false);expect(validDeliveryCoordinates(NaN,-74)).toBe(false);expect(validDeliveryCoordinates(4,Infinity)).toBe(false);});
});
