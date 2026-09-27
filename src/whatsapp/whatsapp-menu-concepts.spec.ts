import { findByMenuConcept, resolveConceptBrowseForAgent } from './whatsapp-menu-concepts';

describe('findByMenuConcept (categoría, no lista de cortes)', () => {
  const menu = [
    { id: 1, code: 1, name: 'Churrasco', price: 28000, categoryName: 'Carnes', availableNow: true },
    { id: 2, code: 2, name: 'Sobrebarriga', price: 26000, categoryName: 'Carnes', availableNow: true },
    { id: 3, code: 3, name: 'Punta de anca', price: 32000, categoryName: 'Carnes', availableNow: true },
    { id: 4, code: 4, name: 'Solomillo', price: 35000, categoryName: 'Carnes', availableNow: true },
    { id: 5, code: 5, name: '1 Pollo Frito', price: 44000, categoryName: 'Pollo', availableNow: true },
    { id: 6, code: 6, name: 'Gaseosa 400ml', price: 4000, categoryName: 'Bebidas', availableNow: true },
    {
      id: 7,
      code: 7,
      name: 'Churrasco Especial',
      price: 30000,
      categoryName: 'Platos fuertes',
      availableNow: true,
    },
  ];

  it('"carne" incluye todos los cortes de la categoría Carnes', () => {
    const hit = findByMenuConcept('tienes carne?', menu);
    expect(hit).toBeTruthy();
    expect(hit!.conceptId).toBe('carne');
    const names = hit!.products.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(['Churrasco', 'Sobrebarriga', 'Punta de anca', 'Solomillo']),
    );
    expect(names).not.toEqual(expect.arrayContaining(['1 Pollo Frito', 'Gaseosa 400ml']));
  });

  it('no exige parchear cada corte nuevo en keywords', () => {
    const hit = findByMenuConcept('carne', menu);
    expect(hit!.products.some((p) => /punta de anca/i.test(p.name))).toBe(true);
    expect(hit!.products.some((p) => /solomillo/i.test(p.name))).toBe(true);
  });

  it('keyword de respaldo si el plato no está en categoría Carnes', () => {
    const hit = findByMenuConcept('carne', menu);
    expect(hit!.products.some((p) => /churrasco especial/i.test(p.name))).toBe(true);
  });
});

