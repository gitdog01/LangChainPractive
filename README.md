# LangChain 기반 Node.js 애플리케이션

이 프로젝트는 LangChain과 OpenAI를 활용한 간단한 챗봇 애플리케이션입니다.

## 기능

- OpenAI의 GPT 모델을 활용한 대화형 챗봇
- LangChain의 체인 및 프롬프트 템플릿 사용
- Express 웹 서버를 통한 웹 인터페이스 제공

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

## 실행 방법

```bash
npm start
```

또는 개발 모드로 실행 (변경 사항 자동 반영):

```bash
npm run dev
```

서버가 실행되면 웹 브라우저에서 `http://localhost:3000`으로 접속하여 챗봇을 사용할 수 있습니다.

## 프로젝트 구조

- `main.js`: 메인 애플리케이션 코드
- `package.json`: 프로젝트 의존성 및 스크립트 정의
- `.env`: 환경 변수 파일

## 기술 스택

- Node.js
- Express
- LangChain
- OpenAI API
