const express = require('express');
const router = express.Router();
const db = require('../db/index');

// Handle the Clerk webhook to create a new user
router.post('/', async (req, res) => {
    try {
        const webhookEvent = req.body;
        console.log("Received Clerk Webhook Event:", webhookEvent);
        
        // Make sure the event is what you expect
        if (webhookEvent.type === 'user.created') {
            const user = webhookEvent.data;
            const id = user.id;
            const email = user.email_addresses?.[0]?.email_address || null;
            const username = user.username;
            
            console.log('Hello');
            
            // Check if user already exists by userId or email
            const [results] = await db.query(
                'SELECT userId FROM user WHERE userId = ? OR email = ?', 
                [id, email]
            );
            console.log("DB check", results);
            
            // If user doesn't exist, insert them
            if (results.length === 0) {
                const query = 'INSERT INTO user (userId, email, name) VALUES (?, ?, ?)';
                const [result] = await db.query(query, [id, email, username]);
                
                console.log('User added to database:', result);
                res.status(200).send('User created and stored in database');
            } else {
                // User already exists, just return success
                console.log('User already exists, skipping insert');
                res.status(200).send('User already exists');
            }
        } else {
            res.status(200).send('Event type not handled');
        }
    } catch (error) {
        console.error('Error in webhook handler:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
