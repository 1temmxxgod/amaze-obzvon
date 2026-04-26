// Refreshes Discord roles and updates JWT cookie
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const { SECRET, getUser } = require("../../lib/auth");

module.exports = async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const memberRes = await fetch(
      `https://discord.com/api/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`,
      { headers: { Authorization: `Bearer ${user.discord_token}` } }
    );
    const member = await memberRes.json();
    const roles = member.roles || user.roles;

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${user.discord_token}` },
    });
    const discordUser = await userRes.json();

    const payload = {
      ...user,
      username: discordUser.username || user.username,
      avatar: discordUser.avatar || user.avatar,
      roles,
    };
    delete payload.iat;
    delete payload.exp;

    const token = jwt.sign(payload, SECRET);
    res.setHeader(
      "Set-Cookie",
      cookie.serialize("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      })
    );
    res.json({ ok: true, username: payload.username, roles });
  } catch (e) {
    res.status(500).json({ error: "Failed to refresh" });
  }
};
