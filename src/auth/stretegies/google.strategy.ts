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

    // Log para debugging
    console.log('[GoogleStrategy] Configuración OAuth:');
    console.log('  - GOOGLE_CALLBACK_URL:', explicitCallbackURL || 'no configurado');
    console.log('  - BACKEND_URL_NGROK:', backendUrlNgrok || 'no configurado');
    console.log('  - BACKEND_URL:', backendUrl || 'no configurado');
    console.log('  - Callback URL final:', callbackURL);
    console.log('  - Client ID:', clientID ? `${clientID.substring(0, 20)}...` : 'no configurado');

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
    
    console.log('[GoogleStrategy.validate] Iniciando validación');
    console.log('[GoogleStrategy.validate] Email:', email);
    console.log('[GoogleStrategy.validate] Google ID:', id);
    console.log('[GoogleStrategy.validate] Full Name:', name?.displayName);
    
    if (!email) {
      console.error('[GoogleStrategy.validate] ERROR: Email no disponible');
      throw new Error('Email no disponible en el perfil de Google');
    }

    const fullName = name?.givenName && name?.familyName
      ? `${name.givenName} ${name.familyName}`
      : name?.displayName || email.split('@')[0] || 'Usuario';

    console.log('[GoogleStrategy.validate] Buscando usuario en DB...');
    let user = await this.userRepository.findOne({
      where: [{ googleId: id }, { email }],
    });

    if (!user) {
      console.log('[GoogleStrategy.validate] Usuario NO encontrado, creando nuevo...');
      
      try {
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
        
        console.log('[GoogleStrategy.validate] Usuario creado en memoria:', {
          email: user.email,
          fullName: user.fullName,
          googleId: user.googleId,
          provider: user.provider,
        });
        
        await this.userRepository.save(user);
        console.log('[GoogleStrategy.validate] ✅ Usuario guardado exitosamente en DB. ID:', user.id);
      } catch (error) {
        console.error('[GoogleStrategy.validate] ❌ ERROR al guardar usuario:', error);
        throw error;
      }
    } else if (!user.googleId) {
      console.log('[GoogleStrategy.validate] Usuario encontrado SIN googleId, vinculando cuenta...');
      user.googleId = id;
      user.provider = 'google';
      if (!user.isActive) {
        user.isActive = true;
      }
      await this.userRepository.save(user);
      console.log('[GoogleStrategy.validate] ✅ Cuenta vinculada exitosamente');
    } else {
      console.log('[GoogleStrategy.validate] Usuario existente encontrado. ID:', user.id);
    }

    return user;
  }
}
