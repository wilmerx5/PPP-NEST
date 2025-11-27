import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {

  private transporter;

  constructor(private readonly configService: ConfigService) {

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: true,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASSWORD'),
      },
    });
  }

  async sendVerificationCode(email: string, code: string) {
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
        from: `"Pronto Pollo POrtal" <${this.configService.get<string>('MAIL_USER')}>`,
        to: email,
        subject: 'Your Verification Code',
        html: htmlBody,
      });

      return true;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error sending email');
    }
  }

  async sendActivateUser(email: string, userId: string, code: string) {
  try {
    const frontUrl = this.configService.get<string>('AUTH_FRONT_URL');

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
      from: `"Pronto Pollo Portal" <${this.configService.get<string>('MAIL_USER')}>`,
      to: email,
      subject: 'Activate Your Account',
      html: htmlBody,
    });

    return true;

  } catch (error) {
    console.error(error);
    throw new InternalServerErrorException('Error sending activation email');
  }
}

}
