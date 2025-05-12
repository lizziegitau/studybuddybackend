const express = require('express');
const router = express.Router();
const db = require('../db/index');

// Add or update a daily study goal for a user
router.post('/', async (req, res) => {
  console.log(req.body);
  const { userId, dailyGoalMinutes } = req.body;

  if (!userId || !dailyGoalMinutes) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const checkQuery = 'SELECT * FROM studyGoal WHERE userId = ?';
  const insertQuery = 'INSERT INTO studyGoal (userId, dailyGoalMinutes) VALUES (?, ?)';
  const updateQuery = 'UPDATE studyGoal SET dailyGoalMinutes = ? WHERE userId = ?';

  try {
    const [existing] = await db.query(checkQuery, [userId]);

    if (existing.length > 0) {
      // If record exists, update it
      await db.query(updateQuery, [dailyGoalMinutes, userId]);
    } else {
      // If no record exists, insert a new one
      await db.query(insertQuery, [userId, dailyGoalMinutes]);
    }

    // Fetch the updated record to return
    const [updated] = await db.query(checkQuery, [userId]);
    res.status(200).json(updated[0]);
  } catch (error) {
    console.error('Error saving study goal:', error);
    res.status(500).json({ error: 'Database error while saving study goal.' });
  }
});

// Get a user's daily study goal
router.get('/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const [rows] = await db.query(
      'SELECT * FROM studyGoal WHERE userId = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(200).json({ dailyGoalMinutes: 30 });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching study goal:', error);
    res.status(500).json({ error: 'Failed to fetch study goal.' });
  }
});

module.exports = router;