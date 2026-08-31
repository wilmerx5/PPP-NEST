import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Address } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
export declare class UserAddressesService {
    private readonly addressRepository;
    private readonly config;
    private readonly logger;
    constructor(addressRepository: Repository<Address>, config: ConfigService);
    create(userId: string, createAddressDto: CreateAddressDto): Promise<Address>;
    findAll(userId: string): Promise<Address[]>;
    findOne(userId: string, id: number): Promise<Address>;
    update(userId: string, id: number, updateAddressDto: UpdateAddressDto): Promise<Address>;
    remove(userId: string, id: number): Promise<void>;
    setDefault(userId: string, id: number): Promise<Address>;
    geocodePreview(addressText: string): Promise<{
        lat: number;
        lng: number;
        formattedAddress?: string;
    }>;
    private restaurantNear;
    private geocodeQueryVariants;
    private geocodeOnce;
    reverseGeocodePreview(lat: number, lng: number): Promise<{
        lat: number;
        lng: number;
        formattedAddress?: string;
    }>;
    private haversineKm;
}
