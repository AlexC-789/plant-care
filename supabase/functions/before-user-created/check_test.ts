import { assertEquals } from '@std/assert';

import { checkEmail, DomainNotFound, type Lookup } from './check.ts';

const DISPOSABLE = "Use a permanent email address. Temporary inboxes can't be used.";
const NO_MAIL = "This email domain can't receive mail. Check the address.";

/** Fake DNS: records per "domain type"; missing entries return []. */
function dns(records: Record<string, string[]>, opts: { notFound?: string[] } = {}) {
  const calls: string[] = [];
  const lookup: Lookup = async (domain, type) => {
    calls.push(`${domain} ${type}`);
    if (opts.notFound?.includes(domain)) throw new DomainNotFound(domain);
    return records[`${domain} ${type}`] ?? [];
  };
  return { lookup, calls };
}

Deno.test('a domain with MX records is allowed', async () => {
  const { lookup } = dns({ 'gmail.com MX': ['gmail-smtp-in.l.google.com'] });
  assertEquals(await checkEmail('maya@gmail.com', lookup), { ok: true });
});

const WORKING = { 'gmail.com MX': ['gmail-smtp-in.l.google.com'] };

Deno.test('a domain that does not exist is rejected', async () => {
  const { lookup } = dns(WORKING, { notFound: ['ajshs.fur'] });
  assertEquals(await checkEmail('hdsjs@ajshs.fur', lookup), { ok: false, message: NO_MAIL });
});

Deno.test('a domain with no MX, A or AAAA records is rejected', async () => {
  const { lookup } = dns(WORKING);
  assertEquals(await checkEmail('a@parked.example', lookup), { ok: false, message: NO_MAIL });
});

Deno.test('no MX but an A record is allowed (mail falls back to A)', async () => {
  const { lookup } = dns({ 'small.example A': ['203.0.113.7'] });
  assertEquals(await checkEmail('a@small.example', lookup), { ok: true });
});

Deno.test('disposable domains are rejected without a DNS lookup', async () => {
  const { lookup, calls } = dns({ 'mailinator.com MX': ['mx.mailinator.com'] });
  assertEquals(await checkEmail('x@mailinator.com', lookup), { ok: false, message: DISPOSABLE });
  assertEquals(calls, []);
});

Deno.test('subdomains of disposable domains are rejected', async () => {
  const { lookup } = dns({});
  assertEquals(await checkEmail('x@inbox.mailinator.com', lookup), {
    ok: false,
    message: DISPOSABLE,
  });
});

Deno.test('case and surrounding whitespace are ignored', async () => {
  const { lookup } = dns({});
  assertEquals(await checkEmail('  X@Mailinator.COM ', lookup), { ok: false, message: DISPOSABLE });
  const ok = dns({ 'gmail.com MX': ['mx'] });
  assertEquals(await checkEmail(' Maya@GMAIL.com ', ok.lookup), { ok: true });
  assertEquals(ok.calls[0], 'gmail.com MX');
});

Deno.test('a DNS error other than not-found allows the sign-up (fail open)', async () => {
  const lookup: Lookup = () => Promise.reject(new Error('SERVFAIL'));
  assertEquals(await checkEmail('a@example.org', lookup), { ok: true });
});

Deno.test('a DNS lookup slower than the timeout allows the sign-up', async () => {
  const lookup: Lookup = () => new Promise((resolve) => setTimeout(() => resolve([]), 200));
  assertEquals(await checkEmail('a@slow.example', lookup, 20), { ok: true });
});

Deno.test('when even a well-known domain has no records, DNS is broken: allow', async () => {
  const { lookup } = dns({}); // every lookup empty, gmail.com included
  assertEquals(await checkEmail('hdsjs@ajshs.fur', lookup), { ok: true });
});

Deno.test('rejection requires the well-known domain to resolve', async () => {
  const { lookup, calls } = dns({ 'gmail.com MX': ['gmail-smtp-in.l.google.com'] });
  assertEquals(await checkEmail('hdsjs@ajshs.fur', lookup), { ok: false, message: NO_MAIL });
  assertEquals(calls.includes('gmail.com MX'), true);
});
