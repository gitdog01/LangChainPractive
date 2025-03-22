const { Octokit } = require("@octokit/rest");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const {
  createVectorStore,
  splitText,
} = require("../services/vectorStoreService");
const path = require("path");

// 텍스트 분할기 초기화
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

// GitHub 저장소 벡터화 함수
async function vectorizeRepository(
  userId,
  owner,
  repo,
  accessToken,
  chunkSize = 1000,
  chunkOverlap = 200
) {
  try {
    console.log(`🔍 저장소 벡터화 시작: ${owner}/${repo}`);
    const octokit = new Octokit({ auth: accessToken });

    // 저장소의 모든 파일 가져오기
    const { data: contents } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: "",
    });

    // 파일 내용을 저장할 배열
    const documents = [];

    // 지원하는 파일 확장자 목록
    const supportedExtensions = [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".py",
      ".java",
      ".c",
      ".cpp",
      ".cs",
      ".go",
      ".rb",
      ".php",
      ".html",
      ".css",
      ".md",
      ".json",
      ".yml",
      ".yaml",
    ];

    // 제외할 디렉토리 목록
    const excludedDirs = [
      "node_modules",
      ".git",
      "dist",
      "build",
      "target",
      "venv",
      "__pycache__",
      ".idea",
      ".vscode",
    ];

    // 재귀적으로 파일 내용 가져오기
    async function processContents(contents, basePath = "") {
      for (const item of contents) {
        // 제외할 디렉토리 필터링
        if (excludedDirs.some((dir) => item.path.includes(dir))) {
          continue;
        }

        if (item.type === "file") {
          // 지원하는 파일 확장자인지 확인
          const ext = path.extname(item.path).toLowerCase();
          if (!supportedExtensions.includes(ext)) {
            continue;
          }

          try {
            console.log(`📄 파일 처리 중: ${item.path}`);
            const { data: fileContent } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: item.path,
            });

            // Base64로 인코딩된 파일 내용을 디코딩
            const content = Buffer.from(fileContent.content, "base64").toString(
              "utf-8"
            );

            // 텍스트 분할
            const chunks = await splitText(content, {
              source: item.path,
              fileType: ext.replace(".", ""),
              repoOwner: owner,
              repoName: repo,
            });

            // 문서 배열에 추가
            documents.push(...chunks);
          } catch (error) {
            console.error(
              `파일 처리 중 오류 발생: ${item.path}`,
              error.message
            );
          }
        } else if (item.type === "dir") {
          try {
            const { data: dirContents } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: item.path,
            });
            await processContents(dirContents, item.path);
          } catch (error) {
            console.error(
              `디렉토리 처리 중 오류 발생: ${item.path}`,
              error.message
            );
          }
        }
      }
    }

    await processContents(contents);

    // 문서가 없는 경우 처리
    if (documents.length === 0) {
      throw new Error("저장소에서 처리할 수 있는 파일을 찾을 수 없습니다.");
    }

    console.log(`총 ${documents.length}개의 텍스트 청크가 생성되었습니다.`);

    // 벡터 저장소 생성
    const result = await createVectorStore(
      userId,
      `${owner}/${repo}`,
      documents
    );

    console.log(`✅ 저장소 벡터화 완료: ${owner}/${repo}`);
    return result;
  } catch (error) {
    console.error(`❌ 저장소 벡터화 중 오류 발생: ${owner}/${repo}`, error);
    throw error;
  }
}

module.exports = {
  vectorizeRepository,
};
