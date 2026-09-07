# IOPAF Authentication Gateway

The public IOPAF website uses the platform's built-in account system. The same secure account screen supports **first-time user registration with email and password** and **returning-user sign-in**, while IOPAF itself never receives or stores the user's password. This behavior is documented in the official [Manus Access Control guide](https://manus.im/docs/website-builder/access-control), under “Built-in Login System”.

Both “Register” and “Sign in” actions now explain and open this **single supported sign-in-or-sign-up screen**. The previous website copy implied that Register would open a separate provider route, although the provider deliberately uses one verified entry form. The corrected Register view tells a first-time user to enter a new email or continue with Google, Microsoft or Apple; the provider then guides account creation.

The client now puts the allowlisted return path `/portal` inside the nonce-bound OAuth state. After successful token exchange and session-cookie creation, the server callback returns directly to `/portal`; it no longer depends on browser `sessionStorage` surviving a cross-origin account journey. Unknown or external return paths fall back to `/`. Missing, invalid or failed callbacks return to `/?auth=failed`, where the website opens the account window with a visible retry message. `/portal` verifies the session before rendering the engine shell, and `/app.html` remains guarded on the server.

Production HTTPS retains `SameSite=None; Secure` session cookies for the cross-site provider return. Local non-HTTPS testing uses `SameSite=Lax`, allowing logout to clear the test session correctly. Signing out returns to the public homepage, and a subsequent direct `/portal` request is protected again.

The release regression covers both website account intents, the unified provider route, callback URI, nonce and signed `/portal` return state, callback failure recovery, unauthenticated redirection, an authenticated signed session, direct protected-engine loading, Controls navigation, logout re-protection, keyboard focus/activation, and desktop/tablet/mobile overflow.
