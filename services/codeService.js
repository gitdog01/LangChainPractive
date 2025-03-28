const { searchAndGenerate } = require("../services/vectorStoreService");
const {
  vectorizeRepository,
  commitFileChanges,
} = require("../utils/githubUtils");
const { PromptTemplate } = require("@langchain/core/prompts");
const { ChatOpenAI } = require("@langchain/openai");
const { RunnableSequence } = require("@langchain/core/runnables");
const config = require("../config/config");

// OpenAI 모델 초기화
const models = {
  "gpt-4o": new ChatOpenAI({
    openAIApiKey: config.openai.apiKey,
    modelName: "gpt-4o",
    temperature: 0.1,
  }),
  "gpt-o3-mini": new ChatOpenAI({
    openAIApiKey: config.openai.apiKey,
    modelName: "o3-mini-2025-01-31",
  }),
  "gpt-o1": new ChatOpenAI({
    openAIApiKey: config.openai.apiKey,
    modelName: "o1-2024-12-17",
  }),
};

// 모델 사용 여부를 제어하는 플래그
const MODEL_CONFIG = {
  "gpt-4o": { enabled: true },
  "gpt-o3-mini": { enabled: true },
  "gpt-o1": { enabled: false },
};

// 코드 추천 체인 설정
const createRecommendationChain = (model) =>
  RunnableSequence.from([
    // 1단계: 입력 데이터 준비
    (input) => {
      // 소스 코드 컨텍스트 준비
      const context = input.sources
        .map((src) => `파일: ${src.source}\n\n${src.content}`)
        .join("\n\n---\n\n");

      return {
        context,
        request: input.request,
      };
    },
    // 2단계: 프롬프트 구성
    (formattedInput) => {
      return `
다음은 GitHub 저장소에서 추출한 코드 조각들입니다:

${formattedInput.context}

사용자 요청: ${formattedInput.request}

위 코드를 분석하여 사용자의 요청을 구현하기 위한 최적의 방법을 추천해주세요.
어떤 파일들을 수정해야 하고, 어떤 코드를 추가, 수정 또는 삭제해야 하는지 정확하게 설명해주세요.

코드 변경 사항은 반드시 다음과 같은 형식으로 제시해주세요:

1. diff 형식을 사용하여 변경 사항을 명확히 표시하세요.
2. 수정할 파일 경로를 정확히 명시하고, 가능한 파일의 원본 라인 번호를 표시하세요.
3. 코드 블록 시작 시 파일 경로와 라인 범위를 다음 형식으로 명시하세요: "파일명.확장자 (lines X-Y)"
4. diff 헤더에 원본 파일의 라인 번호를 정확히 포함해주세요. (@@ -원본라인번호,줄수 +신규라인번호,줄수 @@)

예시:
\`\`\`diff
app.js (lines 10-20)
@@ -10,6 +10,7 @@
 const express = require('express');
 const app = express();
 
+const cors = require('cors');
 app.use(express.json());
 app.use(express.urlencoded({ extended: true }));
\`\`\`

청크로 분할된 코드를 원본 파일의 실제 라인 번호와 맞추는 것이 중요합니다.
변경하는 코드의 정확한 위치를 원본 파일 기준으로 명시해주세요.
`;
    },
    // 3단계: LLM 호출
    model,
    // 4단계: 응답 추출
    (response) => response.content,
  ]);

// 코드 추천 서비스
async function getCodeRecommendation(userId, request, maxResults, repository) {
  try {
    console.log("코드 추천 요청 시작:", {
      userId,
      request,
      maxResults,
      repository,
    });

    // RAG 기반 검색 및 응답 생성
    const result = await searchAndGenerate(
      userId,
      request,
      repository,
      maxResults
    );

    // 여기 좀 다른 방법으로 수정해야함
    if (!result) {
      return {
        modelResults: [
          {
            modelName: "gpt-4o",
            recommendation:
              "관련 코드를 찾을 수 없어 추천을 생성할 수 없습니다.",
            error: true,
          },
        ],
        relevantFiles: [],
        relevantFilesDetails: [],
      };
    }

    // 프론트엔드 형식에 맞게 데이터 추출
    const relevantFiles = result.relevantFiles || [];
    const relevantFilesDetails = result.relevantFilesDetails || [];

    // 활성화된 모든 모델의 결과를 담을 배열
    const modelResults = [];

    // 활성화된 모든 모델에 대해 코드 추천 생성
    const enabledModels = Object.entries(MODEL_CONFIG)
      .filter(([_, config]) => config.enabled)
      .map(([modelName]) => modelName);

    for (const modelName of enabledModels) {
      try {
        // 모델별 코드 추천 체인 생성
        const modelChain = createRecommendationChain(models[modelName]);

        // 모델별 코드 추천 생성
        const modelResponse = await modelChain.invoke({
          sources: result.sources,
          request: request,
        });

        // 결과 추가
        modelResults.push({
          modelName,
          recommendation: modelResponse,
          error: false,
        });
      } catch (modelError) {
        console.error(`${modelName} 모델 처리 중 오류:`, modelError);
        modelResults.push({
          modelName,
          recommendation: `${modelName} 모델 처리 중 오류가 발생했습니다: ${modelError.message}`,
          error: true,
        });
      }
    }

    // 최종 응답 형식화
    return {
      modelResults,
      relevantFiles,
      relevantFilesDetails,
    };
  } catch (error) {
    console.error("코드 추천 생성 중 오류:", error);
    throw error;
  }
}

