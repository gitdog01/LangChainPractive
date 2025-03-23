// =========================================================================
// LangChain 기반 코드 생성 추천기
// =========================================================================
// LangChain: 대규모 언어 모델(LLM)을 활용한 애플리케이션 개발을 위한 프레임워크
// RAG(Retrieval Augmented Generation): 외부 데이터를 검색하여 LLM의 응답을 강화하는 기법
// =========================================================================

// LangSmith 콜백 백그라운드 처리 설정 (LangChain 경고 해결을 위해 추가)
process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "true";

// 기본 의존성 로드
require("dotenv").config(); // .env 파일에서 환경 변수 로드
const express = require("express"); // 웹 서버 프레임워크
const session = require("express-session");
const passport = require("passport");
const connectDB = require("./config/database");
const config = require("./config/config");
const apiRoutes = require("./routes/api");
const { getMainTemplate } = require("./utils/frontend/templates");
const GitHubStrategy = require("passport-github2").Strategy;
const { Octokit } = require("@octokit/rest");
const MongoStore = require("connect-mongo");

// =========================================================================
// 환경변수 확인
// =========================================================================
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey || apiKey === "your-api-key") {
  console.error(
    "⚠️  OpenAI API 키가 설정되지 않았습니다. .env 파일에 OPENAI_API_KEY를 설정해주세요."
  );
  process.exit(1);
}

// Express 앱 설정
const app = express();

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// 세션 설정
app.use(
  session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 24 * 60 * 60, // 1일
    }),
  })
);

// Passport 초기화
app.use(passport.initialize());
app.use(passport.session());

// Passport 설정
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// GitHub 전략 설정
passport.use(
  new GitHubStrategy(
    {
      clientID: config.github.clientId,
      clientSecret: config.github.clientSecret,
      callbackURL: config.github.callbackUrl,
      scope: ["repo", "user"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const octokit = new Octokit({ auth: accessToken });

        // 사용자의 저장소 목록 가져오기
        const { data: repos } =
          await octokit.rest.repos.listForAuthenticatedUser({
            sort: "updated",
            per_page: 100,
          });

        // 저장소 정보 정리
        const repositories = repos.map((repo) => ({
          fullName: repo.full_name,
          name: repo.name,
          description: repo.description,
          language: repo.language,
          stars: repo.stargazers_count,
        }));

        // 사용자 프로필 정보 정리
        const userProfile = {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          avatar: profile.photos[0].value,
          repositories,
          accessToken,
        };

        return done(null, userProfile);
      } catch (error) {
        console.error("GitHub 인증 중 오류 발생:", error);
        return done(error, null);
      }
    }
  )
);

// =========================================================================
// API 라우트 설정
// =========================================================================

// 라우트 설정
app.use("/api", apiRoutes);

// 기본 HTML 페이지 제공
app.get("/", (req, res) => {
  const html = getMainTemplate(req.isAuthenticated(), req.user);
  res.send(html);
});

// GitHub OAuth 라우트
app.get("/auth/github", passport.authenticate("github"));

app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/");
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

// =========================================================================
// 서버 시작 및 초기화
// =========================================================================

// 서버 시작 함수
async function startServer() {
  try {
    // MongoDB 연결
    await connectDB();

    // 서버 시작
    app.listen(config.server.port, () => {
      console.log(`🚀 서버가 포트 ${config.server.port}에서 실행 중입니다.`);
      console.log(
        `💻 웹 브라우저에서 http://localhost:${config.server.port}/ 를 열어 앱을 사용해보세요.`
      );
    });
  } catch (error) {
    console.error("❌ 서버 시작 중 오류 발생:", error);
    process.exit(1);
  }
}

// 서버 시작
startServer();
