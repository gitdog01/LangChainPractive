const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { ChatOpenAI } = require("@langchain/openai");
const Vector = require("../models/VectorStore");
const config = require("../config/config");

// OpenAI 모델 초기화
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: config.openai.apiKey,
});

const llm = new ChatOpenAI({
  openAIApiKey: config.openai.apiKey,
  modelName: "gpt-3.5-turbo",
  temperature: 0.7,
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

    // 컨텍스트 구성
    const context = similarDocs
      .map((doc) => `[Source: ${doc.source}]\n${doc.content}`)
      .join("\n\n");

    // 프롬프트 구성
    const prompt = `다음 컨텍스트를 바탕으로 질문에 답변해주세요:

컨텍스트:
${context}

질문: ${query}

답변:`;

    // LLM을 사용하여 응답 생성
    const response = await llm.invoke(prompt);

    return {
      answer: response.content,
      sources: similarDocs.map((doc) => ({
        source: doc.source,
        similarity: doc.score,
        chunk_id: doc.chunk_id,
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
