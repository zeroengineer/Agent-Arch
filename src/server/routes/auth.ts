import { Hono } from "hono";
import { auth } from "../auth/index";

const authRoutes = new Hono();

/**
 * Delegate all /api/auth/* requests to Better Auth's built-in handler.
 * This covers: sign-in, sign-up, sign-out, session, OAuth callbacks, etc.
 */
authRoutes.on(["GET", "POST"], "/*", async (c) => {
  return auth.handler(c.req.raw);
});

export default authRoutes;
