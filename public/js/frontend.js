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

  // 텍스트 영역 요소 가져오기
  const requestTextarea = document.getElementById("request");

  // 모든 버튼의 초기 상태 설정 (기본적으로 비활성화)
  const recommendBtn = document.getElementById("recommend-btn");
  const refreshBtn = document.getElementById("refresh-btn");
  const disconnectBtn = document.getElementById("disconnect-btn");

  if (recommendBtn) {
    recommendBtn.disabled = true;
    recommendBtn.classList.add("disabled");
  }

  if (refreshBtn) {
    refreshBtn.classList.add("pulse-animation");
  }

  if (disconnectBtn) {
    disconnectBtn.disabled = true;
    disconnectBtn.classList.add("disabled");
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

  // 저장소 선택을 검색 가능하게 변환
  const repositorySelect = document.getElementById("repository");
  if (repositorySelect) {
    initSearchableSelect(repositorySelect);
  }

  // 저장소 벡터 데이터 확인 후 초기 선택 설정
  checkRepositoriesVectors();
});

// 검색 가능한 select 초기화 함수
function initSearchableSelect(selectElement) {
  if (!selectElement) return;

  // 기존 select의 부모 요소
  const parentElement = selectElement.parentNode;

  // 원본 옵션 저장
  const originalOptions = Array.from(selectElement.options);

  // 선택된 값을 저장하기 위한 숨겨진 input
  const hiddenInput = document.createElement("input");
  hiddenInput.type = "hidden";
  hiddenInput.id = selectElement.id;
  hiddenInput.name = selectElement.name;
  hiddenInput.value = selectElement.value;

  // 컨테이너 생성
  const container = document.createElement("div");
  container.className = "searchable-select-container";

  // 검색 입력 필드 생성
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "searchable-select-input";
  searchInput.placeholder = "저장소 검색...";

  // 선택된 옵션이 있으면 입력 필드에 표시
  if (selectElement.selectedIndex >= 0) {
    searchInput.value = selectElement.options[selectElement.selectedIndex].text;

    // 선택된 옵션이 벡터 데이터를 가지고 있는지 확인
    const hasVectors =
      selectElement.options[selectElement.selectedIndex].getAttribute(
        "data-has-vectors"
      ) === "true";
    if (hasVectors) {
      searchInput.classList.add("has-vectors");
    }
  }

  // 드롭다운 생성
  const dropdown = document.createElement("div");
  dropdown.className = "searchable-select-dropdown";

  // select의 모든 옵션을 드롭다운 옵션으로 변환
  let dropdownOptions = [];

  originalOptions.forEach((option) => {
    const dropdownOption = document.createElement("div");
    dropdownOption.className = "searchable-select-option";
    dropdownOption.textContent = option.text;
    dropdownOption.setAttribute("data-value", option.value);

    // 원본 select 옵션의 모든 data 속성을 복사
    Array.from(option.attributes).forEach((attr) => {
      if (attr.name.startsWith("data-")) {
        dropdownOption.setAttribute(attr.name, attr.value);
      }
    });

    // 벡터 데이터 상태에 따른 클래스 추가
    if (option.getAttribute("data-has-vectors") === "true") {
      dropdownOption.classList.add("repository-with-vectors");
    } else {
      dropdownOption.classList.add("repository-without-vectors");
    }

    // 현재 선택된 옵션이면 selected 클래스 추가
    if (option.selected) {
      dropdownOption.classList.add("selected");
    }

    // 옵션 클릭 이벤트
    dropdownOption.addEventListener("click", function () {
      searchInput.value = this.textContent;
      hiddenInput.value = this.getAttribute("data-value");

      // 모든 옵션에서 selected 클래스 제거
      dropdown.querySelectorAll(".searchable-select-option").forEach((opt) => {
        opt.classList.remove("selected");
      });

      // 선택된 옵션에 selected 클래스 추가
      this.classList.add("selected");

      // 드롭다운 닫기
      dropdown.style.display = "none";

      // 벡터 데이터 상태에 따른 스타일 업데이트
      const hasVectors = this.getAttribute("data-has-vectors") === "true";
      updateSearchableSelectStyle(searchInput, hasVectors);

      // 저장소 정보 업데이트
      updateRepositoryInfo(this.getAttribute("data-value"));

      // 버튼 상태 업데이트
      updateButtonStates(hasVectors);

      // 선택한 저장소를 localStorage에 저장
      localStorage.setItem(
        "lastSelectedRepository",
        this.getAttribute("data-value")
      );

      // change 이벤트 발생
      const event = new Event("change");
      hiddenInput.dispatchEvent(event);
    });

    dropdown.appendChild(dropdownOption);
    dropdownOptions.push(dropdownOption);
  });

  // 검색 입력 필드 클릭 이벤트
  searchInput.addEventListener("click", function () {
    dropdown.style.display = "block";
  });

  // 검색 입력 필드 변경 이벤트
  searchInput.addEventListener("input", function () {
    const searchText = this.value.toLowerCase();
    let matchFound = false;

    // 옵션 필터링
    dropdownOptions.forEach((option) => {
      const optionText = option.textContent.toLowerCase();
      if (optionText.includes(searchText)) {
        option.style.display = "block";
        matchFound = true;
      } else {
        option.style.display = "none";
      }
    });

    // 검색 결과가 없을 때 메시지 표시
    const noResultsElement = dropdown.querySelector(
      ".searchable-select-no-results"
    );
    if (!matchFound) {
      if (!noResultsElement) {
        const noResults = document.createElement("div");
        noResults.className = "searchable-select-no-results";
        noResults.textContent = "검색 결과가 없습니다";
        dropdown.appendChild(noResults);
      }
    } else if (noResultsElement) {
      dropdown.removeChild(noResultsElement);
    }

    // 드롭다운 표시
    dropdown.style.display = "block";
  });

  // 외부 클릭 시 드롭다운 닫기
  document.addEventListener("click", function (event) {
    if (!container.contains(event.target)) {
      dropdown.style.display = "none";
    }
  });

  // 요소 조립 및 DOM에 추가
  container.appendChild(searchInput);
  container.appendChild(dropdown);
  container.appendChild(hiddenInput);

  // 기존 select 대신 새 컨테이너로 교체
  parentElement.replaceChild(container, selectElement);

  // 레퍼런스 저장 (나중에 다른 함수에서 접근할 수 있도록)
  window.searchableSelectElements = window.searchableSelectElements || {};
  window.searchableSelectElements[selectElement.id] = {
    container,
    searchInput,
    dropdown,
    hiddenInput,
    dropdownOptions,
    originalOptions, // 원본 옵션 목록도 저장
  };

  return container;
}

