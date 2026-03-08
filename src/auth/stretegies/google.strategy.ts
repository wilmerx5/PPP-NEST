import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Strategy } from 'passport-google-oauth20';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    
    // Priorizar GOOGLE_CALLBACK_URL explícito, luego BACKEND_URL_NGROK, luego BACKEND_URL, luego localhost
    const explicitCallbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');
    const backendUrlNgrok = configService.get<string>('BACKEND_URL_NGROK');
    const backendUrl = configService.get<string>('BACKEND_URL');
    
    const callbackURL = explicitCallbackURL || 
      (backendUrlNgrok ? `${backendUrlNgrok}/api/auth/google/callback` : null) ||
      (backendUrl ? `${backendUrl}/api/auth/google/callback` : null) ||
      'http://localhost:4000/api/auth/google/callback';

    if (!clientID || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured');
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<User> {
    const { id, name, emails } = profile;
    const email = emails?.[0]?.value;
    if (!email) throw new Error('Email no disponible en el perfil de Google');

    const fullName = name?.givenName && name?.familyName
      ? `${name.givenName} ${name.familyName}`
      : name?.displayName || email.split('@')[0] || 'Usuario';

    let user = await this.userRepository.findOne({
      where: [{ googleId: id }, { email }],
    });

    if (!user) {
      user = this.userRepository.create({
        email,
        fullName,
        googleId: id,
        provider: 'google',
        isActive: true,
        phone: undefined,
        password: undefined,
        roles: ['user'],
      });
      await this.userRepository.save(user);
    } else if (!user.googleId) {
      user.googleId = id;
      user.provider = 'google';
      if (!user.isActive) user.isActive = true;
      await this.userRepository.save(user);
    }

    return user;
  }
}
