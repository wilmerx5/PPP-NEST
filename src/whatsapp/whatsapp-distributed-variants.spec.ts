import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { expandDistributedVariants, expandSpokenSameSkuPair } from './whatsapp-distributed-variants';
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
  it('parte dos combos hablados en dos líneas del mismo plato', () => {
    const text = 'Dos combos de arroz paisa, uno con Colombia y el otro con Coca-Cola';
    const expanded = expandSpokenSameSkuPair(text, products, catalog);
    expect(expanded).toMatch(/1 Combo De Arroz Paisa con Colombia y 1 Combo De Arroz Paisa con Coca-Cola/i);
    const result = catalog.resolveMultiProductOrder(text, products)!;
    const lines = [...result.confident, ...result.needsAttributes];
    expect(lines.filter(line => line.product.id === 94)).toHaveLength(2);
    expect(result.unresolved).toEqual([]);
  });

  it('parte dos combos de otro restaurante', () => {
    const pizza = [{ id: 11601, code: 11601, name: 'Combo De Pizza Margarita', price: 28000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Bebida', options: ['Cola', 'Limonada', 'Agua'] }] }];
    const text = 'Dos combos de pizza margarita, uno con cola y el otro con limonada';
    const result = catalog.resolveMultiProductOrder(text, pizza as never)!;
    const lines = [...result.confident, ...result.needsAttributes];
    expect(lines).toHaveLength(2);
    expect(lines.every(line => line.product.id === 11601)).toBe(true);
    expect(result.unresolved).toEqual([]);
  });

  it('keeps a distinct quantity and its note in each distributed preparation', () => {
    const text = 'Tres sobrebarrigas: dos asadas sin ensalada y una en salsa.';
    const product = products.find(p => p.id === 13);
    expect(catalog.orderSegmentForProduct(text, product, products, [{ attributeName: 'Seleccion', attributeValue: 'Asada' }])).toMatch(/^2 Sobrebarriga asadas sin ensalada$/);
    expect(catalog.orderSegmentForProduct(text, product, products, [{ attributeName: 'Seleccion', attributeValue: 'En Salsa' }])).toMatch(/^1 Sobrebarriga en salsa\.?$/);
  });

  it('parte dos notas distintas del mismo plato sin cambiar la opción', () => {
    const text = 'Quiero dos sopas de ajiaco, una sin cebolla y la otra sin ensalada';
    const expanded = expandSpokenSameSkuPair(text, products, catalog);
    expect(expanded).toMatch(/1 Sopa De Ajiaco sin cebolla y 1 Sopa De Ajiaco sin ensalada/i);
    const result = catalog.resolveMultiProductOrder(text, products)!;
    const lines = [...result.confident, ...result.needsAttributes];
    expect(lines.map(line => line.product.id)).toEqual([38, 38]);
    expect(lines[0].segment).toMatch(/sin cebolla/i);
    expect(lines[0].segment).not.toMatch(/sin ensalada/i);
    expect(lines[1].segment).toMatch(/sin ensalada/i);
    expect(lines[1].segment).not.toMatch(/sin cebolla/i);
    expect(result.unresolved).toEqual([]);
  });

  it('parte dos notas en un menú sin atributos', () => {
    const soup = [{ id: 44001, code: 44001, name: 'Sopa De Tomate', price: 9000, availableNow: true, hasAttributes: false, attributes: [] }];
    const text = 'Quiero dos sopas de tomate, una sin cebolla y la otra sin ensalada';
    const result = catalog.resolveMultiProductOrder(text, soup as never)!;
    const lines = [...result.confident, ...result.needsAttributes];
    expect(lines).toHaveLength(2);
    expect(lines.every(line => line.product.id === 44001)).toBe(true);
    expect(lines[0].segment).toMatch(/sin cebolla/i);
    expect(lines[1].segment).toMatch(/sin ensalada/i);
    expect(result.unresolved).toEqual([]);
  });
});
