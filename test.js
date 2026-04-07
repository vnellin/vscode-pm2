// Test script for PM2 processes
setInterval(() => {
    console.log(`Process ${process.env.PROCESS_NAME || 'unknown'} is running at ${new Date().toISOString()}`);
}, 10000);