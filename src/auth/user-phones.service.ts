import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Phone } from './entities/phone.entity';
import { CreatePhoneDto } from './dto/create-phone.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';

@Injectable()
export class UserPhonesService {
  constructor(
    @InjectRepository(Phone)
    private readonly phoneRepository: Repository<Phone>,
  ) {}

  async create(userId: string, createPhoneDto: CreatePhoneDto): Promise<Phone> {
    // Si se marca como default, desmarcar otros teléfonos default del usuario
    if (createPhoneDto.isDefault) {
      await this.phoneRepository.update(
        { userId, isDefault: true },
        { isDefault: false }
      );
    }

    const phone = this.phoneRepository.create({
      ...createPhoneDto,
      userId,
      isDefault: createPhoneDto.isDefault ?? false,
      type: createPhoneDto.type ?? 'mobile',
    });

    return await this.phoneRepository.save(phone);
  }

  async findAll(userId: string): Promise<Phone[]> {
    return await this.phoneRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: number): Promise<Phone> {
    const phone = await this.phoneRepository.findOne({
      where: { id, userId },
    });

    if (!phone) {
      throw new NotFoundException(`Phone with ID ${id} not found`);
    }

    return phone;
  }

  async update(userId: string, id: number, updatePhoneDto: UpdatePhoneDto): Promise<Phone> {
    const phone = await this.findOne(userId, id);

    // Si se está marcando como default, desmarcar otros
    if (updatePhoneDto.isDefault === true && !phone.isDefault) {
      await this.phoneRepository.update(
        { userId, isDefault: true },
        { isDefault: false }
      );
    }

    Object.assign(phone, updatePhoneDto);
    return await this.phoneRepository.save(phone);
  }

  async remove(userId: string, id: number): Promise<void> {
    const phone = await this.findOne(userId, id);
    await this.phoneRepository.remove(phone);
  }

  async setDefault(userId: string, id: number): Promise<Phone> {
    // Desmarcar todos los teléfonos default del usuario
    await this.phoneRepository.update(
      { userId, isDefault: true },
      { isDefault: false }
    );

    // Marcar el teléfono especificado como default
    const phone = await this.findOne(userId, id);
    phone.isDefault = true;
    return await this.phoneRepository.save(phone);
  }
}
