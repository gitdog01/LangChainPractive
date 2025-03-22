const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const User = require("../models/User");

// GitHub OAuth 설정
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

passport.use(
  new GitHubStrategy(
    {
      clientID: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL: GITHUB_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 기존 사용자 찾기
        let user = await User.findOne({ githubId: profile.id });

        if (!user) {
          // 새 사용자 생성
          user = await User.create({
            githubId: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            email: profile.emails?.[0]?.value,
            avatar: profile._json.avatar_url,
            accessToken,
          });
        } else {
          // 기존 사용자 정보 업데이트
          user.accessToken = accessToken;
          user.lastLogin = new Date();
          await user.save();
        }

        // GitHub API를 사용하여 사용자의 저장소 목록 가져오기
        const reposResponse = await fetch("https://api.github.com/user/repos", {
          headers: {
            Authorization: `token ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (reposResponse.ok) {
          const repos = await reposResponse.json();
          user.repositories = repos.map((repo) => ({
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            private: repo.private,
            updatedAt: repo.updated_at,
          }));
          await user.save();
        }

        done(null, user);
      } catch (error) {
        done(error);
      }
    }
  )
);

module.exports = passport;
