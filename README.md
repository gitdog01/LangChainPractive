# LangChain 기반 코드 생성 추천기

이 프로젝트는 LangChain과 OpenAI를 활용한 코드 생성 추천 애플리케이션입니다. 사용자의 요청에 따라 기존 코드베이스를 분석하고 적절한 코드 수정 방법을 추천해줍니다.

## 기능

- 소스 코드를 메모리 기반 벡터 저장소(Memory Vector Store)로 변환하여 저장
- RAG(Retrieval Augmented Generation) 기술을 활용한 관련 코드 검색
- 사용자 요청에 맞는 코드 수정 방법 추천
- 웹 인터페이스를 통한 쉬운 사용
- **다중 모델 지원**: GPT-4o, GPT-o3-mini 등 여러 모델의 결과를 동시에 비교 가능
- **비용 최적화**: 필요에 따라 특정 모델 비활성화 기능 제공
- **시각적 Diff 형식**: 추가/삭제되는 코드를 색상으로 구분하여 명확하게 표시

## 작동 원리

1. **코드 인덱싱**: Target 폴더 내의 소스 코드 파일을 로드하여 메모리 기반 벡터 저장소로 변환합니다.
2. **검색 및 추천**: 사용자 요청이 들어오면 관련 코드를 검색하고 LLM을 활용하여 코드 수정 방법을 추천합니다.
3. **RAG 접근 방식**: 검색된 코드를 컨텍스트로 제공하여 더 정확하고 관련성 높은 추천을 생성합니다.
4. **병렬 추론**: 활성화된 모든 모델이 동시에 추론을 수행하여 사용자에게 다양한 관점 제공합니다.

## 설치 방법

1. 저장소 클론

```bash
git clone https://github.com/your-username/langchain-app.git
cd langchain-app
```

2. 의존성 설치

```bash
npm install
```

3. 환경 변수 설정
   `.env` 파일을 생성하고 OpenAI API 키를 설정합니다:

```
OPENAI_API_KEY=your-api-key
```

## 사용 방법

1. 애플리케이션 실행

```bash
npm start
```

2. 웹 브라우저에서 `http://localhost:3000` 접속

3. Target 디렉토리에 분석하려는 소스 코드 파일 추가

4. '벡터 저장소 갱신' 버튼을 클릭하여 코드 인덱싱

5. 구현하고 싶은, 또는 수정하고 싶은 기능에 대한 요청을 입력하고 '코드 추천 받기' 버튼 클릭

6. 다양한 모델의 추천 결과를 탭을 통해 비교 확인

## 프로젝트 구조

- `main.js`: 메인 애플리케이션 코드
- `package.json`: 프로젝트 의존성 및 스크립트 정의
- `.env`: 환경 변수 파일
- `Target/`: 분석할 소스 코드가 위치하는 디렉토리
- `daily_log.md`: 개발 일지 및 성능 개선 계획

## LangChain 기술 요소

- **텍스트 분할(Text Splitting)**: 큰 소스 코드 파일을 작은 청크로 분할
- **임베딩(Embeddings)**: 텍스트를 벡터로 변환하여 의미적 검색 가능
- **벡터 저장소(Vector Store)**: 임베딩된 코드 조각을 저장하고 검색하기 위한 저장소
- **RAG(Retrieval Augmented Generation)**: 관련 코드를 검색하여 LLM 응답을 강화
- **프롬프트 템플릿(Prompt Templates)**: LLM에 전달할 프롬프트를 구조화
- **병렬 실행(Parallel Execution)**: 여러 모델을 동시에 실행하여 효율성 향상

## 기술 스택

- Node.js
- Express
- LangChain (최신 @langchain/core, @langchain/openai 패키지 사용)
- OpenAI API (GPT-4o, GPT-o3-mini, GPT-o1 모델 지원)
- MemoryVectorStore (메모리 기반 벡터 저장소)

## 최근 업데이트

- LangChain 의존성 최신화: 구 버전의 의존성에서 @langchain/core, @langchain/openai로 마이그레이션
- 다중 모델 지원: 여러 OpenAI 모델(GPT-4o, GPT-o3-mini, GPT-o1)의 동시 실행 및 결과 비교
- 모델 비활성화 기능: 비용 절약을 위한 특정 모델 비활성화 기능 추가 (현재 GPT-o1 비활성화 상태)
- UI 개선: 비활성화된 모델에 대한 시각적 표시 및 탭 인터페이스 개선
