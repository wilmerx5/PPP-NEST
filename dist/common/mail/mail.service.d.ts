import { ConfigService } from '@nestjs/config';
export declare class MailService {
    private readonly configService;
    private transporter;
    constructor(configService: ConfigService);
    sendVerificationCode(email: string, code: string): Promise<boolean>;
    sendActivateUser(email: string, userId: string, code: string): Promise<boolean>;
}
