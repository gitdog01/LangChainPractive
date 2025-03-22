const getMainTemplate = (isAuthenticated, user) => {
  return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>코드 생성 추천기</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css">
      <link rel="stylesheet" href="/css/styles.css">
    </head>
    <body>
      <h1>LangChain 코드 생성 추천기</h1>
      ${
        isAuthenticated && user
          ? `
        <div class="user-info">
          <img src="${
            user.avatar || "https://github.com/github.png"
          }" alt="프로필" style="width: 40px; height: 40px; border-radius: 50%;">
          <span>${user.displayName || user.username || "사용자"}</span>
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
          </div>
          <div class="form-group">
            <label for="request">기능 요청:</label>
            <textarea id="request" placeholder="예: '사용자 인증 기능을 추가하고 싶습니다...'"></textarea>
          </div>
          <button onclick="getCodeRecommendation()">코드 추천 받기</button>
          <button class="refresh-btn" onclick="refreshVectorStore()">벡터 저장소 갱신</button>
          
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
            <div id="tab-gpt-4o" class="tab-content active markdown">
              <div class="loading" style="display: none;">
                <div class="loading-spinner"></div>
                <p>GPT-4o 모델로 코드 추천 생성 중...</p>
              </div>
              <div class="content">여기에 GPT-4o 코드 추천이 표시됩니다...</div>
            </div>
            <div id="tab-gpt-o3-mini" class="tab-content markdown">
              <div class="loading" style="display: none;">
                <div class="loading-spinner"></div>
                <p>GPT-o3-mini 모델로 코드 추천 생성 중...</p>
              </div>
              <div class="content">여기에 GPT-o3-mini 코드 추천이 표시됩니다...</div>
            </div>
            <div id="tab-gpt-o1" class="tab-content markdown">
              <div class="loading" style="display: none;">
                <div class="loading-spinner"></div>
                <p>GPT-o1 모델로 코드 추천 생성 중...</p>
              </div>
              <div class="content">여기에 GPT-o1 코드 추천이 표시됩니다...</div>
            </div>
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
          <div class="repo-info" style="margin-top: 10px; font-size: 0.9em; color: #666;">
            <div id="repo-description"></div>
          </div>
        </div>
        <div class="form-group">
          <label for="request">기능 요청:</label>
          <textarea id="request" placeholder="예: '사용자 인증 기능을 추가하고 싶습니다...'"></textarea>
        </div>
        <button onclick="getCodeRecommendation()">코드 추천 받기</button>
        <button class="refresh-btn" onclick="refreshVectorStore()">벡터 저장소 갱신</button>
        
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
          <div id="tab-gpt-4o" class="tab-content active markdown">
            <div class="loading" style="display: none;">
              <div class="loading-spinner"></div>
              <p>GPT-4o 모델로 코드 추천 생성 중...</p>
            </div>
            <div class="content">여기에 GPT-4o 코드 추천이 표시됩니다...</div>
          </div>
          <div id="tab-gpt-o3-mini" class="tab-content markdown">
            <div class="loading" style="display: none;">
              <div class="loading-spinner"></div>
              <p>GPT-o3-mini 모델로 코드 추천 생성 중...</p>
            </div>
            <div class="content">여기에 GPT-o3-mini 코드 추천이 표시됩니다...</div>
          </div>
          <div id="tab-gpt-o1" class="tab-content markdown">
            <div class="loading" style="display: none;">
              <div class="loading-spinner"></div>
              <p>GPT-o1 모델로 코드 추천 생성 중...</p>
            </div>
            <div class="content">여기에 GPT-o1 코드 추천이 표시됩니다...</div>
          </div>
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

module.exports = {
  getMainTemplate,
  getLoggedInTemplate,
  getLoginTemplate,
};
