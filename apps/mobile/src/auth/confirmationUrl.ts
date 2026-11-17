/**
 * Native: the confirmation page is only ever reached via a web link, so there is
 * no URL to inspect. See confirmationUrl.web.ts for the browser version.
 */
export function readConfirmationUrl(): { search: string; hash: string } {
  return { search: '', hash: '' };
}

export function clearConfirmationUrl(): void {}
