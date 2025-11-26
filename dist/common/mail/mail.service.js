"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer = require("nodemailer");
let MailService = class MailService {
    configService;
    transporter;
    constructor(configService) {
        this.configService = configService;
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('MAIL_HOST'),
            port: this.configService.get('MAIL_PORT'),
            secure: true,
            auth: {
                user: this.configService.get('MAIL_USER'),
                pass: this.configService.get('MAIL_PASSWORD'),
            },
        });
    }
    async sendVerificationCode(email, code) {
        try {
            const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #333;">Verification Code</h2>
          <p>Your verification code is:</p>
          <h1 style="color: #007bff; letter-spacing: 4px;">${code}</h1>
          <p>This code will expire in <strong>20 minutes</strong>.</p>
        </div>
      `;
            await this.transporter.sendMail({
                from: `"Pronto Pollo POrtal" <${this.configService.get('MAIL_USER')}>`,
                to: email,
                subject: 'Your Verification Code',
                html: htmlBody,
            });
            return true;
        }
        catch (error) {
            console.error(error);
            throw new common_1.InternalServerErrorException('Error sending email');
        }
    }
    async sendActivateUser(email, userId, code) {
        try {
            const frontUrl = this.configService.get('FRONT_URL');
            const activationLink = `${frontUrl}/verify-user?idUser=${userId}&otp=${code}`;
            const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #333;">Activate Your Account</h2>
        <p>Thank you for registering. To activate your account, please click the link below:</p>
        
        <a 
          href="${activationLink}" 
          style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 6px;">
          Activate Account
        </a>

        <p style="margin-top: 20px;">
          If the button doesn't work, copy and paste this link in your browser:
        </p>

        <p style="color: #555; word-break: break-word;">
          ${activationLink}
        </p>

        <p style="margin-top: 20px;">This activation link will expire in <strong>20 minutes</strong>.</p>
      </div>
    `;
            await this.transporter.sendMail({
                from: `"Pronto Pollo Portal" <${this.configService.get('MAIL_USER')}>`,
                to: email,
                subject: 'Activate Your Account',
                html: htmlBody,
            });
            return true;
        }
        catch (error) {
            console.error(error);
            throw new common_1.InternalServerErrorException('Error sending activation email');
        }
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);
//# sourceMappingURL=mail.service.js.map