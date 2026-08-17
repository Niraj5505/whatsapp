const mongoose = require('mongoose');
const dns = require('dns');

// Configure public DNS servers only on Windows for local SRV lookup
if (process.platform === 'win32') {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  } catch (e) {
    // Ignore if unable to set
  }
}

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      'mongodb+srv://nirajth:Niraj%40123@cluster0.la5bw0i.mongodb.net/Whatsapp?retryWrites=true&w=majority&appName=Whatsapp';

    const conn = await mongoose.connect(mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[DATABASE] MongoDB connected (${conn.connection.host}/${conn.connection.name})`);
    return conn;
  } catch (error) {
    console.error(`[DATABASE] Connection error: ${error.message}`);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }
};

module.exports = connectDB;
