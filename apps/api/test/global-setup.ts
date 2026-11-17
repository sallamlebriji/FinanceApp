import { execSync } from 'node:child_process';
import { loadTestEnv } from './load-env';

export default function setup() {
  loadTestEnv();
  // Applies pending migrations to the test database (no-op when up to date).
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
