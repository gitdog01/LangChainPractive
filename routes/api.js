const express = require("express");
const router = express.Router();
const {
  getCodeRecommendation,
  refreshVectorStore,
  applyCodeRecommendation,
} = require("../services/codeService");
const { authenticateUser } = require("../middleware/auth");
const { vectorizeRepository } = require("../utils/githubUtils");
const config = require("../config/config");
const Vector = require("../models/VectorStore");

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

// 저장소의 벡터 데이터 존재 여부 확인 API
router.post("/check-vectors", authenticateUser, async (req, res) => {
  try {
    const { repositories } = req.body;

    if (!repositories || !Array.isArray(repositories)) {
      return res.status(400).json({
        success: false,
        message: "유효한 저장소 목록이 필요합니다.",
      });
    }

    const results = await Promise.all(
      repositories.map(async (repo) => {
        // 해당 저장소의 벡터 데이터가 있는지 확인
        const count = await Vector.countDocuments({
          userId: req.user.id,
          repository: repo,
        });

        return {
          repository: repo,
          hasVectors: count > 0,
        };
      })
    );

    res.json({
      success: true,
      repositories: results,
    });
  } catch (error) {
    console.error("벡터 데이터 확인 중 오류:", error);
    res.status(500).json({
      success: false,
      message: "벡터 데이터 확인 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
});

// 벡터 저장소 연동 해제 API
router.post("/disconnect-vector-store", authenticateUser, async (req, res) => {
  try {
    const { repository } = req.body;

    if (!repository) {
      return res.status(400).json({
        success: false,
        message: "저장소 정보가 필요합니다.",
      });
    }

    // 해당 저장소의 벡터 데이터 삭제
    const result = await Vector.deleteMany({
      userId: req.user.id,
      repository: repository,
    });

    if (result.deletedCount > 0) {
      res.json({
        success: true,
        message: `벡터 저장소 연동이 해제되었습니다. (${result.deletedCount}개 항목 삭제)`,
        deletedCount: result.deletedCount,
      });
    } else {
      res.json({
        success: true,
        message: "삭제할 벡터 데이터가 없습니다.",
        deletedCount: 0,
      });
    }
  } catch (error) {
    console.error("벡터 저장소 연동 해제 중 오류:", error);
    res.status(500).json({
      success: false,
      message: "벡터 저장소 연동 해제 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
});

// 코드 추천 결과 적용 API
router.post("/apply-recommendation", authenticateUser, async (req, res) => {
  try {
    const { repository, recommendation, modelName } = req.body;
    const userId = req.user.githubId;
    const accessToken = req.user.accessToken;

    if (!repository || !recommendation || !modelName) {
      return res.status(400).json({
        success: false,
        message: "필수 파라미터가 누락되었습니다.",
      });
    }

    const result = await applyCodeRecommendation(
      userId,
      repository,
      recommendation,
      accessToken
    );

    res.json(result);
  } catch (error) {
    console.error("코드 추천 적용 API 오류:", error);
    res.status(500).json({
      success: false,
      message: error.message || "코드 추천 적용 중 오류가 발생했습니다.",
    });
  }
});

module.exports = router;
