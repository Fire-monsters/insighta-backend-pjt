require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const profileRoutes = require('./routes/profiles');
const errorHandler  = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/profiles', profileRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 404
app.use((req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));