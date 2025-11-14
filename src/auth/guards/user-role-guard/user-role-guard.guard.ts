import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { META_ROLES } from 'src/auth/decorators/role-protected/role-protected.decorator';
import { User } from 'src/auth/entities/user.entity';

@Injectable()
export class UserRoleGuard implements CanActivate {
  
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const validRoles = this.reflector.get<string[]>(META_ROLES, context.getHandler());


    if (!validRoles || validRoles.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as User;

    if (!user) throw new BadRequestException('User not found');

 
    const hasRole = user.roles.some((role) => validRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('User does not have permission to access this resource');
    }

    return true;
  }
}
