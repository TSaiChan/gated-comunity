const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import database connection
const pool = require('./db');

const app = express();

const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const userRouter = require('./routes/users');

// Smart CORS configuration for both local and production
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-frontend-domain.vercel.app'] // We'll update this later with actual Vercel URL
    : ['http://localhost:3000', 'http://localhost:3001'], // For local development
  credentials: true
}));

app.use(express.json());

// Mount routers
app.use('/api', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/user', userRouter);

app.get('/api/test', (req, res) =>
  res.json({ success: true, message: 'Server is running!' })
);

// Test database connection route
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({
      success: true,
      message: 'Database connected successfully!',
      timestamp: result.rows[0].current_time
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add this route to your server.js file

// Verify all database tables exist and are accessible
app.get('/api/verify-db', async (req, res) => {
  try {
    // List of all your tables
    const expectedTables = [
      'organisation', 'streets', 'plots', 'flats', 'residents',
      'users_login', 'payments', 'notifications', 'maintenance_requests',
      'community_expenses', 'visitor_logs'
    ];

    const tableStatus = {};

    // Check each table
    for (const table of expectedTables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        tableStatus[table] = {
          exists: true,
          recordCount: parseInt(result.rows[0].count)
        };
      } catch (error) {
        tableStatus[table] = {
          exists: false,
          error: error.message
        };
      }
    }

    // Get database connection info
    const dbInfo = await pool.query('SELECT current_database(), current_user, version()');

    res.json({
      success: true,
      message: 'Database verification complete',
      database: dbInfo.rows[0].current_database,
      user: dbInfo.rows[0].current_user,
      tables: tableStatus,
      summary: {
        totalTables: expectedTables.length,
        existingTables: Object.values(tableStatus).filter(t => t.exists).length,
        totalRecords: Object.values(tableStatus).reduce((sum, t) => sum + (t.recordCount || 0), 0)
      }
    });

  } catch (error) {
    console.error('Database verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add some initial sample data (if tables are empty)
app.get('/api/seed-data', async (req, res) => {
  try {
    // Check if org already exists
    const orgCheck = await pool.query('SELECT COUNT(*) FROM organisation');

    if (parseInt(orgCheck.rows[0].count) === 0) {
      // Add sample organization
      await pool.query(`
                INSERT INTO organisation (name, gst_no) 
                VALUES ('Green Valley Residency', 'GSTIN123456') 
            `);

      // Add sample streets
      await pool.query(`
                INSERT INTO streets (org_id, street_name) VALUES 
                (1, 'Palm Street'), 
                (1, 'Lake View Road')
            `);

      // Add sample plots
      await pool.query(`
                INSERT INTO plots (org_id, street_id, plot_type, plot_no) VALUES 
                (1, 1, 'Individual', 'P-101'),
                (1, 1, 'Flats', 'P-102'),
                (1, 2, 'Flats', 'P-201')
            `);

      // Add sample flats
      await pool.query(`
                INSERT INTO flats (plot_id, flat_no, eb_card) VALUES
                (2, 'F1', 'EB001'),
                (2, 'F2', 'EB002'),
                (3, 'F1', 'EB003')
            `);

      // Add sample residents
      await pool.query(`
                INSERT INTO residents (plot_id, flat_id, name, contact_number, email, id_proof) VALUES
                (1, NULL, 'Ravi Kumar', '9876543210', 'ravi@example.com', 'ID123'),
                (2, 1, 'Sneha Mehta', '9123456780', 'sneha@example.com', 'ID456'),
                (2, 2, 'Amit Shah', '9988776655', 'amit@example.com', 'ID789')
            `);

      // Add admin user (password should be hashed in production)
      await pool.query(`
                INSERT INTO users_login (user_name, password, org_id, plot_id, resident_id, user_type) VALUES
                ('admin', 'admin123', 1, NULL, NULL, 'admin'),
                ('ravi_k', 'pass123', 1, 1, 1, 'owner')
            `);

      res.json({
        success: true,
        message: 'Sample data added successfully!',
        note: 'Check /api/verify-db to see updated counts'
      });
    } else {
      res.json({
        success: true,
        message: 'Sample data already exists - no changes made'
      });
    }

  } catch (error) {
    console.error('Seed data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Use environment PORT and bind to all interfaces
const PORT = process.env.PORT || 5001;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});