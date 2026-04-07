1. 1부터 20 스테이지 까지 있고 스테이지가 올라갈수록 커지는 방식으로 할거고 스테이지별 랭킹 관리할거야
2. 간단한 턴제로 아이템을 사용할수 있어야해
3. 실험적으로 발견하는 방식으로
4. 아 여기가 아니라 D:\sorajapp\claudeTest 이 경로에 만들어줘



실행 전 필수 작업 - Firebase 설정
src/firebase/config.ts 에서 실제 Firebase 키 입력:

Firebase Console → 새 프로젝트 생성
Authentication → Google 로그인 활성화
Firestore Database → 생성 (테스트 모드로 시작)
프로젝트 설정 → 웹 앱 추가 → SDK 설정 키 복사 → config.ts에 붙여넣기

cd D:/sorajapp/claudeTest/maze-game
npm run dev   # 개발 서버 실행


구현된 기능 요약
기능	상세
미로	Stage 1 (11×11) ~ Stage 20 (49×49), 재귀 역추적 완전 미로
시야	±1칸만 보임, 방문한 칸은 흐릿하게 표시, 미니맵 포함
몬스터	10종 (슬라임→드래곤), 스테이지별 강화, 턴제 전투
아이템	22종 (무기/방어구/포션/재료)
조합	16개 숨겨진 레시피 (실험으로 발견)
랭킹	스테이지별 상위 10명, 스텝 수 기준
이동	WASD/화살표키 + 모바일 스와이프 + 화면 버튼
