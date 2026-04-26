const { getCandidates, saveCandidates } = require("../lib/db");
const { requireAuth, canManage } = require("../lib/auth");

module.exports = async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const list = await getCandidates();
    return res.json(list);
  }

  if (req.method === "POST") {
    if (!canManage(user)) return res.status(403).json({ error: "Forbidden" });
    const { name, discord_id } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const list = await getCandidates();
    const id = Date.now();
    const candidate = { id, name: name.trim(), discord_id: discord_id || null, added_by: user.id, created_at: Math.floor(Date.now() / 1000) };
    list.push(candidate);
    await saveCandidates(list);
    return res.json(candidate);
  }

  if (req.method === "DELETE") {
    if (!canManage(user)) return res.status(403).json({ error: "Forbidden" });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id required" });
    let list = await getCandidates();
    list = list.filter((c) => String(c.id) !== String(id));
    await saveCandidates(list);
    return res.json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
};
