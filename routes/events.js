const express = require('express');
const router = express.Router();
const db = require('../db/index');

// Add a new planner event for a user
router.post('/', async (req, res) => {
  console.log(req.body);
    const { userId, title, eventDate, startTime, endTime, category } = req.body;
  
    if (!userId || !title || !eventDate || !startTime || !endTime || !category) {
      return res.status(400).json({ error: "Missing required fields." });
    }
  
    const query = `
      INSERT INTO plannerEvent (userId, eventTitle, eventDate, startTime, endTime, eventType)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
  
    try {
      const [result] = await db.query(query, [userId, title, eventDate, startTime, endTime, category]);

      const insertedEventId = result.insertId;

      const [rows] = await db.query(
        `SELECT * FROM plannerEvent WHERE eventId = ?`,
        [insertedEventId]
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      console.error("Error adding event:", error);
      res.status(500).json({ error: "Database error while adding event." });
    }
  });

// Get all planner events for a user
router.get('/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
      const [events] = await db.execute(
        'SELECT * FROM plannerEvent WHERE userId = ? ORDER BY eventDate ASC',
        [userId]
      );
      res.json(events);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch planner events' });
    }
});

// Update an existing planner event
router.put('/:eventId', async (req, res) => {
  const eventId = req.params.eventId;
  const { title, eventDate, startTime, endTime, category } = req.body;
  
  if (!title && !eventDate && !startTime && !endTime && !category) {
    return res.status(400).json({ error: "No fields provided for update." });
  }
  
  try {
    // First check if the event exists
    const [existingEvent] = await db.query(
      'SELECT * FROM plannerEvent WHERE eventId = ?',
      [eventId]
    );
    
    if (existingEvent.length === 0) {
      return res.status(404).json({ error: "Event not found." });
    }
    
    // Build the update query dynamically based on provided fields
    let updateFields = [];
    let queryParams = [];
    
    if (title) {
      updateFields.push('eventTitle = ?');
      queryParams.push(title);
    }
    
    if (eventDate) {
      updateFields.push('eventDate = ?');
      queryParams.push(eventDate);
    }
    
    if (startTime) {
      updateFields.push('startTime = ?');
      queryParams.push(startTime);
    }
    
    if (endTime) {
      updateFields.push('endTime = ?');
      queryParams.push(endTime);
    }
    
    if (category) {
      updateFields.push('eventType = ?');
      queryParams.push(category);
    }
    
    // Add eventId to params array for WHERE clause
    queryParams.push(eventId);
    
    const updateQuery = `
      UPDATE plannerEvent
      SET ${updateFields.join(', ')}
      WHERE eventId = ?
    `;
    
    await db.query(updateQuery, queryParams);
    
    // Fetch the updated event
    const [updatedEvent] = await db.query(
      'SELECT * FROM plannerEvent WHERE eventId = ?',
      [eventId]
    );
    
    res.json(updatedEvent[0]);
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ error: "Database error while updating event." });
  }
});

// Delete a planner event
router.delete('/:eventId', async (req, res) => {
  const eventId = req.params.eventId;
  
  try {
    // First check if the event exists
    const [existingEvent] = await db.query(
      'SELECT * FROM plannerEvent WHERE eventId = ?',
      [eventId]
    );
    
    if (existingEvent.length === 0) {
      return res.status(404).json({ error: "Event not found." });
    }
    
    // Delete the event
    await db.query(
      'DELETE FROM plannerEvent WHERE eventId = ?',
      [eventId]
    );
    
    res.json({ message: "Event successfully deleted", deletedEventId: eventId });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ error: "Database error while deleting event." });
  }
});

module.exports = router;