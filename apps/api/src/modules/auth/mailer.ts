import { env, isProd } from '../../config/env';
import { logger } from '../../lib/logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Mail transport abstraction. In development the message (including the action link) is
 * written to the API log so flows can be tested end to end. A production SMTP/API
 * transport is plugged in here before launch (see docs/ROADMAP.md).
 */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

const devMailer: Mailer = {
  async send(message) {
    logger.info({ mail: { to: message.to, subject: message.subject } }, `\n[dev mail] ${message.subject}\n${message.text}\n`);
  },
};

const sentForTests: MailMessage[] = [];
const testMailer: Mailer = {
  async send(message) {
    sentForTests.push(message);
  },
};

export const mailer: Mailer = env.NODE_ENV === 'test' ? testMailer : devMailer;
export const testOutbox = sentForTests;

if (isProd) logger.warn('No production mail transport configured; emails are logged only.');

export const links = {
  verify: (token: string) => `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`,
  reset: (token: string) => `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`,
};
