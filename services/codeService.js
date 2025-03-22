const { searchAndGenerate } = require("../services/vectorStoreService");
const { vectorizeRepository } = require("../utils/githubUtils");
const { PromptTemplate } = require("@langchain/core/prompts");
const { ChatOpenAI } = require("@langchain/openai");
const { RunnableSequence } = require("@langchain/core/runnables");
const config = require("../config/config");

// OpenAI 모델 초기화
const codeModel = new ChatOpenAI({
  openAIApiKey: config.openai.apiKey,
  modelName: "gpt-4o",
  temperature: 0.1,
});

// 코드 추천 프롬프트 템플릿
const codeRecommendationPrompt = new PromptTemplate({
  template: `
당신은 코드 추천을 제공하는 전문가입니다. 다음 컨텍스트를 바탕으로 사용자의 요청에 대한 코드 추천을 제공해주세요.

컨텍스트:
{context}

사용자 요청:
{request}

다음 형식으로 응답해주세요:

## 코드 추천
{recommendation}

## 관련 파일
{relevantFiles}

## 변경 사항 설명
{explanation}

## 코드 변경
\`\`\`diff
{codeChanges}
\`\`\`

## 구현 시 주의사항
{notes}
`,
  inputVariables: [
    "context",
    "request",
    "recommendation",
    "relevantFiles",
    "explanation",
    "codeChanges",
    "notes",
  ],
});

// 코드 추천 체인 설정
const codeRecommendationChain = RunnableSequence.from([
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
가능하면 diff 형식으로 코드 변경 사항을 보여주세요.
`;
  },
  // 3단계: LLM 호출
  codeModel,
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

    if (!result || !result.answer) {
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

    // RunnableSequence를 사용하여 코드 추천 생성
    const enhancedResponse = await codeRecommendationChain.invoke({
      sources: result.sources,
      request: request,
    });

    // 최종 응답 형식화
    return {
      modelResults: [
        {
          modelName: "gpt-4o",
          recommendation: enhancedResponse,
          error: false,
        },
      ],
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

module.exports = {
  getCodeRecommendation,
  refreshVectorStore,
};
