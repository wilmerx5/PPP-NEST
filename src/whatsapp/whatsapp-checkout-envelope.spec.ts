import {checkoutEnvelope} from './whatsapp-checkout-envelope';
const product=(line:string)=>/Bowl Andino|Crema De Zapallo/.test(line);
const phone=(line:string)=>line.replace(/\D/g,'').length===10;
const source=(name='Maribel Capera')=>`Quiero un Bowl Andino\n${name}\nTorres de Castelló\nDiagonal 3 #83-02\nTorre 3 apto 102\n3000000003`;
describe('Bounded structured checkout forms preserve every field',()=>{
 it.each(['Maribel Capera','Carlos Torres','María del Pilar'])('extracts %s without a restaurant-specific name rule',name=>expect(checkoutEnvelope(source(name),product,phone)).toEqual({orderText:'Quiero un Bowl Andino',customerName:name,phone:'3000000003',address:'Diagonal 3 #83-02, Torres de Castelló, Torre 3 apto 102'}));
 it('preserves every recognized product line',()=>expect(checkoutEnvelope(source().replace('Quiero un Bowl Andino','Quiero un Bowl Andino\n1 Crema De Zapallo'),product,phone)?.orderText).toBe('Quiero un Bowl Andino\n1 Crema De Zapallo'));
 it.each([source()+'\nY agrega un postre',source()+'\n3000000004',source().replace('Maribel Capera','Conjunto Residencial'),source().replace('Diagonal 3 #83-02','cerca de la esquina'),source().replace('3000000003','30000')])('rejects uncertain forms instead of dropping text: %s',text=>expect(checkoutEnvelope(text,product,phone)).toBeNull());
});

it.each(['Muchas gracias','Buenas noches','No mas','Me regalas'])('does not use courtesy or order words as an unlabelled recipient: %s',name=>expect(checkoutEnvelope(source(name),product,phone)).toBeNull());

it('extracts a separate explicit payment line only through the allowed-method callback',()=>expect(checkoutEnvelope(source()+'\ncontraentrega',product,phone,line=>line==='contraentrega'?'cash':null)?.paymentMethod).toBe('cash'));
it('rejects two payment lines rather than guessing',()=>expect(checkoutEnvelope(source()+'\ncontraentrega\ntransferencia',product,phone,line=>['contraentrega','transferencia'].includes(line)?line:null)).toBeNull());

// Contact-only delivery forms must not become purchases or discard other clauses.
it('accepts a delivery form only with an existing cart contract', () => {
 const text='Para domicilio\nCarlos Torres\n3000000006\nCalle 10 #81A-20\nTorre 4 apto 505';
 expect(checkoutEnvelope(text,product,phone)).toBeNull();
 expect(checkoutEnvelope(text,product,phone,undefined,true)).toMatchObject({orderText:'',customerName:'Carlos Torres',phone:'3000000006',address:expect.stringContaining('505')});
});
it.each(['Y agrega un postre','Carlos Lopez','3000000007','No mas'])('rejects extra delivery-form clause: %s', extra => {
 const text='Para domicilio\nCarlos Torres\n3000000006\nCalle 10 #81A-20\nTorre 4 apto 505\n'+extra;
 expect(checkoutEnvelope(text,product,phone,undefined,true)).toBeNull();
});
