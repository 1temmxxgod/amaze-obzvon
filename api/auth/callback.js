const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const { SECRET } = require("../../lib/auth");

module.exports = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "No code" });

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return res.status(400).json({ error: "Failed to get access token", detail: tokenData });
  }

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = await userRes.json();

  const memberRes = await fetch(
    `https://discord.com/api/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`,
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  );
  const member = await memberRes.json();
  const roles = member.roles || [];

  const payload = {
    id: user.id,
    username: user.username,
    discriminator: user.discriminator || "0",
    avatar: user.avatar,
    roles,
    discord_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
  };

  // No expiry — session lasts forever until logout
  const token = jwt.sign(payload, SECRET);

  res.setHeader(
    "Set-Cookie",
    cookie.serialize("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    })
  );

  res.redirect("/");
};
