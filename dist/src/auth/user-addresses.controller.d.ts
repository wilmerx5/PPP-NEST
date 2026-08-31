import { UserAddressesService } from './user-addresses.service';
import { CreateAddressDto, GeocodeAddressDto, ReverseGeocodeDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { Request } from 'express';
export declare class UserAddressesController {
    private readonly addressesService;
    constructor(addressesService: UserAddressesService);
    create(req: Request, createAddressDto: CreateAddressDto): Promise<import("./entities/address.entity").Address>;
    geocode(body: GeocodeAddressDto): Promise<{
        lat: number;
        lng: number;
        formattedAddress?: string;
    }>;
    reverseGeocode(body: ReverseGeocodeDto): Promise<{
        lat: number;
        lng: number;
        formattedAddress?: string;
    }>;
    findAll(req: Request): Promise<import("./entities/address.entity").Address[]>;
    findOne(req: Request, id: number): Promise<import("./entities/address.entity").Address>;
    update(req: Request, id: number, updateAddressDto: UpdateAddressDto): Promise<import("./entities/address.entity").Address>;
    remove(req: Request, id: number): Promise<void>;
    setDefault(req: Request, id: number): Promise<import("./entities/address.entity").Address>;
}
