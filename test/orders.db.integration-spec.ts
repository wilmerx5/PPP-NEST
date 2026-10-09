import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { OrdersService } from '../src/orders/orders.service';
import { ProductsService } from '../src/products/products.service';
import { CreateOrderDto } from '../src/orders/DTOS/orderDTO';
import { Order } from '../src/orders/entities/order.entity';
import { OrderItem } from '../src/orders/entities/order-item.entity';
import { OrderItemAttribute } from '../src/orders/entities/order-item-attribute.entity';
import { OrderExtra } from '../src/orders/entities/order-extra.entity';
import { Product } from '../src/products/entities/product.entity';
import { Category } from '../src/products/entities/category.entity';
import { ProductAttribute } from '../src/products/entities/product-attribute.entity';
import { ProductVariantStock } from '../src/products/entities/product-variant-stock.entity';
import { ProductSchedule } from '../src/products/entities/product-schedule.entity';
import { InventoryGroup } from '../src/products/entities/inventory-group.entity';
import { InventoryGroupItem } from '../src/products/entities/inventory-group-item.entity';
import { InventorySelection } from '../src/products/entities/inventory-selection.entity';
import { InventorySelectionProduct } from '../src/products/entities/inventory-selection-product.entity';
import { User } from '../src/auth/entities/user.entity';
import { UserPoints } from '../src/auth/entities/user-points.entity';
import { Address } from '../src/auth/entities/address.entity';
import { Phone } from '../src/auth/entities/phone.entity';
import { VerificationToken } from '../src/auth/entities/verification-token.entity';
import { WhatsappSettings } from '../src/whatsapp/entities/whatsapp-settings.entity';

// Schema synchronization/cleanup is exclusively for an explicitly selected local
// throwaway DB. Never substitute staging DB_* credentials for TEST_DB_* here.
if (process.env.WHATSAPP_DB_TEST !== '1' ||
  !['127.0.0.1','localhost','::1'].includes(process.env.TEST_DB_HOST || '') ||
  !/^ppp_test_whatsapp(?:_[a-z0-9]+)?$/.test(process.env.TEST_DB_DATABASE || '')) {
  throw new Error('Business DB tests require explicitly selected loopback ppp_test_whatsapp DB');
}

const entities=[Order,OrderItem,OrderItemAttribute,OrderExtra,Product,Category,ProductAttribute,
  ProductVariantStock,ProductSchedule,InventoryGroup,InventoryGroupItem,InventorySelection,
  InventorySelectionProduct,User,UserPoints,Address,Phone,VerificationToken,WhatsappSettings];
function connection() {
  return new DataSource({type:'mariadb',host:process.env.TEST_DB_HOST,port:Number(process.env.TEST_DB_PORT || 3306),
    username:process.env.TEST_DB_USERNAME,password:process.env.TEST_DB_PASSWORD,database:process.env.TEST_DB_DATABASE,
    entities,synchronize:false,timezone:'Z',logging:false,extra:{connectionLimit:12,connectTimeout:10000}});
}