// 검색 가능한 select 스타일 업데이트
function updateSearchableSelectStyle(inputElement, hasVectors) {
  if (hasVectors) {
    inputElement.classList.add("has-vectors");
  } else {
    inputElement.classList.remove("has-vectors");
  }
}

// 저장소 정보 업데이트
function updateRepositoryInfo(repositoryValue) {
  const repoDescription = document.getElementById("repo-description");
  if (!repoDescription) return;

  // 드롭다운 옵션에서 선택된 저장소 정보 가져오기
  const selectRef = window.searchableSelectElements["repository"];
  if (!selectRef) return;

  const selectedOption = selectRef.dropdownOptions.find(
    (option) => option.getAttribute("data-value") === repositoryValue
  );

  if (selectedOption) {
    const description = selectedOption.getAttribute("data-description");
    const language = selectedOption.getAttribute("data-language");
    const stars = selectedOption.getAttribute("data-stars");
    const hasVectors =
      selectedOption.getAttribute("data-has-vectors") === "true";

    // 버튼 상태 업데이트
    updateButtonStates(hasVectors);

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

    // 벡터 데이터 상태 표시 추가
    if (hasVectors) {
      infoHtml += `<p style="color: #4caf50; font-weight: bold;">✓ 벡터 데이터 연동됨</p>`;
    } else {
      infoHtml += `<p style="color: #757575;">✗ 벡터 데이터 없음</p>`;
    }

    repoDescription.innerHTML = infoHtml;
  }
}

// 선택된 저장소의 벡터 데이터 유무에 따라 select 요소 스타일 업데이트
function updateSelectStyle(selectElement, hasVectors) {
  // 검색 가능한 select 컴포넌트로 변경된 경우 처리
  if (
    window.searchableSelectElements &&
    window.searchableSelectElements["repository"]
  ) {
    const searchInput =
      window.searchableSelectElements["repository"].searchInput;
    updateSearchableSelectStyle(searchInput, hasVectors);
  } else if (selectElement) {
    // 기존 방식 (기존 코드 유지)
    if (hasVectors) {
      selectElement.classList.add("has-vectors");
    } else {
      selectElement.classList.remove("has-vectors");
    }
  }
}

// 저장소 벡터 데이터 확인 함수
async function checkRepositoriesVectors() {
  // 검색 가능한 select 요소로 변경 전에 모든 저장소 목록 가져오기
  let repositories = [];
  const repositorySelect = document.getElementById("repository");

  // repositorySelect와 options가 모두 존재하는지 확인
  if (repositorySelect && repositorySelect.options) {
    repositories = Array.from(repositorySelect.options).map(
      (option) => option.value
    );
  } else {
    // 검색 가능한 select 요소로 이미 변환된 경우 확인
    if (
      window.searchableSelectElements &&
      window.searchableSelectElements["repository"]
    ) {
      const originalOptions =
        window.searchableSelectElements["repository"].originalOptions;
      if (originalOptions && originalOptions.length > 0) {
        repositories = originalOptions.map((option) => option.value);
      }
    }
  }

  if (repositories.length === 0) {
    return;
  }

  try {
    const response = await fetch("/api/check-vectors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repositories: repositories,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.repositories) {
        // 저장소에 벡터 데이터 상태 표시
        updateRepositoriesStatus(data.repositories);

        // 저장소 정렬 (벡터 데이터 있는 것 우선)
        sortRepositories();

        // 초기 저장소 선택
        initializeRepositorySelection(data.repositories);

        // 페이지 로드 시 현재 선택된 저장소의 버튼 상태 업데이트
        updateInitialButtonStates();
      }
    } else {
      console.error("저장소 벡터 데이터 확인 중 오류 발생");
    }
  } catch (error) {
    console.error("API 요청 중 오류:", error);
  }
}

// 저장소 벡터 데이터 상태 업데이트
function updateRepositoriesStatus(repositories) {
  // 검색 가능한 select 컴포넌트로 변경된 경우 처리
  if (
    window.searchableSelectElements &&
    window.searchableSelectElements["repository"]
  ) {
    const selectRef = window.searchableSelectElements["repository"];
    const dropdownOptions = selectRef.dropdownOptions;
    const hiddenInput = selectRef.hiddenInput;
    const searchInput = selectRef.searchInput;

    // 각 옵션에 벡터 데이터 상태 설정
    dropdownOptions.forEach((option) => {
      const repoValue = option.getAttribute("data-value");
      const repo = repositories.find((r) => r.repository === repoValue);

      if (repo) {
        // 벡터 데이터 상태 설정
        option.setAttribute("data-has-vectors", repo.hasVectors);

        // 클래스 제거 후 적절한 클래스 추가
        option.classList.remove(
          "repository-with-vectors",
          "repository-without-vectors"
        );

        if (repo.hasVectors) {
          option.classList.add("repository-with-vectors");
          option.style.color = "#4caf50"; // 초록색으로 명시적 설정
          option.style.fontWeight = "bold";
        } else {
          option.classList.add("repository-without-vectors");
          option.style.color = "#333"; // 검은색으로 명시적 설정
          option.style.fontWeight = "normal";
        }
      }
    });

    // 현재 선택된 옵션에 대한 입력 필드 스타일 업데이트
    const selectedOption = dropdownOptions.find(
      (option) => option.getAttribute("data-value") === hiddenInput.value
    );

    if (selectedOption) {
      const hasVectors =
        selectedOption.getAttribute("data-has-vectors") === "true";
      updateSearchableSelectStyle(searchInput, hasVectors);
    }
  } else {
    // 기존 select 요소에 대한 코드 (기존 코드 유지)
    const repositorySelect = document.getElementById("repository");
    if (!repositorySelect) return;

    // 각 저장소 옵션에 벡터 데이터 상태 표시
    Array.from(repositorySelect.options).forEach((option) => {
      const repo = repositories.find((r) => r.repository === option.value);
      if (repo) {
        option.setAttribute("data-has-vectors", repo.hasVectors);
        option.classList.remove(
          "repository-with-vectors",
          "repository-without-vectors"
        );

        if (repo.hasVectors) {
          option.classList.add("repository-with-vectors");
        } else {
          option.classList.add("repository-without-vectors");
        }
      }
    });

    // 현재 선택된 옵션에 대한 select 요소 스타일 업데이트
    const selectedOption =
      repositorySelect.options[repositorySelect.selectedIndex];
    if (selectedOption) {
      const hasVectors =
        selectedOption.getAttribute("data-has-vectors") === "true";
      updateSelectStyle(repositorySelect, hasVectors);
    }
  }
}

