const express = require("express");
const router = express.Router();
const db = require('../db/index');
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { OpenAI } = require("openai");
require("dotenv").config();

const upload = multer({ storage: multer.memoryStorage() });

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// Generate flashcards from user uploaded notes
router.post("/generate-flashcards", upload.array("files"), async (req, res) => {
  try {
    const { userId, deckId } = req.body;
    const files = req.files;

    if (!userId || !deckId) {
      return res.status(400).json({ error: "Missing userId or deckId" });
    }

    let allExtractedText = "";
    let shouldSaveText = false;

    if (files && files.length > 0) {
      shouldSaveText = true;

      for (const file of files) {
        const fileType = file.originalname.split(".").pop().toLowerCase();

        if (fileType === "pdf") {
          const data = await pdfParse(file.buffer);
          allExtractedText += data.text + "\n";
        } else if (fileType === "docx") {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          allExtractedText += result.value + "\n";
        } else {
          return res.status(400).json({ error: `Unsupported file type: ${fileType}` });
        }
      }
    } else {
      const [deckResult] = await db.query(
        'SELECT sourceText FROM deck WHERE deckId = ? AND userId = ?',
        [deckId, userId]
      );

      if (deckResult.length === 0) {
        return res.status(404).json({ error: "Deck not found for this user" });
      }

      allExtractedText = deckResult[0].sourceText;

      if (!allExtractedText || allExtractedText.trim() === "") {
        return res.status(400).json({ error: "No uploaded files or saved notes found for this deck" });
      }
    }

    const [existingCards] = await db.query(
      'SELECT question FROM flashcard WHERE deckId = ? AND userId = ?',
      [deckId, userId]
    );

    const existingQuestions = existingCards.map(card => card.question.toLowerCase().trim());

    const completion = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a helpful flashcard generator. Only respond with exactly 12 flashcards in valid JSON format like this:
          [
            { "question": "What is ...?", "answer": "..." },
            ...
          ]
          ${existingQuestions.length > 0 ? 
            `IMPORTANT: DO NOT generate flashcards with these questions (or very similar ones), as they already exist: ${existingQuestions.join(", ")}` 
            : ''}
          Make sure to generate different questions than any existing ones. Create diverse flashcards covering different aspects of the content.
          Only include alphanumeric characters, common punctuation, and standard ASCII characters in your response.
          Do not include any explanation or extra text. Only the JSON array.`
        },
        {
          role: "user",
          content: allExtractedText
        }
      ],
      temperature: 0.7,
    });

    let text = completion.choices[0].message.content;

    try {
      const jsonMatch = text.match(/\[\s*{[\s\S]*?}\s*]/);
      if (!jsonMatch) {
        throw new Error("Model response did not contain a valid JSON array");
      }
      
      let jsonText = jsonMatch[0];
      
      jsonText = jsonText.replace(/\\([^"\\/bfnrtu])/g, '$1')
                         .replace(/[\u0000-\u001F]+/g, ' ')
                         .replace(/\\/g, '\\\\')
                         .replace(/\\\\/g, '\\')
                         .replace(/\\"/g, '"')
                         .replace(/"/g, '\\"')
                         .replace(/\\\\"/g, '\\"');
      
      const flashcards = JSON.parse(jsonText);
      
      if (!Array.isArray(flashcards)) {
        throw new Error("Generated content is not a valid array");
      }

      if (shouldSaveText) {
        await db.query(
          'UPDATE deck SET sourceText = ? WHERE deckId = ? AND userId = ?',
          [allExtractedText.trim(), deckId, userId]
        );
      }

      const insertFlashcardQuery = `
        INSERT INTO flashcard (userId, deckId, question, answer)
        VALUES (?, ?, ?, ?)
      `;

      for (const card of flashcards) {
        const { question, answer } = card;
        if (question && answer) {
          await db.query(insertFlashcardQuery, [userId, deckId, question, answer]);
        }
      }

      await db.query(
        `UPDATE deck 
         SET flashcardCount = (
           SELECT COUNT(*) FROM flashcard WHERE deckId = ?
         ) 
         WHERE deckId = ?`,
        [deckId, deckId]
      );

      res.json({ success: true, flashcards });
    } catch (jsonError) {

      try {
        const extractFlashcards = (text) => {
          const flashcards = [];
          const cardMatches = text.match(/["']question["']\s*:\s*["'](.+?)["']\s*,\s*["']answer["']\s*:\s*["'](.+?)["']/g) || [];
          
          for (const match of cardMatches) {
            const question = match.match(/["']question["']\s*:\s*["'](.+?)["']/)?.[1];
            const answer = match.match(/["']answer["']\s*:\s*["'](.+?)["']/)?.[1];
            
            if (question && answer) {
              flashcards.push({ question, answer });
            }
          }
          
          return flashcards;
        };
        
        const flashcards = extractFlashcards(text);
        
        if (flashcards.length === 0) {
          throw new Error("Could not extract any valid flashcards from the response");
        }
        
        if (shouldSaveText) {
          await db.query(
            'UPDATE deck SET sourceText = ? WHERE deckId = ? AND userId = ?',
            [allExtractedText.trim(), deckId, userId]
          );
        }

        const insertFlashcardQuery = `
          INSERT INTO flashcard (userId, deckId, question, answer)
          VALUES (?, ?, ?, ?)
        `;

        for (const card of flashcards) {
          const { question, answer } = card;
          if (question && answer) {
            await db.query(insertFlashcardQuery, [userId, deckId, question, answer]);
          }
        }

        await db.query(
          `UPDATE deck 
           SET flashcardCount = (
             SELECT COUNT(*) FROM flashcard WHERE deckId = ?
           ) 
           WHERE deckId = ?`,
          [deckId, deckId]
        );

        res.json({ success: true, flashcards });
      } catch (fallbackError) {
        throw new Error(`Failed to parse LLM response: ${jsonError.message}. Fallback extraction also failed: ${fallbackError.message}`);
      }
    }
  } catch (error) {
    console.error("Groq Flashcard Error:", error);
    res.status(500).json({ error: "Failed to generate flashcards using Groq" });
  }
});

//Add manually created flashcards
router.post('/', async (req, res) => {
  const { userId, deckId, question, answer } = req.body;

  if (!userId || !deckId || !question || !answer) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO flashcard (userId, deckId, question, answer) VALUES (?, ?, ?, ?)',
      [userId, deckId, question, answer]
    );

    const flashcardId = result.insertId;

    await db.execute(
      `UPDATE deck 
       SET flashcardCount = (
         SELECT COUNT(*) FROM flashcard WHERE deckId = ?
       ) 
       WHERE deckId = ?`,
      [deckId, deckId]
    );

    res.status(201).json({
      flashcardId,
      userId,
      deckId,
      question,
      answer
    });
  } catch (error) {
    console.error("Add Flashcard Error:", error);
    res.status(500).json({ error: "Failed to add flashcard" });
  }
});


// Get all flashcards in a deck for a user
router.get('/:userId/:deckId', async (req, res) => {
  const { userId, deckId } = req.params;

  try {
    const [flashcards] = await db.execute(
      'SELECT * FROM flashcard WHERE userId = ? AND deckId = ? ORDER BY createdOn DESC',
      [userId, deckId]
    );
    res.json({ success: true, flashcards });
  } catch (err) {
    console.error("Fetch Flashcards Error:", err);
    res.status(500).json({ error: 'Failed to fetch flashcards' });
  }
});

// Update a flashcard
router.put('/:flashcardId', async (req, res) => {
  const { flashcardId } = req.params;
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: "Both question and answer are required" });
  }

  try {
    const [result] = await db.execute(
      'UPDATE flashcard SET question = ?, answer = ? WHERE flashcardId = ?',
      [question, answer, flashcardId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Flashcard not found" });
    }

    res.json({ success: true, message: "Flashcard updated" });
  } catch (error) {
    console.error("Update Flashcard Error:", error);
    res.status(500).json({ error: "Failed to update flashcard" });
  }
});

// Delete a flashcard
router.delete('/:flashcardId', async (req, res) => {
  const { flashcardId } = req.params;

  try {
    const [flashcard] = await db.execute(
      'SELECT deckId FROM flashcard WHERE flashcardId = ?',
      [flashcardId]
    );

    if (flashcard.length === 0) {
      return res.status(404).json({ error: "Flashcard not found" });
    }

    const deckId = flashcard[0].deckId;

    await db.execute(
      'DELETE FROM flashcard WHERE flashcardId = ?',
      [flashcardId]
    );

    await db.execute(
      `UPDATE deck 
       SET flashcardCount = (
         SELECT COUNT(*) FROM flashcard WHERE deckId = ?
       ) 
       WHERE deckId = ?`,
      [deckId, deckId]
    );

    res.json({ success: true, message: "Flashcard deleted" });
  } catch (error) {
    console.error("Delete Flashcard Error:", error);
    res.status(500).json({ error: "Failed to delete flashcard" });
  }
});

module.exports = router;
