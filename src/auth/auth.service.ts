import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/common/mail/mail.service';
import { Repository } from 'typeorm';
import { CreateUserDTO } from './dto/create-user-dto';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { UpdateStaffUserDto } from './dto/update-staff-user.dto';
import { LogInUserDTO } from './dto/login-user.dto';
import { RequestNewCodeDTO } from './dto/request-new-code.dto';
import { ValidateTokenDTO } from './dto/validate-token.dto';
import { RequestPasswordResetDTO } from './dto/request-password-reset.dto';
import { ResetPasswordDTO } from './dto/reset-password.dto';
import { Confirm2faDto } from './dto/confirm-2fa.dto';
import { Disable2faDto } from './dto/disable-2fa.dto';
import { VerifyLogin2faDto } from './dto/verify-login-2fa.dto';
import { User } from './entities/user.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { ValidRoles } from './interfaces/valid.roles.interface';
import { userHasStaffRole } from './staff.roles.util';
import { TotpService } from './services/totp.service';

/** 3 horas — sesión por inactividad (ventana deslizante al refrescar tokens) */
const DEFAULT_REFRESH_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const DEFAULT_ACCESS_MAX_AGE_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,

    @InjectRepository(VerificationToken) private readonly verificationTokenRepository: Repository<VerificationToken>,

    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly totpService: TotpService,
    private readonly configService: ConfigService,
  ) {

  }


  async refreshTokens(userId: string) {
    const payload = { id: userId };

    return this.getJwtTokens(payload);
  }


  async login(logInUserDTO: LogInUserDTO) {
    const { password, email } = logInUserDTO;

    const user = await this.userRepository.findOne({
      where: { email },
      select: {
        email: true,
        password: true,
        id: true,
        isActive: true,
        provider: true,
        totpEnabled: true,
        roles: true,
        fullName: true,
      },
    });

    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    if (user.provider === 'google' || user.password == null || user.password === '') {
      throw new UnauthorizedException(
        'Esta cuenta se registró con Google. Inicia sesión usando el botón "Continuar con Google".',
      );
    }

    if (!bcrypt.compareSync(password, user.password)) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) throw new UnauthorizedException('Tu cuenta no está activa. Actívala desde el enlace que enviamos a tu correo.');

    if (user.totpEnabled) {
      const tempToken = this.jwtService.sign(
        { id: user.id, purpose: '2fa' } satisfies JwtPayload,
        { expiresIn: '5m' },
      );
      return {
        requires2FA: true as const,
        tempToken,
        user: { id: user.id, email: user.email, fullName: user.fullName },
      };
    }

    const tokens = this.getJwtTokens({ id: user.id });
    return { requires2FA: false as const, ...tokens, user };
  }

  async verifyLogin2fa(dto: VerifyLogin2faDto) {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(dto.tempToken);
    } catch {
      throw new UnauthorizedException('Sesión de verificación expirada. Vuelve a iniciar sesión.');
    }

    if (payload.purpose !== '2fa' || !payload.id) {
      throw new UnauthorizedException('Token de verificación inválido');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        totpEnabled: true,
        totpSecret: true,
        totpRecoveryCodes: true,
        roles: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no disponible');
    }
    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('Este usuario no tiene 2FA activo');
    }

    const code = (dto.code || '').trim();
    let ok = this.totpService.verifyToken(user.totpSecret, code);

    if (!ok) {
      const remaining = this.totpService.consumeRecoveryCode(user.totpRecoveryCodes, code);
      if (remaining) {
        ok = true;
        await this.userRepository.update(
          { id: user.id },
          { totpRecoveryCodes: remaining.length ? remaining : null },
        );
      }
    }

    if (!ok) {
      throw new UnauthorizedException('Código 2FA inválido');
    }

    const { totpSecret: _s, totpRecoveryCodes: _r, ...safeUser } = user;
    const tokens = this.getJwtTokens({ id: user.id });
    return { ...tokens, user: safeUser };
  }

  get2faStatus(user: User) {
    return {
      enabled: Boolean(user.totpEnabled),
      isStaff: userHasStaffRole(user.roles),
    };
  }

  async setup2fa(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'roles', 'totpEnabled', 'totpSecret'],
    });
    if (!user) throw new BadRequestException('Usuario no encontrado');
    if (!userHasStaffRole(user.roles)) {
      throw new BadRequestException('El 2FA solo está disponible para personal interno (staff)');
    }
    if (user.totpEnabled) {
      throw new BadRequestException('Ya tienes 2FA activo. Desactívalo primero para reconfigurarlo.');
    }

    const secret = this.totpService.createSecret();
    const otpauthUrl = this.totpService.buildOtpAuthUri(user.email, secret);
    const qrDataUrl = await this.totpService.buildQrDataUrl(otpauthUrl);

    await this.userRepository.update(
      { id: user.id },
      { totpSecret: secret, totpEnabled: false, totpRecoveryCodes: null },
    );

    return {
      secret,
      otpauthUrl,
      qrDataUrl,
      message: 'Escanea el QR con tu app authenticator y confirma con un código',
    };
  }

  async confirm2fa(userId: string, dto: Confirm2faDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'roles', 'totpEnabled', 'totpSecret'],
    });
    if (!user) throw new BadRequestException('Usuario no encontrado');
    if (!userHasStaffRole(user.roles)) {
      throw new BadRequestException('El 2FA solo está disponible para personal interno (staff)');
    }
    if (user.totpEnabled) {
      throw new BadRequestException('El 2FA ya está activo');
    }
    if (!user.totpSecret) {
      throw new BadRequestException('Primero inicia la configuración de 2FA');
    }
    if (!this.totpService.verifyToken(user.totpSecret, dto.code)) {
      throw new BadRequestException('Código inválido. Revisa la hora del teléfono e inténtalo de nuevo.');
    }

    const recoveryCodes = this.totpService.generateRecoveryCodes();
    const hashed = this.totpService.hashRecoveryCodes(recoveryCodes);

    await this.userRepository.update(
      { id: user.id },
      { totpEnabled: true, totpRecoveryCodes: hashed },
    );

    return {
      enabled: true,
      recoveryCodes,
      message:
        '2FA activado. Guarda estos códigos de recuperación en un lugar seguro; no se mostrarán otra vez.',
    };
  }

  async disable2fa(userId: string, dto: Disable2faDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'totpEnabled', 'totpSecret', 'totpRecoveryCodes'],
    });
    if (!user) throw new BadRequestException('Usuario no encontrado');
    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('No tienes 2FA activo');
    }

    const code = (dto.code || '').trim();
    let ok = this.totpService.verifyToken(user.totpSecret, code);
    if (!ok) {
      const remaining = this.totpService.consumeRecoveryCode(user.totpRecoveryCodes, code);
      ok = Boolean(remaining);
    }

    if (!ok) {
      throw new UnauthorizedException('Código 2FA inválido');
    }

    await this.userRepository.update(
      { id: user.id },
      { totpEnabled: false, totpSecret: null, totpRecoveryCodes: null },
    );

    return { enabled: false, message: '2FA desactivado' };
  }

  async adminResetStaff2fa(staffId: string) {
    const user = await this.userRepository.findOne({
      where: { id: staffId },
      select: ['id', 'email', 'fullName', 'roles', 'totpEnabled'],
    });
    if (!user) throw new BadRequestException('Usuario no encontrado');
    if (!userHasStaffRole(user.roles)) {
      throw new BadRequestException('Este usuario no es de staff interno');
    }

    await this.userRepository.update(
      { id: user.id },
      { totpEnabled: false, totpSecret: null, totpRecoveryCodes: null },
    );

    return {
      success: true,
      message: `2FA reiniciado para ${user.email}. La persona puede configurarlo de nuevo al iniciar sesión.`,
      user: { id: user.id, email: user.email, fullName: user.fullName, totpEnabled: false },
    };
  }

  getJwtTokens(payload: JwtPayload) {
    const accessMs = this.parseMs(
      this.configService.get<string>('ACCESS_TOKEN_MAXAGE'),
      DEFAULT_ACCESS_MAX_AGE_MS,
    );
    const refreshMs = this.parseMs(
      this.configService.get<string>('REFRESH_TOKEN_MAXAGE'),
      DEFAULT_REFRESH_MAX_AGE_MS,
    );

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: Math.max(60, Math.floor(accessMs / 1000)),
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: Math.max(60, Math.floor(refreshMs / 1000)),
    });

    return { accessToken, refreshToken };
  }

  private parseMs(raw: string | undefined, fallback: number): number {
    if (!raw) return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  async create(createUserDto: CreateUserDTO) {
  try {
    const { password, ...rest } = createUserDto;

    const user = this.userRepository.create({
      ...rest,
      password: bcrypt.hashSync(password, 10),
      isActive: false,
    });

    await this.userRepository.save(user);

    await this.createUserActivationFlow(user);

    return {
        msg: 'Usuario creado con exito, revisa tu email y activa tu cuent'
    };

  } catch (e) {
    this.handleDBErrors(e);
  }
}


  async createUserActivationFlow(user: User) {
    
    const token = await this.generateAndStoreToken(user);


    await this.mailService.sendActivateUser(user.email, user.id, token);
  }

  async generateAndStoreToken(user: User, type: string = 'activation') {
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes from now

    const emailToken = this.verificationTokenRepository.create({
      token,
      expiresAt,
      user,
      type,
    });

    await this.verificationTokenRepository.save(emailToken);

    return token;
  }
  async generateTokenForUser(user: User) {
    const token = await this.generateAndStoreToken(user);

    await this.mailService.sendVerificationCode(user.email, token);

    return token;
  }


  async requestNewCode(requestNewCodeDTO: RequestNewCodeDTO) {

    const { email } = requestNewCodeDTO
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('Email not registered');
    }

    await this.verificationTokenRepository.update(
      { user: { id: user.id }, type: 'activation', isUsed: false },
      { isUsed: true }
    );


    const token = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    const newToken = this.verificationTokenRepository.create({
      token,
      expiresAt,
      user,
      type: 'activation',
    });

    await this.verificationTokenRepository.save(newToken);

    await this.mailService.sendVerificationCode(email, token);

    return {
      message: 'Se ha enviado un nuevo código de verificación',
      email,
    };
  }

  async resendActivationLink(requestNewCodeDTO: RequestNewCodeDTO) {
    const { email } = requestNewCodeDTO;

    const user = await this.userRepository.findOne({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });

    if (!user) {
      // For security, do not reveal if the email exists
      return {
        message: 'Si el correo está registrado y la cuenta no está activa, te enviaremos un nuevo enlace de activación',
      };
    }

    // If user is already active, do nothing
    if (user.isActive) {
      return {
        message: 'Esta cuenta ya está activa',
      };
    }

    // Invalidate previous unused activation tokens
    await this.verificationTokenRepository.update(
      { user: { id: user.id }, type: 'activation', isUsed: false },
      { isUsed: true }
    );

    // Generate new activation token
    const token = await this.generateAndStoreToken(user, 'activation');

    // Send activation link by email
    await this.mailService.sendActivateUser(user.email, user.id, token);

    return {
      message: 'Si el correo está registrado y la cuenta no está activa, te enviaremos un nuevo enlace de activación',
    };
  }


  async activateUser(validateTokenDTO: ValidateTokenDTO) {
    const { idUser } = validateTokenDTO;

    await this.validateToken(validateTokenDTO);

    const user = await this.userRepository.findOneBy({ id: idUser });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    await this.userRepository.update({ id: idUser }, { isActive: true });

    return {
      message: 'Usuario activado correctamente'
    };
  }


  async validateToken(validateTokenDTO: ValidateTokenDTO) {

    const { idUser, otp } = validateTokenDTO

    const token = await this.verificationTokenRepository.findOne({
      where: { user: { id: idUser }, token: otp, type: 'activation', isUsed: false },
    });

    if (!token) throw new BadRequestException('Código inválido');

    if (token.expiresAt < new Date())
      throw new BadRequestException('Token expired');

    token.isUsed = true;
    await this.verificationTokenRepository.save(token);

    return true
  }

  private handleDBErrors(e) {
    if (e.errno = 1062) {

      throw new BadRequestException(e.sqlMessage)
    }

    throw new InternalServerErrorException(e)
  }


  getRoles(){

return Object.values(ValidRoles);

  }

  // -------------------------------------------------------------
  // PASSWORD RESET
  // -------------------------------------------------------------

  async requestPasswordReset(requestPasswordResetDTO: RequestPasswordResetDTO) {
    const { email } = requestPasswordResetDTO;

    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      // For security, do not reveal if the email exists
      return {
        message: 'Si el correo está registrado, te enviaremos un código de recuperación',
      };
    }

    // Invalidate all previous password reset tokens
    await this.verificationTokenRepository.update(
      { user: { id: user.id }, type: 'password-reset', isUsed: false },
      { isUsed: true }
    );

    // Generate new password reset token
    const token = await this.generateAndStoreToken(user, 'password-reset');

    // Send code by email
    await this.mailService.sendPasswordResetCode(email, token);

    return {
      message: 'Si el correo está registrado, te enviaremos un código de recuperación',
    };
  }

  async resetPassword(resetPasswordDTO: ResetPasswordDTO) {
    const { email, code, newPassword } = resetPasswordDTO;

    const user = await this.userRepository.findOne({
      where: { email },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      throw new BadRequestException('Correo no encontrado');
    }

    // Find password reset token
    const token = await this.verificationTokenRepository.findOne({
      where: { 
        user: { id: user.id }, 
        token: code, 
        type: 'password-reset',
        isUsed: false 
      },
    });

    if (!token) {
      // Check if code exists in any token (even used or expired) for better error messages
      const tokenByCode = await this.verificationTokenRepository.findOne({
        where: { user: { id: user.id }, token: code, type: 'password-reset' },
      });

      if (tokenByCode) {
        if (tokenByCode.isUsed) {
          throw new BadRequestException('Este código ya fue usado. Solicita un nuevo código.');
        }
        if (tokenByCode.expiresAt < new Date()) {
          throw new BadRequestException('El código expiró. Solicita un nuevo código.');
        }
      }

      throw new BadRequestException('Código inválido');
    }

    if (token.expiresAt < new Date()) {
      throw new BadRequestException('El código expiró');
    }

    // Mark token as used
    token.isUsed = true;
    await this.verificationTokenRepository.save(token);

    // Update password only — never use save() on a partially loaded user (would reset isActive).
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await this.userRepository.update({ id: user.id }, { password: hashedPassword });

    return {
      message: 'Contraseña actualizada correctamente',
    };
  }

  async createStaffUser(dto: CreateStaffUserDto) {
    try {
      const existing = await this.userRepository.findOne({
        where: { email: dto.email.trim().toLowerCase() },
        select: ['id'],
      });
      if (existing) {
        throw new BadRequestException('Ya existe un usuario con ese correo');
      }

      const user = this.userRepository.create({
        email: dto.email.trim().toLowerCase(),
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim() || undefined,
        password: bcrypt.hashSync(dto.password, 10),
        isActive: true,
        provider: 'local',
        roles: [...new Set(dto.roles)],
      });

      await this.userRepository.save(user);

      return {
        success: true,
        message: 'Usuario de staff creado y activo',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          isActive: user.isActive,
          roles: user.roles,
          createdAt: user.createdAt,
        },
      };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.handleDBErrors(e);
    }
  }

  async updateStaffUser(id: string, dto: UpdateStaffUserDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }
    if (!userHasStaffRole(user.roles)) {
      throw new BadRequestException('Este usuario no es de staff interno');
    }

    const patch: Partial<User> = {};
    if (dto.fullName?.trim()) patch.fullName = dto.fullName.trim();
    if (dto.email?.trim()) {
      const email = dto.email.trim().toLowerCase();
      if (email !== user.email) {
        const taken = await this.userRepository.findOne({
          where: { email },
          select: ['id'],
        });
        if (taken && taken.id !== id) {
          throw new BadRequestException('Ya existe otro usuario con ese correo');
        }
        patch.email = email;
      }
    }
    if (dto.phone !== undefined) patch.phone = dto.phone.trim() || undefined;
    if (dto.roles?.length) patch.roles = [...new Set(dto.roles)];
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    if (dto.password) patch.password = bcrypt.hashSync(dto.password, 10);

    await this.userRepository.update({ id }, patch);

    const updated = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'fullName',
        'phone',
        'isActive',
        'roles',
        'createdAt',
        'provider',
        'totpEnabled',
      ],
    });

    return {
      success: true,
      message: 'Usuario de staff actualizado',
      user: updated,
    };
  }
}
