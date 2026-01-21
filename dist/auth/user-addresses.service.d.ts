import { Repository } from 'typeorm';
import { Address } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
export declare class UserAddressesService {
    private readonly addressRepository;
    constructor(addressRepository: Repository<Address>);
    create(userId: string, createAddressDto: CreateAddressDto): Promise<Address>;
    findAll(userId: string): Promise<Address[]>;
    findOne(userId: string, id: number): Promise<Address>;
    update(userId: string, id: number, updateAddressDto: UpdateAddressDto): Promise<Address>;
    remove(userId: string, id: number): Promise<void>;
    setDefault(userId: string, id: number): Promise<Address>;
}
