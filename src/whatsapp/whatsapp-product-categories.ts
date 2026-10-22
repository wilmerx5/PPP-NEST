import type { WhatsappProductCandidate } from './types/whatsapp-session.types';

export function productCategoryNames(product: Pick<WhatsappProductCandidate, 'categoryName' | 'categoryNames'>): string[] {
  if (product.categoryNames?.length) return product.categoryNames;
  return product.categoryName ? [product.categoryName] : [];
}

export function productInCategory(product: Pick<WhatsappProductCandidate, 'categoryName' | 'categoryNames'>, category: string): boolean {
  return productCategoryNames(product).includes(category);
}
