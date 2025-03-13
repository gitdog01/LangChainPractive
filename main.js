// =========================================================================
// LangChain 기반 코드 생성 추천기
// =========================================================================
// LangChain: 대규모 언어 모델(LLM)을 활용한 애플리케이션 개발을 위한 프레임워크
// RAG(Retrieval Augmented Generation): 외부 데이터를 검색하여 LLM의 응답을 강화하는 기법
// =========================================================================

// LangSmith 콜백 백그라운드 처리 설정 (LangChain 경고 해결을 위해 추가)
process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "true";

// 기본 의존성 로드
require("dotenv").config(); // .env 파일에서 환경 변수 로드
const express = require("express"); // 웹 서버 프레임워크
const fs = require("fs").promises; // 파일 시스템 접근을 위한 비동기 메서드
const path = require("path"); // 파일 경로 조작을 위한 유틸리티
const { glob } = require("glob"); // 파일 패턴 검색 라이브러리
const { marked } = require("marked"); // 마크다운 렌더링
const hljs = require("highlight.js"); // 코드 구문 강조

// LangChain 관련 의존성 로드
const { ChatOpenAI } = require("@langchain/openai"); // OpenAI 채팅 모델 인터페이스
const { PromptTemplate } = require("@langchain/core/prompts"); // 프롬프트 템플릿 (LLM에게 지시하는 형식)
const { RunnableSequence } = require("@langchain/core/runnables"); // 실행 가능한 컴포넌트 연결
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter"); // 텍스트를 청크로 분할
const { MemoryVectorStore } = require("langchain/vectorstores/memory"); // 메모리 기반 벡터 저장소
const { OpenAIEmbeddings } = require("@langchain/openai"); // OpenAI 임베딩 모델

// =========================================================================
// 환경변수 확인
// =========================================================================
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

app.use(express.json()); // JSON 요청 본문 파싱
app.use(express.static("public")); // 정적 파일 제공 (HTML, CSS, JS 등)
app.use(express.urlencoded({ extended: true })); // URL 인코딩된 요청 본문 파싱

// =========================================================================
// LangChain 컴포넌트 초기화
// =========================================================================

// 여러 OpenAI 모델 초기화
const models = {
  "gpt-4o": new ChatOpenAI({
    openAIApiKey: apiKey,
    modelName: "gpt-4o",
    temperature: 0.1,
  }),
  "gpt-o3-mini": new ChatOpenAI({
    openAIApiKey: apiKey,
    modelName: "o3-mini-2025-01-31",
  }),
  // o3 는 temperature를 지원하지 않음
  "gpt-o1": new ChatOpenAI({
    openAIApiKey: apiKey,
    modelName: "o1-2024-12-17",
  }),
  // o1 은 temperature를 지원하지 않음
};

// OpenAI 임베딩 모델 초기화 - 텍스트를 벡터로 변환
// 임베딩: 텍스트를 수치 벡터로 변환하여 의미적 유사성을 계산 가능하게 함
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: apiKey,
});

// 텍스트 분할기 초기화 - 큰 텍스트를 작은 청크로 나눔
// 이는 임베딩 모델의 토큰 제한을 고려하고 더 정확한 검색을 위함
// 기본 값으로 초기화하지만, 사용자 설정에 따라 동적으로 변경될 수 있음
function createTextSplitter(chunkSize = 2000, chunkOverlap = 500) {
  return new RecursiveCharacterTextSplitter({
    chunkSize: chunkSize, // 각 청크의 최대 문자 수
    chunkOverlap: chunkOverlap, // 청크 간 중복되는 문자 수 (문맥 유지를 위함)
  });
}

// 기본 설정으로 텍스트 분할기 생성
let textSplitter = createTextSplitter();

// Target 소스 코드 디렉토리 경로
const TARGET_CODE_DIR = "./Target";

// 모델 사용 여부를 제어하는 플래그
const MODEL_CONFIG = {
  "gpt-4o": { enabled: true },
  "gpt-o3-mini": { enabled: true },
  "gpt-o1": { enabled: false }, // 비용 절감을 위해 임시로 비활성화
};

// =========================================================================
// 소스 코드 로딩 및 벡터 저장소 생성 함수
// =========================================================================

/**
 * Target 디렉토리에서 소스 코드 파일을 로드하고 벡터 저장소를 생성/업데이트
 */
