const router = require('express').Router();
const ctrl   = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');

router.get('/github',          ctrl.redirectToGithub);
router.get('/github/callback', ctrl.handleCallback);
router.post('/refresh',        ctrl.refreshToken);
router.post('/logout',         ctrl.logout);

router.get('/me', authenticate, (req, res) => {
    res.json({ status: 'success', user: req.user });
});

module.exports = router;



