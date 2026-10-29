import {isCheckoutWaitIntent,cartTotalFollowupIntent} from './whatsapp-intent';
import {kitchenNotesConflict} from './whatsapp-cart-note';
it.each([
 'espera un momento, calle 10 #20-30','un momentito, quiero dos aguas',
 'ya te confirmo la dirección calle 10 #20-30','déjame revisar y quita el agua',
 'puedes esperar hasta las tres','no me esperes','ya te confirmé','confirmo',
])('a wait classifier does not discard information: %s',text=>expect(isCheckoutWaitIntent(text)).toBe(false));
it.each([
 'cuánto queda todo sin la bebida','cuánto queda todo si agrego agua',
 'cuánto queda todo para mañana','cuánto queda todo y quita el arroz',
 'cuánto queda todo con domicilio','cuánto queda todo el arroz',
])('a total shortcut cannot swallow a condition or named dish: %s',text=>expect(cartTotalFollowupIntent(text)).toBeNull());
it.each([
 ['sin cebolla','con cebolla',true], ['con salsa de cebolla','sin cebolla',false],
 ['sin sal','salsa aparte',false], ['sin cebolla; con tomate','sin tomate',true],
 ['sin azúcar','con poca azúcar',true], ['sin cebolla','sin cebolla y sin tomate',false],
] as const)('bounded contradiction detection: %s / %s', (before,after,conflict)=>expect(kitchenNotesConflict(before,after)).toBe(conflict));
