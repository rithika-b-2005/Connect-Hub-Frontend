/**
 * Turns an API failure into a message that is safe to put in front of a user.
 *
 * The backend answers some failures with raw framework text (for example
 * "ThrottlerException: Too Many Requests"). Showing that verbatim leaks
 * internals and confuses people, so anything that looks like an exception or
 * a stack trace is replaced with a readable fallback.
 */

// "ThrottlerException: ..." / "QueryFailedError: ..." — a class name and a colon.
const RAW_EXCEPTION = /^\s*[\w.]*(?:Exception|Error)\s*:/;
// A stack trace: a newline followed by an indented frame.
const STACK_FRAME = /\n\s*at\s+/;

export function toUserMessage(err, fallback = 'Something went wrong. Please try again.') {
  const status = err?.response?.status;

  if (status === 429) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  // No response at all: the request never reached the API.
  if (!err?.response) {
    return 'Could not reach the server. Check your connection and try again.';
  }

  const payload = err.response.data ?? {};
  const raw = payload.message ?? payload.error;
  const message = Array.isArray(raw) ? raw[0] : raw;

  if (typeof message !== 'string' || !message.trim()) return fallback;

  const text = message.trim();
  if (RAW_EXCEPTION.test(text) || STACK_FRAME.test(text)) return fallback;

  return text;
}