// 벡터 저장소 갱신 서비스
async function refreshVectorStore(userId, chunkSize, chunkOverlap, repository) {
  try {
    const [owner, repo] = repository.split("/");

    // 액세스 토큰 가져오기 (이 함수는 필요에 따라 구현해야 합니다)
    const accessToken = process.env.GITHUB_ACCESS_TOKEN || null;

    const result = await vectorizeRepository(
      userId,
      owner,
      repo,
      accessToken,
      chunkSize || config.chunk.size,
      chunkOverlap || config.chunk.overlap
    );

    return {
      success: true,
      message: `벡터 저장소가 성공적으로 갱신되었습니다. ${result.documentCount}개의 문서가 처리되었습니다.`,
      details: result,
    };
  } catch (error) {
    console.error("벡터 저장소 갱신 중 오류:", error);
    throw error;
  }
}

// diff 형식의 코드를 실제 변경사항으로 변환하는 함수
function parseDiffToChanges(diffText) {
  const changes = [];
  const fileChanges = diffText.split(/```diff/).filter(Boolean);

  for (const fileChange of fileChanges) {
    try {
      // 파일 경로와 라인 범위 추출
      const fileMatch = fileChange.match(/^(.+?)\s+\(lines\s+(\d+)-(\d+)\)/);
      if (!fileMatch) {
        console.log("파일 경로와 라인 범위를 찾을 수 없습니다:", fileChange);
        continue;
      }

      const filePath = fileMatch[1].trim();
      const startLine = parseInt(fileMatch[2]);
      const endLine = parseInt(fileMatch[3]);

      // diff 헤더에서 원본 라인 정보 추출
      const headerMatch = fileChange.match(/@@ -(\d+),\d+ \+(\d+),\d+ @@/);
      if (!headerMatch) {
        console.log("diff 헤더를 찾을 수 없습니다:", fileChange);
        continue;
      }

      const originalStartLine = parseInt(headerMatch[1]);
      const newStartLine = parseInt(headerMatch[2]);

      // 변경된 내용 추출
      const lines = fileChange.split("\n");
      let content = "";
      let currentLine = newStartLine;
      let inHunk = false;

      for (const line of lines) {
        if (line.startsWith("@@")) continue;
        if (line.startsWith("+")) {
          content += line.substring(1) + "\n";
          currentLine++;
        } else if (line.startsWith("-")) {
          // 삭제된 라인은 무시
          currentLine++;
        } else if (line.startsWith(" ")) {
          content += line.substring(1) + "\n";
          currentLine++;
        }
      }

      if (content.trim()) {
        changes.push({
          filePath,
          content: content.trim(),
          originalContent: null,
        });
      } else {
        console.log("변경된 내용이 없습니다:", filePath);
      }
    } catch (error) {
      console.error("파일 변경사항 파싱 중 오류:", error);
      continue;
    }
  }

  if (changes.length === 0) {
    console.log("유효한 변경사항을 찾을 수 없습니다. diff 텍스트:", diffText);
  }

  return changes;
}

// 코드 추천 결과를 실제 변경사항으로 적용하는 함수
async function applyCodeRecommendation(
  userId,
  repository,
  recommendation,
  accessToken
) {
  try {
    console.log("코드 추천 적용 시작:", { userId, repository });

    // diff 형식의 코드를 실제 변경사항으로 변환
    const changes = parseDiffToChanges(recommendation);

    if (changes.length === 0) {
      throw new Error(
        "유효한 변경사항을 찾을 수 없습니다. diff 형식이 올바른지 확인해주세요."
      );
    }

    // 저장소 정보 분리
    const [owner, repo] = repository.split("/");

    // 변경사항 커밋
    const commitMessage = "AI 코드 추천에 따른 자동 변경사항 적용";
    const result = await commitFileChanges(
      owner,
      repo,
      accessToken,
      changes,
      commitMessage
    );

    return {
      success: true,
      message: result.message,
      changes: changes.map((change) => change.filePath),
    };
  } catch (error) {
    console.error("코드 추천 적용 중 오류:", error);
    throw error;
  }
}

module.exports = {
  getCodeRecommendation,
  refreshVectorStore,
  applyCodeRecommendation,
  models,
  MODEL_CONFIG,
};
