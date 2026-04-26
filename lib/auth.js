const jwt = require("jsonwebtoken");
const cookie = require("cookie");

const SECRET = process.env.JWT_SECRET || "changeme_secret";

// Roles
const ROLE_ADMIN = ["1453878766916075663", "1453878697676505109"];
const ROLE_INTERVIEWER = ["1453878770309271684", ...ROLE_ADMIN];

function getToken(req) {
  const cookies = cookie.parse(req.headers.cookie || "");
  return cookies.token || null;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function getUser(req) {
  const token = getToken(req);
  if (!token) return null;
  return verifyToken(token);
}

function hasRole(user, roleIds) {
  if (!user || !user.roles) return false;
  return user.roles.some((r) => roleIds.includes(r));
}

function canInterview(user) {
  return hasRole(user, ROLE_INTERVIEWER);
}

function canManage(user) {
  return hasRole(user, ROLE_ADMIN);
}

function requireAuth(req, res) {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (!canInterview(user)) {
    res.status(403).json({ error: "Forbidden: insufficient role" });
    return null;
  }
  return user;
}

module.exports = { getUser, canInterview, canManage, requireAuth, SECRET, ROLE_ADMIN, ROLE_INTERVIEWER };
