import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '@nestjs/passport';
import { Auth } from './auth.decorator';
import { ValidRoles } from '../interfaces/valid.roles.interface';

describe('Auth decorator', () => {
  it('usa AuthGuard("jwt") explícito (sin defaultStrategy del módulo → 500)', () => {
    class Probe {
      @Auth(ValidRoles.admin)
      handler() {
        return true;
      }
    }

    const guards = Reflect.getMetadata(GUARDS_METADATA, Probe.prototype.handler) as unknown[];
    expect(Array.isArray(guards)).toBe(true);
    expect(guards.length).toBeGreaterThanOrEqual(1);

    const jwtGuard = new (AuthGuard('jwt') as new () => object)();
    const applied = new (guards[0] as new () => object)();
    expect(applied.constructor.name).toBe(jwtGuard.constructor.name);
  });
});
