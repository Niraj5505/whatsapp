const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../server/.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'nexaflow_jwt_super_secure_key_2025_prod_random_99382';
}

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI =
    'mongodb+srv://nirajth:Niraj%40123@cluster0.la5bw0i.mongodb.net/Whatsapp?retryWrites=true&w=majority&appName=Whatsapp';
}

const app = require('../server/src/app');
const connectDB = require('../server/src/config/database');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('Serverless DB connection error:', err);
  }
  return app(req, res);
};
