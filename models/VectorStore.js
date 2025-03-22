const mongoose = require("mongoose");

const vectorSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  repository: {
    type: String,
    required: true,
    index: true,
  },
  embedding: {
    type: [Number],
    required: true,
  },
  metadata: {
    type: Object,
    required: true,
    default: {},
  },
  content: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    required: true,
    index: true,
  },
  chunk_id: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// 복합 인덱스 생성
vectorSchema.index({ userId: 1, repository: 1 });
vectorSchema.index({ source: 1 });
vectorSchema.index({ chunk_id: 1 });

// 벡터 검색을 위한 인덱스 생성
// 이 인덱스는 MongoDB Atlas에서 직접 생성해야 합니다
// Atlas UI에서 'Search' 탭으로 이동하여 벡터 검색 인덱스를 생성하세요
// db.vectors.createIndex(
//   { embedding: "vector" },
//   {
//     name: "vector_index",
//     vectorOptions: {
//       dimension: 1536,
//       similarity: "cosine"
//     }
//   }
// )

// 정적 메서드 추가
vectorSchema.statics.findSimilarDocuments = async function (
  userId,
  repository,
  queryVector,
  limit = 5
) {
  try {
    // userId와 repository를 명시적으로 문자열로 변환
    const userIdStr = String(userId);
    const repositoryStr = String(repository);

    // 올바른 Atlas Search 구문 사용 - knnBeta에 직접 filter 적용
    return await this.aggregate([
      {
        $search: {
          index: "vector_index",
          knnBeta: {
            vector: queryVector,
            path: "embedding",
            k: limit,
            filter: {
              compound: {
                must: [
                  { equals: { path: "userId", value: userIdStr } },
                  { equals: { path: "repository", value: repositoryStr } },
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          content: 1,
          metadata: 1,
          source: 1,
          chunk_id: 1,
          score: { $meta: "searchScore" },
        },
      },
    ]);
  } catch (error) {
    console.error("벡터 검색 중 오류:", error);
    throw error;
  }
};

module.exports = mongoose.model("Vector", vectorSchema);
