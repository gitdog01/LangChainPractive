const getMainTemplate = (isAuthenticated, user) => {
  return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>코드 생성 추천기</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/merge/merge.min.css">
      <link rel="stylesheet" href="/css/styles.css">
    </head>
    <body>
      <h1>LangChain 코드 생성 추천기</h1>
      ${
        isAuthenticated && user
          ? `
        <div class="user-info">
          <a href="https://github.com/${
            user.username
          }" target="_blank" title="GitHub 프로필 방문">
            <img src="${
              user.avatar || "https://github.com/github.png"
            }" alt="프로필" style="width: 40px; height: 40px; border-radius: 50%;">
            <span>${user.displayName || user.username || "사용자"}</span>
          </a>
          <a href="/logout" class="logout-btn">로그아웃</a>
        </div>
      `
          : `
        <div class="login-container">
          <a href="/auth/github" class="github-btn">GitHub로 로그인</a>
        </div>
      `
      }
      
      ${isAuthenticated && user ? getLoggedInTemplate(user) : ""}
      
      <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/highlight.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/javascript/javascript.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/xml/xml.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/css/css.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/htmlmixed/htmlmixed.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/python/python.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/merge/merge.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/diff_match_patch/20121119/diff_match_patch.js"></script>
      <script src="/js/frontend.js"></script>
    </body>
    </html>
  `;
};

const getLoggedInTemplate = (user) => {
  if (!user || !user.repositories) {
    return `
      <div class="container">
        <div class="left-panel">
          <div class="form-group">
            <label for="repository">GitHub 저장소 선택:</label>
            <select id="repository" class="form-control">
              <option value="">저장소를 불러오는 중...</option>
            </select>
            <button id="goto-repo-btn" class="goto-repo-btn" title="선택된 저장소로 이동" onclick="goToRepository()">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </button>
          </div>
          <div class="form-group">
            <label for="request">기능 요청:</label>
            <textarea id="request" placeholder="예: '사용자 인증 기능을 추가하고 싶습니다...'"></textarea>
          </div>
          <div class="button-container">
            <button class="recommend-btn" id="recommend-btn" onclick="getCodeRecommendation()">
              <span class="icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </span>
              <span class="label">코드 추천 받기</span>
            </button>
            <button class="refresh-btn" id="refresh-btn" onclick="refreshVectorStore()">
              <span class="icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg>
              </span>
              <span class="label">벡터 저장소 갱신</span>
            </button>
            <button class="disconnect-btn" id="disconnect-btn" onclick="disconnectVectorStore()" title="벡터 저장소 연동 해제">
              <span class="icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </span>
              <span class="label">벡터 저장소 연동 해제</span>
            </button>
          </div>
          
          <div class="settings-panel">
            <h3>고급 설정 <button class="toggle-btn" onclick="toggleSettings()">▲</button></h3>
            <div id="advanced-settings">
              <div class="settings-group">
                <h4>텍스트 분할 설정</h4>
                <div class="setting-item">
                  <label for="chunkSize">청크 사이즈:</label>
                  <input type="number" id="chunkSize" min="100" max="5000" value="1000" class="setting-input">
                </div>
                <div class="setting-item">
                  <label for="chunkOverlap">오버랩 크기:</label>
                  <input type="number" id="chunkOverlap" min="0" max="1000" value="200" class="setting-input">
                </div>
              </div>
              <div class="settings-group">
                <h4>검색 설정</h4>
                <div class="setting-item">
                  <label for="maxResults">검색 결과 수:</label>
                  <input type="number" id="maxResults" min="1" max="20" value="5" class="setting-input">
                </div>
              </div>
            </div>
          </div>
          
          <div class="model-status-panel">
            <h3>모델 상태</h3>
            <div id="model-status" class="model-status">
              <div class="model-status-item">
                <div class="status-dot" id="status-gpt-4o"></div>
                <span>GPT-4o</span>
              </div>
              <div class="model-status-item">
                <div class="status-dot" id="status-gpt-o3-mini"></div>
                <span>GPT-o3-mini</span>
              </div>
              <div class="model-status-item">
                <div class="status-dot" id="status-gpt-o1"></div>
                <span class="disabled-model-text">GPT-o1</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="right-panel">
          <h2>코드 추천 결과</h2>
          <div id="recommendation-tabs" class="tab-container">
            <div class="tab-nav">
              <button class="tab-btn active" data-tab="gpt-4o">GPT-4o</button>
              <button class="tab-btn" data-tab="gpt-o3-mini">GPT-o3-mini</button>
              <button class="tab-btn" data-tab="gpt-o1">GPT-o1</button>
            </div>
            ${createTabContent("gpt-4o")}
            ${createTabContent("gpt-o3-mini")}
            ${createTabContent("gpt-o1")}
          </div>
          
          <h3>관련 파일</h3>
          <div id="relevantFiles">관련 파일이 여기에 표시됩니다...</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="container">
      <div class="left-panel">
        <div class="form-group">
          <label for="repository">GitHub 저장소 선택:</label>
          <div class="repository-container">
            <select id="repository" class="form-control">
              ${user.repositories
                .map(
                  (repo) => `
                <option value="${repo.fullName}" data-description="${
                    repo.description || ""
                  }" data-language="${repo.language || ""}" data-stars="${
                    repo.stars || 0
                  }" data-has-vectors="false" data-updated-at="${
                    repo.updatedAt || ""
                  }">
                  ${repo.fullName}
                  ${repo.language ? ` (${repo.language})` : ""}
                  ${repo.stars ? ` ⭐ ${repo.stars}` : ""}
                </option>
              `
                )
                .join("")}
            </select>
            <button id="goto-repo-btn" class="goto-repo-btn" title="선택된 저장소로 이동" onclick="goToRepository()">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </button>
          </div>
          <div class="repo-info" style="margin-top: 10px; font-size: 0.9em; color: #666;">
            <div id="repo-description"></div>
          </div>
        </div>
        <div class="form-group">
          <label for="request">기능 요청:</label>
          <textarea id="request" placeholder="예: '사용자 인증 기능을 추가하고 싶습니다...'"></textarea>
        </div>
        <div class="button-container">
          <button class="recommend-btn" id="recommend-btn" onclick="getCodeRecommendation()">
            <span class="icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </span>
            <span class="label">코드 추천 받기</span>
          </button>
          <button class="refresh-btn" id="refresh-btn" onclick="refreshVectorStore()">
            <span class="icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg>
            </span>
            <span class="label">벡터 저장소 갱신</span>
          </button>
          <button class="disconnect-btn" id="disconnect-btn" onclick="disconnectVectorStore()" title="벡터 저장소 연동 해제">
            <span class="icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </span>
          <span class="label">벡터 저장소 연동 해제</span>
        </button>
        </div>
        
        <div class="settings-panel">
          <h3>고급 설정 <button class="toggle-btn" onclick="toggleSettings()">▲</button></h3>
          <div id="advanced-settings">
            <div class="settings-group">
              <h4>텍스트 분할 설정</h4>
              <div class="setting-item">
                <label for="chunkSize">청크 사이즈:</label>
                <input type="number" id="chunkSize" min="100" max="5000" value="1000" class="setting-input">
              </div>
              <div class="setting-item">
                <label for="chunkOverlap">오버랩 크기:</label>
                <input type="number" id="chunkOverlap" min="0" max="1000" value="200" class="setting-input">
              </div>
            </div>
            <div class="settings-group">
              <h4>검색 설정</h4>
              <div class="setting-item">
                <label for="maxResults">검색 결과 수:</label>
                <input type="number" id="maxResults" min="1" max="20" value="5" class="setting-input">
              </div>
            </div>
          </div>
        </div>
        
        <div class="model-status-panel">
          <h3>모델 상태</h3>
          <div id="model-status" class="model-status">
            <div class="model-status-item">
              <div class="status-dot" id="status-gpt-4o"></div>
              <span>GPT-4o</span>
            </div>
            <div class="model-status-item">
              <div class="status-dot" id="status-gpt-o3-mini"></div>
              <span>GPT-o3-mini</span>
            </div>
            <div class="model-status-item">
              <div class="status-dot" id="status-gpt-o1"></div>
              <span class="disabled-model-text">GPT-o1</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="right-panel">
        <h2>코드 추천 결과</h2>
        <div id="recommendation-tabs" class="tab-container">
          <div class="tab-nav">
            <button class="tab-btn active" data-tab="gpt-4o">GPT-4o</button>
            <button class="tab-btn" data-tab="gpt-o3-mini">GPT-o3-mini</button>
            <button class="tab-btn" data-tab="gpt-o1">GPT-o1</button>
          </div>
          ${createTabContent("gpt-4o")}
          ${createTabContent("gpt-o3-mini")}
          ${createTabContent("gpt-o1")}
        </div>
        
        <h3>관련 파일</h3>
        <div id="relevantFiles">관련 파일이 여기에 표시됩니다...</div>
      </div>
    </div>
  `;
};

const getLoginTemplate = () => `
<div class="login-container">
  <a href="/auth/github" class="github-btn">GitHub로 로그인</a>
</div>
`;

// 탭 컨텐츠 템플릿 생성 함수
function createTabContent(modelName) {
  return `
    <div id="tab-${modelName}" class="tab-content markdown">
      <div class="loading" style="display: none;">
        <div class="loading-spinner"></div>
        <p>${modelName} 모델로 코드 추천 생성 중...</p>
      </div>
      <div class="content">여기에 ${modelName} 코드 추천이 표시됩니다...</div>
      <div class="apply-container">
        <button id="apply-${modelName}" class="apply-btn" onclick="applyRecommendation('${modelName}')">
          <span class="icon">💾</span>
          <span class="label">변경사항 적용</span>
        </button>
      </div>
    </div>
  `;
}

module.exports = {
  getMainTemplate,
  getLoggedInTemplate,
  getLoginTemplate,
};
