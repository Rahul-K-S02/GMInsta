const parseAdminEmails = () => {
  const raw = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "").trim();
  if (!raw) return [];
  return raw
    .split(/[,\s;]+/g)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
};

const isAdminEmail = (email) => {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;

  const admins = parseAdminEmails();
  if (!admins.length) {
    // Dev-friendly default: if no env is configured, allow everyone.
    // Set ADMIN_EMAILS in production to restrict access.
    return true;
  }
  return admins.includes(normalized);
};

module.exports = { isAdminEmail };

