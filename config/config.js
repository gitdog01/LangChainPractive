require("dotenv").config();

module.exports = {
  // GitHub OAuth 설정
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackUrl:
      process.env.GITHUB_CALLBACK_URL ||
      "http://localhost:3000/auth/github/callback",
  },

  // OpenAI 설정
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // 세션 설정
  session: {
    secret: process.env.SESSION_SECRET || "your-secret-key",
  },

  // 서버 설정
  server: {
    port: process.env.PORT || 3000,
  },

  // 벡터 저장소 설정
  vectorStore: {
    path: process.env.VECTOR_STORE_PATH || "./vector-store",
  },

  // 기본 청크 설정
  chunk: {
    size: 1000,
    overlap: 200,
    maxResults: 5,
  },
};
