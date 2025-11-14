import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CreateUserDTO } from './dto/create-user-dto';
import { LogInUserDTO } from './dto/login-user.dto';
import { User } from './entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService
  ) {

  }


  async refreshTokens(userId: string) {
    const payload = { id: userId };

    return this.getTokens(payload);
  }


  async login(logInUserDTO: LogInUserDTO) {
    const { password, email } = logInUserDTO

    const user = await this.userRepository.findOne({ where: { email }, select: { email: true, password: true, id:true } })


    if (!user) throw new UnauthorizedException("invalid credential")

    if (!bcrypt.compareSync(password, user.password)) throw new UnauthorizedException("invalid credential")

     console.log(user.id) 
    const tokens = this.getTokens({ id: user.id })
    return { ...tokens, user }

  }

  private getTokens(payload: JwtPayload) {
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
        password: bcrypt.hashSync(password, 10)
      });

      await this.userRepository.save(user);

      const tokens = this.getTokens({ id: user.id });

      return {
        user,
        ...tokens
      };
    }
    catch (e) {
      this.handleDBErrors(e);
    }
  }



  private handleDBErrors(e) {
    if (e.errno = 1062) {

      throw new BadRequestException(e.sqlMessage)
    }

    throw new InternalServerErrorException()
  }
}
