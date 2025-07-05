const express = require('express');
const router = express.Router();
const pool = require('../db');

// 📌 Get resident profile by plot_id
router.get('/profile/:plot_id', async (req, res) => {
    const { plot_id } = req.params;

    try {
        const result = await pool.query(
            'SELECT * FROM residents WHERE plot_id = $1 LIMIT 1',
            [plot_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Resident not found' });
        }

        res.json({ resident: result.rows[0] });
    } catch (err) {
        console.error('Fetch profile error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 📌 Update resident profile by resident_id
router.put('/profile/:resident_id', async (req, res) => {
    const { resident_id } = req.params;
    const { name, email, contact_number } = req.body;

    try {
        await pool.query(
            'UPDATE residents SET name = $1, email = $2, contact_number = $3 WHERE resident_id = $4',
            [name, email, contact_number, resident_id]
        );

        res.json({ success: true, message: 'Profile updated' });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ message: 'Update failed' });
    }
});

// 📌 GET all payments for a specific plot
router.get('/payments/:plot_id', async (req, res) => {
    const { plot_id } = req.params;

    try {
        const result = await pool.query(
            'SELECT * FROM payments WHERE plot_id = $1 ORDER BY payment_date DESC',
            [plot_id]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Fetch payments error:', err);
        res.status(500).json({ message: 'Failed to fetch payments' });
    }
});

// 📌 PUT: Mark a payment as paid
router.put('/payments/:payment_id/mark-paid', async (req, res) => {
    const { payment_id } = req.params;

    try {
        await pool.query(
            `UPDATE payments 
       SET status = 'paid', payment_method = 'manual', transaction_id = 'TXN-DUMMY'
       WHERE payment_id = $1`,
            [payment_id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Update payment error:', err);
        res.status(500).json({ message: 'Failed to update payment' });
    }
});

// 📌 GET notifications relevant to a user (FIXED) - ONLY ONE ROUTE NOW
router.get('/notifications/:plot_id/:org_id/:user_id', async (req, res) => {
    const { plot_id, org_id, user_id } = req.params;

    try {
        // Get user's street_id for street-level notifications
        const plotResult = await pool.query(
            'SELECT street_id FROM plots WHERE plot_id = $1',
            [plot_id]
        );
        const street_id = plotResult.rows[0]?.street_id;

        // Get user's resident_id for individual notifications
        const userResult = await pool.query(
            'SELECT resident_id FROM users_login WHERE user_id = $1',
            [user_id]
        );
        const resident_id = userResult.rows[0]?.resident_id;

        const result = await pool.query(
            `
            SELECT * FROM notifications
            WHERE 
              (
                recipient_type = 'all' AND recipient_id = $1
                OR recipient_type = 'street' AND recipient_id = $2
                OR recipient_type = 'plot' AND recipient_id = $3
                OR recipient_type = 'individual' AND recipient_id = $4
              )
            ORDER BY created_at DESC
            `,
            [org_id, street_id, plot_id, resident_id]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Fetch notifications error:', err);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
});

// 📌 PUT: Mark notification as read
router.put('/notifications/:notification_id/read', async (req, res) => {
    const { notification_id } = req.params;

    try {
        await pool.query(
            "UPDATE notifications SET status = 'read', read_at = CURRENT_TIMESTAMP WHERE notification_id = $1",
            [notification_id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Mark notification read error:', err);
        res.status(500).json({ message: 'Failed to update notification' });
    }
});

// 📌 GET all maintenance requests for a plot
router.get('/maintenance/:plot_id', async (req, res) => {
    const { plot_id } = req.params;

    try {
        const result = await pool.query(
            `SELECT * FROM maintenance_requests WHERE plot_id = $1 ORDER BY created_at DESC`,
            [plot_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Maintenance fetch error:', err);
        res.status(500).json({ message: 'Failed to fetch maintenance requests' });
    }
});

// 📌 POST a new maintenance request
router.post('/maintenance', async (req, res) => {
    const { plot_id, resident_id, title, description, category, priority } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO maintenance_requests 
        (plot_id, resident_id, title, description, category, priority) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [plot_id, resident_id, title, description, category, priority]
        );

        res.status(201).json({ success: true, request: result.rows[0] });
    } catch (err) {
        console.error('Raise request error:', err);
        res.status(500).json({ message: 'Failed to raise request' });
    }
});

// 📌 GET visitor logs for a plot
router.get('/visitors/:plot_id', async (req, res) => {
    const { plot_id } = req.params;

    try {
        const result = await pool.query(
            `SELECT * FROM visitor_logs WHERE plot_id = $1 ORDER BY entry_time DESC`,
            [plot_id]
        );

        res.json(result.rows);
    } catch (err) {
        console.error("Fetch visitor logs error:", err);
        res.status(500).json({ message: "Failed to fetch visitor logs" });
    }
});

module.exports = router;