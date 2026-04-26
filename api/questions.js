const fs = require("fs");
const path = require("path");
const { requireAuth } = require("../lib/auth");

// questions.js doesn't need DB

function parseQuestions(text) {
  const questions = [];
  // Split by numbered lines like "1.", "2.", etc.
  const blocks = text.split(/\n(?=\d+\.)/).filter(Boolean);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const questionLine = lines[0].replace(/^\d+\.\s*/, "").trim();
    const answerLine = lines.slice(1).join(" ").replace(/^\s*(ответ|Ответ)\s*:\s*/i, "").trim();
    if (questionLine) {
      questions.push({ question: questionLine, answer: answerLine });
    }
  }
  return questions;
}

module.exports = (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { type } = req.query;
  if (!type || !["1", "2", "3"].includes(type)) {
    return res.status(400).json({ error: "type must be 1, 2 or 3" });
  }

  const filePath = path.join(process.cwd(), "data", `${type}-obzvon.txt`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Questions file not found" });
  }

  const text = fs.readFileSync(filePath, "utf-8");
  const questions = parseQuestions(text);
  res.json(questions);
};
