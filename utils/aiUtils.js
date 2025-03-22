const OpenAI = require("openai");
const config = require("../config/config");

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

// AI 추천 생성 함수
async function getRecommendation(request, searchResults, modelName) {
  try {
    // 모델별 설정
    let model;
    let maxTokens;
    let temperature;

    switch (modelName) {
      case "gpt-4o":
        model = "gpt-4";
        maxTokens = 2000;
        temperature = 0.7;
        break;
      case "gpt-o3-mini":
        model = "gpt-3.5-turbo";
        maxTokens = 1000;
        temperature = 0.7;
        break;
      case "gpt-o1":
        return {
          modelName,
          disabled: true,
          recommendation: "이 모델은 현재 비활성화되어 있습니다.",
        };
      default:
        throw new Error("지원하지 않는 모델입니다.");
    }

    // 검색 결과를 컨텍스트로 변환
    const context = searchResults
      .map((doc) => `파일: ${doc.metadata?.source}\n${doc.pageContent}`)
      .join("\n\n");

    // 프롬프트 생성
    const prompt = `다음은 사용자의 요청과 관련된 코드 컨텍스트입니다:

사용자 요청:
${request}

관련 코드 컨텍스트:
${context}

위 컨텍스트를 바탕으로 사용자의 요청에 대한 코드 추천을 제공해주세요. 
코드는 마크다운 코드 블록으로 작성해주시고, 필요한 설명도 함께 제공해주세요.`;

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "당신은 코드 추천을 제공하는 전문가입니다. 사용자의 요청에 맞는 코드를 작성하고 설명해주세요.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: maxTokens,
      temperature,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    return {
      modelName,
      recommendation: completion.choices[0].message.content,
    };
  } catch (error) {
    console.error(`${modelName} 추천 생성 중 오류:`, error);
    return {
      modelName,
      error: true,
      recommendation: `오류가 발생했습니다: ${error.message}`,
    };
  }
}

module.exports = {
  getRecommendation,
};
