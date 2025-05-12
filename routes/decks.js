const express = require('express');
const router = express.Router();
const db = require('../db/index');

// Add a new flashcard deck
router.post('/', async (req, res) => {
    const { userId, deckName } = req.body;
  
    if (!userId || !deckName) {
        return res.status(400).json({ error: 'userId and deckName are required' });
    }
  
    const query = `
      INSERT INTO deck (userId, deckName) 
      VALUES (?, ?)
    `;
  
    try {
      const [result] = await db.query(query, [userId, deckName]);

      const insertedDeckId = result.insertId;

      const [rows] = await db.query(
        `SELECT * FROM deck WHERE deckId = ?`,
        [insertedDeckId]
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      console.error("Error creating deck:", error);
      res.status(500).json({ error: "Database error while creating deck." });
    }
});

// Get all flashcard decks for a user
router.get('/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
      const [decks] = await db.execute(
        'SELECT * FROM deck WHERE userId = ? ORDER BY createdOn DESC',
        [userId]
      );
      res.json(decks);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch decks' });
    }
});

// Update a flashcard deck
router.put('/:deckId', async (req, res) => {
  const deckId = req.params.deckId;
  const { deckName } = req.body;
  
  if (!deckName) {
      return res.status(400).json({ error: 'deckName is required' });
  }
  
  try {
      // First check if the deck exists
      const [deck] = await db.execute(
          'SELECT * FROM deck WHERE deckId = ?',
          [deckId]
      );
      
      if (deck.length === 0) {
          return res.status(404).json({ error: 'Deck not found' });
      }
      
      // Update the deck
      await db.execute(
          'UPDATE deck SET deckName = ? WHERE deckId = ?',
          [deckName, deckId]
      );
      
      // Fetch and return the updated deck
      const [updatedDeck] = await db.execute(
          'SELECT * FROM deck WHERE deckId = ?',
          [deckId]
      );
      
      res.json(updatedDeck[0]);
  } catch (error) {
      console.error("Error updating deck:", error);
      res.status(500).json({ error: "Database error while updating deck." });
  }
});

// Delete a flashcard deck
router.delete('/:deckId', async (req, res) => {
  const deckId = req.params.deckId;
  
  try {
      // First check if the deck exists
      const [deck] = await db.execute(
          'SELECT * FROM deck WHERE deckId = ?',
          [deckId]
      );
      
      if (deck.length === 0) {
          return res.status(404).json({ error: 'Deck not found' });
      }
      
      // Delete the deck
      await db.execute(
          'DELETE FROM deck WHERE deckId = ?',
          [deckId]
      );
      
      res.status(200).json({ message: 'Deck deleted successfully' });
  } catch (error) {
      console.error("Error deleting deck:", error);
      res.status(500).json({ error: "Database error while deleting deck." });
  }
});

module.exports = router;
