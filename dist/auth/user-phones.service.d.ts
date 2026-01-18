import { Repository } from 'typeorm';
import { Phone } from './entities/phone.entity';
import { CreatePhoneDto } from './dto/create-phone.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
export declare class UserPhonesService {
    private readonly phoneRepository;
    constructor(phoneRepository: Repository<Phone>);
    create(userId: string, createPhoneDto: CreatePhoneDto): Promise<Phone>;
    findAll(userId: string): Promise<Phone[]>;
    findOne(userId: string, id: number): Promise<Phone>;
    update(userId: string, id: number, updatePhoneDto: UpdatePhoneDto): Promise<Phone>;
    remove(userId: string, id: number): Promise<void>;
    setDefault(userId: string, id: number): Promise<Phone>;
}
