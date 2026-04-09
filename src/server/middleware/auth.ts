import { createMiddleware } from "hono/factory";
import { auth } from "../auth/index";

export type AuthVariables = {
  userId: string;
  sessionId: string;
};

/**
 * Session middleware — validates the Better Auth session from cookies/headers.
 * Attaches userId and sessionId to Hono context variables.
 * Returns 401 if the session is invalid or missing.
 */
export const sessionMiddleware = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session || !session.user || !session.session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", session.user.id);
  c.set("sessionId", session.session.id);

  await next();
});
