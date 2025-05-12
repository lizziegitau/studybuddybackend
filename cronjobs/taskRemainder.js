const cron = require('node-cron');
const moment = require('moment');
const { sendEmail } = require('../utils/mailer');
const db = require('../db/index');

async function checkTasks() {
  const now = moment();
  const twentyFourHoursLater = moment().add(24, 'hours');

  try {
    const [tasks] = await db.execute(
      `SELECT t.*, u.email FROM task t JOIN user u ON t.userId = u.userId WHERE t.dueDate BETWEEN ? AND ? AND t.taskStatus != 'Completed'`,
      [now.format('YYYY-MM-DD'), twentyFourHoursLater.format('YYYY-MM-DD')]
    );

    if (tasks.length > 0) {
      tasks.forEach((task) => {
        sendEmail(
          task.email,
          `Reminder: ${task.taskDescription}`,
          `Your task "${task.taskDescription}" is due soon! Please complete it before ${moment(task.dueDate).format('LLLL')}.`
        );
        console.log(`Reminder sent for task: ${task.taskDescription}`);
      });
    } else {
      console.log('No tasks due within the next 24 hours.');
    }
  } catch (error) {
    console.error('Error checking tasks:', error);
  }
}

cron.schedule('0 * * * *', () => {
  console.log('Checking for tasks due in the next 24 hours...');
  checkTasks();
});

module.exports = checkTasks;