describe('resolveConceptBrowseForAgent (menú ordenado vs carta mezclada)', () => {
  it('categoría Carnes → mode category_clean', () => {
    const menu = [
      { id: 1, code: 1, name: 'Churrasco', price: 28000, categoryName: 'Carnes', availableNow: true },
      { id: 2, code: 2, name: 'Solomillo', price: 35000, categoryName: 'Carnes', availableNow: true },
      { id: 3, code: 3, name: 'Mojarra', price: 32000, categoryName: 'Pescados', availableNow: true },
    ];
    const hit = resolveConceptBrowseForAgent('hay carne?', menu);
    expect(hit?.mode).toBe('category_clean');
    expect(hit!.products.map((p) => p.name)).toEqual(
      expect.arrayContaining(['Churrasco', 'Solomillo']),
    );
    expect(hit!.products.some((p) => /mojarra/i.test(p.name))).toBe(false);
  });

  it('carta mezclada → semantic_filter con pool amplio (LLM filtra mojarra)', () => {
    const menu = [
      {
        id: 1,
        code: 1,
        name: 'Churrasco',
        price: 28000,
        categoryName: 'Platos a la carta',
        availableNow: true,
      },
      {
        id: 2,
        code: 2,
        name: 'Mojarra frita',
        price: 32000,
        categoryName: 'Platos a la carta',
        availableNow: true,
      },
      {
        id: 3,
        code: 3,
        name: 'Sopa de mondongo',
        price: 13000,
        categoryName: 'Especiales',
        availableNow: true,
      },
      {
        id: 4,
        code: 4,
        name: 'Sobrebarriga',
        price: 26000,
        categoryName: 'Platos a la carta',
        availableNow: true,
      },
      {
        id: 5,
        code: 5,
        name: 'Solomillo',
        price: 35000,
        categoryName: 'Especiales',
        availableNow: true,
      },
      {
        id: 6,
        code: 6,
        name: 'Gaseosa',
        price: 4000,
        categoryName: 'Bebidas',
        availableNow: true,
      },
    ];
    const hit = resolveConceptBrowseForAgent('tienes carne?', menu);
    expect(hit?.mode).toBe('semantic_filter');
    expect(hit?.conceptId).toBe('carne');
    const names = hit!.products.map((p) => p.name);
    // Pool incluye mezclados; el LLM excluye mojarra/sopa al responder
    expect(names).toEqual(
      expect.arrayContaining(['Churrasco', 'Mojarra frita', 'Sobrebarriga', 'Solomillo']),
    );
    expect(names).not.toEqual(expect.arrayContaining(['Gaseosa']));
    expect(hit!.hint).toMatch(/SEMÁNTICAMENTE|EXCLUYE/i);
  });

  it('jugos → pool de jugos (no ofrece pollo)', () => {
    const menu = [
      {
        id: 1,
        code: 1,
        name: 'Jugo de lulo',
        price: 6000,
        categoryName: 'Bebidas',
        availableNow: true,
      },
      {
        id: 2,
        code: 2,
        name: 'Limonada natural',
        price: 5000,
        categoryName: 'Bebidas',
        availableNow: true,
      },
      {
        id: 3,
        code: 3,
        name: 'Gaseosa 400ml',
        price: 4000,
        categoryName: 'Bebidas',
        availableNow: true,
      },
      {
        id: 4,
        code: 4,
        name: '1 Pollo Frito',
        price: 44000,
        categoryName: 'Pollo',
        availableNow: true,
      },
    ];
    const hit = resolveConceptBrowseForAgent('tienes jugos?', menu);
    expect(hit).toBeTruthy();
    expect(hit!.conceptLabel).toMatch(/jugo/i);
    const names = hit!.products.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Jugo de lulo', 'Limonada natural']));
    expect(names).not.toEqual(expect.arrayContaining(['1 Pollo Frito']));
    expect(hit!.hint).toMatch(/jugo/i);
  });

  it('jugo en leche → solo la variante en leche', () => {
    const menu = [
      {
        id: 80,
        code: 80,
        name: 'Jugo Natural En Agua',
        price: 6000,
        categoryName: 'Bebidas',
        availableNow: true,
      },
      {
        id: 81,
        code: 81,
        name: 'Jugo Natural En Leche',
        price: 7000,
        categoryName: 'Bebidas',
        availableNow: true,
      },
      {
        id: 82,
        code: 82,
        name: 'Limonada Natural',
        price: 5000,
        categoryName: 'Bebidas',
        availableNow: true,
      },
      {
        id: 83,
        code: 83,
        name: 'Gaseosa 400ml',
        price: 3000,
        categoryName: 'Bebidas',
        availableNow: true,
      },
    ];
    const hit = resolveConceptBrowseForAgent('Y no tienes jugo en Leche?', menu);
    expect(hit).toBeTruthy();
    expect(hit!.products.map((p) => p.name)).toEqual(['Jugo Natural En Leche']);
    expect(hit!.hint).toMatch(/leche|variante|Confirma/i);
  });

  it('menú ejecutivo con pollo → no browse de pollo', () => {
    const menu = [
      {
        id: 1,
        code: 1,
        name: '1 Pollo Frito',
        price: 44000,
        categoryName: 'Pollo',
        availableNow: true,
      },
      {
        id: 22,
        code: 22,
        name: 'Menú ejecutivo con pollo frito',
        price: 16000,
        categoryName: 'Ejecutivos',
        availableNow: true,
      },
    ];
    expect(
      resolveConceptBrowseForAgent('Quiero Un menu ejecutivo con Pollo frito', menu),
    ).toBeNull();
  });

  it('qué hay de comida rápida lista hamburguesas y salchipapas, no pollo', () => {
    const menu = [
      {
        id: 1,
        code: 1,
        name: 'Hamburguesa Clasica',
        price: 22000,
        categoryName: 'Comidas Rápidas',
        availableNow: true,
      },
      {
        id: 2,
        code: 2,
        name: 'Salchipapa',
        price: 18000,
        categoryName: 'Comidas Rápidas',
        availableNow: true,
      },
      {
        id: 3,
        code: 3,
        name: '1 Pollo Frito',
        price: 44000,
        categoryName: 'Pollo',
        availableNow: true,
      },
      {
        id: 4,
        code: 4,
        name: 'Arroz Chino Con Medio Pollo',
        price: 48000,
        categoryName: 'Arroces',
        availableNow: true,
      },
    ];
    const hit = findByMenuConcept('Que hay de comida rapida', menu);
    expect(hit).toBeTruthy();
    expect(hit!.conceptId).toBe('comida_rapida');
    const names = hit!.products.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Hamburguesa Clasica', 'Salchipapa']));
    expect(names.some((n) => /pollo|arroz/i.test(n))).toBe(false);
  });

  it('tiene comida mexicana lista tacos, no hamburguesas ni alitas', () => {
    const menu = [
      {
        id: 70,
        code: 70,
        name: 'Taco Al Pastor',
        price: 17000,
        categoryName: 'Comidas Rapidas',
        availableNow: true,
      },
      {
        id: 71,
        code: 71,
        name: 'Duo De Tacos Al pastor',
        price: 32000,
        categoryName: 'Comidas Rapidas',
        availableNow: true,
      },
      {
        id: 76,
        code: 76,
        name: 'Hamburguesa Clasica',
        price: 22000,
        categoryName: 'Comidas Rapidas',
        availableNow: true,
      },
      {
        id: 75,
        code: 75,
        name: 'Alitas Broaster',
        price: 22000,
        categoryName: 'Comidas Rapidas',
        availableNow: true,
      },
    ];
    const hit = findByMenuConcept('tiene comida mexicana', menu);
    expect(hit).toBeTruthy();
    expect(hit!.conceptId).toBe('mexicana');
    const names = hit!.products.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Taco Al Pastor', 'Duo De Tacos Al pastor']));
    expect(names.some((n) => /hamburguesa|alitas/i.test(n))).toBe(false);
  });
});
