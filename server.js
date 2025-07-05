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

// Add this route to your server.js file

// Create all database tables
app.get('/api/create-tables', async (req, res) => {
  try {
    // Create all tables in the correct order (respecting foreign key dependencies)

    // 1. Organisation Table
    await pool.query(`
            CREATE TABLE IF NOT EXISTS organisation (
                org_id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                gst_no VARCHAR(20)
            )
        `);

    // 2. Streets
    await pool.query(`
            CREATE TABLE IF NOT EXISTS streets (
                street_id SERIAL PRIMARY KEY,
                org_id INTEGER REFERENCES organisation(org_id),
                street_name VARCHAR(100) NOT NULL
            )
        `);

    // 3. Plots
    await pool.query(`
            CREATE TABLE IF NOT EXISTS plots (
                plot_id SERIAL PRIMARY KEY,
                org_id INTEGER REFERENCES organisation(org_id),
                street_id INTEGER REFERENCES streets(street_id),
                plot_type VARCHAR(20) CHECK (plot_type IN ('Individual', 'Flats')),
                plot_no VARCHAR(50) NOT NULL
            )
        `);

    // 4. Flats
    await pool.query(`
            CREATE TABLE IF NOT EXISTS flats (
                flat_id SERIAL PRIMARY KEY,
                plot_id INTEGER REFERENCES plots(plot_id),
                flat_no VARCHAR(50),
                eb_card VARCHAR(50)
            )
        `);

    // 5. Residents
    await pool.query(`
            CREATE TABLE IF NOT EXISTS residents (
                resident_id SERIAL PRIMARY KEY,
                plot_id INTEGER REFERENCES plots(plot_id),
                flat_id INTEGER REFERENCES flats(flat_id),
                name VARCHAR(100) NOT NULL,
                contact_number VARCHAR(15),
                email VARCHAR(100),
                id_proof VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

    // 6. Users Login
    await pool.query(`
            CREATE TABLE IF NOT EXISTS users_login (
                user_id SERIAL PRIMARY KEY,
                user_name VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                org_id INTEGER REFERENCES organisation(org_id),
                plot_id INTEGER REFERENCES plots(plot_id),
                resident_id INTEGER REFERENCES residents(resident_id),
                user_type VARCHAR(10) CHECK (user_type IN ('owner', 'tenant', 'admin')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        `);

    // 7. Payments
    await pool.query(`
            CREATE TABLE IF NOT EXISTS payments (
                payment_id SERIAL PRIMARY KEY,
                plot_id INTEGER REFERENCES plots(plot_id),
                resident_id INTEGER REFERENCES residents(resident_id),
                amount DECIMAL(10,2) NOT NULL,
                payment_type VARCHAR(50) NOT NULL,
                payment_date DATE DEFAULT CURRENT_DATE,
                due_date DATE,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
                payment_method VARCHAR(30),
                transaction_id VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

    // 8. Notifications
    await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                notification_id SERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                sender_id INTEGER REFERENCES users_login(user_id),
                recipient_type VARCHAR(20) CHECK (recipient_type IN ('all', 'street', 'plot', 'individual')),
                recipient_id INTEGER,
                status VARCHAR(20) DEFAULT 'unread' CHECK (status IN ('read', 'unread')),
                priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP
            )
        `);

    // 9. Maintenance Requests
    await pool.query(`
            CREATE TABLE IF NOT EXISTS maintenance_requests (
                request_id SERIAL PRIMARY KEY,
                plot_id INTEGER REFERENCES plots(plot_id),
                resident_id INTEGER REFERENCES residents(resident_id),
                title VARCHAR(200) NOT NULL,
                description TEXT NOT NULL,
                category VARCHAR(50),
                priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
                status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
                assigned_to VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP
            )
        `);

    // 10. Community Expenses
    await pool.query(`
            CREATE TABLE IF NOT EXISTS community_expenses (
                expense_id SERIAL PRIMARY KEY,
                org_id INTEGER REFERENCES organisation(org_id),
                expense_type VARCHAR(50) NOT NULL,
                description TEXT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                expense_date DATE DEFAULT CURRENT_DATE,
                vendor_name VARCHAR(100),
                receipt_number VARCHAR(50),
                approved_by INTEGER REFERENCES users_login(user_id),
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

    // 11. Visitor Logs
    await pool.query(`
            CREATE TABLE IF NOT EXISTS visitor_logs (
                log_id SERIAL PRIMARY KEY,
                plot_id INTEGER REFERENCES plots(plot_id),
                visitor_name VARCHAR(100) NOT NULL,
                visitor_phone VARCHAR(15),
                purpose VARCHAR(200),
                entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                exit_time TIMESTAMP,
                approved_by INTEGER REFERENCES residents(resident_id),
                security_guard VARCHAR(100)
            )
        `);

    // Create indexes for better performance
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_login_username ON users_login(user_name)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_login_plot ON users_login(plot_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_residents_plot ON residents(plot_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_resident ON payments(resident_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_plot ON payments(plot_id)`);

    res.json({
      success: true,
      message: 'All database tables created successfully!',
      tables: [
        'organisation', 'streets', 'plots', 'flats', 'residents',
        'users_login', 'payments', 'notifications', 'maintenance_requests',
        'community_expenses', 'visitor_logs'
      ],
      indexes: [
        'idx_users_login_username', 'idx_users_login_plot',
        'idx_residents_plot', 'idx_payments_resident', 'idx_payments_plot'
      ],
      note: 'Run /api/verify-db to confirm all tables exist'
    });

  } catch (error) {
    console.error('Create tables error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || 'No additional details'
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