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
        const portRaw = this.configService.get('MAIL_PORT') ?? this.configService.get('MAIL_PORT');
        const port = Number(portRaw) || 465;
        const secureEnv = this.configService.get('MAIL_SECURE');
        const secure = secureEnv === 'false' ? false : (secureEnv === 'true' ? true : port === 465);
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('MAIL_HOST'),
            port,
            secure,
            auth: {
                user: this.configService.get('MAIL_USER'),
                pass: this.configService.get('MAIL_PASSWORD'),
            },
            connectionTimeout: 15000,
            greetingTimeout: 10000,
        });
    }
    async sendVerificationCode(email, code) {
        try {
            const logoUrl = 'https://cms.prontopolloportal.com/wp-content/uploads/2022/01/cropped-logo.png';
            const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${logoUrl}" alt="Pronto Pollo Portal" style="max-width: 200px; height: auto; margin-bottom: 20px;" />
          </div>
          <h2 style="color: #333;">Verification Code</h2>
          <p>Your verification code is:</p>
          <h1 style="color: #007bff; letter-spacing: 4px;">${code}</h1>
          <p>This code will expire in <strong>20 minutes</strong>.</p>
        </div>
      `;
            await this.transporter.sendMail({
                from: `"Pronto Pollo Portal" <${this.configService.get('MAIL_USER')}>`,
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
            const frontUrl = this.configService.get('AUTH_FRONT_URL');
            const activationLink = `${frontUrl}/verify-user?idUser=${userId}&otp=${code}`;
            const logoUrl = 'https://cms.prontopolloportal.com/wp-content/uploads/2022/01/cropped-logo.png';
            const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${logoUrl}" alt="Pronto Pollo Portal" style="max-width: 200px; height: auto; margin-bottom: 20px;" />
        </div>
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
    async sendPasswordResetCode(email, code) {
        try {
            const logoUrl = 'https://cms.prontopolloportal.com/wp-content/uploads/2022/01/cropped-logo.png';
            const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); padding: 30px 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <img src="${logoUrl}" alt="Pronto Pollo Portal" style="max-width: 180px; height: auto; margin-bottom: 15px; background: white; padding: 10px; border-radius: 8px;" />
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
                from: `"Pronto Pollo Portal" <${this.configService.get('MAIL_USER')}>`,
                to: email,
                subject: 'Código de Recuperación de Contraseña',
                html: htmlBody,
            });
            return true;
        }
        catch (error) {
            console.error(error);
            throw new common_1.InternalServerErrorException('Error sending password reset email');
        }
    }
    async sendOrderConfirmation(email, orderNumber, customerName, items, total, orderType, address, phone, deliveryFee) {
        const mailHost = this.configService.get('MAIL_HOST');
        const mailUser = this.configService.get('MAIL_USER');
        if (!mailHost || !mailUser) {
            console.warn('⚠️ [Mail] MAIL_HOST y/o MAIL_USER no están en .env. No se envía correo de confirmación. Agrega MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD.');
            return false;
        }
        try {
            const itemsHtml = items
                .map((item) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 0; color: #333;">${item.productName}</td>
          <td style="padding: 12px 0; text-align: center; color: #666;">${item.quantity}</td>
          <td style="padding: 12px 0; text-align: right; color: #333; font-weight: 600;">$${Number(item.price).toLocaleString('es-CO')}</td>
        </tr>
      `)
                .join('');
            const envioRow = deliveryFee != null && Number(deliveryFee) > 0
                ? `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 0; color: #333;">Envío a domicilio</td>
          <td style="padding: 12px 0; text-align: center; color: #666;">1</td>
          <td style="padding: 12px 0; text-align: right; color: #333; font-weight: 600;">$${Number(deliveryFee).toLocaleString('es-CO')}</td>
        </tr>`
                : '';
            const orderTypeText = orderType === 'delivery'
                ? 'Domicilio'
                : orderType === 'pickup'
                    ? 'Para Recoger'
                    : orderType === 'table'
                        ? 'Mesa'
                        : 'Mostrador';
            const logoUrl = 'https://cms.prontopolloportal.com/wp-content/uploads/2022/01/cropped-logo.png';
            const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%); padding: 30px 20px; text-align: center;">
              <img src="${logoUrl}" alt="Pronto Pollo Portal" style="max-width: 200px; height: auto; margin-bottom: 15px; background: white; padding: 10px; border-radius: 8px; display: inline-block;" />
              <h1 style="color: white; margin: 0; font-size: 28px;">¡Pedido Confirmado!</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="width: 80px; height: 80px; background-color: #10b981; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                  <svg style="width: 40px; height: 40px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h2 style="color: #1f2937; margin: 0; font-size: 24px;">¡Gracias por tu pedido!</h2>
                <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 16px;">Hemos recibido tu pedido correctamente</p>
              </div>

              <!-- Order Info -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 14px;">Número de Pedido:</span>
                  <span style="color: #1f2937; font-weight: 700; font-size: 18px;">#${orderNumber}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span style="color: #6b7280; font-size: 14px;">Cliente:</span>
                  <span style="color: #1f2937; font-weight: 600;">${customerName}</span>
                </div>
                ${phone ? `<div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span style="color: #6b7280; font-size: 14px;">Teléfono:</span>
                  <span style="color: #1f2937; font-weight: 600;">${phone}</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span style="color: #6b7280; font-size: 14px;">Tipo de Pedido:</span>
                  <span style="color: #1f2937; font-weight: 600;">${orderTypeText}</span>
                </div>
                ${address && orderType === 'delivery' ? `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 5px;">Dirección de Entrega:</span>
                  <span style="color: #1f2937; font-weight: 600;">${address}</span>
                </div>` : ''}
              </div>

              <!-- Items -->
              <div style="margin-bottom: 30px;">
                <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Resumen del Pedido</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="border-bottom: 2px solid #e5e7eb;">
                      <th style="text-align: left; padding: 10px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Producto</th>
                      <th style="text-align: center; padding: 10px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Cant.</th>
                      <th style="text-align: right; padding: 10px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                    ${envioRow}
                  </tbody>
                </table>
              </div>

              <!-- Total -->
              <div style="background-color: #fef3c7; border: 2px solid #fbbf24; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #92400e; font-size: 18px; font-weight: 700;">Total:</span>
                  <span style="color: #92400e; font-size: 24px; font-weight: 800;">$${Number(total).toLocaleString('es-CO')}</span>
                </div>
              </div>

              <!-- Footer -->
              <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px; margin: 0;">
                  Te notificaremos cuando tu pedido esté listo.
                </p>
                <p style="color: #9ca3af; font-size: 12px; margin: 15px 0 0 0;">
                  Si tienes alguna pregunta, contáctanos directamente.
                </p>
              </div>
            </div>

            <!-- Footer Brand -->
            <div style="background-color: #1f2937; padding: 20px; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Pronto Pollo Portal. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `;
            await this.transporter.sendMail({
                from: `"Pronto Pollo Portal" <${this.configService.get('MAIL_USER')}>`,
                to: email,
                subject: `Confirmación de Pedido #${orderNumber} - Pronto Pollo Portal`,
                html: htmlBody,
            });
            console.log(`✅ [Mail] Order confirmation email sent to ${email} for order #${orderNumber}`);
            return true;
        }
        catch (error) {
            console.error('❌ [Mail] Error sending order confirmation email:', error?.message || error);
            if (error?.code === 'ETIMEDOUT' || /Greeting never received/i.test(String(error?.message))) {
                console.error('   💡 Revisa: MAIL_HOST (ej: smtp.gmail.com), MAIL_PORT (465=SSL, 587=STARTTLS), firewall. En Gmail usa contraseña de aplicación.');
            }
            throw new common_1.InternalServerErrorException('Error sending order confirmation email');
        }
    }
    async sendNewOrderNotification(orderNumber, customerName, phone, address, orderType, items, total, deliveryFee) {
        const mailHost = this.configService.get('MAIL_HOST');
        const mailUser = this.configService.get('MAIL_USER');
        if (!mailHost || !mailUser) {
            console.warn('⚠️ [Mail] MAIL_HOST y/o MAIL_USER no están en .env. No se envía notificación de nueva orden.');
            return false;
        }
        try {
            const itemsHtml = items
                .map((item) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 0; color: #333;">${item.productName}</td>
          <td style="padding: 12px 0; text-align: center; color: #666;">${item.quantity}</td>
          <td style="padding: 12px 0; text-align: right; color: #333; font-weight: 600;">$${Number(item.price).toLocaleString('es-CO')}</td>
        </tr>
      `)
                .join('');
            const envioRow = deliveryFee != null && Number(deliveryFee) > 0
                ? `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 0; color: #333;">Envío a domicilio</td>
          <td style="padding: 12px 0; text-align: center; color: #666;">1</td>
          <td style="padding: 12px 0; text-align: right; color: #333; font-weight: 600;">$${Number(deliveryFee).toLocaleString('es-CO')}</td>
        </tr>`
                : '';
            const orderTypeText = orderType === 'delivery'
                ? 'Domicilio'
                : orderType === 'pickup'
                    ? 'Para Recoger'
                    : orderType === 'table'
                        ? 'Mesa'
                        : 'Mostrador';
            const logoUrl = 'https://cms.prontopolloportal.com/wp-content/uploads/2022/01/cropped-logo.png';
            const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%); padding: 30px 20px; text-align: center;">
              <img src="${logoUrl}" alt="Pronto Pollo Portal" style="max-width: 200px; height: auto; margin-bottom: 15px; background: white; padding: 10px; border-radius: 8px; display: inline-block;" />
              <h1 style="color: white; margin: 0; font-size: 28px;">🆕 Nueva Orden Online</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="width: 80px; height: 80px; background-color: #3b82f6; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                  <span style="font-size: 40px;">📦</span>
                </div>
                <h2 style="color: #1f2937; margin: 0; font-size: 24px;">Se ha recibido una nueva orden</h2>
                <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 16px;">Revisa los detalles a continuación</p>
              </div>

              <!-- Order Info -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 14px;">Número de Pedido:</span>
                  <span style="color: #1f2937; font-weight: 700; font-size: 18px;">#${orderNumber}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span style="color: #6b7280; font-size: 14px;">Cliente:</span>
                  <span style="color: #1f2937; font-weight: 600;">${customerName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span style="color: #6b7280; font-size: 14px;">Teléfono:</span>
                  <span style="color: #1f2937; font-weight: 600;">${phone}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span style="color: #6b7280; font-size: 14px;">Tipo de Pedido:</span>
                  <span style="color: #1f2937; font-weight: 600;">${orderTypeText}</span>
                </div>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 5px;">Dirección:</span>
                  <span style="color: #1f2937; font-weight: 600;">${address}</span>
                </div>
              </div>

              <!-- Items -->
              <div style="margin-bottom: 30px;">
                <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Resumen del Pedido</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="border-bottom: 2px solid #e5e7eb;">
                      <th style="text-align: left; padding: 10px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Producto</th>
                      <th style="text-align: center; padding: 10px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Cant.</th>
                      <th style="text-align: right; padding: 10px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                    ${envioRow}
                  </tbody>
                </table>
              </div>

              <!-- Total -->
              <div style="background-color: #dbeafe; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #1e40af; font-size: 18px; font-weight: 700;">Total:</span>
                  <span style="color: #1e40af; font-size: 24px; font-weight: 800;">$${Number(total).toLocaleString('es-CO')}</span>
                </div>
              </div>

              <!-- Footer -->
              <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px; margin: 0;">
                  Esta orden fue creada desde la aplicación online.
                </p>
              </div>
            </div>

            <!-- Footer Brand -->
            <div style="background-color: #1f2937; padding: 20px; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Pronto Pollo Portal. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `;
            const recipients = ['prontopolloportal@gmail.com', 'wilmercampos2004@gmail.com'];
            await Promise.all(recipients.map(recipient => this.transporter.sendMail({
                from: `"Pronto Pollo Portal" <${mailUser}>`,
                to: recipient,
                subject: `🆕 Nueva Orden Online #${orderNumber} - ${customerName}`,
                html: htmlBody,
            })));
            console.log(`✅ [Mail] New order notification sent to ${recipients.join(', ')} for order #${orderNumber}`);
            return true;
        }
        catch (error) {
            console.error('❌ [Mail] Error sending new order notification:', error?.message || error);
            if (error?.code === 'ETIMEDOUT' || /Greeting never received/i.test(String(error?.message))) {
                console.error('   💡 Revisa: MAIL_HOST (ej: smtp.gmail.com), MAIL_PORT (465=SSL, 587=STARTTLS), firewall. En Gmail usa contraseña de aplicación.');
            }
            return false;
        }
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);
//# sourceMappingURL=mail.service.js.map