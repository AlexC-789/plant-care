import { DISPOSABLE_DOMAINS } from './disposable_domains.ts';

export const DISPOSABLE_MESSAGE = "Use a permanent email address. Temporary inboxes can't be used.";
export const NO_MAIL_MESSAGE = "This email domain can't receive mail. Check the address.";

/** Thrown by a Lookup when the domain does not exist (NXDOMAIN). */
export class DomainNotFound extends Error {
  constructor(domain: string) {
    super(`Domain not found: ${domain}`);
    this.name = 'DomainNotFound';
  }
}

/** DNS lookup returning record values; [] when the domain has none of that type. */
export type Lookup = (domain: string, type: 'MX' | 'A' | 'AAAA') => Promise<string[]>;

export type Decision = { ok: true } | { ok: false; message: string };

function isDisposable(domain: string): boolean {
  const labels = domain.split('.');
  // The domain itself or any parent (inbox.mailinator.com → mailinator.com).
  for (let i = 0; i < labels.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(labels.slice(i).join('.'))) return true;
  }
  return false;
}

/** Can the domain receive mail? MX, else A/AAAA (RFC 5321 implicit MX). */
async function receivesMail(domain: string, lookup: Lookup): Promise<boolean> {
  for (const type of ['MX', 'A', 'AAAA'] as const) {
    if ((await lookup(domain, type)).length > 0) return true;
  }
  return false;
}

function timeout(ms: number): Promise<'timeout'> {
  return new Promise((resolve) => setTimeout(() => resolve('timeout'), ms));
}

/**
 * Decide whether a sign-up email is acceptable. Only the domain is looked up.
 * Any DNS failure other than "domain doesn't exist", or a slow lookup, allows the
 * sign-up: email confirmation still protects us and an outage never blocks people.
 */
export async function checkEmail(email: string, lookup: Lookup, timeoutMs = 2000): Promise<Decision> {
  const domain = email.trim().toLowerCase().split('@').pop() ?? '';
  if (!domain) return { ok: true }; // malformed addresses are rejected by Supabase itself
  if (isDisposable(domain)) return { ok: false, message: DISPOSABLE_MESSAGE };

  try {
    const result = await Promise.race([receivesMail(domain, lookup), timeout(timeoutMs)]);
    if (result === 'timeout' || result) return { ok: true };
    return { ok: false, message: NO_MAIL_MESSAGE };
  } catch (error) {
    if (error instanceof DomainNotFound) return { ok: false, message: NO_MAIL_MESSAGE };
    return { ok: true };
  }
}
