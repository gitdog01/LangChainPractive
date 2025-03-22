const express = require("express");
const router = express.Router();
const {
  getCodeRecommendation,
  refreshVectorStore,
} = require("../services/codeService");
const { authenticateUser } = require("../middleware/auth");
const { vectorizeRepository } = require("../utils/githubUtils");
const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence } = require("@langchain/core/runnables");
const config = require("../config/config");

// OpenAI 모델 초기화
const models = {
  "gpt-4o": new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0.1,
  }),
  "gpt-o3-mini": new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "o3-mini-2025-01-31",
  }),
  "gpt-o1": new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "o1-2024-12-17",
  }),
};

// 모델 사용 여부를 제어하는 플래그
const MODEL_CONFIG = {
  "gpt-4o": { enabled: true },
  "gpt-o3-mini": { enabled: true },
  "gpt-o1": { enabled: false },
};

// 코드 추천 프롬프트 템플릿
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

// 코드 추천 API
router.post("/recommend-code", authenticateUser, async (req, res) => {
  try {
    const { request, maxResults, repository } = req.body;

    if (!request || !repository) {
      return res.status(400).json({
        modelResults: [
          {
            modelName: "gpt-4o",
            recommendation: "요청 내용과 저장소가 필요합니다.",
            error: true,
          },
        ],
        error: "요청 내용과 저장소가 필요합니다.",
      });
    }

    // 저장소 이름에서 owner와 repo 추출
    const [owner, repo] = repository.split("/");

    try {
      // 코드 추천 서비스 호출
      const result = await getCodeRecommendation(
        req.user.id,
        request,
        maxResults || config.chunk.maxResults,
        repository
      );

      // 결과가 에러인 경우 처리
      if (result.error) {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (error) {
      if (error.message === "관련 문서를 찾을 수 없습니다.") {
        console.log(
          "벡터 저장소에서 관련 문서를 찾을 수 없습니다. 저장소를 새로 벡터화합니다..."
        );

        try {
          // 벡터 저장소 자동 생성
          await vectorizeRepository(
            req.user.id,
            owner,
            repo,
            req.user.accessToken,
            config.chunk.size,
            config.chunk.overlap
          );

          // 벡터 저장소 생성 후 다시 코드 추천 시도
          const result = await getCodeRecommendation(
            req.user.id,
            request,
            maxResults || config.chunk.maxResults,
            repository
          );

          res.json(result);
        } catch (vectorizeError) {
          console.error("저장소 벡터화 중 오류:", vectorizeError);
          return res.status(500).json({
            modelResults: [
              {
                modelName: "gpt-4o",
                recommendation:
                  "저장소 벡터화 중 오류가 발생했습니다. 다시 시도해주세요.",
                error: true,
              },
            ],
            error: vectorizeError.message,
          });
        }
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("코드 추천 중 오류 발생:", error);
    res.status(500).json({
      modelResults: [
        {
          modelName: "gpt-4o",
          recommendation: "코드 추천을 생성하는 중 오류가 발생했습니다.",
          error: true,
        },
      ],
      error: error.message || "코드 추천을 생성하는 중 오류가 발생했습니다.",
    });
  }
});

// 벡터 저장소 갱신 API
router.post("/refresh-vector-store", authenticateUser, async (req, res) => {
  try {
    const { chunkSize, chunkOverlap, repository } = req.body;

    if (!repository) {
      return res.status(400).json({
        success: false,
        message: "저장소 정보가 필요합니다.",
      });
    }

    const result = await refreshVectorStore(
      req.user.id,
      chunkSize || config.chunk.size,
      chunkOverlap || config.chunk.overlap,
      repository
    );

    res.json(result);
  } catch (error) {
    console.error("벡터 저장소 갱신 중 오류:", error);
    res.status(500).json({
      success: false,
      message: "벡터 저장소 갱신 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
});

module.exports = router;
