import { UserPhonesService } from './user-phones.service';
import { CreatePhoneDto } from './dto/create-phone.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { Request } from 'express';
export declare class UserPhonesController {
    private readonly phonesService;
    constructor(phonesService: UserPhonesService);
    create(req: Request, createPhoneDto: CreatePhoneDto): Promise<import("./entities/phone.entity").Phone>;
    findAll(req: Request): Promise<import("./entities/phone.entity").Phone[]>;
    findOne(req: Request, id: number): Promise<import("./entities/phone.entity").Phone>;
    update(req: Request, id: number, updatePhoneDto: UpdatePhoneDto): Promise<import("./entities/phone.entity").Phone>;
    remove(req: Request, id: number): Promise<void>;
    setDefault(req: Request, id: number): Promise<import("./entities/phone.entity").Phone>;
}
