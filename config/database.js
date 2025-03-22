const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`🌿 MongoDB가 연결되었습니다: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB 연결 오류:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
