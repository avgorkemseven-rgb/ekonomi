import { auth, createTestApp, registerUser, resetDb, type TestContext } from './helpers';

describe('Auth (integration)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
  });
  afterAll(async () => ctx.app.close());

  it('registers, never stores the plain password, and returns tokens', async () => {
    const res = await registerUser(ctx, { email: 'Ali@Example.com', username: 'ali.k' });
    expect(res.user.email).toBe('ali@example.com');
    expect(res.user.role).toBe('USER');
    expect(res.user.activeListingLimit).toBe(10);
    expect(res.accessToken).toBeTruthy();
    expect(res.refreshToken.length).toBeGreaterThan(30);
    const row = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'ali@example.com' } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    const session = await ctx.prisma.session.findFirstOrThrow({ where: { userId: row.id } });
    expect(session.tokenHash).not.toBe(res.refreshToken);
  });

  it('rejects duplicates and invalid input with stable error codes', async () => {
    const dupEmail = await ctx.http().post('/v1/auth/register').send({ email: 'ali@example.com', username: 'other', password: 'Sifre12345', displayName: 'X Y' });
    expect(dupEmail.status).toBe(409);
    expect(dupEmail.body.error).toBe('EMAIL_TAKEN');
    const dupUser = await ctx.http().post('/v1/auth/register').send({ email: 'new@example.com', username: 'ALI.K', password: 'Sifre12345', displayName: 'X Y' });
    expect(dupUser.body.error).toBe('USERNAME_TAKEN');
    const weak = await ctx.http().post('/v1/auth/register').send({ email: 'w@example.com', username: 'weak', password: 'password', displayName: 'X Y' });
    expect(weak.status).toBe(400);
    expect(weak.body.error).toBe('VALIDATION_ERROR');
    expect(weak.body.issues[0].path).toEqual(['password']);
  });

  it('logs in and rejects wrong credentials without revealing which part was wrong', async () => {
    const ok = await ctx.http().post('/v1/auth/login').send({ email: 'ALI@example.com', password: 'Sifre12345' });
    expect(ok.status).toBe(200);
    const badPass = await ctx.http().post('/v1/auth/login').send({ email: 'ali@example.com', password: 'wrong123' });
    const noUser = await ctx.http().post('/v1/auth/login').send({ email: 'nobody@example.com', password: 'wrong123' });
    expect(badPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(badPass.body.error).toBe('INVALID_CREDENTIALS');
    expect(noUser.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('protects /auth/me', async () => {
    const u = await registerUser(ctx);
    await ctx.http().get('/v1/auth/me').expect(401);
    await ctx.http().get('/v1/auth/me').set(auth('garbage.token.value')).expect(401);
    const me = await ctx.http().get('/v1/auth/me').set(auth(u.accessToken)).expect(200);
    expect(me.body.id).toBe(u.user.id);
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const u = await registerUser(ctx);
    const first = await ctx.http().post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(200);
    expect(first.body.refreshToken).not.toBe(u.refreshToken);
    // Immediate reuse (parallel requests) is rejected but does not revoke the family.
    const racing = await ctx.http().post('/v1/auth/refresh').send({ refreshToken: u.refreshToken });
    expect(racing.status).toBe(401);
    const second = await ctx.http().post('/v1/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(200);
    // Reuse after the grace window is treated as theft → whole family revoked.
    await ctx.prisma.session.updateMany({ where: { userId: u.user.id, rotatedAt: { not: null } }, data: { rotatedAt: new Date(Date.now() - 60_000) } });
    const reuse = await ctx.http().post('/v1/auth/refresh').send({ refreshToken: u.refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error).toBe('INVALID_REFRESH_TOKEN');
    await ctx.http().post('/v1/auth/refresh').send({ refreshToken: second.body.refreshToken }).expect(401);
  });

  it('logout revokes the session', async () => {
    const u = await registerUser(ctx);
    await ctx.http().post('/v1/auth/logout').send({ refreshToken: u.refreshToken }).expect(204);
    await ctx.http().post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
  });

  it('blocks suspended users immediately, even with a valid access token', async () => {
    const u = await registerUser(ctx);
    await ctx.prisma.user.update({ where: { id: u.user.id }, data: { status: 'SUSPENDED' } });
    const me = await ctx.http().get('/v1/auth/me').set(auth(u.accessToken));
    expect(me.status).toBe(403);
    expect(me.body.error).toBe('ACCOUNT_SUSPENDED');
    const login = await ctx.http().post('/v1/auth/login').send({ email: u.user.email, password: u.password });
    expect(login.body.error).toBe('ACCOUNT_SUSPENDED');
  });

  it('updates the profile with validation', async () => {
    const u = await registerUser(ctx);
    const res = await ctx.http().patch('/v1/me').set(auth(u.accessToken)).send({ city: 'İzmir', bio: 'Dart oyuncusu' }).expect(200);
    expect(res.body.city).toBe('İzmir');
    await ctx.http().patch('/v1/me').set(auth(u.accessToken)).send({ city: 'Gotham' }).expect(400);
    const pub = await ctx.http().get(`/v1/users/${u.user.username}`).expect(200);
    expect(pub.body.city).toBe('İzmir');
    expect(pub.body).not.toHaveProperty('email');
  });
});
