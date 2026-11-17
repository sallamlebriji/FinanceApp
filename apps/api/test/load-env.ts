/** Points the API at the dedicated test database before any module reads env. */
export function loadTestEnv() {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* CI provides env */
  }
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required to run API tests');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.NODE_ENV = 'test';
}
