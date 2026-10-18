import { hasExplicitOrderApprovalClause, blocksImplicitOrderApproval } from './whatsapp-order-approval';

describe('Order approval requires an independent declarative clause',()=>{
 it.each([
  'Lo confirmo.', 'Sí, confirmo el pedido. ¿Cuánto tarda?', '¿Cuánto tarda? Lo confirmo.',
  'Quiero confirmar mi pedido. ¿Cuánto tarda?', 'Confirmo el pedido, ¿cuánto tarda?',
  'Por favor confirmar el pedido. ¿Cuánto tarda?', 'Me dijiste «confirmar». Lo confirmo. ¿Cuánto tarda?',
  'Sí señor! ¿Cuánto tarda?', 'Confirmar. ¿Cuánto tarda?', 'Lo confirmo; ¿Cuánto tarda?', 'si confirmo el pedido', 'Sí confirmo el pedido. ¿Cuánto tarda?',
 ])('accepts explicit approval outside a question or quote: %s',text=>{
  expect(hasExplicitOrderApprovalClause(text)).toBe(true);expect(blocksImplicitOrderApproval(text)).toBe(false);
 });
 it.each([
  'Confirmo el pedido? ¿Cuánto tarda?', '¿Confirmo el pedido, cuánto tarda?',
  'Me dijiste «confirmar». ¿Cuánto tarda?', 'Si digo "confirmar", ¿cuánto tarda?',
  'No lo confirmo todavía. ¿Cuánto tarda?', 'Si yo lo confirmo, ¿cuánto tarda?',
  'Lo confirmo solo si llega pronto. ¿Cuánto tarda?', '¿Puedo confirmar el pedido? ¿Cuánto tarda?',
  '"Lo confirmo". ¿Cuánto tarda?', '«Lo confirmo. ¿Cuánto tarda?', 'Si confirmo el pedido, ¿cuánto tarda?', '¿Cuánto tarda? Si confirmo el pedido.', 'Conirmar?', '"No más"',
 ])('rejects mentioned, quoted, conditional or questioned approval: %s',text=>{
  expect(hasExplicitOrderApprovalClause(text)).toBe(false);expect(blocksImplicitOrderApproval(text)).toBe(true);
 });
});
