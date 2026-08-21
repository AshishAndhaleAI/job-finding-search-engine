import { httpRouter } from "convex/server";
import { auth } from "./auth";

/*
 * HTTP router — Convex Auth endpoints only.
 *
 * NOTE: This file must NOT have a "use node" directive. The HTTP router runs
 * in the standard V8 runtime, and adding the directive crashes deployment of
 * the entire router ("use node" directive is not allowed for http.ts), which
 * breaks both auth token validation and any custom HTTP endpoints.
 */

const http = httpRouter();

// Registers /.well-known/openid-configuration, /.well-known/jwks.json,
// and (if configured) OAuth sign-in/callback routes.
auth.addHttpRoutes(http);

export default http;
