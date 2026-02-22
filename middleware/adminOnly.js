export const adminOnly = (req, res, next) => {
  try {
    // Check authentication first
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized. Please login first.",
      });
    }

    // Normalize role safely
    const role = String(req.user.role || "").toLowerCase();

    // Check admin access
    if (role !== "admin") {
      return res.status(403).json({
        message: "Admin access only.",
      });
    }

    // Passed checks
    next();
  } catch (err) {
    console.error("❌ Admin middleware error:", err);
    return res.status(500).json({
      message: "Server error",
    });
  }
};
