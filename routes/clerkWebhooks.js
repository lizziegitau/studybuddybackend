const express = require('express');
const router = express.Router();
const db = require('../db/index');

// Handle the Clerk webhook to create a new user
router.post('/', (req, res) => {
    const webhookEvent = req.body;
    console.log("Received Clerk Webhook Event:", webhookEvent);

    // Make sure the event is what you expect, for example, a 'user.created' event
    if (webhookEvent.type === 'user.created') {

        const user = webhookEvent.data;

        const id = user.id;
        const email = user.email_addresses?.[0]?.email_address || null;
        const username = user.username;

        // Check if user already exists first
        db.query('SELECT userId FROM user WHERE userId = ?', [id], (err, results) => {
            if (err) {
                console.error('Error checking for existing user:', err);
                return res.status(500).send('Internal Server Error');
            }

            // If user doesn't exist, insert them
            if (results.length === 0) {
                const query = 'INSERT INTO user (userId, email, name) VALUES (?, ?, ?)';
                db.query(query, [id, email, username], (err, result) => {
                    if (err) {
                        console.error('Error inserting user into database:', err);
                        return res.status(500).send('Internal Server Error');
                    }
                    console.log('User added to database:', result);
                    res.status(200).send('User created and stored in database');
                });
            } else {
                // User already exists, just return success
                console.log('User already exists, skipping insert');
                res.status(200).send('User already exists');
            }
        });
    } else {
        res.status(200).send('Event type not handled');
    }
});

module.exports = router;
