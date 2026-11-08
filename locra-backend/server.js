require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { connectDatabases, closeDatabases } = require('./config/database');

const authRoutes = require('./routes/auth');
const eduRoutes = require('./routes/edu');
const privAiRoutes = require('./routes/privai');
const billingRoutes = require('./routes/billing');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 4200;

// Security & Middlewares
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'x-internal-privai-secret']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'locra-backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'locra-backend',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authRoutes); // Alias voor compatibiliteit met api.rowmatch.nl auth & register endpoints
app.use('/api/edu', eduRoutes);
app.use('/api/privai', privAiRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);

// Statische bestanden van Locra PrivAI™ website & dashboard
const websitePath = path.resolve(__dirname, '../website/Locra-privai');
app.use(express.static(websitePath));
app.use('/website/Locra-privai', express.static(websitePath));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.url} niet gevonden op Locra Backend.`
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Interne serverfout'
  });
});

let server;

async function startServer() {
  try {
    await connectDatabases();
    server = app.listen(PORT, () => {
      console.log(`🚀 Locra Backend draait op http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Kon Locra Backend niet starten:', error);
    process.exit(1);
  }
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeDatabases();
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, stopServer };

