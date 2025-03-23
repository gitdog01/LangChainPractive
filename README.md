# LangChain 기반 코드 생성 추천기

이 프로젝트는 LangChain과 OpenAI를 활용한 코드 생성 추천 애플리케이션입니다. 사용자의 요청에 따라 기존 코드베이스를 분석하고 적절한 코드 수정 방법을 추천해줍니다.

## 기능

- 소스 코드를 MongoDB Atlas Search 기반 벡터로 변환하여 저장
- RAG(Retrieval Augmented Generation) 기술을 활용한 관련 코드 검색
- 사용자 요청에 맞는 코드 수정 방법 추천
- GitHub OAuth를 통한 사용자 인증 및 저장소 접근
- 자동 벡터 저장소 갱신 기능

## 설치 방법

### 전제 조건

- Node.js (v14 이상)
- MongoDB Atlas 계정
- OpenAI API 키
- GitHub OAuth 앱 등록

### 설치 단계

1. 저장소 클론

```bash
git clone https://github.com/your-username/LangChainPractice.git
cd LangChainPractice
```

2. 의존성 설치

```bash
npm install
```

3. 환경 변수 설정
   `.env.example` 파일을 복사하여 `.env` 파일 생성 후 필요한 정보를 입력합니다.

```bash
cp .env.example .env
```

## 환경 변수 설정

`.env` 파일에 다음 정보를 설정해야 합니다:

```
# OpenAI API 설정 (필수)
OPENAI_API_KEY=your_openai_api_key_here

# 서버 설정
PORT=3000
SESSION_SECRET=your_session_secret

# MongoDB 설정
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/database"

# GitHub OAuth 설정
GITHUB_CLIENT_ID="깃허브 클라이언트 ID"
GITHUB_CLIENT_SECRET="깃허브 클라이언트 시크릿"
GITHUB_CALLBACK_URL="http://localhost:3000/auth/github/callback"

# 텍스트 청크 설정 (선택 사항)
CHUNK_SIZE=1000
CHUNK_OVERLAP=200

# LangSmith 관련 설정 (선택 사항)
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
LANGSMITH_API_KEY="your_langsmith_api_key_here"
LANGSMITH_PROJECT="YourProjectName"
```

## MongoDB Atlas Search 인덱스 설정

이 애플리케이션은 MongoDB Atlas의 벡터 검색 기능을 사용합니다. 다음 단계를 따라 벡터 검색 인덱스를 설정하세요:

1. MongoDB Atlas 콘솔에 로그인합니다.
2. 해당 클러스터의 "Search" 탭으로 이동합니다.
3. "Create Index" 버튼을 클릭합니다.
4. JSON 편집기를 선택하고 다음 인덱스 정의를 입력합니다:

```json
{
  "mappings": {
    "dynamic": true,
    "fields": {
      "embedding": {
        "dimensions": 1536,
        "similarity": "cosine",
        "type": "knnVector"
      }
    }
  },
  "name": "vector_index"
}
```

5. 데이터베이스와 컬렉션을 선택하고(기본값은 `vectors` 컬렉션) 인덱스를 생성합니다.

## 실행 방법

### 개발 모드로 실행

```bash
npm run dev
```

### 프로덕션 모드로 실행

```bash
npm start
```

서버가 시작되면 웹 브라우저에서 http://localhost:3000 으로 접속하여 애플리케이션을 사용할 수 있습니다.

## 사용 방법

1. 첫 화면에서 GitHub 계정으로 로그인합니다.
2. 로그인 후 저장소 목록이 표시됩니다.
3. 분석하고자 하는 저장소를 선택합니다.
4. 코드 추천을 받고 싶은 내용을 질의합니다.
5. 시스템은 관련 코드를 찾아 추천 사항을 제공합니다.

## 벡터 저장소 관리

저장소의 코드가 변경되었을 경우, 벡터 저장소를 갱신할 수 있습니다:

1. 저장소를 선택한 상태에서 "벡터 저장소 갱신" 버튼을 클릭합니다.
2. 새로운 코드가 분석되어 벡터로 변환됩니다.

## 라이센스

이 프로젝트는 MIT 라이센스를 따릅니다.
