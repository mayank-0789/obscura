import { handlers } from "@/lib/auth-config";

// Auth.js v5 catch-all handler. Owns /api/auth/{signin,callback,signout,session,csrf,...}.
// All flow logic lives in `lib/auth-config.ts`.
export const { GET, POST } = handlers;
