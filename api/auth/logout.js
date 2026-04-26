const cookie = require("cookie");

module.exports = (req, res) => {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize("token", "", { maxAge: 0, path: "/" })
  );
  res.redirect("/login");
};
