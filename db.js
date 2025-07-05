const { Pool } = require('pg');
require('dotenv').config();

// Enhanced pool configuration with better error handling
const pool = new Pool(
    process.env.DATABASE_URL ?
        {
            // Production configuration (Neon database)
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            // Connection pool settings
            max: 20, // Maximum number of clients in the pool
            idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
            connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
            maxUses: 7500, // Close (and replace) a connection after it has been used this many times
        } :
        {
            // Local development configuration
            user: 'postgres',
            host: 'localhost',
            database: 'gcms',
            password: 'chandan@2710',
            port: 5432,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        }
);

// Handle pool errors
pool.on('error', (err, client) => {
    console.error('🔴 Unexpected error on idle client', err);
    // Don't exit the process, just log the error
});

// Handle pool connection events
pool.on('connect', (client) => {
    console.log('🔗 New client connected to database');
});

pool.on('acquire', (client) => {
    console.log('📥 Client acquired from pool');
});

pool.on('remove', (client) => {
    console.log('📤 Client removed from pool');
});

// Initial connection test with retry logic
const connectWithRetry = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
        try {
            const client = await pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            console.log("✅ Connected to PostgreSQL DB");
            console.log("🔗 Using:", process.env.DATABASE_URL ? "Production Database (Neon)" : "Local Database");
            return;
        } catch (err) {
            console.error(`❌ DB connection attempt ${i + 1} failed:`, err.message);
            if (i === retries - 1) {
                console.error("💀 All connection attempts failed. Server will continue but database may be unavailable.");
                // Don't exit the process - let the server run and handle errors per request
                return;
            }
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
    }
};

// Connect with retry on startup
connectWithRetry();

// Enhanced query function with automatic retry
const query = async (text, params) => {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await pool.query(text, params);
            return result;
        } catch (error) {
            console.error(`Query attempt ${attempt} failed:`, error.message);

            if (attempt === maxRetries) {
                throw error;
            }

            // If it's a connection error, wait and retry
            if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.message.includes('Connection terminated')) {
                console.log(`Retrying query in ${attempt * 1000}ms...`);
                await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            } else {
                // If it's not a connection error, don't retry
                throw error;
            }
        }
    }
};

// Export both the pool and enhanced query function
module.exports = {
    pool,
    query
};