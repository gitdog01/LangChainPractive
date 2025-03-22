// highlight.js 초기화
document.addEventListener("DOMContentLoaded", function () {
  if (typeof hljs !== "undefined") {
    hljs.configure({
      languages: [
        "javascript",
        "python",
        "java",
        "c",
        "cpp",
        "csharp",
        "go",
        "ruby",
        "diff",
      ],
    });
    hljs.highlightAll();
  } else {
    console.warn("highlight.js가 로드되지 않았습니다.");
  }

  // 탭 버튼에 클릭 이벤트 추가
  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      // 모든 탭 버튼에서 active 클래스 제거
      document.querySelectorAll(".tab-btn").forEach(function (b) {
        b.classList.remove("active");
      });

      // 모든 탭 컨텐츠에서 active 클래스 제거
      document.querySelectorAll(".tab-content").forEach(function (content) {
        content.classList.remove("active");
      });

      // 클릭한 버튼에 active 클래스 추가
      this.classList.add("active");

      // 해당 탭 컨텐츠에 active 클래스 추가
      const tabId = this.getAttribute("data-tab");
      document.getElementById("tab-" + tabId).classList.add("active");
    });
  });

  // 고급 설정 패널의 초기 상태를 설정
  initSettingsPanel();

  // 저장소 선택 시 정보 표시
  const repositorySelect = document.getElementById("repository");
  const repoDescription = document.getElementById("repo-description");

  if (repositorySelect && repoDescription) {
    repositorySelect.addEventListener("change", () => {
      const selectedOption =
        repositorySelect.options[repositorySelect.selectedIndex];
      const description = selectedOption.getAttribute("data-description");
      const language = selectedOption.getAttribute("data-language");
      const stars = selectedOption.getAttribute("data-stars");

      let infoHtml = "";
      if (description) {
        infoHtml += `<p>${description}</p>`;
      }
      if (language) {
        infoHtml += `<p>주요 언어: ${language}</p>`;
      }
      if (stars) {
        infoHtml += `<p>⭐ ${stars} stars</p>`;
      }

      repoDescription.innerHTML = infoHtml;
    });

    // 초기 선택 시 정보 표시
    if (repositorySelect.value) {
      repositorySelect.dispatchEvent(new Event("change"));
    }
  }
});

// 고급 설정 패널 초기화
function initSettingsPanel() {
  // 이전에 저장된 설정이 있으면 로드
  const savedChunkSize = localStorage.getItem("chunkSize");
  const savedChunkOverlap = localStorage.getItem("chunkOverlap");
  const savedMaxResults = localStorage.getItem("maxResults");

  // DOM 요소 가져오기
  const chunkSizeInput = document.getElementById("chunkSize");
  const chunkOverlapInput = document.getElementById("chunkOverlap");
  const maxResultsInput = document.getElementById("maxResults");
  const advancedSettings = document.getElementById("advanced-settings");
  const toggleBtn = document.querySelector(".toggle-btn");

  // 각 요소가 존재하는 경우에만 값을 설정
  if (chunkSizeInput) {
    chunkSizeInput.value = savedChunkSize || 1000;
  }
  if (chunkOverlapInput) {
    chunkOverlapInput.value = savedChunkOverlap || 200;
  }
  if (maxResultsInput) {
    maxResultsInput.value = savedMaxResults || 5;
  }

  // 고급 설정 패널이 존재하는 경우에만 표시 설정
  if (advancedSettings) {
    advancedSettings.style.display = "block";
  }
  if (toggleBtn) {
    toggleBtn.textContent = "▲";
  }

  // 초기 모델 상태 설정
  initModelStatus();
}

// 초기 모델 상태 설정
function initModelStatus() {
  // GPT-o1이 비활성화된 상태로 표시
  updateModelStatus("gpt-o1", "disabled");
}

// 고급 설정 토글 함수
function toggleSettings() {
  const settingsPanel = document.getElementById("advanced-settings");
  const toggleBtn = document.querySelector(".toggle-btn");

  // 요소가 없으면 함수 종료
  if (!settingsPanel || !toggleBtn) {
    return;
  }

  // 현재 표시 상태 확인
  const isVisible = window.getComputedStyle(settingsPanel).display !== "none";

  if (isVisible) {
    settingsPanel.style.display = "none";
    toggleBtn.textContent = "▼";
  } else {
    settingsPanel.style.display = "block";
    toggleBtn.textContent = "▲";
  }
}

