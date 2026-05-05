require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const profileRoutes = require('./routes/profiles');
const authRoutes    = require('./routes/auth');
const errorHandler  = require('./middleware/errorHandler');

const app = express();

// ── Security & parsing ───────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// ── Rate limiting ────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { status: 'error', message: 'Too many requests, slow down' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { status: 'error', message: 'Too many requests, slow down' },
});

// ── Routes ───────────────────────────────────────────────────────
app.use('/auth',         authLimiter, authRoutes);
app.use('/api/profiles', apiLimiter,  profileRoutes);

// ── Health check ─────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── 404 ──────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));