const express = require('express');
const router = express.Router();
const db = require('../db/index');

// Add a new task for a user
router.post('/', async (req, res) => {
    // Get user ID from the request
    const userId = req.body.userId;
    
    const { taskDescription, dueDate, taskStatus, priority } = req.body;
    
    // Validate required fields
    if (!userId || !taskDescription || !dueDate) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Use your existing table structure
    const query = 'INSERT INTO task (userId, taskDescription, dueDate, taskStatus, priority) VALUES (?, ?, ?, ?, ?)';
    
    // Default to 'To-Do' if status not provided
    const status = taskStatus || 'To-Do';

    try {
        const [result] = await db.query(query, [userId, taskDescription, dueDate, status, priority]);

        const insertedTaskId = result.insertId;

      const [rows] = await db.query(
        `SELECT * FROM task WHERE taskId = ?`,
        [insertedTaskId]
      );

        res.status(201).json(rows[0]);
      } catch (error) {
        console.error("Error creating task:", error);
        res.status(500).json({ error: "Database error while creating." });
      }
    
});

// Get all tasks for a user
router.get('/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
      const [tasks] = await db.execute(
        'SELECT * FROM task WHERE userId = ? ORDER BY createdDate DESC',
        [userId]
      );
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// Update an existing task
router.put('/:taskId', async (req, res) => {
  const taskId = req.params.taskId;
  const { taskDescription, dueDate, taskStatus, priority } = req.body;
  
  // Validate that we have at least one field to update
  if (!taskDescription && !dueDate && !taskStatus && !priority) {
      return res.status(400).json({ error: 'No fields provided for update' });
  }
  
  try {
      // First check if the task exists
      const [existingTask] = await db.execute(
          'SELECT * FROM task WHERE taskId = ?',
          [taskId]
      );
      
      if (existingTask.length === 0) {
          return res.status(404).json({ error: 'Task not found' });
      }
      
      // Build dynamic update query based on provided fields
      let updateQuery = 'UPDATE task SET ';
      const updateValues = [];
      const updateFields = [];
      
      if (taskDescription) {
          updateFields.push('taskDescription = ?');
          updateValues.push(taskDescription);
      }
      
      if (dueDate) {
          updateFields.push('dueDate = ?');
          const formattedDueDate = new Date(dueDate).toISOString().split('T')[0];
          updateValues.push(formattedDueDate);
      }
      
      if (taskStatus) {
          updateFields.push('taskStatus = ?');
          updateValues.push(taskStatus);
      }
      
      if (priority) {
          updateFields.push('priority = ?');
          updateValues.push(priority);
      }

      
      updateQuery += updateFields.join(', ') + ' WHERE taskId = ?';
      updateValues.push(taskId);
      
      // Execute the update
      await db.execute(updateQuery, updateValues);
      
      // Get the updated task
      const [updatedTask] = await db.execute(
          'SELECT * FROM task WHERE taskId = ?',
          [taskId]
      );
      
      res.json(updatedTask[0]);
  } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ error: 'Database error while updating task' });
  }
});

// Delete a task
router.delete('/:taskId', async (req, res) => {
  const taskId = req.params.taskId;
  
  try {
      // First check if the task exists
      const [existingTask] = await db.execute(
          'SELECT * FROM task WHERE taskId = ?',
          [taskId]
      );
      
      if (existingTask.length === 0) {
          return res.status(404).json({ error: 'Task not found' });
      }
      
      // Delete the task
      await db.execute('DELETE FROM task WHERE taskId = ?', [taskId]);
      
      res.json({ message: 'Task deleted successfully', deletedTaskId: taskId });
  } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).json({ error: 'Database error while deleting task' });
  }
});

module.exports = router;