// 현재 설정 값을 로컬 스토리지에 저장하고 가져오는 함수
function saveSettings() {
  const chunkSizeInput = document.getElementById("chunkSize");
  const chunkOverlapInput = document.getElementById("chunkOverlap");
  const maxResultsInput = document.getElementById("maxResults");

  // 기본값 설정
  const defaultSettings = {
    chunkSize: 1000,
    chunkOverlap: 200,
    maxResults: 5,
  };

  // 각 입력 요소가 존재하는 경우에만 값을 저장
  if (chunkSizeInput) {
    localStorage.setItem("chunkSize", chunkSizeInput.value);
    defaultSettings.chunkSize = parseInt(chunkSizeInput.value);
  }
  if (chunkOverlapInput) {
    localStorage.setItem("chunkOverlap", chunkOverlapInput.value);
    defaultSettings.chunkOverlap = parseInt(chunkOverlapInput.value);
  }
  if (maxResultsInput) {
    localStorage.setItem("maxResults", maxResultsInput.value);
    defaultSettings.maxResults = parseInt(maxResultsInput.value);
  }

  return defaultSettings;
}

// 마크다운 설정
marked.setOptions({
  highlight: function (code, lang) {
    if (typeof hljs !== "undefined") {
      try {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      } catch (e) {
        console.error("구문 강조 중 오류:", e);
        return code;
      }
    }
    return code;
  },
  gfm: true,
  breaks: true,
  sanitize: false,
  smartypants: true,
});

// 모델 상태 업데이트 함수
function updateModelStatus(modelName, status) {
  const statusElement = document.getElementById("status-" + modelName);
  if (statusElement) {
    statusElement.className = "status-dot";
    if (status === "pending") {
      statusElement.classList.add("status-pending");
    } else if (status === "completed") {
      statusElement.classList.add("status-completed");
    } else if (status === "error") {
      statusElement.classList.add("status-error");
    } else if (status === "disabled") {
      statusElement.classList.add("status-disabled");
    }
  }
}

// 모든 모델 상태 초기화
function resetAllModelStatus() {
  updateModelStatus("gpt-4o", "pending");
  updateModelStatus("gpt-o3-mini", "pending");
  updateModelStatus("gpt-o1", "disabled");
}

