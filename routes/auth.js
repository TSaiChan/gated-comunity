const express = require('express');
const router = express.Router();
const pool = require('../db'); // your PostgreSQL pool connection

// Register route
router.post('/register', async (req, res) => {
  console.log('Register request body:', req.body);

  const { user_type, user_name, password, org_id, plot_id } = req.body;

  try {
    // Check if username already exists
    const userCheck = await pool.query(
      'SELECT * FROM users_login WHERE user_name = $1',
      [user_name]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    // For non-admin users, try to find the resident_id
    let resident_id = null;
    if (user_type !== 'admin' && plot_id) {
      const residentResult = await pool.query(
        'SELECT resident_id FROM residents WHERE plot_id = $1 LIMIT 1',
        [plot_id]
      );

      if (residentResult.rows.length > 0) {
        resident_id = residentResult.rows[0].resident_id;
      }
    }

    // Insert new user (without password hashing)
    const newUser = await pool.query(
      `INSERT INTO users_login (user_type, user_name, password, org_id, plot_id, resident_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_type, user_name, password, org_id, plot_id, resident_id]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: newUser.rows[0]
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { user_name, password } = req.body;
  console.log("Login attempt with username:", user_name);

  try {
    const result = await pool.query(
      'SELECT * FROM users_login WHERE user_name = $1',
      [user_name]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    // Direct password comparison (no hashing)
    if (password !== user.password) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    let displayName = user.user_name;
    let welcomeMessage = '';

    // 🔧 FIX: Ensure resident_id is populated for non-admin users
    if (user.user_type !== 'admin' && !user.resident_id && user.plot_id) {
      console.log("🔄 Attempting to link user to resident record...");

      try {
        // Try to find resident by plot_id
        const residentResult = await pool.query(
          'SELECT resident_id, name FROM residents WHERE plot_id = $1 LIMIT 1',
          [user.plot_id]
        );

        if (residentResult.rows.length > 0) {
          const resident = residentResult.rows[0];
          user.resident_id = resident.resident_id;

          // Update the users_login table with the resident_id
          await pool.query(
            'UPDATE users_login SET resident_id = $1 WHERE user_id = $2',
            [user.resident_id, user.user_id]
          );

          console.log(`✅ Linked user ${user.user_name} to resident ${resident.name} (ID: ${resident.resident_id})`);
        } else {
          console.log(`⚠️ No resident found for plot_id: ${user.plot_id}`);
        }
      } catch (linkErr) {
        console.error('Error linking user to resident:', linkErr);
        // Continue with login even if linking fails
      }
    }

    // If user is admin, show admin welcome
    if (user.user_type === 'admin') {
      welcomeMessage = 'Welcome Admin';
      displayName = 'Admin';
    } else {
      // For regular users, fetch their actual name from residents table
      try {
        let residentResult;

        // Try to find resident by resident_id first (if available)
        if (user.resident_id) {
          residentResult = await pool.query(
            'SELECT name FROM residents WHERE resident_id = $1',
            [user.resident_id]
          );
        }

        // If not found by resident_id, try by plot_id
        if (!residentResult || residentResult.rows.length === 0) {
          residentResult = await pool.query(
            'SELECT name FROM residents WHERE plot_id = $1 LIMIT 1',
            [user.plot_id]
          );
        }

        if (residentResult && residentResult.rows.length > 0) {
          displayName = residentResult.rows[0].name;
          welcomeMessage = `Welcome ${displayName}`;
        } else {
          welcomeMessage = `Welcome ${user.user_name}`;
        }
      } catch (err) {
        console.log('Could not fetch resident name:', err.message);
        welcomeMessage = `Welcome ${user.user_name}`;
      }
    }

    // Send success response with user details
    res.status(200).json({
      success: true,
      message: 'Login successful',
      welcomeMessage: welcomeMessage,
      user: {
        user_id: user.user_id,
        user_name: user.user_name,
        user_type: user.user_type,
        org_id: user.org_id,
        plot_id: user.plot_id,
        resident_id: user.resident_id || null,
        display_name: displayName
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Get user profile (for users to view their own profile)
router.get('/profile/:user_id', async (req, res) => {
  const { user_id } = req.params;

  try {
    const userResult = await pool.query(
      'SELECT user_id, user_name, user_type, org_id, plot_id, resident_id FROM users_login WHERE user_id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = userResult.rows[0];
    let profile = { ...user };

    // If user has resident_id, fetch resident details
    if (user.resident_id) {
      const residentResult = await pool.query(
        `SELECT r.*, p.plot_no, f.flat_no 
         FROM residents r
         LEFT JOIN plots p ON r.plot_id = p.plot_id
         LEFT JOIN flats f ON r.flat_id = f.flat_id
         WHERE r.resident_id = $1`,
        [user.resident_id]
      );

      if (residentResult.rows.length > 0) {
        profile.resident_details = residentResult.rows[0];
      }
    }

    res.json({ success: true, profile });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// Update user password (for users to change their own password)
router.put('/change-password', async (req, res) => {
  const { user_id, current_password, new_password } = req.body;

  try {
    // Verify current password
    const userResult = await pool.query(
      'SELECT password FROM users_login WHERE user_id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check current password
    if (current_password !== user.password) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    // Update password
    await pool.query(
      'UPDATE users_login SET password = $1 WHERE user_id = $2',
      [new_password, user_id]
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

// Forgot password - check if user exists (you might want to implement email verification)
router.post('/forgot-password', async (req, res) => {
  const { user_name, email } = req.body;

  try {
    // Check if user exists and get their resident info
    const userResult = await pool.query(
      `SELECT ul.user_id, ul.user_name, r.email 
       FROM users_login ul
       LEFT JOIN residents r ON ul.resident_id = r.resident_id
       WHERE ul.user_name = $1`,
      [user_name]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check if provided email matches
    if (user.email && user.email.toLowerCase() === email.toLowerCase()) {
      // In a real application, you would send an email with reset link
      // For now, just return success
      res.json({
        success: true,
        message: 'Password reset instructions sent to your email',
        user_id: user.user_id // You might not want to expose this in production
      });
    } else {
      res.status(400).json({ success: false, message: 'Email does not match our records' });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
});

// Reset password (simplified version - in production you'd use tokens)
router.post('/reset-password', async (req, res) => {
  const { user_id, new_password } = req.body;

  try {
    await pool.query(
      'UPDATE users_login SET password = $1 WHERE user_id = $2',
      [new_password, user_id]
    );

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

// Check if username is available (for registration form)
router.get('/check-username/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const result = await pool.query(
      'SELECT user_id FROM users_login WHERE user_name = $1',
      [username]
    );

    res.json({
      available: result.rows.length === 0,
      message: result.rows.length === 0 ? 'Username available' : 'Username already taken'
    });
  } catch (error) {
    console.error('Username check error:', error);
    res.status(500).json({ success: false, message: 'Failed to check username' });
  }
});

// Logout (if you want to track logout - optional)
router.post('/logout', async (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // In a session-based system, you'd destroy the session here
  // For now, just return success
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get all users for a specific organization (for admin use)
router.get('/org-users/:org_id', async (req, res) => {
  const { org_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT ul.user_id, ul.user_name, ul.user_type, ul.created_at,
              r.name as resident_name, r.contact_number, r.email,
              p.plot_no, f.flat_no
       FROM users_login ul
       LEFT JOIN residents r ON ul.resident_id = r.resident_id
       LEFT JOIN plots p ON ul.plot_id = p.plot_id
       LEFT JOIN flats f ON r.flat_id = f.flat_id
       WHERE ul.org_id = $1 AND ul.user_type != 'admin'
       ORDER BY r.name ASC NULLS LAST`,
      [org_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching org users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// 🔧 UTILITY: Manually link users to residents (for admin use)
router.post('/link-user-resident', async (req, res) => {
  const { user_id, resident_id } = req.body;

  try {
    const result = await pool.query(
      'UPDATE users_login SET resident_id = $1 WHERE user_id = $2 RETURNING *',
      [resident_id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User successfully linked to resident',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Link user-resident error:', error);
    res.status(500).json({ success: false, message: 'Failed to link user to resident' });
  }
});

// 🔧 UTILITY: Fix all unlinked users (for admin use)
router.post('/fix-user-resident-links/:org_id', async (req, res) => {
  const { org_id } = req.params;

  try {
    // Find all users without resident_id but with plot_id
    const unlinkedUsers = await pool.query(
      `SELECT ul.user_id, ul.user_name, ul.plot_id 
       FROM users_login ul
       WHERE ul.org_id = $1 AND ul.resident_id IS NULL AND ul.plot_id IS NOT NULL AND ul.user_type != 'admin'`,
      [org_id]
    );

    let fixedCount = 0;
    const results = [];

    for (const user of unlinkedUsers.rows) {
      try {
        // Find resident for this plot
        const residentResult = await pool.query(
          'SELECT resident_id, name FROM residents WHERE plot_id = $1 LIMIT 1',
          [user.plot_id]
        );

        if (residentResult.rows.length > 0) {
          const resident = residentResult.rows[0];

          // Update user with resident_id
          await pool.query(
            'UPDATE users_login SET resident_id = $1 WHERE user_id = $2',
            [resident.resident_id, user.user_id]
          );

          fixedCount++;
          results.push({
            user_name: user.user_name,
            plot_id: user.plot_id,
            linked_to: resident.name,
            resident_id: resident.resident_id
          });
        }
      } catch (err) {
        console.error(`Error fixing link for user ${user.user_name}:`, err);
      }
    }

    res.json({
      success: true,
      message: `Fixed ${fixedCount} user-resident links`,
      fixed_users: results,
      total_checked: unlinkedUsers.rows.length
    });
  } catch (error) {
    console.error('Fix user-resident links error:', error);
    res.status(500).json({ success: false, message: 'Failed to fix user-resident links' });
  }
});

module.exports = router;