async function loadSourceCodeAndCreateVectorStore() {
  try {
    console.log("🔍 Target 디렉토리에서 소스 코드 파일 검색 중...");

    // 현재 설정된 분할기의 설정 로깅
    console.log(
      `📊 현재 텍스트 분할 설정: 청크 사이즈=${textSplitter.chunkSize}, 오버랩=${textSplitter.chunkOverlap}`
    );

    // glob을 사용하여 Target 디렉토리의 모든 코드 파일 찾기
    // 확장자에 따라 다른 언어 파일도 포함시킬 수 있음
    const files = await glob(
      `${TARGET_CODE_DIR}/**/*.{js,ts,py,java,cpp,c,cs,go,rb}`
    );

    if (files.length === 0) {
      console.warn("⚠️ Target 디렉토리에서 소스 코드 파일을 찾을 수 없습니다.");
      return null;
    }

    console.log(`🔎 ${files.length}개의 소스 코드 파일을 찾았습니다.`);

    // 각 파일의 내용을 로드하고 메타데이터와 함께 저장
    const docs = [];
    for (const file of files) {
      try {
        // 파일 내용 읽기
        const content = await fs.readFile(file, "utf-8");

        // 파일 경로를 상대 경로로 변환
        const relativePath = path.relative(process.cwd(), file);

        // 텍스트 분할기를 사용하여 큰 파일을 청크로 분할
        const textChunks = await textSplitter.splitText(content);

        // 각 청크를 문서 객체로 변환하고 메타데이터 추가
        for (let i = 0; i < textChunks.length; i++) {
          docs.push({
            pageContent: textChunks[i],
            metadata: {
              source: relativePath,
              chunk: i + 1,
              totalChunks: textChunks.length,
            },
          });
        }

        console.log(
          `✅ 파일 처리 완료: ${relativePath} (${textChunks.length} 청크)`
        );
      } catch (error) {
        console.error(`❌ 파일 처리 중 오류 발생: ${file}`, error);
      }
    }

    if (docs.length === 0) {
      console.warn("⚠️ 소스 코드에서 유효한 문서를 생성할 수 없습니다.");
      return null;
    }

    console.log(`📄 총 ${docs.length}개의 문서 청크가 생성되었습니다.`);

    // MemoryVectorStore를 사용하여 벡터 저장소 생성
    // MemoryVectorStore: 메모리 기반 벡터 저장소로, 임시적으로 벡터를 저장
    console.log("🔢 벡터 저장소 생성 중...");
    const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

    console.log("💾 벡터 저장소가 성공적으로 생성되었습니다.");
    return vectorStore;
  } catch (error) {
    console.error("❌ 벡터 저장소 생성 중 오류 발생:", error);
    return null;
  }
}

/**
 * 벡터 저장소 로드 또는 생성 함수
 */
async function getVectorStore() {
  try {
    // MemoryVectorStore는 파일로 저장/로드할 수 없으므로 항상 새로 생성
    console.log("🆕 벡터 저장소를 새로 생성합니다.");
    return await loadSourceCodeAndCreateVectorStore();
  } catch (error) {
    console.error("❌ 벡터 저장소 생성 중 오류 발생:", error);
    return null;
  }
}

// 초기 벡터 저장소 변수
let vectorStore = null;

// =========================================================================
// 코드 생성 추천을 위한 프롬프트 템플릿
// =========================================================================

// 코드 추천 프롬프트 템플릿 - LLM에게 코드 수정 방법을 요청하는 형식 정의
const codeRecommendationPrompt = new PromptTemplate({
  template: `
다음은 기존 코드베이스의 일부입니다:

{relevantCode}

사용자가 원하는 기능은 다음과 같습니다:
{userRequest}

위 코드를 어떻게 수정하거나 확장해야 사용자의 요청을 구현할 수 있는지 추천해주세요.
당신의 응답은 반드시 마크다운 형식으로 작성해야 합니다.

다음 정보를 마크다운 형식으로 포함해주세요:
1. **파일 경로**: 수정이 필요한 파일 경로
2. **변경 내용**: 어떤 변경을 해야 하는지 설명
3. **코드 변경사항**: 구체적인 코드 변경 내용을 코드 블록으로 표시

코드 변경 내용은 반드시 diff 형식으로 표시해야 합니다. 그래야 사용자가 어떤 부분이 추가되고 삭제되는지 명확하게 볼 수 있습니다:

\`\`\`diff
- // 삭제될 코드 (빨간색 배경으로 표시됩니다)
+ // 추가될 코드 (초록색 배경으로 표시됩니다)
\`\`\`

각 섹션을 마크다운 헤딩(##)으로 구분하고, 전체 응답이 마크다운으로 쉽게 파싱될 수 있도록 해주세요.
코드 변경을 할 때는 가능한 한 전체 맥락을 제공하기 위해 변경된 라인 주변의 코드도 일부 포함해주세요.
`,
  inputVariables: ["relevantCode", "userRequest"],
});

// =========================================================================
// API 라우트 설정
// =========================================================================

// 벡터 저장소 갱신 엔드포인트
app.post("/api/refresh-vector-store", async (req, res) => {
  try {
    // 사용자 설정 적용
    const { chunkSize, chunkOverlap } = req.body;

    // 유효한 값이 전달되었는지 확인하고 텍스트 분할기 업데이트
    if (chunkSize && chunkOverlap) {
      console.log(
        `📐 텍스트 분할기 설정 업데이트: 청크 사이즈=${chunkSize}, 오버랩=${chunkOverlap}`
      );
      textSplitter = createTextSplitter(
        parseInt(chunkSize),
        parseInt(chunkOverlap)
      );
    }

    vectorStore = await loadSourceCodeAndCreateVectorStore();
    if (vectorStore) {
      res.json({
        success: true,
        message: "벡터 저장소가 성공적으로 갱신되었습니다.",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "벡터 저장소 갱신 중 오류가 발생했습니다.",
      });
    }
  } catch (error) {
    console.error("벡터 저장소 갱신 중 오류:", error);
    res.status(500).json({
      success: false,
      message: "벡터 저장소 갱신 중 오류가 발생했습니다.",
    });
  }
});

