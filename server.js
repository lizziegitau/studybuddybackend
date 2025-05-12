const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors');

const app = express();
dotenv.config();

const port = process.env.PORT || 5000;
const frontend_url = process.env.FRONTEND_URL

app.use(bodyParser.json());
app.use(cors({ origin: `${frontend_url}`, credentials: true }));

const taskRoutes = require('./routes/tasks');
const deckRoutes = require('./routes/decks');
const clerkWebhook = require('./routes/clerkWebhooks');
const eventRoutes = require('./routes/events');
const studySessionRoutes = require('./routes/studySessions');
const studyGoalRoutes = require('./routes/dailyGoal');
const flashcardRoutes = require('./routes/flashcards');

app.use('/api/tasks', taskRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/webhooks/clerk', clerkWebhook);
app.use('/api/planner-events', eventRoutes);
app.use('/api/study-session', studySessionRoutes);
app.use('/api/daily-goal', studyGoalRoutes);
app.use('/api/flashcards', flashcardRoutes);

require('./cronjobs/taskRemainder'); 
require('./cronjobs/eventRemainder'); 

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
