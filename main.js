// LangChain 기반 Node.js 애플리케이션
require("dotenv").config();
const express = require("express");
const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("langchain/prompts");
const { LLMChain } = require("langchain/chains");

// 환경변수 확인
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey || apiKey === "your-api-key") {
  console.error(
    "⚠️  OpenAI API 키가 설정되지 않았습니다. .env 파일에 OPENAI_API_KEY를 설정해주세요."
  );
  process.exit(1);
}

// Express 앱 설정
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// ChatOpenAI 모델 초기화
const chat = new ChatOpenAI({
  openAIApiKey: apiKey,
  modelName: "gpt-3.5-turbo",
  temperature: 0.7,
});

// 프롬프트 템플릿 생성
const promptTemplate = new PromptTemplate({
  template:
    "사용자: {question}\n\n당신은 친절한 AI 비서입니다. 사용자의 질문에 대해 한국어로 상세하게 답변해주세요.",
  inputVariables: ["question"],
});

// LLMChain 생성
const chain = new LLMChain({
  llm: chat,
  prompt: promptTemplate,
});

// API 라우트 설정
app.post("/api/chat", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: "질문이 비어있습니다." });
    }

    console.log(`💬 사용자 질문: ${question}`);

    const response = await chain.call({ question });

    console.log(`🤖 AI 응답: ${response.text}`);

    res.json({ answer: response.text });
  } catch (error) {
    console.error("오류 발생:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// 기본 라우트
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>LangChain 챗봇</title>
      <style>
        body { font-family: 'Pretendard', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .chat-container { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-top: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; }
        input[type="text"] { width: 100%; padding: 8px; font-size: 16px; }
        button { background-color: #4CAF50; color: white; border: none; padding: 10px 15px; cursor: pointer; border-radius: 4px; }
        button:hover { background-color: #45a049; }
        #response { margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px; display: none; }
      </style>
    </head>
    <body>
      <h1>LangChain 챗봇</h1>
      <p>이 애플리케이션은 LangChain과 OpenAI를 사용한 간단한 챗봇입니다.</p>
      
      <div class="chat-container">
        <div class="form-group">
          <label for="question">질문:</label>
          <input type="text" id="question" placeholder="질문을 입력하세요...">
        </div>
        <button onclick="sendQuestion()">전송</button>
        
        <div id="response"></div>
      </div>
      
      <script>
        async function sendQuestion() {
          const question = document.getElementById('question').value;
          const responseDiv = document.getElementById('response');
          
          if (!question) {
            alert('질문을 입력해주세요.');
            return;
          }
          
          responseDiv.textContent = '답변을 불러오는 중...';
          responseDiv.style.display = 'block';
          
          try {
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ question }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
              responseDiv.textContent = data.answer;
            } else {
              responseDiv.textContent = '오류: ' + data.error;
            }
          } catch (error) {
            responseDiv.textContent = '네트워크 오류가 발생했습니다.';
            console.error(error);
          }
        }
      </script>
    </body>
    </html>
  `);
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(
    `💻 웹 브라우저에서 http://localhost:${PORT}/ 를 열어 앱을 사용해보세요.`
  );
});
