import {
  isNamedMenuDishOrderPhrase,
  productLooksLikeNamedMenuDish,
} from './whatsapp-named-menu-dish';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { resolveConceptBrowseForAgent } from './whatsapp-menu-concepts';

describe('named menu dish vs carta link', () => {
  it('distingue pedir la carta de pedir un plato "menú …"', () => {
    expect(isNamedMenuDishOrderPhrase('pásame el menú')).toBe(false);
    expect(isNamedMenuDishOrderPhrase('ver el menú')).toBe(false);
    expect(isNamedMenuDishOrderPhrase('link del menú')).toBe(false);
    expect(isNamedMenuDishOrderPhrase('dame la carta')).toBe(false);

    expect(isNamedMenuDishOrderPhrase('quiero el menú especial')).toBe(true);
    expect(isNamedMenuDishOrderPhrase('un menú de la casa')).toBe(true);
    expect(isNamedMenuDishOrderPhrase('menú del día')).toBe(true);
    expect(isNamedMenuDishOrderPhrase('Quiero Un menu ejecutivo con Pollo frito')).toBe(true);
    expect(isNamedMenuDishOrderPhrase('bandeja con pollo frito')).toBe(true);
  });

  it('reconoce SKUs de envoltorio en el catálogo', () => {
    expect(productLooksLikeNamedMenuDish('Menú Especial')).toBe(true);
    expect(productLooksLikeNamedMenuDish('Menú de la Casa')).toBe(true);
    expect(productLooksLikeNamedMenuDish('Ejecutivo Con Pollo Frito')).toBe(true);
    expect(productLooksLikeNamedMenuDish('1 Pollo Frito')).toBe(false);
  });

  it('resuelve menú especial / de la casa sin confundir con pollo', () => {
    const catalog = new WhatsappCatalogService({} as never);
    const menu = [
      {
        id: 1,
        code: 1,
        name: '1 Pollo Frito',
        price: 44000,
        availableNow: true,
        categoryName: 'Pollo',
      },
      {
        id: 50,
        code: 50,
        name: 'Menú Especial',
        price: 18000,
        availableNow: true,
        categoryName: 'Especiales',
      },
      {
        id: 51,
        code: 51,
        name: 'Menú de la Casa',
        price: 20000,
        availableNow: true,
        categoryName: 'Especiales',
      },
    ];

    expect(catalog.resolveNamedMenuDishProduct('quiero el menú especial', menu)?.name).toBe(
      'Menú Especial',
    );
    expect(catalog.resolveNamedMenuDishProduct('un menú de la casa', menu)?.name).toBe(
      'Menú de la Casa',
    );
    expect(
      catalog.findProductEmbeddedInMessage('quiero el menú especial', menu)?.name,
    ).toBe('Menú Especial');
    expect(resolveConceptBrowseForAgent('quiero el menú especial', menu)).toBeNull();
  });
});
