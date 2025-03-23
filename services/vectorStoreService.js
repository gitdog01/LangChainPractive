const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { ChatOpenAI } = require("@langchain/openai");
const Vector = require("../models/VectorStore");
const config = require("../config/config");

// OpenAI 모델 초기화
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: config.openai.apiKey,
});

// 텍스트 분할기 초기화
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

// 벡터 저장소 생성 함수
async function createVectorStore(userId, repository, documents) {
  try {
    console.log(
      `벡터 저장소 생성 시작: ${userId}/${repository} (문서 수: ${documents.length})`
    );

    // 기존 벡터 삭제
    await Vector.deleteMany({ userId, repository });

    // 벡터 생성 및 저장
    const vectorsToInsert = await Promise.all(
      documents.map(async (doc, index) => {
        const embedding = await embeddings.embedQuery(doc.pageContent);
        return {
          userId,
          repository,
          embedding,
          metadata: {
            ...doc.metadata,
            tokenCount: doc.pageContent.split(" ").length, // 간단한 토큰 수 계산
            language: detectLanguage(doc.pageContent),
          },
          content: doc.pageContent,
          source: doc.metadata.source || "unknown",
          chunk_id: index,
          timestamp: new Date(),
        };
      })
    );

    // 벡터 데이터 삽입 (배치 처리)
    if (vectorsToInsert.length > 0) {
      await Vector.insertMany(vectorsToInsert);
      console.log(
        `✅ ${vectorsToInsert.length}개의 벡터가 성공적으로 저장되었습니다.`
      );
    }

    return {
      userId,
      repository,
      documentCount: vectorsToInsert.length,
      metadata: {
        description: `Vector store for ${repository}`,
        sourceType: "github",
        language: vectorsToInsert[0]?.metadata?.language || "unknown",
        totalTokens: vectorsToInsert.reduce(
          (sum, vector) => sum + (vector.metadata.tokenCount || 0),
          0
        ),
        lastUpdated: new Date(),
      },
    };
  } catch (error) {
    console.error("벡터 저장소 생성 중 오류:", error);
    throw error;
  }
}

// RAG 검색 및 응답 생성 함수
async function searchAndGenerate(userId, query, repository, maxResults = 5) {
  try {
    console.log(`검색 요청: ${userId}/${repository} - "${query}"`);

    // 쿼리 벡터 생성
    const queryVector = await embeddings.embedQuery(query);

    // 벡터 검색 실행
    const similarDocs = await Vector.findSimilarDocuments(
      userId,
      repository,
      queryVector,
      maxResults
    );

    if (!similarDocs || similarDocs.length === 0) {
      throw new Error("관련 문서를 찾을 수 없습니다.");
    }

    // 파일별 청크 수 계산
    const fileChunks = {};

    // 모든 문서에 대해 소스 파일 카운트
    for (const doc of similarDocs) {
      if (!fileChunks[doc.source]) {
        // 해당 파일의 총 청크 수 조회
        const totalChunks = await Vector.countDocuments({
          userId: userId,
          repository: repository,
          source: doc.source,
        });

        fileChunks[doc.source] = totalChunks;
      }
    }

    return {
      sources: similarDocs.map((doc) => ({
        source: doc.source,
        similarity: doc.score,
        chunk_id: doc.chunk_id,
        content: doc.content,
      })),
      relevantFiles: similarDocs.map((doc) => doc.source),
      relevantFilesDetails: similarDocs.map((doc) => ({
        path: doc.source,
        chunk: doc.chunk_id + 1, // 0부터 시작하는 chunk_id를 1부터 시작하는 형태로 변환
        totalChunks: fileChunks[doc.source],
        preview:
          doc.content.substring(0, 150) +
          (doc.content.length > 150 ? "..." : ""), // 미리보기 150자로 제한
      })),
    };
  } catch (error) {
    console.error("검색 및 응답 생성 중 오류:", error);
    throw error;
  }
}

// 텍스트 분할 함수
async function splitText(text, metadata = {}) {
  const chunks = await textSplitter.splitText(text);
  return chunks.map((chunk) => ({
    pageContent: chunk,
    metadata: { ...metadata, timestamp: new Date() },
  }));
}

// 언어 감지 함수 (간단한 구현)
function detectLanguage(text) {
  // 한글이 포함되어 있는지 확인
  if (/[가-힣]/.test(text)) return "ko";
  // 영어가 포함되어 있는지 확인
  if (/[a-zA-Z]/.test(text)) return "en";
  return "unknown";
}

module.exports = {
  createVectorStore,
  searchAndGenerate,
  splitText,
};
