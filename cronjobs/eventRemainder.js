const cron = require('node-cron');
const moment = require('moment');
const { sendEmail } = require('../utils/mailer');
const db = require('../db/index');

async function checkEvents() {
  const now = moment();
  const twentyFourHoursLater = moment().add(24, 'hours');

  try {
    const [events] = await db.execute(
      `SELECT e.*, u.email FROM plannerEvent e JOIN user u ON e.userId = u.userId WHERE e.eventDate BETWEEN ? AND ?`,
      [now.format('YYYY-MM-DD'), twentyFourHoursLater.format('YYYY-MM-DD')]
    );

    if (events.length > 0) {
      events.forEach((event) => {
        sendEmail(
          event.email,
          `Event Reminder: ${event.eventTitle}`,
          `Your event "${event.eventTitle}" is coming up soon! It will start at ${moment(event.eventDate).format('LLLL')} and will end at ${moment(event.endTime, 'HH:mm').format('LT')}.`
        );
        console.log(`Reminder sent for event: ${event.eventTitle}`);
      });
    } else {
      console.log('No events due within the next 24 hours.');
    }
  } catch (error) {
    console.error('Error checking events:', error);
  }
}

// Cron job to check for events every hour
cron.schedule('0 * * * *', () => {
  console.log('Checking for events due in the next 24 hours...');
  checkEvents();
});

module.exports = checkEvents;
