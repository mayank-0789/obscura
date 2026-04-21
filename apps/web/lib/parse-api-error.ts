// Shared error-response parser for client mutations.
//
// Server contract (apiError in lib/api.ts): on error, the response JSON is
// always `{ error: <code> }` and optionally includes `{ message: <human> }`
// when the route supplied one. The convention we want in the UI is:
//   - Prefer the human-readable message when present (it's more useful than
//     a raw code like `bad_request` in a toast description).
//   - Fall back to the error code so the calling hook can still switch on it.
//   - Fall back to `api_error_<status>` when the body is missing/malformed.
//
// Callers throw `new Error(await parseApiError(res))` and downstream UI can
// either show `err.message` verbatim or branch on recognizable code values
// (`rate_limited`, `forbidden`, `bad_request`, …).
export async function parseApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    if (body.message && body.message.length > 0) return body.message;
    if (body.error && body.error.length > 0) return body.error;
  } catch {
    /* fall through */
  }
  return `api_error_${res.status}`;
}
