/**
 * Admin Role & Token Verification Middleware
 */
const requireAdmin = (req, res, next) => {
  const adminSecret = req.headers['x-admin-token'];
  const expectedSecret = process.env.LOCRA_ADMIN_TOKEN || 'locra-superadmin-secret-2026';

  // 1. Direct admin secret token header check
  if (adminSecret && adminSecret === expectedSecret) {
    return next();
  }

  // 2. User admin role check from authenticated JWT
  if (req.user) {
    const isAdmin = req.user.role === 'admin' || 
                    req.user.adminRole === 'ceo' || 
                    req.user.adminRole === 'manager';
    if (isAdmin) {
      return next();
    }
  }

  // Development bypass
  if (process.env.NODE_ENV !== 'production' && req.query.admin === 'true') {
    return next();
  }

  return res.status(403).json({
    error: 'Toegang geweigerd. Beheerdersrechten vereist.',
    code: 'forbidden'
  });
};

module.exports = { 
  requireAdmin,
  adminMiddleware: requireAdmin 
};
