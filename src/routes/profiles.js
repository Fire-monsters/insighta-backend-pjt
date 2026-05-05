const router        = require('express').Router();
const ctrl          = require('../controllers/profileController');
const authenticate  = require('../middleware/authenticate');
const { requireRole } = require('../middleware/rbac');
const requireApiVersion = require('../middleware/apiVersion');

router.get('/search', ctrl.searchProfiles);   // must be BEFORE /:id
router.get('/', ctrl.listProfiles);
router.get('/:id', ctrl.getProfile);
// All profile routes require auth + API version header
router.use(authenticate);
router.use(requireApiVersion);

router.get('/export', ctrl.exportProfiles);                          // analyst + admin
router.get('/search', ctrl.searchProfiles);                          // analyst + admin
router.get('/',       ctrl.listProfiles);                            // analyst + admin
router.get('/:id',    ctrl.getProfile);                              // analyst + admin
router.post('/',      requireRole('admin'), ctrl.createProfile);     // admin only
router.delete('/:id', requireRole('admin'), ctrl.deleteProfile);     // admin only

module.exports = router;