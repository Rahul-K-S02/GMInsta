const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");

const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET || "";
const googleCallbackPath = process.env.GOOGLE_CALLBACK_PATH || process.env.CALL_BACK_URL || "/api/auth/google/callback";
const googleClient = googleClientId && googleClientSecret ? new OAuth2Client(googleClientId, googleClientSecret) : null;

const signToken = (user) =>
  jwt.sign(
    { id: user._id, username: user.username, email: user.email, authProvider: user.authProvider || "local" },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    }
  );

const serializeUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  bio: user.bio,
  profilePic: user.profilePic,
  authProvider: user.authProvider || "local",
  emailVerified: Boolean(user.emailVerified)
});

const slugifyUsername = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.-]+|[_.-]+$/g, "");

const createUniqueUsername = async (preferredName, email) => {
  const baseSource = preferredName || (email ? email.split("@")[0] : "guser");
  const base = slugifyUsername(baseSource) || "guser";
  let candidate = base.slice(0, 24);
  let suffix = 1;

  while (await User.exists({ username: candidate })) {
    candidate = `${base.slice(0, 20)}${suffix}`;
    suffix += 1;
  }

  return candidate;
};

const buildResponse = (user, message) => ({
  message,
  token: signToken(user),
  user: serializeUser(user)
});

const getAppBaseUrl = (req) => process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`;

const getGoogleCallbackUrl = (req) => {
  if (/^https?:\/\//i.test(googleCallbackPath)) return googleCallbackPath;
  return new URL(googleCallbackPath, getAppBaseUrl(req)).toString();
};

const getGoogleCallbackRoutePath = () => {
  if (/^https?:\/\//i.test(googleCallbackPath)) {
    return new URL(googleCallbackPath).pathname;
  }

  try {
    return new URL(googleCallbackPath, "http://localhost").pathname;
  } catch (error) {
    return googleCallbackPath.startsWith("/") ? googleCallbackPath : `/${googleCallbackPath}`;
  }
};

const parseGoogleState = (state) => {
  if (!state) return {};
  try {
    const decoded = Buffer.from(String(state), "base64url").toString("utf8");
    return JSON.parse(decoded);
  } catch (error) {
    return {};
  }
};

const sanitizeReturnTo = (value) => (typeof value === "string" && value.startsWith("/") ? value : "/home");

const renderGoogleResultPage = ({ token, user, returnTo }) => {
  const tokenValue = encodeURIComponent(token);
  const userValue = encodeURIComponent(JSON.stringify(user));
  const returnToValue = encodeURIComponent(returnTo);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Signing in...</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0f1014; color: #f6f7f9; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    .card { padding: 24px 28px; border-radius: 16px; background: #16181d; border: 1px solid #2a2f38; text-align: center; max-width: 420px; }
    .muted { color: #b2b7c1; font-size: 14px; }
  </style>
</head>
<body>
  <div
    id="google-auth-result"
    class="card"
    data-token="${tokenValue}"
    data-user="${userValue}"
    data-return-to="${returnToValue}"
  >
    <h1>Signing you in...</h1>
    <p class="muted">Redirecting back to GMinsta.</p>
  </div>
  <script src="/public/js/googleCallback.js"></script>
</body>
</html>`;
};

const renderGoogleErrorPage = (message) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Google Sign-In Failed</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0f1014; color: #f6f7f9; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    .card { padding: 24px 28px; border-radius: 16px; background: #16181d; border: 1px solid #2a2f38; text-align: center; max-width: 460px; }
    .muted { color: #b2b7c1; font-size: 14px; line-height: 1.6; }
    a { color: #4db5ff; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Google sign-in failed</h1>
    <p class="muted">${String(message).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]))}</p>
    <p class="muted"><a href="/">Back to login</a></p>
  </div>
