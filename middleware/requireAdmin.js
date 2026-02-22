export function requireAdmin(req, res, next) {
  const role = String(req.user?.role || "")
    .trim()
    .toLowerCase();

  // allow common admin variants just in case
  const allowed = new Set(["admin", "administrator", "superadmin"]);

  if (!allowed.has(role)) {
    return res.status(403).json({
      message: "Admin only",
      gotRole: role || "missing",
    });
  }

  next();
}
