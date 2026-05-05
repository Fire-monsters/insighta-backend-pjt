const router = require('express').Router();
const ctrl = require('../controllers/profileController');

router.get('/search', ctrl.searchProfiles);   // must be BEFORE /:id
router.get('/', ctrl.listProfiles);
router.get('/:id', ctrl.getProfile);

module.exports = router;