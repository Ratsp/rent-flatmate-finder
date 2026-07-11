const jwt = require('jsonwebtoken');

/**
 * Authenticate middleware — verifies JWT from Authorization header.
 * Attaches decoded user payload to req.user: { id, email, role }
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

/**
 * Role-based access control middleware.
 * Must be used AFTER authenticate middleware.
 * 
 * @param {string[]} roles - Array of allowed roles, e.g. ['owner'], ['tenant', 'owner']
 * @returns {Function} Express middleware
 * 
 * @example
 * router.post('/listings', authenticate, requireRole(['owner']), createListing);
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access denied. Required role: ${roles.join(' or ')}` 
      });
    }

    next();
  };
};

module.exports = { authenticate, requireRole };
