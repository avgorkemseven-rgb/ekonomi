import { auth, createTestApp, registerUser, resetDb, type TestContext } from './helpers';

/**
 * Refresh-token rotation under concurrency (ADR-014). Legitimate parallel refreshes with the same token must not
 * revoke the session, while replay outside the bounded grace window must still be detected.
 */
describe('Refresh token concurrency and replay (integration)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
  });
  afterAll(async () => ctx.app.close());

  const refresh = (refreshToken: string) => ctx.http().post('/v1/auth/refresh').send({ refreshToken });
  const familyRevoked = async (userId: string) =>
    (await ctx.prisma.session.count({ where: { userId, revokedAt: { not: null } } })) > 0;

  it('simultaneous refreshes with the same token all succeed and converge on one successor', async () => {
    const u = await registerUser(ctx);
    const results = await Promise.all(Array.from({ length: 5 }, () => refresh(u.refreshToken)));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const successors = new Set(results.map((r) => r.body.refreshToken as string));
    expect(successors.size).toBe(1);
    expect(await familyRevoked(u.user.id)).toBe(false);
    // Exactly one successor session was created (original + successor).
    expect(await ctx.prisma.session.count({ where: { userId: u.user.id } })).toBe(2);
    // Every returned access token works and the shared successor keeps rotating normally.
    for (const r of results) await ctx.http().get('/v1/auth/me').set(auth(r.body.accessToken)).expect(200);
    await refresh([...successors][0]!).expect(200);
  });

  it('rejects an expired refresh token without revoking anything else', async () => {
    const u = await registerUser(ctx);
    await ctx.prisma.session.updateMany({ where: { userId: u.user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await refresh(u.refreshToken);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_REFRESH_TOKEN');
    expect(await familyRevoked(u.user.id)).toBe(false);
  });

  it('rejects a revoked (logged-out) refresh token', async () => {
    const u = await registerUser(ctx);
    await ctx.http().post('/v1/auth/logout').send({ refreshToken: u.refreshToken }).expect(204);
    const res = await refresh(u.refreshToken);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_REFRESH_TOKEN');
  });

  it('rejects unknown tokens', async () => {
    await refresh('x'.repeat(43)).expect(401);
  });

  it('treats replay after the grace window as theft and revokes the whole family', async () => {
    const u = await registerUser(ctx);
    const next = await refresh(u.refreshToken).expect(200);
    await ctx.prisma.session.updateMany({
      where: { userId: u.user.id, rotatedAt: { not: null } },
      data: { rotatedAt: new Date(Date.now() - 60_000) },
    });
    const replay = await refresh(u.refreshToken);
    expect(replay.status).toBe(401);
    expect(await familyRevoked(u.user.id)).toBe(true);
    // The legitimate holder's successor is revoked too (attacker and victim both lose the session).
    await refresh(next.body.refreshToken).expect(401);
  });

  it('within the grace window, a replay never yields a token once the successor has been used', async () => {
    const u = await registerUser(ctx);
    const next = await refresh(u.refreshToken).expect(200);
    await refresh(next.body.refreshToken).expect(200); // successor already rotated
    const replay = await refresh(u.refreshToken);
    expect(replay.status).toBe(401);
    // Within the window this is ambiguous (late parallel request), so it is rejected without revocation.
    expect(await familyRevoked(u.user.id)).toBe(false);
  });

  it('caps grace-window replays; exceeding the cap revokes the family', async () => {
    const u = await registerUser(ctx);
    await refresh(u.refreshToken).expect(200);
    for (let i = 0; i < 5; i++) await refresh(u.refreshToken).expect(200);
    const over = await refresh(u.refreshToken);
    expect(over.status).toBe(401);
    expect(await familyRevoked(u.user.id)).toBe(true);
  });

  it('replay of a successor by two parties is detected (the replayed successor is single-use)', async () => {
    const u = await registerUser(ctx);
    const a = await refresh(u.refreshToken).expect(200);
    const b = await refresh(u.refreshToken).expect(200); // grace replay → same successor
    expect(b.body.refreshToken).toBe(a.body.refreshToken);
    await refresh(a.body.refreshToken).expect(200); // party A rotates the successor
    await ctx.prisma.session.updateMany({
      where: { userId: u.user.id, rotatedAt: { not: null } },
      data: { rotatedAt: new Date(Date.now() - 60_000) },
    });
    await refresh(b.body.refreshToken).expect(401); // party B later presents it → theft detected
    expect(await familyRevoked(u.user.id)).toBe(true);
  });

  it('blocks refresh for suspended users', async () => {
    const u = await registerUser(ctx);
    await ctx.prisma.user.update({ where: { id: u.user.id }, data: { status: 'SUSPENDED' } });
    const res = await refresh(u.refreshToken);
    expect(res.status).toBe(403);
  });
});
