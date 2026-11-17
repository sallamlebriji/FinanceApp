import request from 'supertest';
import { createApp } from '../src/app';

export const app = createApp();
let n = 0;

export async function signUp(name = 'Test User') {
  const email = `t${Date.now()}_${n++}@test.mizan`;
  const password = 'Sup3r-secret-pass';
  const res = await request(app).post('/api/auth/register').send({ name, email, password });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = res.headers['set-cookie'] as unknown as string[];
  return { token: res.body.accessToken as string, cookie, email, password, user: res.body.user };
}

export function authed(token: string) {
  const h = { Authorization: `Bearer ${token}` };
  return {
    get: (url: string) => request(app).get(url).set(h),
    post: (url: string, body?: object) => request(app).post(url).set(h).send(body ?? {}),
    patch: (url: string, body?: object) => request(app).patch(url).set(h).send(body ?? {}),
    delete: (url: string) => request(app).delete(url).set(h),
  };
}
