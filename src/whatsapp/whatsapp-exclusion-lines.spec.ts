import {WhatsappCatalogService} from './whatsapp-catalog.service';
const catalog=new WhatsappCatalogService({} as never);
describe('Exclusion line segmentation keeps purchase intent',()=>{
 it.each([
  ['Un Bowl De Quinoa\nsin salsa por favor',1],
  ['Un Arroz Con Pollo\nsin ensalada por favor',1],
  ['Una Pasta Al Pesto\nsin salsa',1],
  ['Un Arroz Con Pollo\nuna porcion de ensalada',2],
  ['Un Bowl De Quinoa\ny una porcion de salsa',2],
 ])('%s keeps %s purchase segments',(text,count)=>expect(catalog.splitMultiProductSegments(text)).toHaveLength(count));
});
