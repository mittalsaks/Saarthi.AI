require('dotenv').config();

const { createApp } = require('./app');
const { connectDB } = require('./config/db');
const { startAlertCron } = require('./jobs/alertCron');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    console.log('MongoDB connected');

    const app = createApp();
    app.listen(PORT, () => {
      console.log(`Saarthi.ai backend listening on port ${PORT}`);
    });

    startAlertCron();
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();