const router          = require('express').Router();
const multer          = require('multer');
const path            = require('path');
const ctrl            = require('../controllers/profileController');
const { ingestCSV }   = require('../controllers/ingestController');
const authenticate    = require('../middleware/authenticate');
const { requireRole } = require('../middleware/rbac');
const requireApiVersion = require('../middleware/apiVersion');
const { cacheMiddleware } = require('../middleware/cache');

// Multer — store uploaded CSV as temp file (never fully in memory)
const upload = multer({
  dest: '/tmp/insighta-uploads/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.csv') {
      return cb(new Error('Only CSV files allowed'));
    }
    cb(null, true);
  }
});

// All routes require auth + API version header
router.use(authenticate);
router.use(requireApiVersion);

// ── Read routes (with cache) ─────────────────────────────────────
router.get('/export', ctrl.exportProfiles);
router.get('/search', cacheMiddleware('search'), ctrl.searchProfiles);
router.get('/',       cacheMiddleware('list'),   ctrl.listProfiles);
router.get('/:id',   ctrl.getProfile);

// ── Write routes (admin only) ────────────────────────────────────
router.post('/',         requireRole('admin'), ctrl.createProfile);
router.delete('/:id',    requireRole('admin'), ctrl.deleteProfile);

// ── CSV ingestion (admin only) ───────────────────────────────────
router.post('/ingest', requireRole('admin'), upload.single('file'), ingestCSV);

module.exports = router;