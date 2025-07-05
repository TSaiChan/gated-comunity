const express = require('express');
const router = express.Router();
const pool = require('../db');

// ========== STREETS CRUD ==========

// Get all streets for an organization
router.get('/streets/:org_id', async (req, res) => {
  try {
    const { org_id } = req.params;
    const result = await pool.query('SELECT * FROM streets WHERE org_id = $1', [org_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching streets:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch streets' });
  }
});

// Add a new street
router.post('/streets', async (req, res) => {
  const { org_id, street_name } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO streets (org_id, street_name) VALUES ($1, $2) RETURNING *',
      [org_id, street_name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding street:', err);
    res.status(500).json({ success: false, message: 'Failed to add street' });
  }
});

// Update a street
router.put('/streets/:id', async (req, res) => {
  const { id } = req.params;
  const { street_name } = req.body;
  try {
    const result = await pool.query(
      'UPDATE streets SET street_name = $1 WHERE street_id = $2 RETURNING *',
      [street_name, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating street:', err);
    res.status(500).json({ success: false, message: 'Failed to update street' });
  }
});

// Delete a street
router.delete('/streets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM streets WHERE street_id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting street:', err);
    res.status(500).json({ success: false, message: 'Failed to delete street' });
  }
});

// ========== PLOTS CRUD ==========

// Get all plots for an organization
router.get('/plots/:org_id', async (req, res) => {
  const { org_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT p.*, s.street_name 
       FROM plots p
       LEFT JOIN streets s ON p.street_id = s.street_id
       WHERE p.org_id = $1`,
      [org_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching plots:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch plots' });
  }
});

// Add a new plot
router.post('/plots', async (req, res) => {
  const { org_id, street_id, plot_type, plot_no } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO plots (org_id, street_id, plot_type, plot_no)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [org_id, street_id, plot_type, plot_no]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding plot:', err);
    res.status(500).json({ success: false, message: 'Failed to add plot' });
  }
});

// Update a plot
router.put('/plots/:id', async (req, res) => {
  const { id } = req.params;
  const { street_id, plot_type, plot_no } = req.body;
  try {
    const result = await pool.query(
      `UPDATE plots SET street_id = $1, plot_type = $2, plot_no = $3
       WHERE plot_id = $4 RETURNING *`,
      [street_id, plot_type, plot_no, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating plot:', err);
    res.status(500).json({ success: false, message: 'Failed to update plot' });
  }
});

// Delete a plot
router.delete('/plots/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM plots WHERE plot_id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting plot:', err);
    res.status(500).json({ success: false, message: 'Failed to delete plot' });
  }
});

// ========== FLATS CRUD ==========

// Get all flats for a plot
router.get('/flats/:plot_id', async (req, res) => {
  const { plot_id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM flats WHERE plot_id = $1',
      [plot_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching flats:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch flats' });
  }
});

// Add flat
router.post('/flats', async (req, res) => {
  const { plot_id, flat_no, eb_card } = req.body;

  try {
    // Validate required fields
    if (!plot_id || !flat_no) {
      return res.status(400).json({ message: 'Plot ID and flat number are required' });
    }

    // Check if flat number already exists in this plot
    const checkResult = await pool.query(
      'SELECT flat_id FROM flats WHERE plot_id = $1 AND flat_no = $2',
      [plot_id, flat_no]
    );

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: 'Flat number already exists in this plot' });
    }

    // Insert new flat
    const result = await pool.query(
      `INSERT INTO flats (plot_id, flat_no, eb_card)
       VALUES ($1, $2, $3) RETURNING *`,
      [plot_id, flat_no, eb_card || null]
    );

    res.status(201).json({
      message: 'Flat added successfully',
      flat: result.rows[0]
    });
  } catch (err) {
    console.error('Error adding flat:', err);
    res.status(500).json({ message: 'Failed to add flat' });
  }
});

// Update flat
router.put('/flats/:id', async (req, res) => {
  const { id } = req.params;
  const { flat_no, eb_card } = req.body;

  try {
    if (!flat_no) {
      return res.status(400).json({ message: 'Flat number is required' });
    }

    // Check if the flat exists
    const checkResult = await pool.query('SELECT * FROM flats WHERE flat_id = $1', [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Flat not found' });
    }

    const currentFlat = checkResult.rows[0];

    // Check if flat number already exists in this plot (excluding current flat)
    const duplicateResult = await pool.query(
      `SELECT flat_id FROM flats 
       WHERE plot_id = $1 AND flat_no = $2 AND flat_id != $3`,
      [currentFlat.plot_id, flat_no, id]
    );

    if (duplicateResult.rows.length > 0) {
      return res.status(400).json({ message: 'Flat number already exists in this plot' });
    }

    // Update flat
    const result = await pool.query(
      `UPDATE flats SET flat_no = $1, eb_card = $2
       WHERE flat_id = $3 RETURNING *`,
      [flat_no, eb_card || null, id]
    );

    res.json({
      message: 'Flat updated successfully',
      flat: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating flat:', err);
    res.status(500).json({ message: 'Failed to update flat' });
  }
});

// Delete flat
router.delete('/flats/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Check if flat exists
    const checkResult = await pool.query('SELECT * FROM flats WHERE flat_id = $1', [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Flat not found' });
    }

    // Check if flat has any residents
    const residentsResult = await pool.query('SELECT resident_id FROM residents WHERE flat_id = $1', [id]);

    if (residentsResult.rows.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete flat. There are residents associated with this flat.'
      });
    }

    // Delete flat
    const deleteResult = await pool.query('DELETE FROM flats WHERE flat_id = $1 RETURNING *', [id]);

    res.json({
      message: 'Flat deleted successfully',
      flat: deleteResult.rows[0]
    });
  } catch (err) {
    console.error('Error deleting flat:', err);
    res.status(500).json({ message: 'Failed to delete flat' });
  }
});

// ========== RESIDENTS CRUD (UPDATED WITH LOGIN MANAGEMENT) ==========

// Get all residents for an org with login status
router.get('/residents/:org_id', async (req, res) => {
  const { org_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
        r.*, 
        p.plot_no, 
        f.flat_no,
        ul.user_name,
        ul.user_type,
        CASE WHEN ul.user_id IS NOT NULL THEN true ELSE false END as has_login
       FROM residents r
       LEFT JOIN plots p ON r.plot_id = p.plot_id
       LEFT JOIN flats f ON r.flat_id = f.flat_id
       LEFT JOIN users_login ul ON r.resident_id = ul.resident_id
       WHERE p.org_id = $1
       ORDER BY r.name`,
      [org_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch residents error:', err);
    res.status(500).json({ message: 'Failed to fetch residents' });
  }
});

// Add resident with optional login creation
router.post('/residents', async (req, res) => {
  const {
    plot_id, flat_id, name, contact_number, email, id_proof,
    create_login, user_name, password, user_type
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert resident
    const residentResult = await client.query(
      `INSERT INTO residents (plot_id, flat_id, name, contact_number, email, id_proof)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [plot_id, flat_id || null, name, contact_number, email, id_proof]
    );

    const resident = residentResult.rows[0];

    // Create login if requested
    if (create_login && user_name && password) {
      // Check if username already exists
      const userCheck = await client.query(
        'SELECT user_id FROM users_login WHERE user_name = $1',
        [user_name]
      );

      if (userCheck.rows.length > 0) {
        throw new Error('Username already exists');
      }

      // Get org_id from plot
      const plotResult = await client.query(
        'SELECT org_id FROM plots WHERE plot_id = $1',
        [plot_id]
      );

      const org_id = plotResult.rows[0].org_id;

      await client.query(
        `INSERT INTO users_login (user_name, password, org_id, plot_id, resident_id, user_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user_name, password, org_id, plot_id, resident.resident_id, user_type || 'owner']
      );
    }

    await client.query('COMMIT');
    res.status(201).json(resident);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Add resident error:', err);
    res.status(500).json({ message: err.message || 'Failed to add resident' });
  } finally {
    client.release();
  }
});

// Update resident with optional login creation
router.put('/residents/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name, contact_number, email, id_proof,
    create_login, user_name, password, user_type
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update resident basic info
    const residentResult = await client.query(
      `UPDATE residents
       SET name = $1, contact_number = $2, email = $3, id_proof = $4
       WHERE resident_id = $5 RETURNING *`,
      [name, contact_number, email, id_proof, id]
    );

    const resident = residentResult.rows[0];

    // Create login if requested and doesn't exist
    if (create_login && user_name && password) {
      // Check if resident already has login
      const existingLogin = await client.query(
        'SELECT user_id FROM users_login WHERE resident_id = $1',
        [id]
      );

      if (existingLogin.rows.length === 0) {
        // Check if username is available
        const userCheck = await client.query(
          'SELECT user_id FROM users_login WHERE user_name = $1',
          [user_name]
        );

        if (userCheck.rows.length > 0) {
          throw new Error('Username already exists');
        }

        // Get org_id from resident's plot
        const plotResult = await client.query(
          'SELECT org_id FROM plots WHERE plot_id = $1',
          [resident.plot_id]
        );

        const org_id = plotResult.rows[0].org_id;

        await client.query(
          `INSERT INTO users_login (user_name, password, org_id, plot_id, resident_id, user_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [user_name, password, org_id, resident.plot_id, id, user_type || 'owner']
        );
      }
    }

    await client.query('COMMIT');
    res.json(resident);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update resident error:', err);
    res.status(500).json({ message: err.message || 'Failed to update resident' });
  } finally {
    client.release();
  }
});

// Reset resident password
router.put('/residents/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users_login 
       SET password = $1, last_login = NULL
       WHERE resident_id = $2 RETURNING user_name`,
      [password, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No login account found for this resident' });
    }

    res.json({
      success: true,
      message: 'Password updated successfully',
      user_name: result.rows[0].user_name
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// Delete resident (and associated login)
router.delete('/residents/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete associated login first
    await client.query('DELETE FROM users_login WHERE resident_id = $1', [id]);

    // Delete resident
    await client.query('DELETE FROM residents WHERE resident_id = $1', [id]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete resident error:', err);
    res.status(500).json({ message: 'Failed to delete resident' });
  } finally {
    client.release();
  }
});

// ========== PAYMENTS CRUD ==========

// Get all payments by org
router.get('/payments/:org_id', async (req, res) => {
  const { org_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT pay.*, r.name as resident_name, p.plot_no, f.flat_no
      FROM payments pay
      LEFT JOIN residents r ON pay.resident_id = r.resident_id
      LEFT JOIN plots p ON pay.plot_id = p.plot_id
      LEFT JOIN flats f ON r.flat_id = f.flat_id
      WHERE p.org_id = $1
      ORDER BY pay.payment_date DESC
    `, [org_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ message: 'Failed to fetch payments' });
  }
});

// Add a payment
router.post('/payments', async (req, res) => {
  const {
    plot_id, resident_id, amount, payment_type, payment_date,
    due_date, status, payment_method, transaction_id, notes
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO payments (
        plot_id, resident_id, amount, payment_type,
        payment_date, due_date, status, payment_method,
        transaction_id, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [plot_id, resident_id, amount, payment_type, payment_date, due_date, status, payment_method, transaction_id, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding payment:', err);
    res.status(500).json({ message: 'Failed to add payment' });
  }
});

// Delete payment
router.delete('/payments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM payments WHERE payment_id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting payment:', err);
    res.status(500).json({ message: 'Failed to delete payment' });
  }
});

// ========== REPORTS ==========

router.get('/reports/payment-summary/:org_id', async (req, res) => {
  const { org_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT status, COUNT(*) AS count, SUM(amount) AS total
      FROM payments pay
      JOIN plots p ON pay.plot_id = p.plot_id
      WHERE p.org_id = $1
      GROUP BY status
    `, [org_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching payment summary:', err);
    res.status(500).json({ message: 'Failed to fetch summary' });
  }
});

router.get('/reports/resident-count/:org_id', async (req, res) => {
  const { org_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT s.street_name, COUNT(r.resident_id) AS resident_count
      FROM residents r
      JOIN plots p ON r.plot_id = p.plot_id
      JOIN streets s ON p.street_id = s.street_id
      WHERE p.org_id = $1
      GROUP BY s.street_name
    `, [org_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching resident count:', err);
    res.status(500).json({ message: 'Failed to fetch resident count' });
  }
});

router.get('/reports/overdue-payments/:org_id', async (req, res) => {
  const { org_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT pay.*, r.name AS resident_name, p.plot_no, f.flat_no
      FROM payments pay
      JOIN residents r ON pay.resident_id = r.resident_id
      JOIN plots p ON pay.plot_id = p.plot_id
      LEFT JOIN flats f ON r.flat_id = f.flat_id
      WHERE p.org_id = $1 AND pay.status = 'overdue'
      ORDER BY pay.due_date ASC
    `, [org_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching overdue payments:', err);
    res.status(500).json({ message: 'Failed to fetch overdue payments' });
  }
});

// ========== SEND NOTIFICATIONS (FIXED) ==========
router.post('/notifications', async (req, res) => {
  const { sender_id, recipient_type, recipient_id, title, message, priority } = req.body;

  try {
    let finalRecipientId = recipient_id;

    // Fix recipient_id logic based on recipient_type
    if (recipient_type === 'all') {
      // For "all" notifications, use org_id as recipient_id
      // Get org_id from sender (assuming sender is admin)
      const senderResult = await pool.query(
        'SELECT org_id FROM users_login WHERE user_id = $1',
        [sender_id]
      );
      finalRecipientId = senderResult.rows[0]?.org_id || 1; // Default to org_id = 1
    }

    const result = await pool.query(
      `INSERT INTO notifications (
        sender_id, recipient_type, recipient_id,
        title, message, priority
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [sender_id, recipient_type, finalRecipientId, title, message, priority || 'normal']
    );

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      notification: result.rows[0]
    });
  } catch (err) {
    console.error('Error sending notification:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: err.message
    });
  }
});

// ========== MAINTENANCE REQUESTS ==========

// Raise new maintenance request
router.post('/maintenance', async (req, res) => {
  const { plot_id, resident_id, title, description, category, priority } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO maintenance_requests 
        (plot_id, resident_id, title, description, category, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending', NOW())
       RETURNING *`,
      [plot_id, resident_id, title, description, category, priority]
    );
    res.status(201).json({ success: true, request: result.rows[0] });
  } catch (err) {
    console.error("Error submitting maintenance request:", err);
    res.status(500).json({ success: false, message: "Failed to submit request" });
  }
});

// ========== ADDITIONAL ROUTES ==========

// Get all plots (without org_id filter) - for FlatsManagement
router.get('/plots', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, s.street_name 
       FROM plots p
       LEFT JOIN streets s ON p.street_id = s.street_id
       ORDER BY s.street_name, p.plot_no`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching plots:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch plots' });
  }
});

// Get all streets (without org_id filter) - for FlatsManagement  
router.get('/streets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM streets ORDER BY street_name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching streets:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch streets' });
  }
});

// Get flats by plot ID
router.get('/flats/plot/:plotId', async (req, res) => {
  const { plotId } = req.params;
  try {
    const result = await pool.query(
      `SELECT f.*, p.plot_no, p.plot_type 
       FROM flats f
       JOIN plots p ON f.plot_id = p.plot_id
       WHERE f.plot_id = $1
       ORDER BY f.flat_no`,
      [plotId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching flats:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch flats' });
  }
});

// Bulk add flats
router.post('/flats/bulk', async (req, res) => {
  const { flats } = req.body;

  if (!flats || !Array.isArray(flats) || flats.length === 0) {
    return res.status(400).json({ message: 'Flats array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const successfulFlats = [];
    const failedFlats = [];

    // Process each flat
    for (const flat of flats) {
      try {
        if (!flat.plot_id || !flat.flat_no) {
          failedFlats.push({
            flat_no: flat.flat_no || 'Unknown',
            reason: 'Plot ID and flat number are required'
          });
          continue;
        }

        // Check if flat already exists
        const checkResult = await client.query(
          'SELECT flat_id FROM flats WHERE plot_id = $1 AND flat_no = $2',
          [flat.plot_id, flat.flat_no]
        );

        if (checkResult.rows.length > 0) {
          failedFlats.push({
            flat_no: flat.flat_no,
            reason: 'Flat number already exists'
          });
          continue;
        }

        // Insert flat
        const insertResult = await client.query(
          `INSERT INTO flats (plot_id, flat_no, eb_card) 
           VALUES ($1, $2, $3) 
           RETURNING *`,
          [flat.plot_id, flat.flat_no, flat.eb_card || null]
        );

        successfulFlats.push(insertResult.rows[0]);
      } catch (flatError) {
        console.error(`Error adding flat ${flat.flat_no}:`, flatError);
        failedFlats.push({
          flat_no: flat.flat_no || 'Unknown',
          reason: 'Database error'
        });
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `${successfulFlats.length} flats added successfully`,
      successful: successfulFlats,
      failed: failedFlats,
      totalRequested: flats.length,
      totalAdded: successfulFlats.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error bulk adding flats:', error);
    res.status(500).json({ message: 'Failed to add flats' });
  } finally {
    client.release();
  }
});

// Get flat details with residents
router.get('/flats/:flatId/details', async (req, res) => {
  const { flatId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        f.*,
        p.plot_no,
        p.plot_type,
        s.street_name,
        r.resident_id,
        r.name as resident_name,
        r.contact_number,
        r.email
      FROM flats f
      JOIN plots p ON f.plot_id = p.plot_id
      JOIN streets s ON p.street_id = s.street_id
      LEFT JOIN residents r ON f.flat_id = r.flat_id
      WHERE f.flat_id = $1`,
      [flatId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Flat not found' });
    }

    // Group residents for this flat
    const flatData = {
      flat_id: result.rows[0].flat_id,
      flat_no: result.rows[0].flat_no,
      eb_card: result.rows[0].eb_card,
      plot_id: result.rows[0].plot_id,
      plot_no: result.rows[0].plot_no,
      plot_type: result.rows[0].plot_type,
      street_name: result.rows[0].street_name,
      residents: result.rows
        .filter(row => row.resident_id)
        .map(row => ({
          resident_id: row.resident_id,
          name: row.resident_name,
          contact_number: row.contact_number,
          email: row.email
        }))
    };

    res.json(flatData);
  } catch (err) {
    console.error('Error fetching flat details:', err);
    res.status(500).json({ message: 'Failed to fetch flat details' });
  }
});

// Get flats summary for dashboard
router.get('/flats/summary', async (req, res) => {
  try {
    const summaryQuery = `
      SELECT 
        COUNT(f.flat_id) as total_flats,
        COUNT(r.resident_id) as occupied_flats,
        COUNT(f.flat_id) - COUNT(r.resident_id) as vacant_flats,
        COUNT(DISTINCT f.plot_id) as plots_with_flats
      FROM flats f
      LEFT JOIN residents r ON f.flat_id = r.flat_id
    `;

    const plotTypeQuery = `
      SELECT 
        p.plot_type,
        COUNT(f.flat_id) as flat_count
      FROM plots p
      LEFT JOIN flats f ON p.plot_id = f.plot_id
      WHERE f.flat_id IS NOT NULL
      GROUP BY p.plot_type
    `;

    const [summaryResult, plotTypeResult] = await Promise.all([
      pool.query(summaryQuery),
      pool.query(plotTypeQuery)
    ]);

    res.json({
      summary: summaryResult.rows[0],
      byPlotType: plotTypeResult.rows
    });
  } catch (err) {
    console.error('Error fetching flats summary:', err);
    res.status(500).json({ message: 'Failed to fetch flats summary' });
  }
});

// ========== MAINTENANCE REQUESTS MANAGEMENT ROUTES ==========

// Get all maintenance requests with resident and plot details
router.get('/maintenance-requests', async (req, res) => {
  try {
    const query = `
            SELECT 
                mr.*,
                r.name as resident_name,
                r.contact_number,
                r.email,
                p.plot_no,
                f.flat_no,
                s.street_name
            FROM maintenance_requests mr
            JOIN residents r ON mr.resident_id = r.resident_id
            JOIN plots p ON mr.plot_id = p.plot_id
            LEFT JOIN flats f ON r.flat_id = f.flat_id
            LEFT JOIN streets s ON p.street_id = s.street_id
            ORDER BY 
                CASE mr.priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'normal' THEN 3 
                    WHEN 'low' THEN 4 
                END,
                mr.created_at DESC
        `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance requests:', error);
    res.status(500).json({ message: 'Failed to fetch maintenance requests' });
  }
});

// Get recent maintenance requests (for notifications dropdown)
router.get('/maintenance-requests/recent', async (req, res) => {
  try {
    const query = `
            SELECT 
                mr.*,
                r.name as resident_name,
                p.plot_no,
                f.flat_no
            FROM maintenance_requests mr
            JOIN residents r ON mr.resident_id = r.resident_id
            JOIN plots p ON mr.plot_id = p.plot_id
            LEFT JOIN flats f ON r.flat_id = f.flat_id
            WHERE mr.status IN ('open', 'in_progress')
            ORDER BY mr.created_at DESC
            LIMIT 10
        `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent maintenance requests:', error);
    res.status(500).json({ message: 'Failed to fetch recent maintenance requests' });
  }
});

// Get maintenance requests counts/summary
router.get('/maintenance-requests/summary', async (req, res) => {
  try {
    const query = `
            SELECT 
                COUNT(*) as total_requests,
                COUNT(CASE WHEN status = 'open' THEN 1 END) as open_requests,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_requests,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_requests,
                COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_requests,
                COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_requests,
                COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_requests,
                COUNT(CASE WHEN status IN ('open', 'in_progress') THEN 1 END) as pending_requests
            FROM maintenance_requests
        `;

    const result = await pool.query(query);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching maintenance requests summary:', error);
    res.status(500).json({ message: 'Failed to fetch maintenance requests summary' });
  }
});

// Update maintenance request status
router.put('/maintenance-requests/:id', async (req, res) => {
  const { id } = req.params;
  const { status, assigned_to, notes } = req.body;

  try {
    // Validate status
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Check if request exists
    const checkResult = await pool.query(
      'SELECT * FROM maintenance_requests WHERE request_id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance request not found' });
    }

    let updateQuery = 'UPDATE maintenance_requests SET updated_at = CURRENT_TIMESTAMP';
    const queryParams = [];
    let paramCount = 1;

    if (status) {
      updateQuery += `, status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;

      // If marking as resolved, set resolved_at timestamp
      if (status === 'resolved') {
        updateQuery += `, resolved_at = CURRENT_TIMESTAMP`;
      }
    }

    if (assigned_to !== undefined) {
      updateQuery += `, assigned_to = $${paramCount}`;
      queryParams.push(assigned_to || null);
      paramCount++;
    }

    updateQuery += ` WHERE request_id = $${paramCount} RETURNING *`;
    queryParams.push(id);

    const result = await pool.query(updateQuery, queryParams);

    res.json({
      message: 'Maintenance request updated successfully',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating maintenance request:', error);
    res.status(500).json({ message: 'Failed to update maintenance request' });
  }
});

// Get maintenance request details by ID
router.get('/maintenance-requests/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
            SELECT 
                mr.*,
                r.name as resident_name,
                r.contact_number,
                r.email,
                p.plot_no,
                f.flat_no,
                s.street_name
            FROM maintenance_requests mr
            JOIN residents r ON mr.resident_id = r.resident_id
            JOIN plots p ON mr.plot_id = p.plot_id
            LEFT JOIN flats f ON r.flat_id = f.flat_id
            LEFT JOIN streets s ON p.street_id = s.street_id
            WHERE mr.request_id = $1
        `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance request not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching maintenance request details:', error);
    res.status(500).json({ message: 'Failed to fetch maintenance request details' });
  }
});

// Delete maintenance request (admin only)
router.delete('/maintenance-requests/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Check if request exists
    const checkResult = await pool.query(
      'SELECT * FROM maintenance_requests WHERE request_id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance request not found' });
    }

    // Delete the request
    const deleteResult = await pool.query(
      'DELETE FROM maintenance_requests WHERE request_id = $1 RETURNING *',
      [id]
    );

    res.json({
      message: 'Maintenance request deleted successfully',
      request: deleteResult.rows[0]
    });
  } catch (error) {
    console.error('Error deleting maintenance request:', error);
    res.status(500).json({ message: 'Failed to delete maintenance request' });
  }
});

// Get maintenance requests by plot
router.get('/maintenance-requests/plot/:plotId', async (req, res) => {
  const { plotId } = req.params;

  try {
    const query = `
            SELECT 
                mr.*,
                r.name as resident_name,
                r.contact_number,
                f.flat_no
            FROM maintenance_requests mr
            JOIN residents r ON mr.resident_id = r.resident_id
            LEFT JOIN flats f ON r.flat_id = f.flat_id
            WHERE mr.plot_id = $1
            ORDER BY mr.created_at DESC
        `;

    const result = await pool.query(query, [plotId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance requests for plot:', error);
    res.status(500).json({ message: 'Failed to fetch maintenance requests for plot' });
  }
});

// Get maintenance requests by resident
router.get('/maintenance-requests/resident/:residentId', async (req, res) => {
  const { residentId } = req.params;

  try {
    const query = `
            SELECT 
                mr.*,
                p.plot_no,
                f.flat_no,
                s.street_name
            FROM maintenance_requests mr
            JOIN plots p ON mr.plot_id = p.plot_id
            LEFT JOIN flats f ON mr.plot_id = f.plot_id AND EXISTS(
                SELECT 1 FROM residents r WHERE r.resident_id = mr.resident_id AND r.flat_id = f.flat_id
            )
            LEFT JOIN streets s ON p.street_id = s.street_id
            WHERE mr.resident_id = $1
            ORDER BY mr.created_at DESC
        `;

    const result = await pool.query(query, [residentId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance requests for resident:', error);
    res.status(500).json({ message: 'Failed to fetch maintenance requests for resident' });
  }
});

// Assign maintenance request to someone
router.put('/maintenance-requests/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { assigned_to } = req.body;

  try {
    if (!assigned_to) {
      return res.status(400).json({ message: 'assigned_to is required' });
    }

    const result = await pool.query(
      `UPDATE maintenance_requests 
             SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP, status = 'in_progress'
             WHERE request_id = $2 
             RETURNING *`,
      [assigned_to, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance request not found' });
    }

    res.json({
      message: 'Maintenance request assigned successfully',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Error assigning maintenance request:', error);
    res.status(500).json({ message: 'Failed to assign maintenance request' });
  }
});

// Mark maintenance request as resolved
router.put('/maintenance-requests/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { resolution_notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE maintenance_requests 
             SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE request_id = $1 
             RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance request not found' });
    }

    res.json({
      message: 'Maintenance request marked as resolved',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Error resolving maintenance request:', error);
    res.status(500).json({ message: 'Failed to resolve maintenance request' });
  }
});

module.exports = router;