// 저장소 정렬 (벡터 데이터 있는 것 우선)
function sortRepositories() {
  // 검색 가능한 select 컴포넌트로 변경된 경우 처리
  if (
    window.searchableSelectElements &&
    window.searchableSelectElements["repository"]
  ) {
    const selectRef = window.searchableSelectElements["repository"];
    const dropdown = selectRef.dropdown;
    const hiddenInput = selectRef.hiddenInput;

    // 현재 선택된 값 저장
    const selectedValue = hiddenInput.value;

    // 드롭다운 옵션 정렬
    const options = Array.from(selectRef.dropdownOptions);

    // 벡터 데이터 유무 값을 명확하게 가져오기
    options.sort((a, b) => {
      const aHasVectors = a.getAttribute("data-has-vectors") === "true";
      const bHasVectors = b.getAttribute("data-has-vectors") === "true";

      // 벡터 데이터 있는 것을 먼저 정렬
      if (aHasVectors && !bHasVectors) return -1;
      if (!aHasVectors && bHasVectors) return 1;

      // 벡터 데이터 유무가 같으면 업데이트 날짜로 정렬
      const aUpdatedAt = a.getAttribute("data-updated-at");
      const bUpdatedAt = b.getAttribute("data-updated-at");

      if (aUpdatedAt && bUpdatedAt) {
        return new Date(bUpdatedAt) - new Date(aUpdatedAt);
      }

      // 업데이트 날짜가 없으면 이름순 정렬
      return a.textContent.localeCompare(b.textContent);
    });

    // 기존 옵션 제거
    while (dropdown.firstChild) {
      dropdown.removeChild(dropdown.firstChild);
    }

    // 정렬된 옵션을 다시 추가
    options.forEach((option) => {
      dropdown.appendChild(option);
    });

    // 옵션 배열 업데이트
    selectRef.dropdownOptions = options;

    // 현재 선택된 옵션이 있으면 클래스 업데이트
    const selectedOption = options.find(
      (option) => option.getAttribute("data-value") === selectedValue
    );
    if (selectedOption) {
      selectedOption.classList.add("selected");

      // 시각적 스타일 업데이트
      const hasVectors =
        selectedOption.getAttribute("data-has-vectors") === "true";
      updateSearchableSelectStyle(selectRef.searchInput, hasVectors);
    }
  } else {
    // 기존 select 요소에 대한 코드 (기존 코드 유지)
    const repositorySelect = document.getElementById("repository");
    if (!repositorySelect) return;

    // 선택된 저장소 값 저장
    const selectedValue = repositorySelect.value;

    // 옵션 배열로 변환 후 정렬
    const options = Array.from(repositorySelect.options);
    options.sort((a, b) => {
      const aHasVectors = a.getAttribute("data-has-vectors") === "true";
      const bHasVectors = b.getAttribute("data-has-vectors") === "true";

      // 먼저 벡터 데이터 유무로 정렬
      if (aHasVectors && !bHasVectors) return -1;
      if (!aHasVectors && bHasVectors) return 1;

      // 벡터 데이터 유무가 같으면 업데이트 날짜로 정렬
      const aUpdatedAt = a.getAttribute("data-updated-at");
      const bUpdatedAt = b.getAttribute("data-updated-at");

      if (aUpdatedAt && bUpdatedAt) {
        // 날짜가 최신인 항목이 먼저 오도록 정렬 (내림차순)
        return new Date(bUpdatedAt) - new Date(aUpdatedAt);
      }

      // 업데이트 날짜가 없으면 이름순 정렬
      return a.value.localeCompare(b.value);
    });

    // 기존 옵션 제거
    while (repositorySelect.firstChild) {
      repositorySelect.removeChild(repositorySelect.firstChild);
    }

    // 정렬된 옵션을 다시 추가
    options.forEach((option) => repositorySelect.appendChild(option));

    // 기존 선택 값 복원
    repositorySelect.value = selectedValue;
  }
}

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
    // 외부에서 처리하므로 간단히 반환
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

  // 저장소 값 가져오기 (검색 가능한 select 또는 기존 select에서)
  let repository;
  if (
    window.searchableSelectElements &&
    window.searchableSelectElements["repository"]
  ) {
    repository =
      window.searchableSelectElements["repository"].hiddenInput.value;
  } else {
    repository = document.getElementById("repository").value;
  }

  const relevantFilesDiv = document.getElementById("relevantFiles");

  if (!request) {
    alert("기능 요청을 입력해주세요.");
    return;
  }

  // 현재 선택된 저장소를 로컬 스토리지에 저장
  if (repository) {
    localStorage.setItem("lastSelectedRepository", repository);
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

  // 첫 번째 요청 후 애니메이션 표시 상태를 localStorage에 저장
  localStorage.setItem("hasShownRecommendAnimation", "true");

  // 추천 버튼에서 펄스 애니메이션 클래스 제거
  const recommendButton = document.getElementById("recommend-btn");
  if (recommendButton) {
    recommendButton.classList.remove("recommend-pulse");
  }

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
        const tabContent = document.getElementById(`tab-${modelName}`);
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

          // 코드 블록 향상 처리 (즉시 실행)
          enhanceCodeBlocks(contentDiv);

          // 해당 탭을 활성화
          const tabButton = document.querySelector(`[data-tab="${modelName}"]`);
          if (tabButton) {
            tabButton.click();
          }
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

  // 저장소 값 가져오기 (검색 가능한 select 또는 기존 select에서)
  let repository;
  if (
    window.searchableSelectElements &&
    window.searchableSelectElements["repository"]
  ) {
    repository =
      window.searchableSelectElements["repository"].hiddenInput.value;
  } else {
    repository = document.getElementById("repository").value;
  }

  // 저장소가 선택되지 않았으면 알림
  if (!repository) {
    alert("저장소를 선택해주세요.");
    return;
  }

  // 현재 선택된 저장소를 로컬 스토리지에 저장
  localStorage.setItem("lastSelectedRepository", repository);

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

      // 선택한 저장소의 벡터 상태 업데이트
      if (
        window.searchableSelectElements &&
        window.searchableSelectElements["repository"]
      ) {
        // 검색 가능한 select 요소 업데이트
        const selectRef = window.searchableSelectElements["repository"];
        const hiddenInput = selectRef.hiddenInput;
        const searchInput = selectRef.searchInput;

        // 선택된 옵션 찾기
        const selectedOption = selectRef.dropdownOptions.find(
          (option) => option.getAttribute("data-value") === hiddenInput.value
        );

        if (selectedOption) {
          // 벡터 데이터가 생성되었으므로 상태 업데이트
          selectedOption.setAttribute("data-has-vectors", "true");
          selectedOption.classList.remove("repository-without-vectors");
          selectedOption.classList.add("repository-with-vectors");

          // 입력 필드 스타일 업데이트
          updateSearchableSelectStyle(searchInput, true);

          // 버튼 상태 업데이트
          updateButtonStates(true);
        }
      } else {
        // 기존 select 요소 업데이트
        const repositorySelect = document.getElementById("repository");
        const selectedOption =
          repositorySelect.options[repositorySelect.selectedIndex];

        // 벡터 데이터가 생성되었으므로 상태 업데이트
        selectedOption.setAttribute("data-has-vectors", "true");
        selectedOption.classList.remove("repository-without-vectors");
        selectedOption.classList.add("repository-with-vectors");

        // select 요소 스타일 업데이트
        updateSelectStyle(repositorySelect, true);

        // 버튼 상태 업데이트
        updateButtonStates(true);
      }

      // repo-description 업데이트
      const repoDescription = document.getElementById("repo-description");
      if (repoDescription) {
        // 기존 내용 가져오기
        const existingHtml = repoDescription.innerHTML;

        // 벡터 데이터 상태 표시가 있는지 확인하고 교체
        if (existingHtml.includes("벡터 데이터 없음")) {
          const updatedHtml = existingHtml.replace(
            `<p style="color: #757575;">✗ 벡터 데이터 없음</p>`,
            `<p style="color: #4caf50; font-weight: bold;">✓ 벡터 데이터 연동됨</p>`
          );
          repoDescription.innerHTML = updatedHtml;
        } else if (!existingHtml.includes("벡터 데이터 연동됨")) {
          // 상태 표시가 아직 없으면 추가
          repoDescription.innerHTML += `<p style="color: #4caf50; font-weight: bold;">✓ 벡터 데이터 연동됨</p>`;
        }
      }

      // 저장소 정렬 다시 수행
      sortRepositories();
    } else {
      firstTabContent.textContent = "❌ 오류: " + data.message;
      console.error("벡터 저장소 갱신 실패:", data);
    }
  } catch (error) {
    firstTabContent.textContent =
      "❌ 벡터 저장소 갱신 중 네트워크 오류가 발생했습니다.";
    console.error("벡터 저장소 갱신 오류:", error);
  }
}

