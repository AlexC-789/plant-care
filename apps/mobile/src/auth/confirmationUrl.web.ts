/** Query string and fragment of the page Supabase redirected to. */
export function readConfirmationUrl(): { search: string; hash: string } {
  return { search: window.location.search, hash: window.location.hash };
}

/** Remove query and fragment (Supabase puts session tokens there) from the address bar. */
export function clearConfirmationUrl(): void {
  window.history.replaceState(null, '', window.location.pathname);
}
