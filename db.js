const { Pool } = require('pg');
require('dotenv').config();

// Smart configuration: Use environment variable if available, otherwise use local config
const pool = new Pool(
    process.env.DATABASE_URL ?
        {
            // Production configuration (Neon database)
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        } :
        {
            // Local development configuration (your existing setup)
            user: 'postgres',
            host: 'localhost',
            database: 'gcms',
            password: 'chandan@2710',
            port: 5432,
        }
);