// 초기 저장소 선택 설정
function initializeRepositorySelection(repositories) {
  // 검색 가능한 select 컴포넌트로 변경된 경우 처리
  if (
    window.searchableSelectElements &&
    window.searchableSelectElements["repository"]
  ) {
    const selectRef = window.searchableSelectElements["repository"];
    const searchInput = selectRef.searchInput;
    const hiddenInput = selectRef.hiddenInput;
    const dropdownOptions = selectRef.dropdownOptions;

    // 1. 마지막으로 선택했던 저장소 확인
    const lastSelectedRepo = localStorage.getItem("lastSelectedRepository");
    console.log("마지막 선택 저장소:", lastSelectedRepo);

    if (lastSelectedRepo) {
      // 마지막 선택 저장소가 목록에 있는지 확인
      const lastSelected = dropdownOptions.find(
        (option) => option.getAttribute("data-value") === lastSelectedRepo
      );

      if (lastSelected) {
        // 값 설정
        hiddenInput.value = lastSelectedRepo;
        searchInput.value = lastSelected.textContent;

        // selected 클래스 추가
        dropdownOptions.forEach((opt) => opt.classList.remove("selected"));
        lastSelected.classList.add("selected");

        // 벡터 데이터 상태에 따른 스타일 업데이트
        const hasVectors =
          lastSelected.getAttribute("data-has-vectors") === "true";
        updateSearchableSelectStyle(searchInput, hasVectors);

        // 저장소 정보 업데이트
        updateRepositoryInfo(lastSelectedRepo);
        console.log("마지막 선택 저장소로 설정됨:", lastSelectedRepo);
        return;
      }
    }

    // 2. 벡터 데이터가 있는 저장소 찾기
    const repoWithVectors = repositories.find((repo) => repo.hasVectors);
    if (repoWithVectors) {
      const vectorOption = dropdownOptions.find(
        (option) =>
          option.getAttribute("data-value") === repoWithVectors.repository
      );

      if (vectorOption) {
        // 값 설정
        hiddenInput.value = repoWithVectors.repository;
        searchInput.value = vectorOption.textContent;

        // selected 클래스 추가
        dropdownOptions.forEach((opt) => opt.classList.remove("selected"));
        vectorOption.classList.add("selected");

        // 벡터 데이터 상태에 따른 스타일 업데이트
        updateSearchableSelectStyle(searchInput, true);

        // 저장소 정보 업데이트
        updateRepositoryInfo(repoWithVectors.repository);
        console.log(
          "벡터 데이터 있는 저장소로 설정됨:",
          repoWithVectors.repository
        );
        return;
      }
    }

    // 3. 가장 최근에 업데이트된 저장소 사용 (이미 첫 번째 옵션으로 정렬되어 있다고 가정)
    if (dropdownOptions.length > 0) {
      const firstOption = dropdownOptions[0];

      // 값 설정
      hiddenInput.value = firstOption.getAttribute("data-value");
      searchInput.value = firstOption.textContent;

      // selected 클래스 추가
      dropdownOptions.forEach((opt) => opt.classList.remove("selected"));
      firstOption.classList.add("selected");

      // 벡터 데이터 상태에 따른 스타일 업데이트
      const hasVectors =
        firstOption.getAttribute("data-has-vectors") === "true";
      updateSearchableSelectStyle(searchInput, hasVectors);

      // 저장소 정보 업데이트
      updateRepositoryInfo(firstOption.getAttribute("data-value"));
      console.log(
        "첫 번째 옵션으로 설정됨:",
        firstOption.getAttribute("data-value")
      );
    }
  } else {
    // 기존 select 요소에 대한 코드 (기존 코드 유지)
    const repositorySelect = document.getElementById("repository");
    if (!repositorySelect) return;

    // 1. 마지막으로 선택했던 저장소 확인
    const lastSelectedRepo = localStorage.getItem("lastSelectedRepository");

    if (lastSelectedRepo) {
      // 마지막 선택 저장소가 목록에 있는지 확인
      const exists = Array.from(repositorySelect.options).some(
        (option) => option.value === lastSelectedRepo
      );

      if (exists) {
        repositorySelect.value = lastSelectedRepo;
        repositorySelect.dispatchEvent(new Event("change"));
        return;
      }
    }

    // 2. 벡터 데이터가 있는 저장소 찾기
    const repoWithVectors = repositories.find((repo) => repo.hasVectors);
    if (repoWithVectors) {
      repositorySelect.value = repoWithVectors.repository;
      repositorySelect.dispatchEvent(new Event("change"));
      return;
    }

    // 3. 가장 최근에 업데이트된 저장소 사용 (이미 첫 번째 옵션으로 정렬되어 있다고 가정)
    if (repositorySelect.options.length > 0) {
      repositorySelect.selectedIndex = 0;
      repositorySelect.dispatchEvent(new Event("change"));
    }
  }
}

