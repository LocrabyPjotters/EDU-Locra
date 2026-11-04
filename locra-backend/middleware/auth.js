const jwt = require('jsonwebtoken');
const { getModels } = require('../config/database');

/**
 * Pjotters / RowMatch JWT Authentication Middleware
 * 
 * Verifies JWT tokens signed with the shared JWT_SECRET.
 * Looks up the user in the rowmatch database and attaches it to req.user.
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = req.headers['x-auth-token'];
  
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (tokenFromHeader) {
    token = tokenFromHeader.trim();
  }

  if (!token) {
    return res.status(401).json({
      error: 'Geen authenticatietoken gevonden. Log in met je Pjotters / RowMatch account.',
      code: 'unauthorized'
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';
    const decoded = jwt.verify(token, jwtSecret);

    const userId = decoded.user?.id || decoded.id || decoded._id;
    if (!userId) {
      return res.status(401).json({ error: 'Ongeldige tokenpayload.', code: 'invalid_token' });
    }

    const { User } = getModels();
    if (!User) {
      // Offline/fallback mode
      req.user = { id: userId, email: decoded.user?.email || decoded.email, role: decoded.user?.role || 'user' };
      return next();
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'Gebruikersaccount niet gevonden.', code: 'user_not_found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Sessie verlopen of ongeldig token. Log opnieuw in.',
      code: 'token_expired'
    });
  }
};

module.exports = { 
  requireAuth,
  authMiddleware: requireAuth 
};
