import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { expandDistributedVariants } from './whatsapp-distributed-variants';
import { readFileSync } from 'fs';
import { join } from 'path';
const products = JSON.parse(readFileSync(join(__dirname, '../../scripts/fixtures/whatsapp-beta-menu.json'), 'utf8'));
const catalog = new WhatsappCatalogService({} as never);

describe('A grouped quantity describes the total, not the first preparation', () => {
  it('resolves both separately chosen preparations and retains the other dish note', () => {
    const result = catalog.resolveMultiProductOrder('Quiero un churrasco sin ensalada y dos sobrebarrigas: una asada y otra en salsa.', products)!;
    expect(result.unresolved).toEqual([]); expect(result.ambiguous).toEqual([]);
    const lines = [...result.confident, ...result.needsAttributes];
    expect(lines.map(line => line.product.id)).toEqual([17, 13, 13]);
    expect(lines.map(line => catalog.extractQuantityFromSegment(line.segment))).toEqual([1, 1, 1]);
    expect(lines[0].segment).toContain('sin ensalada');
  });
  it.each([
    'Tres sobrebarrigas: una asada y otra en salsa.',
    'Dos sobrebarrigas: una asada y otra gratinada.',
    'Dos sobrebarrigas: una asada y un churrasco.',
    'Dos productos inventados: uno asado y otro en salsa.',
  ])('does not invent an expansion when totals, choices or ownership disagree: %s', text => {
    expect(expandDistributedVariants(text, products, catalog)).toBe(text);
  });
  it('keeps a distinct quantity and its note in each distributed preparation', () => {
    const text = 'Tres sobrebarrigas: dos asadas sin ensalada y una en salsa.';
    const product = products.find(p => p.id === 13);
    expect(catalog.orderSegmentForProduct(text, product, products, [{ attributeName: 'Seleccion', attributeValue: 'Asada' }])).toMatch(/^2 Sobrebarriga asadas sin ensalada$/);
    expect(catalog.orderSegmentForProduct(text, product, products, [{ attributeName: 'Seleccion', attributeValue: 'En Salsa' }])).toMatch(/^1 Sobrebarriga en salsa\.?$/);
  });
});