// GitHub 저장소로 이동하는 함수
function goToRepository() {
  // 저장소 값 가져오기 (검색 가능한 select 또는 기존 select에서)
  let repository;
  if (
    window.searchableSelectElements &&
    window.searchableSelectElements["repository"]
  ) {
    repository =
      window.searchableSelectElements["repository"].hiddenInput.value;
  } else {
    repository = document.getElementById("repository").value;
  }

  // 저장소가 선택되지 않았으면 알림
  if (!repository) {
    alert("저장소를 선택해주세요.");
    return;
  }

  // GitHub 저장소 페이지로 이동
  window.open(`https://github.com/${repository}`, "_blank");
}

// 저장소 벡터 데이터 상태에 따라 버튼 상태 업데이트 함수
function updateButtonStates(hasVectors) {
  const recommendButton = document.getElementById("recommend-btn");
  const refreshButton = document.getElementById("refresh-btn");
  const disconnectButton = document.getElementById("disconnect-btn");
  const requestTextarea = document.getElementById("request");

  // 첫 번째 요청인지 확인 (localStorage에 저장된 상태 확인)
  const hasShownRecommendAnimation =
    localStorage.getItem("hasShownRecommendAnimation") === "true";

  if (recommendButton && refreshButton && disconnectButton && requestTextarea) {
    if (hasVectors) {
      // 벡터 데이터가 있는 경우
      // 요청 textarea 활성화
      requestTextarea.disabled = false;

      // 입력 상태에 따라 코드 추천 버튼 활성화/비활성화
      const hasInput = requestTextarea.value.trim().length > 0;

      if (hasInput) {
        // 텍스트가 있는 경우 버튼 활성화, textarea 애니메이션 제거
        recommendButton.disabled = false;
        recommendButton.classList.remove("disabled");

        // 첫 번째 요청인 경우에만 애니메이션 적용
        if (!hasShownRecommendAnimation) {
          recommendButton.classList.add("recommend-pulse");
          recommendButton.classList.add("active");
        } else {
          recommendButton.classList.add("active");
        }

        requestTextarea.classList.remove("pulse-animation");
      } else {
        // 텍스트가 없는 경우 버튼 비활성화, textarea 애니메이션 추가
        recommendButton.disabled = true;
        recommendButton.classList.add("disabled");
        recommendButton.classList.remove("active");
        recommendButton.classList.remove("recommend-pulse");
        requestTextarea.classList.add("pulse-animation");
      }

      // 텍스트 영역 입력 이벤트 처리
      if (!requestTextarea.hasInputListener) {
        requestTextarea.addEventListener("input", function () {
          const hasInput = this.value.trim().length > 0;
          if (hasInput) {
            recommendButton.disabled = false;
            recommendButton.classList.remove("disabled");

            // 첫 번째 요청인 경우에만 애니메이션 적용
            if (!hasShownRecommendAnimation) {
              recommendButton.classList.add("recommend-pulse");
            }

            recommendButton.classList.add("active");
            this.classList.remove("pulse-animation");
          } else {
            recommendButton.disabled = true;
            recommendButton.classList.add("disabled");
            recommendButton.classList.remove("active");
            recommendButton.classList.remove("recommend-pulse");
            this.classList.add("pulse-animation");
          }
        });
        requestTextarea.hasInputListener = true;
      }

      // 포커스 이벤트 처리 - 포커스 시 애니메이션 일시 중지
      if (!requestTextarea.hasFocusListener) {
        requestTextarea.addEventListener("focus", function () {
          if (!this.value.trim().length) {
            // 텍스트가 없을 때만 애니메이션 유지, focus 스타일은 CSS에서 처리
          }
        });

        requestTextarea.addEventListener("blur", function () {
          if (!this.value.trim().length) {
            // textarea가 비어있을 경우 다시 애니메이션 적용
            this.classList.add("pulse-animation");
          }
        });

        requestTextarea.hasFocusListener = true;
      }

      // 이전 호버 리스너 제거 (이제 CSS로 처리)
      if (recommendButton.hasHoverListeners) {
        recommendButton.removeEventListener(
          "mouseenter",
          recommendButton.mouseenterListener
        );
        recommendButton.removeEventListener(
          "mouseleave",
          recommendButton.mouseleaveListener
        );
        recommendButton.hasHoverListeners = false;
      }

      // 벡터 저장소 갱신 버튼 - 애니메이션 제거 & 호버 시에만 레이블 표시되도록
      refreshButton.classList.remove("pulse-animation");

      // 연동 해제 버튼 활성화
      disconnectButton.disabled = false;
      disconnectButton.classList.remove("disabled");
    } else {
      // 벡터 데이터가 없는 경우
      // 요청 textarea 비활성화 및 애니메이션 제거
      requestTextarea.disabled = true;
      requestTextarea.classList.remove("pulse-animation");

      // 코드 추천 버튼 비활성화
      recommendButton.disabled = true;
      recommendButton.classList.add("disabled");
      recommendButton.classList.remove("active");

      // 벡터 저장소 갱신 버튼 - 항상 레이블 표시 & 애니메이션 적용
      refreshButton.classList.add("pulse-animation");

      // 연동 해제 버튼 비활성화
      disconnectButton.disabled = true;
      disconnectButton.classList.add("disabled");
    }
  }
}

