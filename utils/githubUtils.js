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

// 파일 수정 및 커밋 함수
async function commitFileChanges(
  owner,
  repo,
  accessToken,
  changes,
  commitMessage
) {
  try {
    console.log(`🔧 파일 변경사항 커밋 시작: ${owner}/${repo}`);
    const octokit = new Octokit({ auth: accessToken });

    // 현재 브랜치 정보 가져오기
    const { data: defaultBranch } = await octokit.rest.repos.get({
      owner,
      repo,
    });

    const branch = defaultBranch.default_branch;

    // 각 파일 변경사항 처리
    for (const change of changes) {
      const { filePath, content, originalContent } = change;

      try {
        // 파일의 현재 내용 가져오기
        const { data: currentFile } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: filePath,
        });

        // Base64로 인코딩된 현재 내용 디코딩
        const currentContent = Buffer.from(
          currentFile.content,
          "base64"
        ).toString("utf-8");

        // 파일 내용이 변경된 경우에만 커밋
        if (currentContent !== content) {
          // 파일 업데이트
          await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: filePath,
            message: commitMessage,
            content: Buffer.from(content).toString("base64"),
            sha: currentFile.sha,
          });

          console.log(`✅ 파일 업데이트 완료: ${filePath}`);
        } else {
          console.log(`ℹ️ 파일 변경사항 없음: ${filePath}`);
        }
      } catch (error) {
        if (error.status === 404) {
          // 파일이 존재하지 않는 경우 새로 생성
          await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: filePath,
            message: commitMessage,
            content: Buffer.from(content).toString("base64"),
          });
          console.log(`✅ 새 파일 생성 완료: ${filePath}`);
        } else {
          throw error;
        }
      }
    }

    console.log(`✅ 모든 파일 변경사항 커밋 완료: ${owner}/${repo}`);
    return {
      success: true,
      message: "파일 변경사항이 성공적으로 커밋되었습니다.",
    };
  } catch (error) {
    console.error(
      `❌ 파일 변경사항 커밋 중 오류 발생: ${owner}/${repo}`,
      error
    );
    throw error;
  }
}

module.exports = {
  vectorizeRepository,
  commitFileChanges,
};
