import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/wallet(.*)",
  "/sell(.*)",
  "/orders(.*)",
  "/api/economy(.*)",
]);

const isApiRoute = createRouteMatcher(["/api(.*)"]);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (!isProtectedRoute(req)) return;

  const { userId, redirectToSignIn } = await auth();
  if (userId) return;

  // auth.protect() 404s unauthenticated requests by default instead of
  // redirecting — redirect to sign-in for pages, 401 JSON for API routes.
  if (isApiRoute(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return redirectToSignIn({ returnBackUrl: req.url });
});

export const proxyConfig = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