describe('PPP actual business order, inventory and transaction persistence',()=>{
  let db:DataSource;
  let otherDb:DataSource;
  let orders:OrdersService;
  let otherOrders:OrdersService;
  let inventory:ProductsService;
  let closed:boolean;
  let externalFetch:jest.SpyInstance;
  const business={assertAcceptingOnlineOrders:async()=>{if(closed)throw new Error('synthetic business closed');}};
  const gateway={emitOrdersUpdates:jest.fn()};
  function services(ds:DataSource) {
    const stock=new ProductsService(ds.getRepository(Product),ds.getRepository(Category),ds.getRepository(ProductAttribute),
      ds.getRepository(ProductVariantStock),ds.getRepository(InventoryGroup),ds.getRepository(InventoryGroupItem),
      ds.getRepository(InventorySelection),ds.getRepository(InventorySelectionProduct),ds.getRepository(ProductSchedule),
      {} as never,{} as never,business as never);
    const service=new OrdersService(ds.getRepository(Order),ds.getRepository(OrderItem),ds.getRepository(OrderItemAttribute),
      ds.getRepository(OrderExtra),ds.getRepository(Product),ds.getRepository(User),gateway as never,ds,
      {calculatePointsFromCodes:()=>0,invalidatePointsForCanceledOrder:async()=>{}} as never,
      stock,business as never,{} as never,{} as never,{} as never,{} as never);
    // Outbound notifications, email, loyalty and invoices are separate boundaries.
    // Creation, stock queries/updates, locks and all commercial repositories are real.
    jest.spyOn(service as any,'finalizeOrderAfterCreate').mockResolvedValue(undefined);
    return {orders:service,inventory:stock};
  }
  function dto(patch:Partial<CreateOrderDto>={}):CreateOrderDto {
    return {customerName:'Cliente Sintético',phone:'573000000099',address:'Recoge en el local',
      orderType:'pickup',orderSource:'whatsapp',clientRequestId:'synthetic-order-key',items:[{productId:1}],...patch};
  }
  async function productStock(id=1){return Number((await db.getRepository(Product).findOneByOrFail({id})).stock);}
  async function saved(id:number){return db.getRepository(Order).findOneOrFail({where:{id},relations:['items','items.product','items.attributes','extras']});}
  beforeAll(async()=>{
    externalFetch=jest.spyOn(global,'fetch').mockImplementation(async()=>{throw new Error('No external provider calls in business DB tests');});
    db=connection();await db.initialize();await db.synchronize();otherDb=connection();await otherDb.initialize();
  });
  beforeEach(async()=>{
    await db.getRepository(Order).createQueryBuilder().delete().execute();
    await db.getRepository(InventoryGroup).createQueryBuilder().delete().execute();
    await db.getRepository(Product).createQueryBuilder().delete().execute();
    await db.getRepository(Product).save([
      {id:1,code:1,name:'Pollo sintético',price:41000,isActive:true,trackInventory:true,stock:10,hasAttributes:true},
      {id:2,code:2,name:'Jugo sintético',price:5000,isActive:true,trackInventory:false,stock:0,hasAttributes:true},
    ]);
    await db.getRepository(WhatsappSettings).save({id:1,ignoreBusinessHours:false});
    closed=false;gateway.emitOrdersUpdates.mockReset();
    const a=services(db);orders=a.orders;inventory=a.inventory;otherOrders=services(otherDb).orders;
  });
  afterEach(()=>{expect(externalFetch).not.toHaveBeenCalled();jest.restoreAllMocks();
    // restoreAllMocks also removes the fetch boundary; install it for the next case.
    externalFetch=jest.spyOn(global,'fetch').mockImplementation(async()=>{throw new Error('No external provider calls in business DB tests');});});
  afterAll(async()=>{externalFetch?.mockRestore();if(otherDb?.isInitialized)await otherDb.destroy();if(db?.isInitialized)await db.destroy();});

  it('persists three physical units with exact notes and attributes on their own rows',async()=>{
    const result=await orders.create(dto({items:[
      {productId:1,note:'sin ensalada',attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]},
      {productId:1,note:'arepas aparte',attributes:[{attributeName:'Arepas',attributeValue:'Fritas'}]},
      {productId:2,attributes:[{attributeName:'Sabor',attributeValue:'Mango'}]},
    ]}));
    const order=await saved(result.orderId);
    expect(order.items).toHaveLength(3);expect(await productStock()).toBe(8);
    expect(order.items.find(i=>i.note==='sin ensalada')?.attributes.map(a=>a.attributeValue)).toEqual(['Blancas']);
    expect(order.items.find(i=>i.note==='arepas aparte')?.attributes.map(a=>a.attributeValue)).toEqual(['Fritas']);
    expect(order.items.find(i=>i.product.id===2)?.attributes.map(a=>a.attributeValue)).toEqual(['Mango']);
    expect(order.items.reduce((sum,i)=>sum+Number(i.unitPrice),0)).toBe(87000);
  });
  it('takes the current catalog price when the order is created',async()=>{
    await db.getRepository(Product).update(1,{price:43000});
    const r=await orders.create(dto());expect(Number((await saved(r.orderId)).items[0].unitPrice)).toBe(43000);
  });
  it('keeps the persisted sale price when the catalog changes later',async()=>{
    const r=await orders.create(dto());await db.getRepository(Product).update(1,{price:43000});
    expect(Number((await saved(r.orderId)).items[0].unitPrice)).toBe(41000);
  });
  it('retries the same key without creating another order or deducting stock again',async()=>{
    const first=await orders.create(dto({items:[{productId:1},{productId:1}]}));
    const second=await otherOrders.create(dto({items:[{productId:1},{productId:1}]}));
    expect(second).toMatchObject({orderId:first.orderId,duplicate:true});
    expect(await db.getRepository(Order).count()).toBe(1);expect(await productStock()).toBe(8);
  });
  it('handles eight simultaneous identical retries across independent service instances',async()=>{
    const results=await Promise.all(Array.from({length:8},(_,i)=>(i%2?orders:otherOrders).create(dto({items:[{productId:1},{productId:1}]}))));
    expect(new Set(results.map(r=>r.orderId)).size).toBe(1);
    expect(await db.getRepository(Order).count()).toBe(1);expect(await productStock()).toBe(8);
  });
  it('assigns different daily numbers to eight concurrent distinct orders',async()=>{
    const results=await Promise.all(Array.from({length:8},(_,i)=>(i%2?orders:otherOrders).create(dto({clientRequestId:'synthetic-'+i}))));
    expect(new Set(results.map(r=>r.dailyOrderNumber)).size).toBe(8);
    expect(await db.getRepository(Order).count()).toBe(8);expect(await productStock()).toBe(2);
  });
  it('lets only one of two concurrent orders consume the last unit',async()=>{
    await db.getRepository(Product).update(1,{stock:1});
    const results=await Promise.allSettled([orders.create(dto({clientRequestId:'last-a'})),otherOrders.create(dto({clientRequestId:'last-b'}))]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(await db.getRepository(Order).count()).toBe(1);expect(await productStock()).toBe(0);
  });
  it('rejects a disabled product without persisting an order',async()=>{
    await db.getRepository(Product).update(1,{isActive:false});
    await expect(orders.create(dto())).rejects.toThrow(/desactivado/);
    expect(await db.getRepository(Order).count()).toBe(0);expect(await productStock()).toBe(10);
  });
  it('rejects insufficient stock before persisting items',async()=>{
    await db.getRepository(Product).update(1,{stock:1});
    await expect(orders.create(dto({items:[{productId:1},{productId:1}]}))).rejects.toThrow(/Stock insuficiente/);
    expect(await db.getRepository(OrderItem).count()).toBe(0);expect(await productStock()).toBe(1);
  });
  it('deducts only the chosen variant stock',async()=>{
    await db.getRepository(ProductVariantStock).save([
      {productId:2,attributeName:'Sabor',attributeValue:'Mango',stock:3},
      {productId:2,attributeName:'Sabor',attributeValue:'Lulo',stock:4},
    ]);
    await orders.create(dto({items:[{productId:2,attributes:[{attributeName:'Sabor',attributeValue:'Mango'}]}]}));
    const rows=await db.getRepository(ProductVariantStock).find({order:{attributeValue:'ASC'}});
    expect(rows.map(r=>[r.attributeValue,r.stock])).toEqual([['Lulo',4],['Mango',2]]);
  });
  it('rejects an exhausted variant even when another flavor has stock',async()=>{
    await db.getRepository(ProductVariantStock).save([
      {productId:2,attributeName:'Sabor',attributeValue:'Mango',stock:0},
      {productId:2,attributeName:'Sabor',attributeValue:'Lulo',stock:4},
    ]);
    await expect(orders.create(dto({items:[{productId:1},{productId:2,attributes:[{attributeName:'Sabor',attributeValue:'Mango'}]}]}))).rejects.toThrow(/Stock insuficiente/);
    expect(await db.getRepository(Order).count()).toBe(0);expect(await productStock()).toBe(10);
  });
  it('deducts fractional shared chicken stock precisely',async()=>{
    const group=await db.getRepository(InventoryGroup).save({name:'synthetic chicken pool',stock:2});
    await db.getRepository(InventoryGroupItem).save({groupId:group.id,productId:1,baseUnits:0.25});
    await orders.create(dto({items:[{productId:1},{productId:1},{productId:1}]}));
    expect(Number((await db.getRepository(InventoryGroup).findOneByOrFail({id:group.id})).stock)).toBe(1.25);
    expect(await productStock()).toBe(10);
  });
  it('rolls back the order and its items after a late inventory failure',async()=>{
    jest.spyOn(inventory,'decrementStock').mockRejectedValueOnce(new Error('synthetic late transaction failure'));
    await expect(orders.create(dto())).rejects.toThrow(/late transaction/);
    expect(await db.getRepository(Order).count()).toBe(0);expect(await db.getRepository(OrderItem).count()).toBe(0);
    expect(await productStock()).toBe(10);
  });
  it('rejects WhatsApp orders while the business is closed',async()=>{
    closed=true;await expect(orders.create(dto())).rejects.toThrow(/closed/);
    expect(await db.getRepository(Order).count()).toBe(0);
  });
  it('honors the explicit admin setting to ignore business hours',async()=>{
    closed=true;await db.getRepository(WhatsappSettings).update(1,{ignoreBusinessHours:true});
    expect((await orders.create(dto())).success).toBe(true);
  });
  it('requires a delivery fee for a delivery order',async()=>{
    await expect(orders.create(dto({orderType:'delivery',address:'Calle sintética 123'}))).rejects.toThrow(/domicilio es obligatorio/);
    expect(await db.getRepository(Order).count()).toBe(0);
  });
  it('persists the delivery fee separately from product prices',async()=>{
    const r=await orders.create(dto({orderType:'delivery',address:'Calle sintética 123',deliveryFee:5000}));
    const order=await saved(r.orderId);expect(Number(order.deliveryFee)).toBe(5000);
    expect(order.items.reduce((sum,i)=>sum+Number(i.unitPrice),0)+Number(order.deliveryFee)).toBe(46000);
  });
  it('restores consumed stock when canceling an order',async()=>{
    const r=await orders.create(dto({items:[{productId:1},{productId:1}]}));
    await orders.updateOrderGeneral(r.orderId,{orderStatus:'canceled'});
    expect(await productStock()).toBe(10);expect((await saved(r.orderId)).orderStatus).toBe('canceled');
    expect(await db.getRepository(OrderItem).count()).toBe(0);
  });
  it('does not restore stock twice when two processes cancel simultaneously',async()=>{
    const r=await orders.create(dto({items:[{productId:1},{productId:1}]}));
    await Promise.allSettled([orders.updateOrderGeneral(r.orderId,{orderStatus:'canceled'}),otherOrders.updateOrderGeneral(r.orderId,{orderStatus:'canceled'})]);
    expect(await productStock()).toBe(10);expect((await saved(r.orderId)).orderStatus).toBe('canceled');
  });
  it('marks all physical items prepared when kitchen completes cooking',async()=>{
    const r=await orders.create(dto({items:[{productId:1},{productId:1}]}));
    await orders.updateOrderGeneral(r.orderId,{orderStatus:'cooked'});
    const order=await saved(r.orderId);expect(order.orderStatus).toBe('cooked');
    expect(order.items.every(item=>item.kitchenPreparedAt instanceof Date)).toBe(true);
  });
});
