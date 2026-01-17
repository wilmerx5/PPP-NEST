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


    const tokens = this.getJwtTokens({ id: user.id })
    return { ...tokens, user }

  }

  private getJwtTokens(payload: JwtPayload) {
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1m',
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
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutos desde ahora

    console.log(`[GENERATE TOKEN] Generando token para usuario: ${user.id}, tipo: ${type}`);
    console.log(`[GENERATE TOKEN] Token generado: ${token}`);
    console.log(`[GENERATE TOKEN] Fecha expiración: ${expiresAt.toISOString()}`);

    const emailToken = this.verificationTokenRepository.create({
      token,
      expiresAt,
      user,
      type,
    });

    const savedToken = await this.verificationTokenRepository.save(emailToken);
    console.log(`[GENERATE TOKEN] ✅ Token guardado correctamente. ID: ${savedToken.id}, tipo: ${savedToken.type}`);

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
    
    console.log('[RESEND ACTIVATION LINK] Solicitando reenvío de link para:', email);

    const user = await this.userRepository.findOne({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });

    if (!user) {
      console.log('[RESEND ACTIVATION LINK] ❌ Usuario no encontrado');
      // Por seguridad, no revelamos si el email existe
      return {
        message: 'Si el email existe y la cuenta no está activa, se enviará un nuevo link de activación',
      };
    }

    console.log('[RESEND ACTIVATION LINK] ✅ Usuario encontrado. ID:', user.id, 'Activo:', user.isActive);

    // Si el usuario ya está activo, no hacemos nada
    if (user.isActive) {
      console.log('[RESEND ACTIVATION LINK] ⚠️ Usuario ya está activo');
      return {
        message: 'Esta cuenta ya está activa',
      };
    }

    // Invalidar tokens de activación previos no usados
    await this.verificationTokenRepository.update(
      { user: { id: user.id }, type: 'activation', isUsed: false },
      { isUsed: true }
    );
    console.log('[RESEND ACTIVATION LINK] Tokens previos invalidados');

    // Generar nuevo token de activación
    const token = await this.generateAndStoreToken(user, 'activation');
    console.log('[RESEND ACTIVATION LINK] ✅ Nuevo token generado:', token);

    // Enviar link de activación por email
    await this.mailService.sendActivateUser(user.email, user.id, token);
    console.log('[RESEND ACTIVATION LINK] ✅ Link de activación enviado');

    return {
      message: 'Si el email existe y la cuenta no está activa, se enviará un nuevo link de activación',
      email, // Solo para desarrollo, considerar remover en producción
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

    console.log(token)
    if (!token) throw new BadRequestException('Token inválido');

    if (token.expiresAt < new Date())
      throw new BadRequestException('Token expirado');

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

    console.log('[PASSWORD RESET REQUEST] Solicitando reset para email:', email);

    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      console.log('[PASSWORD RESET REQUEST] ❌ Usuario no encontrado');
      // Por seguridad, no revelamos si el email existe o no
      return {
        message: 'Si el email existe, se enviará un código de recuperación',
      };
    }

    console.log('[PASSWORD RESET REQUEST] ✅ Usuario encontrado. ID:', user.id);

    // Invalidar todos los tokens de password reset previos
    const invalidatedTokens = await this.verificationTokenRepository.update(
      { user: { id: user.id }, type: 'password-reset', isUsed: false },
      { isUsed: true }
    );
    console.log('[PASSWORD RESET REQUEST] Tokens previos invalidados:', invalidatedTokens.affected);

    // Generar nuevo token de password reset
    const token = await this.generateAndStoreToken(user, 'password-reset');
    console.log('[PASSWORD RESET REQUEST] ✅ Token generado:', token);

    // Enviar código por email
    await this.mailService.sendPasswordResetCode(email, token);
    console.log('[PASSWORD RESET REQUEST] ✅ Email enviado correctamente');

    return {
      message: 'Si el email existe, se enviará un código de recuperación',
      email, // Solo para desarrollo, considerar remover en producción
    };
  }

  async resetPassword(resetPasswordDTO: ResetPasswordDTO) {
    const { email, code, newPassword } = resetPasswordDTO;

    console.log('[PASSWORD RESET] Iniciando reset de contraseña');
    console.log('[PASSWORD RESET] Email:', email);
    console.log('[PASSWORD RESET] Código recibido:', code);
    console.log('[PASSWORD RESET] Longitud del código:', code?.length);

    const user = await this.userRepository.findOne({
      where: { email },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      console.log('[PASSWORD RESET] ❌ Usuario no encontrado para email:', email);
      throw new BadRequestException('Email no encontrado');
    }

    console.log('[PASSWORD RESET] ✅ Usuario encontrado. ID:', user.id);

    // Buscar el token de password reset
    console.log('[PASSWORD RESET] Buscando token con:');
    console.log('  - userId:', user.id);
    console.log('  - token:', code);
    console.log('  - type: password-reset');
    console.log('  - isUsed: false');

    const token = await this.verificationTokenRepository.findOne({
      where: { 
        user: { id: user.id }, 
        token: code, 
        type: 'password-reset',
        isUsed: false 
      },
    });

    if (!token) {
      console.log('[PASSWORD RESET] ❌ Token no encontrado');
      
      // Buscar todos los tokens del usuario para debugging
      const allTokens = await this.verificationTokenRepository.find({
        where: { user: { id: user.id }, type: 'password-reset' },
        order: { createdAt: 'DESC' },
        take: 5,
      });
      
      console.log('[PASSWORD RESET] Tokens encontrados para este usuario (últimos 5):');
      allTokens.forEach((t, idx) => {
        console.log(`  Token ${idx + 1}:`, {
          token: t.token,
          type: t.type,
          isUsed: t.isUsed,
          expiresAt: t.expiresAt,
          createdAt: t.createdAt,
          expired: t.expiresAt < new Date(),
        });
      });

      // Verificar si el código está en algún token (incluso usado o expirado)
      const tokenByCode = await this.verificationTokenRepository.findOne({
        where: { user: { id: user.id }, token: code, type: 'password-reset' },
      });

      if (tokenByCode) {
        if (tokenByCode.isUsed) {
          console.log('[PASSWORD RESET] ⚠️ Token encontrado pero ya fue usado');
          throw new BadRequestException('Este código ya fue utilizado. Solicita un nuevo código.');
        }
        if (tokenByCode.expiresAt < new Date()) {
          console.log('[PASSWORD RESET] ⚠️ Token encontrado pero expiró');
          throw new BadRequestException('Código expirado. Solicita un nuevo código.');
        }
      }

      throw new BadRequestException('Código inválido');
    }

    console.log('[PASSWORD RESET] ✅ Token encontrado:', {
      id: token.id,
      token: token.token,
      expiresAt: token.expiresAt,
      isUsed: token.isUsed,
    });

    if (token.expiresAt < new Date()) {
      console.log('[PASSWORD RESET] ❌ Token expirado. Fecha expiración:', token.expiresAt);
      throw new BadRequestException('Código expirado');
    }

    console.log('[PASSWORD RESET] Token válido, procediendo a actualizar contraseña');

    // Marcar token como usado
    token.isUsed = true;
    await this.verificationTokenRepository.save(token);
    console.log('[PASSWORD RESET] ✅ Token marcado como usado');

    // Actualizar contraseña
    user.password = bcrypt.hashSync(newPassword, 10);
    await this.userRepository.save(user);
    console.log('[PASSWORD RESET] ✅ Contraseña actualizada correctamente');

    return {
      message: 'Contraseña actualizada correctamente',
    };
  }
}