</body>
</html>`;

const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) {
      return res.status(409).json({
        message: exists.googleId ? "Account already exists. Continue with Google sign-in." : "User already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      authProvider: "local",
      emailVerified: false
    });

    return res.status(201).json(buildResponse(user, "Registration successful"));
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (!user.password) {
      return res.status(401).json({ message: "This account uses Google sign-in. Continue with Google." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    return res.json(buildResponse(user, "Login successful"));
  } catch (error) {
    if (error?.response?.data?.error === "invalid_grant" || error?.code === "invalid_grant") {
      res.status(400).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(
        renderGoogleErrorPage(
          "Google rejected the authorization code. Reopen the login page and try again. If it keeps failing, verify that the redirect URI in Google Cloud Console exactly matches this app's callback URL."
        )
      );
    }
    next(error);
  }
};

const getGoogleConfig = async (req, res) => {
  return res.json({
    googleClientId,
    googleCallbackPath,
    googleCallbackUrl: getGoogleCallbackUrl(req)
  });
};

const startGoogleAuth = async (req, res) => {
  try {
    if (!googleClient) {
      return res.status(500).send("Google sign-in is not configured on the server");
    }

    const mode = req.query.mode === "register" ? "register" : "login";
    const preferredUsername = typeof req.query.preferredUsername === "string" ? req.query.preferredUsername.trim() : "";
    const returnTo = sanitizeReturnTo(req.query.returnTo);
    const redirectUri = getGoogleCallbackUrl(req);
    const state = Buffer.from(JSON.stringify({ mode, preferredUsername, returnTo, redirectUri }), "utf8").toString("base64url");

    const authUrl = googleClient.generateAuthUrl({
      access_type: "offline",
      prompt: "consent select_account",
      scope: ["openid", "email", "profile"],
      state,
      redirect_uri: redirectUri
    });

    return res.redirect(authUrl);
  } catch (error) {
    return res.status(500).send("Unable to start Google sign-in");
  }
};

const completeGoogleAuth = async (req, res, next) => {
  try {
    if (!googleClient) {
      return res.status(500).send("Google sign-in is not configured on the server");
    }

    const code = req.query.code;
    if (!code) {
      return res.status(400).send("Missing Google authorization code");
    }

    const state = parseGoogleState(req.query.state);
    const redirectUri = state.redirectUri || getGoogleCallbackUrl(req);
    const { tokens } = await googleClient.getToken({
      code,
      redirect_uri: redirectUri
    });

    if (!tokens?.id_token) {
      return res.status(400).send("Google did not return an ID token");
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: googleClientId
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.sub) {
      return res.status(400).send("Google account details are incomplete");
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const emailVerified = Boolean(payload.email_verified);
    const displayName = payload.name || state.preferredUsername || email.split("@")[0];
    const picture = payload.picture || "/public/images/default-avatar.svg";

    let user = await User.findOne({ $or: [{ googleId }, { email }] }).select("+password");

    if (user) {
      const updates = {
        googleId: user.googleId || googleId,
        emailVerified: user.emailVerified || emailVerified,
        authProvider: "google"
      };

      if (!user.profilePic || user.profilePic === "/public/images/default-avatar.svg") {
        updates.profilePic = picture;
      }

      if (!user.username && displayName) {
        updates.username = await createUniqueUsername(displayName, email);
      }

      user = await User.findByIdAndUpdate(user._id, updates, { new: true });
    } else {
      const username = await createUniqueUsername(displayName, email);
      user = await User.create({
        username,
        email,
        password: null,
        authProvider: "google",
        googleId,
        emailVerified,
        profilePic: picture
      });
    }

    const resultPage = renderGoogleResultPage({
      token: signToken(user),
      user: serializeUser(user),
      returnTo: sanitizeReturnTo(state.returnTo)
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(resultPage);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getGoogleConfig,
  startGoogleAuth,
  completeGoogleAuth,
  googleCallbackPath,
  getGoogleCallbackRoutePath
};