// 코드 추천 엔드포인트
app.post("/api/recommend-code", async (req, res) => {
  try {
    const { request, maxResults } = req.body;

    // 검색 결과 수 기본값
    const resultCount = maxResults ? parseInt(maxResults) : 5;

    if (!request) {
      return res.status(400).json({ error: "요청 내용이 비어있습니다." });
    }

    console.log(`💬 사용자 요청: ${request}`);
    console.log(`🔍 검색 결과 수: ${resultCount}`);

    // 벡터 저장소가 없으면 초기화
    if (!vectorStore) {
      console.log("🔄 벡터 저장소 초기화 중...");
      vectorStore = await getVectorStore();

      if (!vectorStore) {
        return res
          .status(500)
          .json({ error: "벡터 저장소를 초기화할 수 없습니다." });
      }
    }

    // 유사도 검색을 통해 관련 코드 검색
    // similaritySearch: 쿼리와 의미적으로 유사한 문서를 찾는 메서드
    console.log("🔍 사용자 요청과 관련된 코드 검색 중...");
    // scoreThreshold를 포함하여 유사도 점수를 함께 가져옵니다
    const searchResultsWithScore = await vectorStore.similaritySearchWithScore(
      request,
      resultCount // 사용자 설정 적용
    );

    if (searchResultsWithScore.length === 0) {
      return res
        .status(404)
        .json({ error: "요청과 관련된 코드를 찾을 수 없습니다." });
    }

    // 검색된 코드 청크에 대한 상세 로그
    console.log(
      `\n📋 검색된 관련 코드 청크 (${searchResultsWithScore.length}개):`
    );
    const searchResults = searchResultsWithScore.map(([doc, score], index) => {
      console.log(`\n--- 청크 #${index + 1} ---`);
      console.log(`📁 파일: ${doc.metadata.source}`);
      console.log(
        `🔢 청크 번호: ${doc.metadata.chunk}/${doc.metadata.totalChunks}`
      );
      console.log(`📊 내용 길이: ${doc.pageContent.length}자`);
      console.log(`🔍 유사도 점수: ${score.toFixed(4)}`);
      console.log(
        `📝 내용 미리보기: ${doc.pageContent.substring(0, 150)}${
          doc.pageContent.length > 150 ? "..." : ""
        }`
      );
      return doc; // 원래 문서만 반환
    });
    console.log("\n");

    // 검색 결과를 하나의 문자열로 결합
    const relevantCode = searchResults
      .map((doc) => {
        return `파일: ${doc.metadata.source}, 청크: ${doc.metadata.chunk}/${doc.metadata.totalChunks}\n\n${doc.pageContent}\n\n`;
      })
      .join("\n---\n\n");

    console.log(`🔎 ${searchResults.length}개의 관련 코드 청크를 찾았습니다.`);

    // 각 모델별로 체인 실행 (병렬 처리)
    console.log("🤖 여러 모델을 사용하여 코드 추천 생성 중...");

    // 모든 모델의 결과를 병렬로 가져오기
    const modelResults = await Promise.all(
      Object.entries(models).map(async ([modelName, model]) => {
        if (MODEL_CONFIG[modelName].enabled) {
          try {
            console.log(`모델 ${modelName} 실행 중...`);
            const chain = RunnableSequence.from([
              codeRecommendationPrompt,
              model,
            ]);
            const response = await chain.invoke({
              relevantCode,
              userRequest: request,
            });
            console.log(`✅ 모델 ${modelName} 실행 완료`);

            // 모델별 응답 반환
            return {
              modelName,
              recommendation: response.content,
            };
          } catch (error) {
            console.error(`❌ 모델 ${modelName} 실행 중 오류:`, error);
            return {
              modelName,
              recommendation: `오류: ${
                error.message || "알 수 없는 오류가 발생했습니다."
              }`,
              error: true,
            };
          }
        } else {
          // 비활성화된 모델은 메시지만 반환
          console.log(`⏸️ 모델 ${modelName}는 현재 비활성화되어 있습니다.`);
          return {
            modelName,
            recommendation: `이 모델(${modelName})은 현재 비용 절약을 위해 임시로 비활성화되어 있습니다.`,
            disabled: true,
          };
        }
      })
    );

    console.log("✅ 모든 모델의 코드 추천 생성 완료");

    // 유사도 점수를 포함한 관련 파일 정보 준비
    const relevantFilesInfo = searchResultsWithScore.map(([doc, score]) => ({
      path: doc.metadata.source,
      chunk: doc.metadata.chunk,
      totalChunks: doc.metadata.totalChunks,
      score: score.toFixed(4),
      preview:
        doc.pageContent.substring(0, 100) +
        (doc.pageContent.length > 100 ? "..." : ""),
    }));

    // 응답 전송
    res.json({
      modelResults, // 각 모델별 결과
      relevantFiles: [
        ...new Set(searchResults.map((doc) => doc.metadata.source)),
      ], // 중복 제거된 파일 경로
      relevantFilesDetails: relevantFilesInfo, // 상세 정보 추가
    });
  } catch (error) {
    console.error("코드 추천 중 오류 발생:", error);
    res
      .status(500)
      .json({ error: "코드 추천을 생성하는 중 오류가 발생했습니다." });
  }
});

