const { isAdminEmail } = require("../utils/admin");

module.exports = (req, res, next) => {
  if (isAdminEmail(req.user?.email)) return next();
  return res.status(403).json({ message: "Admin access required" });
};