// 페이지 로드 시 현재 선택된 저장소의 버튼 상태 업데이트
function updateInitialButtonStates() {
  let hasVectors = false;

  // 검색 가능한 select 컴포넌트의 경우
  if (
    window.searchableSelectElements &&
    window.searchableSelectElements["repository"]
  ) {
    const selectRef = window.searchableSelectElements["repository"];
    const hiddenInput = selectRef.hiddenInput;

    const selectedOption = selectRef.dropdownOptions.find(
      (option) => option.getAttribute("data-value") === hiddenInput.value
    );

    if (selectedOption) {
      hasVectors = selectedOption.getAttribute("data-has-vectors") === "true";
    }
  }
  // 기존 select 요소의 경우
  else {
    const repositorySelect = document.getElementById("repository");
    if (repositorySelect && repositorySelect.selectedIndex >= 0) {
      const selectedOption =
        repositorySelect.options[repositorySelect.selectedIndex];
      hasVectors = selectedOption.getAttribute("data-has-vectors") === "true";
    }
  }

  // 버튼 상태 업데이트
  updateButtonStates(hasVectors);
}

// 벡터 저장소 연동 해제 함수
async function disconnectVectorStore() {
  // 저장소 값 가져오기 (검색 가능한 select 또는 기존 select에서)
  let repository;
  if (
    window.searchableSelectElements &&
    window.searchableSelectElements["repository"]
  ) {
    repository =
      window.searchableSelectElements["repository"].hiddenInput.value;
  } else {
    repository = document.getElementById("repository").value;
  }

  // 저장소가 선택되지 않았으면 알림
  if (!repository) {
    alert("저장소를 선택해주세요.");
    return;
  }

  // 사용자에게 확인 요청
  if (
    !confirm(
      "정말로 이 저장소의 벡터 데이터를 삭제하시겠습니까?\n이 작업은 취소할 수 없습니다."
    )
  ) {
    return;
  }

  // 현재 선택된 저장소를 로컬 스토리지에 저장
  localStorage.setItem("lastSelectedRepository", repository);

  const recommendationTabs = document.getElementById("recommendation-tabs");
  const firstTabContent = recommendationTabs.querySelector(
    ".tab-content.active .content"
  );
  firstTabContent.textContent = "벡터 저장소 연동 해제 중...";

  try {
    const response = await fetch("/api/disconnect-vector-store", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repository,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      firstTabContent.textContent = "✅ " + data.message;

      // 선택한 저장소의 벡터 상태 업데이트
      if (
        window.searchableSelectElements &&
        window.searchableSelectElements["repository"]
      ) {
        // 검색 가능한 select 요소 업데이트
        const selectRef = window.searchableSelectElements["repository"];
        const hiddenInput = selectRef.hiddenInput;
        const searchInput = selectRef.searchInput;

        // 선택된 옵션 찾기
        const selectedOption = selectRef.dropdownOptions.find(
          (option) => option.getAttribute("data-value") === hiddenInput.value
        );

        if (selectedOption) {
          // 벡터 데이터가 삭제되었으므로 상태 업데이트
          selectedOption.setAttribute("data-has-vectors", "false");
          selectedOption.classList.remove("repository-with-vectors");
          selectedOption.classList.add("repository-without-vectors");

          // 입력 필드 스타일 업데이트
          updateSearchableSelectStyle(searchInput, false);

          // 버튼 상태 업데이트
          updateButtonStates(false);
        }
      } else {
        // 기존 select 요소 업데이트
        const repositorySelect = document.getElementById("repository");
        const selectedOption =
          repositorySelect.options[repositorySelect.selectedIndex];

        // 벡터 데이터가 삭제되었으므로 상태 업데이트
        selectedOption.setAttribute("data-has-vectors", "false");
        selectedOption.classList.remove("repository-with-vectors");
        selectedOption.classList.add("repository-without-vectors");

        // select 요소 스타일 업데이트
        updateSelectStyle(repositorySelect, false);

        // 버튼 상태 업데이트
        updateButtonStates(false);
      }

      // repo-description 업데이트
      const repoDescription = document.getElementById("repo-description");
      if (repoDescription) {
        // 기존 내용 가져오기
        const existingHtml = repoDescription.innerHTML;

        // 벡터 데이터 상태 표시가 있는지 확인하고 교체
        if (existingHtml.includes("벡터 데이터 연동됨")) {
          const updatedHtml = existingHtml.replace(
            `<p style="color: #4caf50; font-weight: bold;">✓ 벡터 데이터 연동됨</p>`,
            `<p style="color: #757575;">✗ 벡터 데이터 없음</p>`
          );
          repoDescription.innerHTML = updatedHtml;
        }
      }

      // 저장소 정렬 다시 수행
      sortRepositories();
    } else {
      firstTabContent.textContent = "❌ 오류: " + data.message;
      console.error("벡터 저장소 연동 해제 실패:", data);
    }
  } catch (error) {
    firstTabContent.textContent =
      "❌ 벡터 저장소 연동 해제 중 네트워크 오류가 발생했습니다.";
    console.error("벡터 저장소 연동 해제 오류:", error);
  }
}

