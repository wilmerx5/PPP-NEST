import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class UserAddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
  ) {}

  async create(userId: string, createAddressDto: CreateAddressDto): Promise<Address> {
    // Si se marca como default, desmarcar otras direcciones default del usuario
    if (createAddressDto.isDefault) {
      await this.addressRepository.update(
        { userId, isDefault: true },
        { isDefault: false }
      );
    }

    const address = this.addressRepository.create({
      ...createAddressDto,
      userId,
      isDefault: createAddressDto.isDefault ?? false,
      type: createAddressDto.type ?? 'other',
    });

    return await this.addressRepository.save(address);
  }

  async findAll(userId: string): Promise<Address[]> {
    return await this.addressRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: number): Promise<Address> {
    const address = await this.addressRepository.findOne({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException(`Address with ID ${id} not found`);
    }

    return address;
  }

  async update(userId: string, id: number, updateAddressDto: UpdateAddressDto): Promise<Address> {
    const address = await this.findOne(userId, id);

    // Si se está marcando como default, desmarcar otras
    if (updateAddressDto.isDefault === true && !address.isDefault) {
      await this.addressRepository.update(
        { userId, isDefault: true },
        { isDefault: false }
      );
    }

    Object.assign(address, updateAddressDto);
    return await this.addressRepository.save(address);
  }

  async remove(userId: string, id: number): Promise<void> {
    const address = await this.findOne(userId, id);
    await this.addressRepository.remove(address);
  }

  async setDefault(userId: string, id: number): Promise<Address> {
    // Desmarcar todas las direcciones default del usuario
    await this.addressRepository.update(
      { userId, isDefault: true },
      { isDefault: false }
    );

    // Marcar la dirección especificada como default
    const address = await this.findOne(userId, id);
    address.isDefault = true;
    return await this.addressRepository.save(address);
  }
}
