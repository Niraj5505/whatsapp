const mongoose = require('mongoose');
const dns = require('dns');

// Configure public DNS servers for resolving MongoDB Atlas SRV records on Windows
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // Ignore if unable to set
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[DATABASE] MongoDB connected (${conn.connection.host}/${conn.connection.name})`);
    return conn;
  } catch (error) {
    console.error(`[DATABASE] Connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