// 코드 블록을 CodeMirror 에디터로 변환하는 함수
function enhanceCodeBlocks(contentElement) {
  const codeBlocks = contentElement.querySelectorAll("pre code");

  codeBlocks.forEach((codeBlock, index) => {
    const preElement = codeBlock.parentElement;
    const rawCode = codeBlock.textContent;

    // 코드 블록 언어 추출
    let lang = "";
    const classMatch = codeBlock.className.match(/language-(\w+)/);
    if (classMatch) {
      lang = classMatch[1];
    }

    // 파일 경로와 라인 정보 추출
    let filePath = "";
    let lineInfo = "";
    const fileMatch = rawCode.match(
      /^(.+\.[\w]+)(?:\s+\(lines\s+(\d+)-(\d+)\))?/
    );

    if (fileMatch) {
      filePath = fileMatch[1].trim();
      if (fileMatch[2] && fileMatch[3]) {
        lineInfo = `라인 ${fileMatch[2]}-${fileMatch[3]}`;
      }
    }

    // 코드가 diff인 경우 특별 처리
    if (
      lang === "diff" ||
      rawCode.includes("+++") ||
      rawCode.includes("---") ||
      rawCode.includes("+++ ") ||
      rawCode.includes("--- ") ||
      rawCode.match(/^@@ -\d+,\d+ \+\d+,\d+ @@/m)
    ) {
      // diff 감지
      const container = document.createElement("div");
      container.className = "code-container";

      // 파일 경로 헤더 추가
      if (filePath) {
        const pathHeader = document.createElement("div");
        pathHeader.className = "file-path";
        pathHeader.innerHTML = `<span>${filePath}</span>`;
        if (lineInfo) {
          pathHeader.innerHTML += `<span class="line-info">${lineInfo}</span>`;
        }
        container.appendChild(pathHeader);
      }

      // 에디터 컨테이너
      const editorDiv = document.createElement("div");
      editorDiv.className = "code-editor";
      editorDiv.id = `editor-${index}`;
      container.appendChild(editorDiv);

      // 에디터 초기화를 위해 preElement 대체
      preElement.parentNode.replaceChild(container, preElement);

      // diff 처리 및 원본 라인 번호 추출
      const diffProcessor = processDiff(rawCode, editorDiv.id);

      // CodeMirror 에디터 생성
      const editor = CodeMirror(editorDiv, {
        value: diffProcessor.processedCode,
        mode: getCodeMirrorMode(lang || diffProcessor.detectedLang),
        lineNumbers: true,
        readOnly: true,
        theme: "default",
        viewportMargin: Infinity,
      });

      // 라인 배경색 설정
      diffProcessor.lineTypes.forEach((type, line) => {
        if (type === "addition") {
          editor.addLineClass(line, "background", "CodeMirror-line-addition");
        } else if (type === "deletion") {
          editor.addLineClass(line, "background", "CodeMirror-line-deletion");
        }
      });

      // 원본 라인 번호 표시
      if (diffProcessor.originalLineNumbers) {
        const lineNumberElements = editorDiv.querySelectorAll(
          ".CodeMirror-linenumber"
        );
        diffProcessor.originalLineNumbers.forEach((originalLine, idx) => {
          if (originalLine && lineNumberElements[idx]) {
            const lineSpan = document.createElement("span");
            lineSpan.className = "original-line-number";
            lineSpan.textContent = `(${originalLine})`;
            lineNumberElements[idx].appendChild(lineSpan);
          }
        });
      }
    } else {
      // 일반 코드 블록 처리
      const container = document.createElement("div");
      container.className = "code-container";

      if (filePath) {
        const pathHeader = document.createElement("div");
        pathHeader.className = "file-path";
        pathHeader.innerHTML = `<span>${filePath}</span>`;
        if (lineInfo) {
          pathHeader.innerHTML += `<span class="line-info">${lineInfo}</span>`;
        }
        if (lang) {
          pathHeader.innerHTML += `<span class="language-badge">${lang}</span>`;
        }
        container.appendChild(pathHeader);
      }

      const editorDiv = document.createElement("div");
      editorDiv.className = "code-editor";
      editorDiv.id = `editor-${index}`;
      container.appendChild(editorDiv);

      preElement.parentNode.replaceChild(container, preElement);

      // 파일 경로와 라인 정보 제거
      let cleanCode = rawCode;
      if (fileMatch) {
        cleanCode = rawCode.substring(rawCode.indexOf("\n") + 1);
      }

      // CodeMirror 에디터 생성
      CodeMirror(editorDiv, {
        value: cleanCode,
        mode: getCodeMirrorMode(lang),
        lineNumbers: true,
        readOnly: true,
        theme: "default",
        viewportMargin: Infinity,
      });
    }
  });
}

// diff 코드 처리 함수
function processDiff(diffText, editorId) {
  const lines = diffText.split("\n");
  const processedLines = [];
  const lineTypes = [];
  const originalLineNumbers = [];

  let detectedLang = "";
  let inFileHeader = true;
  let currentOriginalLine = null;

  // 파일 확장자로 언어 감지
  const fileHeaderMatch = diffText.match(
    /^(?:diff --git a\/|---|\+\+\+)(.*?)(\.\w+)(?:\s|$)/m
  );
  if (fileHeaderMatch && fileHeaderMatch[2]) {
    const ext = fileHeaderMatch[2].substring(1);
    detectedLang = getLanguageFromExtension(ext);
  }

  lines.forEach((line, idx) => {
    // 파일 헤더 건너뛰기
    if (
      inFileHeader &&
      (line.startsWith("diff ") ||
        line.startsWith("---") ||
        line.startsWith("+++"))
    ) {
      return;
    }

    // Hunk 헤더 처리 (@@ -x,y +a,b @@)
    if (line.match(/^@@ -\d+,\d+ \+\d+,\d+ @@/)) {
      inFileHeader = false;
      const match = line.match(/@@ -(\d+),\d+ \+(\d+),\d+ @@/);
      if (match) {
        currentOriginalLine = parseInt(match[1], 10);
      }
      return;
    }

    inFileHeader = false;

    // 라인 처리
    if (line.startsWith("+")) {
      processedLines.push(line.substring(1));
      lineTypes.push("addition");
      originalLineNumbers.push(null); // 추가된 라인은 원본에 없음
    } else if (line.startsWith("-")) {
      processedLines.push(line.substring(1));
      lineTypes.push("deletion");
      originalLineNumbers.push(currentOriginalLine++);
    } else if (line.startsWith(" ")) {
      processedLines.push(line.substring(1));
      lineTypes.push("context");
      originalLineNumbers.push(currentOriginalLine++);
    } else {
      processedLines.push(line);
      lineTypes.push("normal");
      if (currentOriginalLine !== null) {
        originalLineNumbers.push(currentOriginalLine++);
      } else {
        originalLineNumbers.push(null);
      }
    }
  });

  return {
    processedCode: processedLines.join("\n"),
    lineTypes: lineTypes,
    originalLineNumbers: originalLineNumbers,
    detectedLang: detectedLang,
  };
}

