import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/common/mail/mail.service';
import { Repository } from 'typeorm';
import { CreateUserDTO } from './dto/create-user-dto';
import { LogInUserDTO } from './dto/login-user.dto';
import { RequestNewCodeDTO } from './dto/request-new-code.dto';
import { ValidateTokenDTO } from './dto/validate-token.dto';
import { RequestPasswordResetDTO } from './dto/request-password-reset.dto';
import { ResetPasswordDTO } from './dto/reset-password.dto';
import { User } from './entities/user.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { ValidRoles } from './interfaces/valid.roles.interface';

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
    const { password, email } = logInUserDTO

    const user = await this.userRepository.findOne({ where: { email }, select: { email: true, password: true, id: true, isActive: true } })


    if (!user) throw new UnauthorizedException("invalid credential")

    if (!bcrypt.compareSync(password, user.password)) throw new UnauthorizedException("invalid credential")

    if (!user.isActive) throw new UnauthorizedException("Inactive User, pleas active your user")


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
      message: 'A new verification code has been sent',
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
        message: 'If the email exists and the account is not active, a new activation link will be sent',
      };
    }

    // If user is already active, do nothing
    if (user.isActive) {
      return {
        message: 'This account is already active',
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
      message: 'If the email exists and the account is not active, a new activation link will be sent',
    };
  }


  async activateUser(validateTokenDTO: ValidateTokenDTO) {
    const { idUser } = validateTokenDTO;

    await this.validateToken(validateTokenDTO);

    const user = await this.userRepository.findOneBy({ id: idUser });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    user.isActive = true;
    await this.userRepository.save(user);

    return {
      message: 'Usuario activado correctamente'
    };
  }


  async validateToken(validateTokenDTO: ValidateTokenDTO) {

    const { idUser, otp } = validateTokenDTO

    const token = await this.verificationTokenRepository.findOne({
      where: { user: { id: idUser }, token: otp, type: 'activation', isUsed: false },
    });

    if (!token) throw new BadRequestException('Invalid token');

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
        message: 'If the email exists, a recovery code will be sent',
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
      message: 'If the email exists, a recovery code will be sent',
    };
  }

  async resetPassword(resetPasswordDTO: ResetPasswordDTO) {
    const { email, code, newPassword } = resetPasswordDTO;

    const user = await this.userRepository.findOne({
      where: { email },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      throw new BadRequestException('Email not found');
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
          throw new BadRequestException('This code has already been used. Please request a new code.');
        }
        if (tokenByCode.expiresAt < new Date()) {
          throw new BadRequestException('Code expired. Please request a new code.');
        }
      }

      throw new BadRequestException('Invalid code');
    }

    if (token.expiresAt < new Date()) {
      throw new BadRequestException('Code expired');
    }

    // Mark token as used
    token.isUsed = true;
    await this.verificationTokenRepository.save(token);

    // Update password
    user.password = bcrypt.hashSync(newPassword, 10);
    await this.userRepository.save(user);

    return {
      message: 'Password updated successfully',
    };
  }
}
