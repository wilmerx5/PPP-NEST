import { WhatsappConversationService } from './whatsapp-conversation.service';

describe('WhatsApp inbound claim (multi-instance idempotency)', () => {
  const makeService = () => {
    const msgRepo = {
      insert: jest.fn(),
      findOne: jest.fn(),
      query: jest.fn().mockResolvedValue([{ total: 1 }]),
      createQueryBuilder: jest.fn(),
    };
    const service = new WhatsappConversationService(
      {} as never,
      msgRepo as never,
      {} as never,
      {} as never,
    );
    return { service, msgRepo };
  };

  it('marca como completed solo mensajes entrantes en processing', async () => {
    const { service, msgRepo } = makeService();
    const execute = jest.fn().mockResolvedValue({ affected: 2 });
    const andWhere = jest.fn().mockReturnThis();
    const where = jest.fn().mockReturnThis();
    const set = jest.fn().mockReturnThis();
    const update = jest.fn().mockReturnThis();
    msgRepo.createQueryBuilder = jest.fn().mockReturnValue({ update, set, where, andWhere, execute });
    await service.setInboundProcessingOutcome(['a', 'b', 'a'], 'completed');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      processingStatus: 'completed',
      processingError: null,
      processedAt: expect.any(Date),
    }));
    expect(where).toHaveBeenCalledWith('wa_message_id IN (:...ids)', { ids: ['a', 'b'] });
    expect(andWhere).toHaveBeenCalledWith('processing_status = :previous', { previous: 'processing' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('marca los turnos fallidos para revisión, sin reintentarlos automáticamente', async () => {
    const { service, msgRepo } = makeService();
    const execute = jest.fn().mockResolvedValue({ affected: 1 });
    const chain: any = { execute };
    chain.update = jest.fn().mockReturnValue(chain);
    chain.set = jest.fn().mockReturnValue(chain);
    chain.where = jest.fn().mockReturnValue(chain);
    chain.andWhere = jest.fn().mockReturnValue(chain);
    msgRepo.createQueryBuilder = jest.fn().mockReturnValue(chain);
    await service.setInboundProcessingOutcome(['wamid.failed'], 'failed');
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({
      processingStatus: 'failed',
      processedAt: null,
      processingError: 'turn_failed_requires_review',
    }));
  });

  it('rechaza el procesamiento si falta UNIQUE sobre wa_message_id', async () => {
    const { service, msgRepo } = makeService();
    msgRepo.query.mockResolvedValue([{ total: 0 }]);
    await expect(
      service.claimInboundMessage({ conversationId: 3, waMessageId: 'wamid.fail', body: 'hola' }),
    ).rejects.toThrow(/falta un índice UNIQUE/);
    expect(msgRepo.insert).not.toHaveBeenCalled();
  });

  it('una consulta SQL fallida no se interpreta como duplicado', async () => {
    const { service, msgRepo } = makeService();
    msgRepo.query.mockRejectedValue(new Error('database unavailable'));
    await expect(
      service.claimInboundMessage({ conversationId: 3, waMessageId: 'wamid.db', body: 'hola' }),
    ).rejects.toThrow('database unavailable');
    expect(msgRepo.insert).not.toHaveBeenCalled();
  });

  it('reclama un mensaje nuevo mediante insert atómico y devuelve el registro creado', async () => {
    const { service, msgRepo } = makeService();
    const created = { id: '12', waMessageId: 'wamid.abc', direction: 'in' };
    msgRepo.insert.mockResolvedValue({ identifiers: [{ id: '12' }] });
    msgRepo.findOne.mockResolvedValue(created);

    const result = await service.claimInboundMessage({
      conversationId: 3,
      waMessageId: 'wamid.abc',
      body: 'dos ajiacos',
    });

    expect(result).toBe(created);
    expect(msgRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 3,
        waMessageId: 'wamid.abc',
        direction: 'in',
        body: 'dos ajiacos',
      }),
    );
  });

  it('ignora la colisión de índice único: solo un worker procesa el webhook', async () => {
    const { service, msgRepo } = makeService();
    msgRepo.insert.mockRejectedValue(
      Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY', errno: 1062 }),
    );

    await expect(
      service.claimInboundMessage({
        conversationId: 3,
        waMessageId: 'wamid.retried',
        body: 'confirmar',
      }),
    ).resolves.toBeNull();
    expect(msgRepo.findOne).not.toHaveBeenCalled();
  });

  it('reconoce la colisión dentro de driverError de TypeORM', async () => {
    const { service, msgRepo } = makeService();
    msgRepo.insert.mockRejectedValue(
      Object.assign(new Error('duplicate'), {
        driverError: { code: 'ER_DUP_ENTRY' },
      }),
    );
    await expect(
      service.claimInboundMessage({ conversationId: 3, waMessageId: 'x', body: 'hola' }),
    ).resolves.toBeNull();
  });

  it('no convierte errores reales de base de datos en duplicados silenciosos', async () => {
    const { service, msgRepo } = makeService();
    msgRepo.insert.mockRejectedValue(
      Object.assign(new Error('connection lost'), { code: 'PROTOCOL_CONNECTION_LOST' }),
    );
    await expect(
      service.claimInboundMessage({ conversationId: 3, waMessageId: 'x', body: 'hola' }),
    ).rejects.toThrow('connection lost');
  });
});