// 파일 확장자로 언어 감지
function getLanguageFromExtension(ext) {
  const extMap = {
    js: "javascript",
    ts: "javascript",
    jsx: "javascript",
    tsx: "javascript",
    py: "python",
    rb: "ruby",
    java: "clike",
    cs: "clike",
    c: "clike",
    cpp: "clike",
    h: "clike",
    html: "htmlmixed",
    htm: "htmlmixed",
    css: "css",
    php: "php",
    go: "go",
    rs: "rust",
    swift: "swift",
    kt: "kotlin",
    md: "markdown",
    json: "javascript",
    xml: "xml",
    yml: "yaml",
    yaml: "yaml",
    sh: "shell",
    bash: "shell",
  };

  return extMap[ext.toLowerCase()] || "";
}

// CodeMirror 모드 반환
function getCodeMirrorMode(lang) {
  const modeMap = {
    javascript: "javascript",
    js: "javascript",
    typescript: "javascript",
    ts: "javascript",
    jsx: "jsx",
    tsx: "jsx",
    python: "python",
    py: "python",
    ruby: "ruby",
    rb: "ruby",
    java: "clike",
    c: "clike",
    cpp: "clike",
    csharp: "clike",
    cs: "clike",
    html: "htmlmixed",
    xml: "xml",
    css: "css",
    json: "javascript",
    go: "go",
    diff: "diff",
  };

  return modeMap[lang] || "javascript";
}

// 코드 추천 결과 적용 함수
async function applyRecommendation(modelName) {
  try {
    // 저장소 값 가져오기
    let repository;
    if (
      window.searchableSelectElements &&
      window.searchableSelectElements["repository"]
    ) {
      repository =
        window.searchableSelectElements["repository"].hiddenInput.value;
    } else {
      repository = document.getElementById("repository").value;
    }

    if (!repository) {
      alert("저장소를 선택해주세요.");
      return;
    }

    // 선택된 모델의 추천 결과 가져오기
    const tabContent = document.getElementById(`tab-${modelName}`);
    const contentDiv = tabContent.querySelector(".content");
    const recommendation = contentDiv.textContent;

    if (!recommendation || recommendation.includes("여기에")) {
      alert("유효한 코드 추천 결과가 없습니다.");
      return;
    }

    // diff 형식으로 변환
    let formattedDiff = "";

    // 파일 경로와 내용 추출 (한글 '파일:'도 인식)
    const fileMatch = recommendation.match(/(?:File:|파일:)\s*([^\n]+)/);
    if (!fileMatch) {
      console.log("파일 경로를 찾을 수 없습니다:", recommendation);
      alert("코드 추천 결과에서 파일 경로를 찾을 수 없습니다.");
      return;
    }

    let filePath = fileMatch[1].trim();

    // 라인 범위 추출
    const lineRangeMatch = filePath.match(/\(lines\s+(\d+)-(\d+)\)/);
    if (lineRangeMatch) {
      filePath = filePath.replace(/\(lines\s+\d+-\d+\)/, "").trim();
    }

    // 파일 내용 추출
    const contentMatch = recommendation.match(/```(?:diff)?\n([\s\S]*?)```/);
    if (!contentMatch) {
      console.log("코드 블록을 찾을 수 없습니다:", recommendation);
      alert("코드 추천 결과에서 코드 블록을 찾을 수 없습니다.");
      return;
    }

    let content = contentMatch[1].trim();

    // 불필요한 문자 제거
    content = content
      .replace(/[─\s]+/g, "")
      .replace(/설명:.*$/gm, "")
      .replace(/^x\d+\s*/gm, "")
      .trim();

    if (!content) {
      console.log("변경할 내용이 없습니다:", recommendation);
      alert("코드 추천 결과에 변경할 내용이 없습니다.");
      return;
    }

    const lines = content.split("\n");

    // diff 형식으로 변환
    formattedDiff += `diff --git a/${filePath} b/${filePath}\n`;
    formattedDiff += `index 0000000..0000000 100644\n`;
    formattedDiff += `--- a/${filePath}\n`;
    formattedDiff += `+++ b/${filePath}\n`;

    // 라인 수 계산
    const lineCount = lines.length;
    formattedDiff += `@@ -1,${lineCount} +1,${lineCount} @@\n`;

    // 각 라인을 diff 형식으로 변환
    lines.forEach((line) => {
      if (line.trim()) {
        formattedDiff += `+${line}\n`;
      } else {
        formattedDiff += "\n";
      }
    });

    formattedDiff += "\n";

    // diff 형식 확인
    const hasDiffFormat =
      formattedDiff.includes("diff --git") &&
      formattedDiff.includes("+++") &&
      formattedDiff.includes("---") &&
      formattedDiff.match(/^@@ -\d+,\d+ \+\d+,\d+ @@/m);

    if (!hasDiffFormat) {
      console.log("diff 형식 검증 실패. 추천 결과:", recommendation);
      console.log("변환된 diff:", formattedDiff);
      alert(
        "코드 추천 결과를 diff 형식으로 변환할 수 없습니다. 추천 결과를 확인해주세요."
      );
      return;
    }

    // 적용 확인
    if (!confirm("이 코드 추천을 저장소에 적용하시겠습니까?")) {
      return;
    }

    // 로딩 상태 표시
    const applyButton = document.getElementById(`apply-${modelName}`);
    if (applyButton) {
      applyButton.disabled = true;
      applyButton.innerHTML =
        '<span class="loading-spinner"></span> 적용 중...';
    }

    // 서버에 변경사항 적용 요청
    const response = await fetch("/api/apply-recommendation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repository,
        recommendation: formattedDiff,
        modelName,
      }),
    });

    const result = await response.json();

    if (result.success) {
      alert(
        `변경사항이 성공적으로 적용되었습니다.\n\n변경된 파일:\n${result.changes.join(
          "\n"
        )}`
      );

      // GitHub 저장소 페이지로 이동
      if (confirm("GitHub 저장소 페이지로 이동하시겠습니까?")) {
        window.open(`https://github.com/${repository}`, "_blank");
      }
    } else {
      throw new Error(
        result.message || "변경사항 적용 중 오류가 발생했습니다."
      );
    }
  } catch (error) {
    console.error("코드 추천 적용 중 오류:", error);
    alert(`오류가 발생했습니다: ${error.message}`);
  } finally {
    // 버튼 상태 복구
    const applyButton = document.getElementById(`apply-${modelName}`);
    if (applyButton) {
      applyButton.disabled = false;
      applyButton.innerHTML = '<span class="icon">💾</span> 변경사항 적용';
    }
  }
}
