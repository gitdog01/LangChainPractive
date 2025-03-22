const { Octokit } = require("@octokit/rest");

// GitHub 인증 미들웨어
async function authenticateUser(req, res, next) {
  try {
    if (!req.user || !req.user.accessToken) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }

    // GitHub API 클라이언트 생성
    const octokit = new Octokit({ auth: req.user.accessToken });

    // 사용자 정보 확인
    const { data: user } = await octokit.users.getAuthenticated();

    // 요청 객체에 사용자 정보 추가
    req.user = user;
    next();
  } catch (error) {
    console.error("인증 중 오류:", error);
    res.status(401).json({ error: "인증에 실패했습니다." });
  }
}

module.exports = {
  authenticateUser,
};
