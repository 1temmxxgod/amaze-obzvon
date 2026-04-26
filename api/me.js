const { getUser, canInterview, canManage } = require("../lib/auth");
const { getSessions } = require("../lib/db");

module.exports = async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  // Build profile stats
  const sessions = await getSessions();
  const mySessions = sessions.filter((s) => s.conducted_by === user.id);

  const stats = {
    total: mySessions.length,
    byType: { 1: 0, 2: 0, 3: 0 },
    totalPlus: 0,
    totalZero: 0,
    totalHalf: 0,
  };
  for (const s of mySessions) {
    stats.byType[s.obzvon_type] = (stats.byType[s.obzvon_type] || 0) + 1;
    if (Array.isArray(s.answers)) {
      stats.totalPlus += s.answers.filter((a) => a === "+").length;
      stats.totalZero += s.answers.filter((a) => a === "0").length;
      stats.totalHalf += s.answers.filter((a) => a === "50/50").length;
    }
  }

  res.json({
    id: user.id,
    username: user.username,
    discriminator: user.discriminator || "0",
    avatar: user.avatar,
    roles: user.roles,
    canInterview: canInterview(user),
    canManage: canManage(user),
    stats,
  });
};
