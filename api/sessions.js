const { getSessions, saveSessions } = require("../lib/db");
const { requireAuth } = require("../lib/auth");

module.exports = async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const { candidate_id, conducted_by } = req.query;
    let list = await getSessions();
    if (candidate_id) list = list.filter((s) => String(s.candidate_id) === String(candidate_id));
    if (conducted_by) list = list.filter((s) => s.conducted_by === conducted_by);
    return res.json(list.reverse());
  }

  if (req.method === "POST") {
    const { candidate_id, obzvon_type, answers } = req.body;
    if (!candidate_id || !obzvon_type || !answers) {
      return res.status(400).json({ error: "candidate_id, obzvon_type, answers required" });
    }
    const plus  = answers.filter((a) => a === "+").length;
    const zero  = answers.filter((a) => a === "0").length;
    const half  = answers.filter((a) => a === "50/50").length;
    const total = answers.length;
    const pct   = Math.round((plus / total) * 100);
    const score = `${plus}/${total} (${pct}%)`;

    const list = await getSessions();
    const session = {
      id: Date.now(),
      candidate_id,
      obzvon_type,
      conducted_by: user.id,
      conducted_by_name: user.username,
      answers,
      plus, zero, half, total, pct, score,
      created_at: Math.floor(Date.now() / 1000),
    };
    list.push(session);
    await saveSessions(list);
    return res.json(session);
  }

  res.status(405).json({ error: "Method not allowed" });
};