// 기본 HTML 페이지 제공
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>코드 생성 추천기</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css">
      <style>
        body {
          font-family: 'Pretendard', Arial, sans-serif;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          color: #333;
        }
        .container {
          display: flex;
          gap: 20px;
        }
        .left-panel {
          flex: 0 0 350px;
          width: 350px;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
        }
        .right-panel {
          flex: 2;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        textarea {
          width: 100%;
          height: 200px;
          padding: 8px;
          font-size: 16px;
          border-radius: 4px;
          border: 1px solid #ddd;
        }
        button {
          background-color: #4caf50;
          color: white;
          border: none;
          padding: 10px 15px;
          cursor: pointer;
          border-radius: 4px;
          margin-right: 10px;
        }
        button:hover {
          background-color: #45a049;
        }
        .refresh-btn {
          background-color: #2196f3;
        }
        .refresh-btn:hover {
          background-color: #0b7dda;
        }
        #recommendation-tabs,
        #relevantFiles {
          margin-top: 20px;
          background-color: #f9f9f9;
          border-radius: 4px;
          overflow: auto;
        }
        .tab-container {
          display: flex;
          flex-direction: column;
          width: 100%;
        }
        .tab-nav {
          display: flex;
          border-bottom: 1px solid #ddd;
          background-color: #f1f1f1;
          overflow-x: auto;
        }
        .tab-btn {
          padding: 10px 15px;
          background-color: transparent;
          border: none;
          border-right: 1px solid #ddd;
          cursor: pointer;
          white-space: nowrap;
          color: #333;
          font-weight: bold;
        }
        .tab-btn:hover {
          background-color: #e0e0e0;
        }
        .tab-btn.active {
          background-color: #fff;
          border-bottom: 3px solid #4caf50;
        }
        .tab-content {
          display: none;
          padding: 15px;
        }
        .tab-content.active {
          display: block;
        }
        .model-indicator {
          display: inline-block;
          padding: 3px 7px;
          border-radius: 3px;
          font-size: 12px;
          font-weight: bold;
          margin-left: 8px;
          color: white;
        }
        .model-gpt-4o {
          background-color: #8A2BE2; /* BlueViolet */
        }
        .model-gpt-o3-mini {
          background-color: #FF8C00; /* DarkOrange */
        }
        .model-gpt-o1 {
          background-color: #20B2AA; /* LightSeaGreen */
        }
        .file-list {
          margin-top: 10px;
        }
        .file-item {
          background-color: #e7f3ff;
          padding: 5px 10px;
          border-radius: 3px;
          display: inline-block;
          margin-right: 5px;
          margin-bottom: 5px;
        }
        .file-details {
          margin-top: 20px;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
        .file-detail-item {
          padding: 10px;
          margin-bottom: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background-color: #f5f5f5;
        }
        .file-detail-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .file-score {
          color: #2196f3;
        }
        .file-preview {
          font-family: monospace;
          padding: 8px;
          background-color: #fff;
          border-radius: 3px;
          font-size: 0.9em;
          white-space: pre-wrap;
          overflow-x: auto;
        }
        code {
          font-family: Consolas, monospace;
        }
        pre {
          margin: 0;
          overflow: auto;
        }
        .model-time {
          color: #666;
          font-size: 12px;
          margin-top: 5px;
          text-align: right;
        }
        
        /* Diff 스타일 */
        .hljs-addition,
        .markdown pre code .hljs-addition,
        pre .hljs-addition,
        code .hljs-addition {
          background-color: #95f295; /* 더 진한 초록색 배경 */
          color: #1a7f1a;
          display: inline-block;
          width: 100%;
        }
        
        .hljs-deletion,
        .markdown pre code .hljs-deletion,
        pre .hljs-deletion,
        code .hljs-deletion {
          background-color: #ff9999; /* 더 진한 빨간색 배경 */
          color: #b30000;
          display: inline-block;
          width: 100%;
        }
        
        /* 마크다운 스타일 */
        .markdown h1 {
          font-size: 1.8em;
          border-bottom: 1px solid #eaecef;
          padding-bottom: 0.3em;
        }
        .markdown h2 {
          font-size: 1.5em;
          border-bottom: 1px solid #eaecef;
          padding-bottom: 0.3em;
        }
        .markdown h3 {
          font-size: 1.25em;
        }
        .markdown code {
          background-color: rgba(27,31,35,.05);
          padding: 0.2em 0.4em;
          border-radius: 3px;
        }
        .markdown pre {
          background-color: #f6f8fa;
          padding: 16px;
          border-radius: 6px;
        }
        .markdown blockquote {
          margin: 0;
          padding-left: 16px;
          border-left: 4px solid #ddd;
        }
        .markdown ul, .markdown ol {
          padding-left: 2em;
        }
        .markdown img {
          max-width: 100%;
        }

        /* 로딩 애니메이션 */
        .loading {
          text-align: center;
          padding: 20px;
        }
        .loading-spinner {
          display: inline-block;
          width: 50px;
          height: 50px;
          border: 5px solid rgba(0, 0, 0, 0.1);
          border-radius: 50%;
          border-top-color: #4caf50;
          animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .model-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 15px;
          background-color: #f9f9f9;
          border-radius: 4px;
        }
        .model-status-item {
          display: flex;
          align-items: center;
        }
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-right: 8px;
          background-color: #e0e0e0; /* 기본 상태는 회색 */
        }
        .status-pending {
          background-color: #ffb700;
        }
        .status-completed {
          background-color: #4caf50;
        }
        .status-error {
          background-color: #f44336;
        }
        .status-disabled {
          background-color: #9e9e9e; /* 회색으로 비활성화 표시 */
        }
        .disabled-model {
          color: #757575;
          padding: 15px;
          background-color: #f5f5f5;
          border-left: 4px solid #9e9e9e;
          margin-bottom: 20px;
          font-style: italic;
        }
        
        /* 비활성화된 모델 텍스트 스타일 */
        .disabled-model-text {
          text-decoration: line-through;
          color: #9e9e9e;
        }
        
        /* 모델 상태 패널 스타일 */
        .model-status-panel {
          margin-top: 20px;
          background-color: #f5f5f5;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .model-status-panel h3 {
          font-size: 16px;
          margin-top: 0;
          margin-bottom: 12px;
          color: #333;
          padding-bottom: 5px;
          border-bottom: 1px solid #ddd;
        }
        
        /* 설정 패널 스타일 */
        .settings-panel {
          margin-top: 20px;
          border-top: 1px solid #ddd;
          padding-top: 10px;
          background-color: #f5f5f5;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .settings-panel h3 {
          font-size: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          cursor: pointer;
          color: #333;
          padding-bottom: 5px;
          border-bottom: 1px solid #ddd;
        }
        .toggle-btn {
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          padding: 0 5px;
          color: #4caf50;
          font-weight: bold;
        }
        .settings-group {
          margin-bottom: 15px;
          padding: 12px;
          background-color: #ffffff;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
        }
        .settings-group h4 {
          font-size: 14px;
          margin-top: 0;
          margin-bottom: 12px;
          color: #444;
          font-weight: bold;
        }
        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding: 5px 0;
        }
        .setting-input {
          width: 100px;
          padding: 6px 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
          text-align: center;
          background-color: #f9f9f9;
        }
        .setting-input:focus {
          outline: none;
          border-color: #4caf50;
          box-shadow: 0 0 3px rgba(76, 175, 80, 0.3);
        }
      </style>
    </head>
    <body>
      <h1>LangChain 코드 생성 추천기</h1>
      <p>이 애플리케이션은 LangChain, 벡터 저장소, RAG를 활용하여 소스 코드 기반으로 코드 수정 추천을 제공합니다.</p>
      
      <div class="container">
        <div class="left-panel">
          <div class="form-group">
            <label for="request">기능 요청 (구현하고 싶은 기능을 자세히 설명해주세요):</label>
            <textarea id="request" placeholder="예: '사용자 인증 기능을 추가하고 싶습니다...'">링크의 썸네일을 가져올때 해당 페이지가 403 응답을 주면 썸네일이나 타이틀 없이 링크만 저장하도록 수정해줘.</textarea>
          </div>
          <button onclick="getCodeRecommendation()">코드 추천 받기</button>
          <button class="refresh-btn" onclick="refreshVectorStore()">벡터 저장소 갱신</button>
          <p><small>참고: Target 디렉토리에 코드 파일을 추가/수정한 후 '벡터 저장소 갱신' 버튼을 클릭하세요.</small></p>
          
          <div class="settings-panel">
            <h3>고급 설정 <button class="toggle-btn" onclick="toggleSettings()">▲</button></h3>
            <div id="advanced-settings">
              <div class="settings-group">
                <h4>텍스트 분할 설정</h4>
                <div class="setting-item">
                  <label for="chunkSize">청크 사이즈:</label>
                  <input type="number" id="chunkSize" min="100" max="5000" value="1000" class="setting-input">
                </div>
                <div class="setting-item">
                  <label for="chunkOverlap">오버랩 크기:</label>
                  <input type="number" id="chunkOverlap" min="0" max="1000" value="200" class="setting-input">
                </div>
              </div>
              <div class="settings-group">
                <h4>검색 설정</h4>
                <div class="setting-item">
                  <label for="maxResults">검색 결과 수:</label>
                  <input type="number" id="maxResults" min="1" max="20" value="5" class="setting-input">
                </div>
              </div>
            </div>
          </div>
          
          <div class="model-status-panel">
            <h3>모델 상태</h3>
            <div id="model-status" class="model-status">
              <div class="model-status-item">
                <div class="status-dot" id="status-gpt-4o"></div>
                <span>GPT-4o</span>
              </div>
              <div class="model-status-item">
                <div class="status-dot" id="status-gpt-o3-mini"></div>
                <span>GPT-o3-mini</span>
              </div>
              <div class="model-status-item">
                <div class="status-dot" id="status-gpt-o1"></div>
                <span class="disabled-model-text">GPT-o1</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="right-panel">
          <h2>코드 추천 결과</h2>
          <div id="recommendation-tabs" class="tab-container">
            <div class="tab-nav">
              <button class="tab-btn active" data-tab="gpt-4o">GPT-4o</button>
              <button class="tab-btn" data-tab="gpt-o3-mini">GPT-o3-mini</button>
              <button class="tab-btn" data-tab="gpt-o1">GPT-o1</button>
            </div>
            <div id="tab-gpt-4o" class="tab-content active markdown">
              <div class="loading" style="display: none;">
                <div class="loading-spinner"></div>
                <p>GPT-4o 모델로 코드 추천 생성 중...</p>
              </div>
              <div class="content">여기에 GPT-4o 코드 추천이 표시됩니다...</div>
            </div>
            <div id="tab-gpt-o3-mini" class="tab-content markdown">
              <div class="loading" style="display: none;">
                <div class="loading-spinner"></div>
                <p>GPT-o3-mini 모델로 코드 추천 생성 중...</p>
              </div>
              <div class="content">여기에 GPT-o3-mini 코드 추천이 표시됩니다...</div>
            </div>
            <div id="tab-gpt-o1" class="tab-content markdown">
              <div class="loading" style="display: none;">
                <div class="loading-spinner"></div>
                <p>GPT-o1 모델로 코드 추천 생성 중...</p>
              </div>
              <div class="content">여기에 GPT-o1 코드 추천이 표시됩니다...</div>
            </div>
          </div>
          
          <h3>관련 파일</h3>
          <div id="relevantFiles">관련 파일이 여기에 표시됩니다...</div>
        </div>
      </div>
      
      <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/highlight.min.js"></script>
      <script>
        // highlight.js가 로드되면 초기화
        document.addEventListener('DOMContentLoaded', function() {
          if (typeof hljs !== 'undefined') {
            hljs.configure({
              languages: ['javascript', 'python', 'java', 'c', 'cpp', 'csharp', 'go', 'ruby', 'diff']
            });
            hljs.highlightAll();
          } else {
            console.warn('highlight.js가 로드되지 않았습니다.');
          }
          
          // 탭 버튼에 클릭 이벤트 추가
          document.querySelectorAll('.tab-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
              // 모든 탭 버튼에서 active 클래스 제거
              document.querySelectorAll('.tab-btn').forEach(function(b) {
                b.classList.remove('active');
              });
              
              // 모든 탭 컨텐츠에서 active 클래스 제거
              document.querySelectorAll('.tab-content').forEach(function(content) {
                content.classList.remove('active');
              });
              
              // 클릭한 버튼에 active 클래스 추가
              this.classList.add('active');
              
              // 해당 탭 컨텐츠에 active 클래스 추가
              const tabId = this.getAttribute('data-tab');
              document.getElementById('tab-' + tabId).classList.add('active');
            });
          });
          
          // 고급 설정 패널의 초기 상태를 설정
          initSettingsPanel();
        });
        
        // 고급 설정 패널 초기화
        function initSettingsPanel() {
          // 이전에 저장된 설정이 있으면 로드
          const savedChunkSize = localStorage.getItem('chunkSize');
          const savedChunkOverlap = localStorage.getItem('chunkOverlap');
          const savedMaxResults = localStorage.getItem('maxResults');
          
          // 저장된 값이 있으면 적용, 없으면 기본값 사용
          document.getElementById('chunkSize').value = savedChunkSize || 1000;
          document.getElementById('chunkOverlap').value = savedChunkOverlap || 200;
          document.getElementById('maxResults').value = savedMaxResults || 5;
          
          // 패널을 기본적으로 표시
          document.getElementById('advanced-settings').style.display = 'block';
          document.querySelector('.toggle-btn').textContent = '▲';
          
          // 초기 모델 상태 설정 - 비활성화된 모델 표시
          initModelStatus();
        }
        
        // 초기 모델 상태 설정
        function initModelStatus() {
          // GPT-o1이 비활성화된 상태로 표시
          updateModelStatus('gpt-o1', 'disabled');
        }
        
        // 고급 설정 토글 함수
        function toggleSettings() {
          const settingsPanel = document.getElementById('advanced-settings');
          const toggleBtn = document.querySelector('.toggle-btn');
          
          // 현재 표시 상태 확인 (getComputedStyle을 사용하여 실제 렌더링된 상태 확인)
          const isVisible = window.getComputedStyle(settingsPanel).display !== 'none';
          
          if (isVisible) {
            // 현재 보이는 상태면 숨김
            settingsPanel.style.display = 'none';
            toggleBtn.textContent = '▼';
          } else {
            // 현재 숨겨진 상태면 표시
            settingsPanel.style.display = 'block';
            toggleBtn.textContent = '▲';
          }
        }
        
        // 현재 설정 값을 로컬 스토리지에 저장하고 가져오는 함수
        function saveSettings() {
          const chunkSize = document.getElementById('chunkSize').value;
          const chunkOverlap = document.getElementById('chunkOverlap').value;
          const maxResults = document.getElementById('maxResults').value;
          
          localStorage.setItem('chunkSize', chunkSize);
          localStorage.setItem('chunkOverlap', chunkOverlap);
          localStorage.setItem('maxResults', maxResults);
          
          return {
            chunkSize: parseInt(chunkSize),
            chunkOverlap: parseInt(chunkOverlap),
            maxResults: parseInt(maxResults)
          };
        }
        
        // 마크다운 설정
        marked.setOptions({
          highlight: function(code, lang) {
            // highlight.js가 로드되었는지 확인
            if (typeof hljs !== 'undefined') {
              try {
                if (lang && hljs.getLanguage(lang)) {
                  return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
              } catch (e) {
                console.error('구문 강조 중 오류:', e);
                return code;
              }
            }
            // highlight.js가 없으면 일반 코드 반환
            return code;
          },
          gfm: true,
          breaks: true,
          sanitize: false,
          smartypants: true
        });
        
        // 모델 상태 업데이트 함수
        function updateModelStatus(modelName, status) {
          const statusElement = document.getElementById('status-' + modelName);
          if (statusElement) {
            statusElement.className = 'status-dot';
            if (status === 'pending') {
              statusElement.classList.add('status-pending');
            } else if (status === 'completed') {
              statusElement.classList.add('status-completed');
            } else if (status === 'error') {
              statusElement.classList.add('status-error');
            } else if (status === 'disabled') {
              statusElement.classList.add('status-disabled');
            }
          }
        }
        
        // 모든 모델 상태 초기화
        function resetAllModelStatus() {
          updateModelStatus('gpt-4o', 'pending');
          updateModelStatus('gpt-o3-mini', 'pending');
          // 비활성화된 모델은 상태 유지
          updateModelStatus('gpt-o1', 'disabled');
        }
        
        async function getCodeRecommendation() {
          const request = document.getElementById('request').value;
          const relevantFilesDiv = document.getElementById('relevantFiles');
          
          if (!request) {
            alert('기능 요청을 입력해주세요.');
            return;
          }
          
          // 사용자 설정 저장
          const settings = saveSettings();
          
          // 모델 상태 표시 초기화
          resetAllModelStatus();
          
          // 각 모델 탭 로딩 상태로 변경
          ['gpt-4o', 'gpt-o3-mini', 'gpt-o1'].forEach(modelName => {
            const tabContent = document.getElementById('tab-' + modelName);
            const loadingDiv = tabContent.querySelector('.loading');
            const contentDiv = tabContent.querySelector('.content');
            
            loadingDiv.style.display = 'block';
            contentDiv.style.display = 'none';
            contentDiv.innerHTML = '';
          });
          
          relevantFilesDiv.textContent = '관련 파일을 검색 중...';
          
          try {
            const response = await fetch('/api/recommend-code', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                request,
                maxResults: settings.maxResults // 검색 결과 수 설정 전달
              }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
              // 각 모델별 결과 처리
              data.modelResults.forEach(result => {
                const modelName = result.modelName;
                const tabContent = document.getElementById('tab-' + modelName);
                const loadingDiv = tabContent.querySelector('.loading');
                const contentDiv = tabContent.querySelector('.content');
                
                loadingDiv.style.display = 'none';
                contentDiv.style.display = 'block';
                
                if (result.error) {
                  contentDiv.innerHTML = '<div class="error">오류: ' + result.recommendation + '</div>';
                  updateModelStatus(modelName, 'error');
                } else if (result.disabled) {
                  contentDiv.innerHTML = '<div class="disabled-model">' + result.recommendation + '</div>';
                  updateModelStatus(modelName, 'disabled');
                } else {
                  // 마크다운 렌더링
                  contentDiv.innerHTML = marked.parse(result.recommendation);
                  updateModelStatus(modelName, 'completed');
                  
                  // 현재 시간 표시
                  const timeDiv = document.createElement('div');
                  timeDiv.className = 'model-time';
                  timeDiv.textContent = '생성 시간: ' + new Date().toLocaleTimeString();
                  contentDiv.appendChild(timeDiv);
                  
                  // 코드 구문 강조 적용 (highlight.js가 로드되었는지 확인)
                  setTimeout(function() {
                    if (typeof hljs !== 'undefined') {
                      try {
                        tabContent.querySelectorAll('pre code').forEach(function(block) {
                          hljs.highlightElement(block);
                        });
                      } catch (e) {
                        console.error('코드 강조 적용 중 오류:', e);
                      }
                    }
                  }, 100);
                }
              });
              
              // 관련 파일 표시
              if (data.relevantFiles && data.relevantFiles.length > 0) {
                let filesHtml = '<div class="file-list">';
                for (let i = 0; i < data.relevantFiles.length; i++) {
                  filesHtml += '<div class="file-item">' + data.relevantFiles[i] + '</div>';
                }
                filesHtml += '</div>';
                
                // 상세 정보 표시
                if (data.relevantFilesDetails && data.relevantFilesDetails.length > 0) {
                  filesHtml += '<div class="file-details"><h4>관련 코드 청크 상세 정보</h4>';
                  
                  // 유사도 점수에 따라 정렬
                  const sortedDetails = [...data.relevantFilesDetails].sort((a, b) => b.score - a.score);
                  
                  for (let i = 0; i < sortedDetails.length; i++) {
                    const detail = sortedDetails[i];
                    filesHtml += '<div class="file-detail-item">' +
                      '<div class="file-detail-header">' +
                      '<span>' + detail.path + ' (청크 ' + detail.chunk + '/' + detail.totalChunks + ')</span>' +
                      '<span class="file-score">유사도: ' + detail.score + '</span>' +
                      '</div>' +
                      '<div class="file-preview">' + detail.preview + '</div>' +
                      '</div>';
                  }
                  
                  filesHtml += '</div>';
                }
                
                relevantFilesDiv.innerHTML = filesHtml;
              } else {
                relevantFilesDiv.textContent = '관련 파일이 없습니다.';
              }
            } else {
              // 모든 모델 탭에 에러 표시
              ['gpt-4o', 'gpt-o3-mini', 'gpt-o1'].forEach(modelName => {
                const tabContent = document.getElementById('tab-' + modelName);
                const loadingDiv = tabContent.querySelector('.loading');
                const contentDiv = tabContent.querySelector('.content');
                
                loadingDiv.style.display = 'none';
                contentDiv.style.display = 'block';
                contentDiv.innerHTML = '<div class="error">오류: ' + data.error + '</div>';
                updateModelStatus(modelName, 'error');
              });
              
              relevantFilesDiv.textContent = '오류가 발생했습니다.';
            }
          } catch (error) {
            // 모든 모델 탭에 에러 표시
            ['gpt-4o', 'gpt-o3-mini', 'gpt-o1'].forEach(modelName => {
              const tabContent = document.getElementById('tab-' + modelName);
              const loadingDiv = tabContent.querySelector('.loading');
              const contentDiv = tabContent.querySelector('.content');
              
              loadingDiv.style.display = 'none';
              contentDiv.style.display = 'block';
              contentDiv.innerHTML = '<div class="error">네트워크 오류가 발생했습니다.</div>';
              updateModelStatus(modelName, 'error');
            });
            
            relevantFilesDiv.textContent = '오류가 발생했습니다.';
            console.error(error);
          }
        }
        
        async function refreshVectorStore() {
          // 사용자 설정 저장
          const settings = saveSettings();
          
          const recommendationTabs = document.getElementById('recommendation-tabs');
          const firstTabContent = recommendationTabs.querySelector('.tab-content.active .content');
          firstTabContent.textContent = '벡터 저장소 갱신 중...';
          
          try {
            const response = await fetch('/api/refresh-vector-store', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                chunkSize: settings.chunkSize,
                chunkOverlap: settings.chunkOverlap
              }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
              firstTabContent.textContent = '✅ ' + data.message;
            } else {
              firstTabContent.textContent = '❌ 오류: ' + data.message;
            }
          } catch (error) {
            firstTabContent.textContent = '❌ 벡터 저장소 갱신 중 네트워크 오류가 발생했습니다.';
            console.error(error);
          }
        }
      </script>
    </body>
    </html>
  `);
});

// =========================================================================
// 서버 시작 및 초기화
// =========================================================================

// 서버 시작 함수
async function startServer() {
  try {
    // 애플리케이션 시작 시 벡터 저장소 초기화
    console.log("🔄 애플리케이션 시작 시 벡터 저장소 초기화 중...");
    vectorStore = await getVectorStore();

    // Target 디렉토리가 없으면 생성
    try {
      await fs.mkdir(TARGET_CODE_DIR, { recursive: true });
      console.log(`📁 ${TARGET_CODE_DIR} 디렉토리가 생성되었습니다.`);
    } catch (error) {
      // 이미 디렉토리가 존재하면 무시
      if (error.code !== "EEXIST") {
        console.error(`❌ ${TARGET_CODE_DIR} 디렉토리 생성 중 오류:`, error);
      }
    }

    // 서버 시작
    app.listen(PORT, () => {
      console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
      console.log(
        `💻 웹 브라우저에서 http://localhost:${PORT}/ 를 열어 앱을 사용해보세요.`
      );
      console.log(
        `📂 소스 코드를 ${TARGET_CODE_DIR} 디렉토리에 넣고 벡터 저장소를 갱신해보세요.`
      );
    });
  } catch (error) {
    console.error("❌ 서버 시작 중 오류 발생:", error);
    process.exit(1);
  }
}

// 서버 시작
startServer();
