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

  async sendPasswordResetCode(email: string, code: string) {
    try {
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h2 style="color: white; margin: 0;">Recuperación de Contraseña</h2>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="color: #333; font-size: 16px;">Hemos recibido una solicitud para restablecer tu contraseña.</p>
            <p style="color: #666; margin-top: 20px;">Tu código de verificación es:</p>
            <div style="background-color: white; border: 2px dashed #f97316; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <h1 style="color: #f97316; letter-spacing: 8px; font-size: 32px; margin: 0;">${code}</h1>
            </div>
            <p style="color: #666; font-size: 14px;">Este código expirará en <strong style="color: #f97316;">20 minutos</strong>.</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Si no solicitaste este código, puedes ignorar este mensaje de forma segura.
            </p>
          </div>
        </div>
      `;

      await this.transporter.sendMail({
        from: `"Pronto Pollo Portal" <${this.configService.get<string>('MAIL_USER')}>`,
        to: email,
        subject: 'Código de Recuperación de Contraseña',
        html: htmlBody,
      });

      return true;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error sending password reset email');
    }
  }

}
