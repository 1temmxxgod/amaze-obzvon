const fetch = require("node-fetch");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // "username/repo"
const BRANCH = process.env.GITHUB_BRANCH || "main";
const BASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents/data`;

async function ghGet(filename) {
  const res = await fetch(`${BASE_URL}/${filename}`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" },
  });
  if (res.status === 404) return { data: null, sha: null };
  const json = await res.json();
  const data = JSON.parse(Buffer.from(json.content, "base64").toString("utf-8"));
  return { data, sha: json.sha };
}

async function ghPut(filename, data, sha) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  const body = { message: `update ${filename}`, content, branch: BRANCH };
  if (sha) body.sha = sha;
  await fetch(`${BASE_URL}/${filename}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function getCandidates() {
  const { data } = await ghGet("candidates.json");
  return data || [];
}

async function saveCandidates(list) {
  const { sha } = await ghGet("candidates.json");
  await ghPut("candidates.json", list, sha);
}

async function getSessions() {
  const { data } = await ghGet("sessions.json");
  return data || [];
}

async function saveSessions(list) {
  const { sha } = await ghGet("sessions.json");
  await ghPut("sessions.json", list, sha);
}

module.exports = { getCandidates, saveCandidates, getSessions, saveSessions };
