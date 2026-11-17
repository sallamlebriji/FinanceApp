import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { testOutbox } from '../src/modules/auth/mailer';
import { app, authed, signUp } from './helpers';

const refreshCookie = (cookies: string[]) => cookies.find((c) => c.startsWith('mz_rt='))!.split(';')[0]!;

describe('auth', () => {
  it('registers with default categories and an httpOnly, SameSite=Strict refresh cookie', async () => {
    const s = await signUp();
    const raw = s.cookie.find((c) => c.startsWith('mz_rt='))!;
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Strict/i);
    expect(raw).toMatch(/Path=\/api\/auth/);
    const cats = await authed(s.token).get('/api/categories');
    expect(cats.body.items).toHaveLength(18);
    expect(s.user.emailVerified).toBe(false);
  });

  it('never returns the password hash and rejects duplicate emails', async () => {
    const s = await signUp();
    const me = await authed(s.token).get('/api/auth/me');
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|argon2/);
    const dup = await request(app).post('/api/auth/register').send({ name: 'X', email: s.email, password: 'Another-pass-123' });
    expect(dup.status).toBe(409);
  });

  it('enforces password strength', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'X', email: 'weak@test.mizan', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in with a generic error on bad credentials', async () => {
    const s = await signUp();
    const bad = await request(app).post('/api/auth/login').send({ email: s.email, password: 'wrong-password-1' });
    expect(bad.status).toBe(401);
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@test.mizan', password: 'wrong-password-1' });
    expect(unknown.body.error.message).toBe(bad.body.error.message);
    const ok = await request(app).post('/api/auth/login').send({ email: s.email, password: s.password });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const s = await signUp();
    const first = refreshCookie(s.cookie);
    const r1 = await request(app).post('/api/auth/refresh').set('Cookie', first);
    expect(r1.status).toBe(200);
    const second = refreshCookie(r1.headers['set-cookie'] as unknown as string[]);
    expect(second).not.toBe(first);

    // Replaying the first (already rotated) token is treated as theft.
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', first);
    expect(replay.status).toBe(401);
    // ...and the legitimate latest token is revoked too.
    const after = await request(app).post('/api/auth/refresh').set('Cookie', second);
    expect(after.status).toBe(401);
  });

  it('supports native clients with the refresh token in the body', async () => {
    const s = await signUp();
    const login = await request(app)
      .post('/api/auth/login')
      .set('X-Client-Platform', 'native')
      .send({ email: s.email, password: s.password });
    expect(login.body.refreshToken).toBeTruthy();
    expect(login.headers['set-cookie']).toBeUndefined();
    const r = await request(app)
      .post('/api/auth/refresh')
      .set('X-Client-Platform', 'native')
      .send({ refreshToken: login.body.refreshToken });
    expect(r.status).toBe(200);
    expect(r.body.refreshToken).not.toBe(login.body.refreshToken);
  });

  it('rejects refresh from an untrusted origin', async () => {
    const s = await signUp();
    const r = await request(app).post('/api/auth/refresh').set('Origin', 'https://evil.example').set('Cookie', refreshCookie(s.cookie));
    expect(r.status).toBe(403);
  });

  it('logout revokes the session', async () => {
    const s = await signUp();
    const c = refreshCookie(s.cookie);
    expect((await request(app).post('/api/auth/logout').set('Cookie', c)).status).toBe(204);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', c)).status).toBe(401);
  });

  it('verifies email with a single-use token', async () => {
    const s = await signUp();
    const mail = [...testOutbox].reverse().find((m) => m.to === s.email && /Confirm/.test(m.subject))!;
    const token = /token=([^\s]+)/.exec(mail.text)![1]!;
    const ok = await request(app).post('/api/auth/verify-email').send({ token: decodeURIComponent(token) });
    expect(ok.status).toBe(200);
    const again = await request(app).post('/api/auth/verify-email').send({ token: decodeURIComponent(token) });
    expect(again.status).toBe(400);
    const me = await authed(s.token).get('/api/auth/me');
    expect(me.body.user.emailVerified).toBe(true);
  });

  it('resets the password and signs out every session', async () => {
    const s = await signUp();
    const res = await request(app).post('/api/auth/forgot-password').send({ email: s.email });
    expect(res.status).toBe(200);
    // Unknown emails get the same response (no enumeration).
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@test.mizan' });
    expect(unknown.body).toEqual(res.body);
    const mail = [...testOutbox].reverse().find((m) => m.to === s.email && /Reset/.test(m.subject))!;
    const token = decodeURIComponent(/token=([^\s]+)/.exec(mail.text)![1]!);
    const reset = await request(app).post('/api/auth/reset-password').send({ token, password: 'Brand-new-pass-42' });
    expect(reset.status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie(s.cookie))).status).toBe(401);
    const login = await request(app).post('/api/auth/login').send({ email: s.email, password: 'Brand-new-pass-42' });
    expect(login.status).toBe(200);
  });

  it('requires a valid access token on protected routes', async () => {
    expect((await request(app).get('/api/accounts')).status).toBe(401);
    expect((await request(app).get('/api/accounts').set('Authorization', 'Bearer nope')).status).toBe(401);
  });
});
