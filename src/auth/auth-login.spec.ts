import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

describe('staff login response', () => {
  it('returns public user fields without password hashes or second-factor secrets', async () => {
    const user = {
      id: 'staff-fixture', email: 'staff@example.invalid', fullName: 'Staff fixture',
      isActive: true, provider: 'local', roles: ['kitchenUser'],
      password: bcrypt.hashSync('fixture-password', 4), totpEnabled: false,
      totpSecret: 'private-fixture', totpRecoveryCodes: ['private-recovery-fixture'],
    };
    const service = new AuthService(
      { findOne: jest.fn().mockResolvedValue(user) } as any,
      {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    jest.spyOn(service, 'getJwtTokens').mockReturnValue({ accessToken: 'access-fixture', refreshToken: 'refresh-fixture' });
    const result = await service.login({ email: user.email, password: 'fixture-password' });
    expect(result.user).toEqual({ id: user.id, email: user.email, fullName: user.fullName,
      isActive: true, provider: 'local', roles: ['kitchenUser'] });
    expect(JSON.stringify(result)).not.toContain(user.password);
    expect(JSON.stringify(result)).not.toContain(user.totpSecret);
    expect(JSON.stringify(result)).not.toContain(user.totpRecoveryCodes[0]);
  });
});
