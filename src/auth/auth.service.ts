import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
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
import { User } from './entities/user.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { ValidRoles } from './interfaces/valid.roles.interface';
import { userHasStaffRole } from './staff.roles.util';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,

    @InjectRepository(VerificationToken) private readonly verificationTokenRepository: Repository<VerificationToken>,

    private readonly jwtService: JwtService,
    private readonly mailService: MailService

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
      select: { email: true, password: true, id: true, isActive: true, provider: true },
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


    const tokens = this.getJwtTokens({ id: user.id });
    return { ...tokens, user };

  }

  getJwtTokens(payload: JwtPayload) {
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m', // 15 minutos
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
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
    if (dto.phone !== undefined) patch.phone = dto.phone.trim() || undefined;
    if (dto.roles?.length) patch.roles = [...new Set(dto.roles)];
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    if (dto.password) patch.password = bcrypt.hashSync(dto.password, 10);

    await this.userRepository.update({ id }, patch);

    const updated = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'email', 'fullName', 'phone', 'isActive', 'roles', 'createdAt', 'provider'],
    });

    return {
      success: true,
      message: 'Usuario de staff actualizado',
      user: updated,
    };
  }
}
