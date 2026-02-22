import { ForbiddenException } from '@nestjs/common';
import { ArtistGuard } from '../guards/artist.guard';

const buildContext = (user: any) => ({
  switchToHttp: () => ({
    getRequest: () => ({ user }),
  }),
});

describe('ArtistGuard', () => {
  let guard: ArtistGuard;

  beforeEach(() => {
    guard = new ArtistGuard();
  });

  it('allows access when user has artistId', () => {
    const ctx = buildContext({ sub: 'user-uuid', artistId: 'artist-uuid' });
    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('throws ForbiddenException when user has no artistId', () => {
    const ctx = buildContext({ sub: 'user-uuid', artistId: undefined });
    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is null', () => {
    const ctx = buildContext(null);
    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is undefined', () => {
    const ctx = buildContext(undefined);
    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
  });
});