// 코드 추천 받기 함수
async function getCodeRecommendation() {
  const request = document.getElementById("request").value;
  const repository = document.getElementById("repository").value;
  const relevantFilesDiv = document.getElementById("relevantFiles");

  if (!request) {
    alert("기능 요청을 입력해주세요.");
    return;
  }

  // 사용자 설정 저장
  const settings = saveSettings();

  // 모델 상태 표시 초기화
  resetAllModelStatus();

  // 각 모델 탭 로딩 상태로 변경
  ["gpt-4o", "gpt-o3-mini", "gpt-o1"].forEach((modelName) => {
    const tabContent = document.getElementById("tab-" + modelName);
    const loadingDiv = tabContent.querySelector(".loading");
    const contentDiv = tabContent.querySelector(".content");

    loadingDiv.style.display = "block";
    contentDiv.style.display = "none";
    contentDiv.innerHTML = "";
  });

  relevantFilesDiv.innerHTML =
    '<div class="loading"><div class="loading-spinner"></div><p>관련 파일을 검색 중...</p><p class="small-text">처음 실행 시 벡터 저장소를 생성하는 데 시간이 걸릴 수 있습니다.</p></div>';

  try {
    const response = await fetch("/api/recommend-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        request,
        maxResults: settings.maxResults,
        repository,
      }),
    });

    const data = await response.json();
    console.log("서버 응답:", data);

    if (response.ok) {
      // 각 모델별 결과 처리
      data.modelResults.forEach((result) => {
        const modelName = result.modelName;
        const tabContent = document.getElementById("tab-" + modelName);
        const loadingDiv = tabContent.querySelector(".loading");
        const contentDiv = tabContent.querySelector(".content");

        loadingDiv.style.display = "none";
        contentDiv.style.display = "block";

        if (result.error) {
          contentDiv.innerHTML =
            '<div class="error">' + result.recommendation + "</div>";
          updateModelStatus(modelName, "error");
        } else if (result.disabled) {
          contentDiv.innerHTML =
            '<div class="disabled-model">' + result.recommendation + "</div>";
          updateModelStatus(modelName, "disabled");
        } else {
          // 마크다운 렌더링
          contentDiv.innerHTML = marked.parse(result.recommendation);
          updateModelStatus(modelName, "completed");

          // 현재 시간 표시
          const timeDiv = document.createElement("div");
          timeDiv.className = "model-time";
          timeDiv.textContent = "생성 시간: " + new Date().toLocaleTimeString();
          contentDiv.appendChild(timeDiv);

          // 코드 구문 강조 적용
          setTimeout(function () {
            if (typeof hljs !== "undefined") {
              try {
                tabContent
                  .querySelectorAll("pre code")
                  .forEach(function (block) {
                    hljs.highlightElement(block);
                  });
              } catch (e) {
                console.error("코드 강조 적용 중 오류:", e);
              }
            }
          }, 100);
        }
      });

      // 관련 파일 표시
      if (data.relevantFiles && data.relevantFiles.length > 0) {
        let filesHtml = '<div class="file-list">';
        // 중복 제거를 위해 Set 사용
        const uniqueFiles = [...new Set(data.relevantFiles)];
        uniqueFiles.forEach((file) => {
          filesHtml += '<div class="file-item">' + file + "</div>";
        });
        filesHtml += "</div>";

        // 상세 정보 표시
        if (data.relevantFilesDetails && data.relevantFilesDetails.length > 0) {
          filesHtml +=
            '<div class="file-details"><h4>관련 코드 청크 상세 정보</h4>';

          data.relevantFilesDetails.forEach((detail) => {
            filesHtml +=
              '<div class="file-detail-item">' +
              '<div class="file-detail-header">' +
              "<span>" +
              detail.path +
              " (청크 " +
              detail.chunk +
              "/" +
              detail.totalChunks +
              ")</span>" +
              "</div>" +
              '<div class="file-preview">' +
              detail.preview +
              "</div>" +
              "</div>";
          });

          filesHtml += "</div>";
        }

        relevantFilesDiv.innerHTML = filesHtml;
      } else {
        relevantFilesDiv.innerHTML =
          '<div class="no-results">관련 파일을 찾을 수 없습니다. 다른 키워드로 시도해보세요.</div>';
      }
    } else {
      // 모든 모델 탭에 에러 표시
      ["gpt-4o", "gpt-o3-mini", "gpt-o1"].forEach((modelName) => {
        const tabContent = document.getElementById("tab-" + modelName);
        const loadingDiv = tabContent.querySelector(".loading");
        const contentDiv = tabContent.querySelector(".content");

        loadingDiv.style.display = "none";
        contentDiv.style.display = "block";
        contentDiv.innerHTML =
          '<div class="error">오류: ' + data.error + "</div>";
        updateModelStatus(modelName, "error");
      });

      relevantFilesDiv.textContent = "오류가 발생했습니다.";
    }
  } catch (error) {
    console.error("API 요청 중 오류:", error);
    // 모든 모델 탭에 에러 표시
    ["gpt-4o", "gpt-o3-mini", "gpt-o1"].forEach((modelName) => {
      const tabContent = document.getElementById("tab-" + modelName);
      const loadingDiv = tabContent.querySelector(".loading");
      const contentDiv = tabContent.querySelector(".content");

      loadingDiv.style.display = "none";
      contentDiv.style.display = "block";
      contentDiv.innerHTML =
        '<div class="error">네트워크 오류가 발생했습니다.</div>';
      updateModelStatus(modelName, "error");
    });

    relevantFilesDiv.textContent = "오류가 발생했습니다.";
  }
}

// 벡터 저장소 갱신 함수
async function refreshVectorStore() {
  // 사용자 설정 저장
  const settings = saveSettings();
  const repository = document.getElementById("repository").value;

  const recommendationTabs = document.getElementById("recommendation-tabs");
  const firstTabContent = recommendationTabs.querySelector(
    ".tab-content.active .content"
  );
  firstTabContent.textContent = "벡터 저장소 갱신 중...";

  try {
    const response = await fetch("/api/refresh-vector-store", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chunkSize: settings.chunkSize,
        chunkOverlap: settings.chunkOverlap,
        repository,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      firstTabContent.textContent = "✅ " + data.message;
    } else {
      firstTabContent.textContent = "❌ 오류: " + data.message;
    }
  } catch (error) {
    firstTabContent.textContent =
      "❌ 벡터 저장소 갱신 중 네트워크 오류가 발생했습니다.";
    console.error(error);
  }
}
