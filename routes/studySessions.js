const express = require('express');
const router = express.Router();
const db = require('../db/index');

//Add a new study session for a user
router.post('/', async (req, res) => {  
  const { userId, sessionDate, sessionDuration, sessionTaskIds } = req.body;
  
  if (!userId || !sessionDate || !sessionDuration || !sessionTaskIds) {
      return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const query = 'INSERT INTO studysession (userId, sessionDate, sessionDuration, sessionTaskIds) VALUES (?, ?, ?, ?)';

  try {
      const [result] = await db.query(query, [userId, sessionDate, sessionDuration, JSON.stringify(sessionTaskIds)]);

      res.status(201).json({
        message: "Study session created successfully",
        sessionId: result.insertId,
        userId,
        sessionDate,
        sessionDuration,
        sessionTaskIds
      });

    } catch (error) {
      console.error("Error creating study session:", error);
      res.status(500).json({ error: "Database error while creating." });
    }
  
});

// Get all study sessions for a user
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await db.execute(
      `SELECT * FROM studysession WHERE userId = ? ORDER BY sessionDate DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching sessions:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get tasks for a specific study session
router.get('/:sessionId/tasks', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    // First get the session to extract the taskIds
    const [sessions] = await db.query(
      `SELECT sessionTaskIds FROM studysession WHERE sessionId = ?`,
      [sessionId]
    );
    
    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    let taskIds;
    try {
      // Try to parse the JSON string into an array
      taskIds = Array.isArray(sessions[0].sessionTaskIds) 
        ? sessions[0].sessionTaskIds 
        : JSON.parse(sessions[0].sessionTaskIds);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      
      // If it's a string with comma-separated values, try splitting it
      if (typeof sessions[0].sessionTaskIds === 'string') {
        taskIds = sessions[0].sessionTaskIds.split(',').map(id => id.trim());
      } else {
        // If all else fails, return an error
        return res.status(500).json({ error: 'Invalid task ID format in database' });
      }
    }
    
    if (!taskIds || taskIds.length === 0) {
      return res.json([]);
    }
    
    // Now fetch tasks with those IDs
    const placeholders = taskIds.map(() => '?').join(',');
    const [tasks] = await db.query(
      `SELECT * FROM task WHERE taskId IN (${placeholders})`,
      taskIds
    );
    
    res.json(tasks);
  } catch (err) {
    console.error("Error fetching session tasks:", err);
    res.status(500).json({ error: 'Failed to fetch tasks for this session' });
  }
});

// Mark a task for a specific study session as done
router.patch('/:sessionId/task/:taskId/complete', async (req, res) => {
  const { taskId } = req.params;

  try {
    const [result] = await db.execute(
      `UPDATE task SET taskStatus = 'Completed' WHERE taskId = ?`,
      [taskId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task marked as completed' });
  } catch (err) {
    console.error('Error updating task status:', err);
    res.status(500).json({ error: 'Database error while updating task' });
  }
});

// Remove a task from a specific study session
router.delete('/:sessionId/task/:taskId', async (req, res) => {
  const { sessionId, taskId } = req.params;

  try {
    const [sessions] = await db.query(
      `SELECT sessionTaskIds FROM studysession WHERE sessionId = ?`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    let taskIds = [];
    try {
      if (Array.isArray(sessions[0].sessionTaskIds)) {
        taskIds = sessions[0].sessionTaskIds;
      } else {
        taskIds = JSON.parse(sessions[0].sessionTaskIds);
      }
    } catch (e) {
      console.error('Failed to parse sessionTaskIds:', e);
      return res.status(500).json({ 
        error: 'Invalid task ID format in database',
        details: e.message,
        rawValue: sessions[0].sessionTaskIds
      });
    }

    const newTaskIds = taskIds.filter(id => String(id) !== String(taskId));

    const [updateResult] = await db.execute(
      `UPDATE studysession SET sessionTaskIds = ? WHERE sessionId = ?`,
      [JSON.stringify(newTaskIds), sessionId]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(500).json({ error: 'Failed to update session' });
    }

    res.json({ 
      message: 'Task removed from study session', 
      updatedTaskIds: newTaskIds,
      removedTaskId: taskId
    });
  } catch (err) {
    console.error('Error removing task from session:', err);
    res.status(500).json({ 
      error: 'Database error while updating study session',
      message: err.message
    });
  }
});

module.exports = router;
