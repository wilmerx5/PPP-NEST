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
import { User } from './entities/user.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';

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
      expiresIn: '2m',
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
        isActive: false, // opcional si tienes este campo
      });

      await this.userRepository.save(user);

      // Generar token y enviar correo de activación
      await this.createUserActivationFlow(user);

      // JWT para login
      const tokens = this.getJwtTokens({ id: user.id });

      return {
        user,
        ...tokens
      };

    } catch (e) {
      this.handleDBErrors(e);
    }
  }

  async createUserActivationFlow(user: User) {
    
    const token = await this.generateAndStoreToken(user);


    await this.mailService.sendActivateUser(user.email, user.id, token);
  }

  async generateAndStoreToken(user: User) {
    const token = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    const expiresAtBogota = new Date(
      expiresAt.toLocaleString('en-US', { timeZone: 'America/Bogota' })
    );

    const emailToken = this.verificationTokenRepository.create({
      token,
      expiresAt: expiresAtBogota,
      user,
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
      { user: { id: user.id }, isUsed: false },
      { isUsed: true }
    );


    const token = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    const newToken = this.verificationTokenRepository.create({
      token,
      expiresAt,
      user,
    });

    await this.verificationTokenRepository.save(newToken);

    await this.mailService.sendVerificationCode(email, token);

    return {
      message: 'A new verification code has been sent',
      email,
    };
  }


  async activateUser(validateTokenDTO: ValidateTokenDTO) {
    const { userId } = validateTokenDTO;

    await this.validateToken(validateTokenDTO);

    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    user.isActive = true;
    await this.userRepository.save(user);

    return {
      message: 'Usuario activado correctamente'
    };
  }


  async validateToken(validateTokenDTO: ValidateTokenDTO) {

    const { userId, code } = validateTokenDTO

    const token = await this.verificationTokenRepository.findOne({
      where: { user: { id: userId }, token: code, isUsed: false },
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
}
