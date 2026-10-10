import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('staging order email isolation', () => {
  const sendMail = jest.fn().mockResolvedValue({});
  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  });
  const service = (staging: string) => new MailService(new ConfigService({
    PPP_STAGING: staging, MAIL_HOST: 'smtp.example.invalid',
    MAIL_USER: 'test@example.invalid', MAIL_PASSWORD: 'fixture',
  }));
  it('blocks both customer and operational order emails despite configured SMTP', async () => {
    const mail = service('true');
    expect(await mail.sendOrderConfirmation('test@example.invalid', 1, 'Fixture', [], 100, 'pickup')).toBe(false);
    expect(await mail.sendNewOrderNotification(1, 'Fixture', '0000000000', 'Fixture', 'pickup', [], 100)).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });
  it('preserves operational notifications outside staging', async () => {
    expect(await service('false').sendNewOrderNotification(1, 'Fixture', '0000000000', 'Fixture', 'pickup', [], 100)).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});
