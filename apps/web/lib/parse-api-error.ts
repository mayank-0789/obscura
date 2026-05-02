/** Parse a server error response into a string for `new Error(...)`. Prefers `message`, falls back to `error` code, then `api_error_<status>`. */
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
