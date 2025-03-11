// =========================================================================
// LangChain 기반 코드 생성 추천기
// =========================================================================
// LangChain: 대규모 언어 모델(LLM)을 활용한 애플리케이션 개발을 위한 프레임워크
// RAG(Retrieval Augmented Generation): 외부 데이터를 검색하여 LLM의 응답을 강화하는 기법
// =========================================================================

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
const { PromptTemplate } = require("langchain/prompts"); // 프롬프트 템플릿 (LLM에게 지시하는 형식)
const { RunnableSequence } = require("langchain/schema/runnable"); // 실행 가능한 컴포넌트 연결
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter"); // 텍스트를 청크로 분할
const { MemoryVectorStore } = require("langchain/vectorstores/memory"); // 메모리 기반 벡터 저장소
const { OpenAIEmbeddings } = require("langchain/embeddings/openai"); // OpenAI 임베딩 모델

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

// OpenAI 모델 초기화 - ChatGPT를 사용하여 실제 응답 생성
const llm = new ChatOpenAI({
  openAIApiKey: apiKey,
  modelName: "gpt-3.5-turbo", // 또는 'gpt-4' 등 다른 모델 사용 가능
  temperature: 0.7, // 0에 가까울수록 결정적, 1에 가까울수록 창의적 응답
});

// OpenAI 임베딩 모델 초기화 - 텍스트를 벡터로 변환
// 임베딩: 텍스트를 수치 벡터로 변환하여 의미적 유사성을 계산 가능하게 함
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: apiKey,
});

// 텍스트 분할기 초기화 - 큰 텍스트를 작은 청크로 나눔
// 이는 임베딩 모델의 토큰 제한을 고려하고 더 정확한 검색을 위함
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000, // 각 청크의 최대 문자 수
  chunkOverlap: 200, // 청크 간 중복되는 문자 수 (문맥 유지를 위함)
});

// Target 소스 코드 디렉토리 경로
const TARGET_CODE_DIR = "./Target";

// =========================================================================
// 소스 코드 로딩 및 벡터 저장소 생성 함수
// =========================================================================

/**
 * Target 디렉토리에서 소스 코드 파일을 로드하고 벡터 저장소를 생성/업데이트
 */
async function loadSourceCodeAndCreateVectorStore() {
  try {
    console.log("🔍 Target 디렉토리에서 소스 코드 파일 검색 중...");

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

코드 변경 내용은 가능한 한 diff 형식으로 표시해주세요. 예시:

\`\`\`diff
- // 삭제될 코드
+ // 추가될 코드
\`\`\`

각 섹션을 마크다운 헤딩(##)으로 구분하고, 전체 응답이 마크다운으로 쉽게 파싱될 수 있도록 해주세요.
`,
  inputVariables: ["relevantCode", "userRequest"],
});

// =========================================================================
// API 라우트 설정
// =========================================================================

// 벡터 저장소 갱신 엔드포인트
app.post("/api/refresh-vector-store", async (req, res) => {
  try {
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
    const { request } = req.body;

    if (!request) {
      return res.status(400).json({ error: "요청 내용이 비어있습니다." });
    }

    console.log(`💬 사용자 요청: ${request}`);

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
      5
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

    // RunnableSequence를 사용하여 프롬프트와 LLM을 연결
    // RunnableSequence: 여러 컴포넌트를 연결하여 순차적으로 실행하는 객체
    const chain = RunnableSequence.from([codeRecommendationPrompt, llm]);

    console.log("🤖 코드 추천 생성 중...");

    // 체인 실행하여 추천 생성
    const response = await chain.invoke({
      relevantCode,
      userRequest: request,
    });

    console.log("✅ 코드 추천 생성 완료");

    // LLM 응답에서 마크다운 형식의 텍스트 추출
    const recommendation = response.content;

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
      recommendation,
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
          max-width: 1000px;
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
        .left-panel,
        .right-panel {
          flex: 1;
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
        #recommendation,
        #relevantFiles {
          margin-top: 20px;
          padding: 15px;
          background-color: #f9f9f9;
          border-radius: 4px;
          overflow: auto;
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
        
        /* Diff 스타일 */
        .hljs-addition {
          background-color: #e6ffed;
          color: #22863a;
        }
        .hljs-deletion {
          background-color: #ffeef0;
          color: #cb2431;
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
      </style>
    </head>
    <body>
      <h1>LangChain 코드 생성 추천기</h1>
      <p>이 애플리케이션은 LangChain, 벡터 저장소, RAG를 활용하여 소스 코드 기반으로 코드 수정 추천을 제공합니다.</p>
      
      <div class="container">
        <div class="left-panel">
          <div class="form-group">
            <label for="request">기능 요청 (구현하고 싶은 기능을 자세히 설명해주세요):</label>
            <textarea id="request" placeholder="예: '사용자 인증 기능을 추가하고 싶습니다...'"></textarea>
          </div>
          <button onclick="getCodeRecommendation()">코드 추천 받기</button>
          <button class="refresh-btn" onclick="refreshVectorStore()">벡터 저장소 갱신</button>
          <p><small>참고: Target 디렉토리에 코드 파일을 추가/수정한 후 '벡터 저장소 갱신' 버튼을 클릭하세요.</small></p>
        </div>
        
        <div class="right-panel">
          <h2>코드 추천 결과</h2>
          <div id="recommendation" class="markdown">여기에 코드 추천이 표시됩니다...</div>
          
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
        });
        
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
        
        async function getCodeRecommendation() {
          const request = document.getElementById('request').value;
          const recommendationDiv = document.getElementById('recommendation');
          const relevantFilesDiv = document.getElementById('relevantFiles');
          
          if (!request) {
            alert('기능 요청을 입력해주세요.');
            return;
          }
          
          recommendationDiv.textContent = '코드 추천을 불러오는 중...';
          relevantFilesDiv.textContent = '관련 파일을 검색 중...';
          
          try {
            const response = await fetch('/api/recommend-code', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ request }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
              // 마크다운 렌더링
              recommendationDiv.innerHTML = marked.parse(data.recommendation);
              
              // 코드 구문 강조 적용 (highlight.js가 로드되었는지 확인)
              setTimeout(function() {
                if (typeof hljs !== 'undefined') {
                  try {
                    document.querySelectorAll('#recommendation pre code').forEach(function(block) {
                      hljs.highlightElement(block);
                    });
                  } catch (e) {
                    console.error('코드 강조 적용 중 오류:', e);
                  }
                }
              }, 100); // 약간의 딜레이를 두어 DOM이 업데이트된 후 적용
              
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
              recommendationDiv.textContent = '오류: ' + data.error;
              relevantFilesDiv.textContent = '오류가 발생했습니다.';
            }
          } catch (error) {
            recommendationDiv.textContent = '네트워크 오류가 발생했습니다.';
            relevantFilesDiv.textContent = '오류가 발생했습니다.';
            console.error(error);
          }
        }
        
        async function refreshVectorStore() {
          const recommendationDiv = document.getElementById('recommendation');
          recommendationDiv.textContent = '벡터 저장소 갱신 중...';
          
          try {
            const response = await fetch('/api/refresh-vector-store', {
              method: 'POST',
            });
            
            const data = await response.json();
            
            if (response.ok) {
              recommendationDiv.textContent = '✅ ' + data.message;
            } else {
              recommendationDiv.textContent = '❌ 오류: ' + data.message;
            }
          } catch (error) {
            recommendationDiv.textContent = '❌ 벡터 저장소 갱신 중 네트워크 오류가 발생했습니다.';
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
