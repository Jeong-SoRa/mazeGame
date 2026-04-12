### 요구사항
1. 웹 플랫폼에서 간단히 플레이할 수 있는 게임
2. 구글 로그인을 통해 데이터 유지
3. 출발해서 목적지까지 최단기간에 찾아가는 2차원 도트형 미로 게임
4. 주인공 시점으로 1한칸까지의 시야만 확보되서 길을 외워야 빨리 깰 수 있음.
5. 한 칸씩 갈때마다 몬스터를 잡거나 보물상자를 열수있다. 
6. 몬스터를 잡거나 보물상자를 열면 아이템이 나온다. 
7. 아이템을 조합해서 새로운 아이템을 생성할 수 있다. 
8. 생성된 아이템으로 몬스터를 잡거나 또 새로운 아이템을 생성할 수 있다. 

#### 상세 요구사항
1. 1부터 20 스테이지 까지 있고 스테이지가 올라갈수록 커지는 방식으로 할거고 스테이지별 랭킹 관리할거야
2. 간단한 턴제로 아이템을 사용할수 있어야해
3. 실험적으로 발견하는 방식으로

### 구현된 기능 요약
- 미로	
- Stage 1 (11×11) ~ Stage 20 (49×49), 재귀 역추적 완전 미로
- 시야	±1칸만 보임, 방문한 칸은 흐릿하게 표시, 미니맵 포함
- 몬스터	10종 (슬라임→드래곤), 스테이지별 강화, 턴제 전투
- 아이템	22종 (무기/방어구/포션/재료)
- 조합	16개 숨겨진 레시피 (실험으로 발견)
- 랭킹	스테이지별 상위 10명, 스텝 수 기준
- 이동	WASD/화살표키 + 모바일 스와이프 + 화면 버튼


### 실행 전 필수 작업 
#### Firebase 설정
src/firebase/config.ts 에서 실제 Firebase 키 입력:

    1. Firebase Console → 새 프로젝트 생성
    2. Authentication → Google 로그인 활성화
    3. Firestore Database → 생성 (테스트 모드로 시작)
    4. 프로젝트 설정 → 웹 앱 추가 → SDK 설정 키 복사 → config.ts에 붙여넣기

#### claude 코드 관련 환경변수 설정
    터미널에서 아래 명령어 실행
```
set ANTHROPIC_MAX_OUTPUT_TOKENS=8000
set ANTHROPIC_MAX_THINKING_TOKENS=10000
set ANTHROPIC_CLAUDE_CODE_SUBAGENT_MODE=haiku
```

### 실행하기
#### 로컬
cd D:/sorajapp/claudeTest/maze-game
npm run dev   # 개발 서버 실행

### firebase 에 배포하기
    클로드 사용하여 수정된 소스를 git에 push하도록 함

### 환경구성
#### claude code안에서 실행
    ```
    /plugin marketplace add https://github.com/affaan-m/everythin-claude-code
    /plugin install ecc@ecc
    ```
#### firebase 호스팅 설정
    1. firebase cli 설치
    ```
    npm install -g firebase-tools
    ```
    2. 프로젝트 초기화
    ```
    firebase login
    firebase init
    ```
    3. firebase 호스팅에 배포하기
    ```
    정적 파일(예: HTML, CSS, JS)을 앱의 배포 디렉터리에 배치합니다. 
    기본값은 '공개'입니다. 그런 다음 앱의 루트 디렉터리에서 이 명령어를 실행합니다.

    npm run build && firebase deploy
    ```
    4. 배포후 확인
        https://breaking-maze.web.app/
        // 테스트용 지금은 사용안함
        https://maze-breakout.web.app/

## 개발 중 상세 사항
2. 스테이지별 미로 고정화
    MazeGenerator.ts:8-22에서 시드 기반 랜덤 생성기(SeededRandom) 구현
    MazeGenerator.ts:109에서 스테이지별 고정 시드 사용 (stage * 982451653 + 67867967)
    동일한 미로 패턴이 생성되어 랭킹 시스템에 적합합니다.

3. 속성 시스템 추가

    속성 타입: 바람 💨, 불 🔥, 물 💧, 나무 🌿

    상성 시스템: 바람 > 나무 > 물 > 불 > 바람 (순환 상성)

    상성 유리: 1.5배 데미지 ("효과가 뛰어나다!")
    상성 불리: 0.7배 데미지 ("효과가 별로다...")
    적용된 곳:

    캐릭터: 전사(불), 마법사(물), 도적(바람) - CharacterSelect.tsx:12-28
    -> 불 고양이, 물 고양이, 바람 고양이로 변경

    몬스터: 각 몬스터별 고유 속성 - MonsterDatabase.ts:4-91
    아이템: 무기/방어구에 속성 추가 - ItemDatabase.ts:6-50
    전투: 속성 상성에 따른 데미지 계산 - CombatSystem.ts:42-82
    UI: 캐릭터 선택 화면에 속성 표시
    
    
    todo
    1. 전투로그도 액션로그에 보이도록 한다. -완
    2. 몬스터를 만났을 때 몬스터가 화면을 벗어난다. 
    3. 전투 후 원래 플레이 상태로 돌아오지 않는 오류가 있음. 
    4. 몬스터의 어택 액션이 필요함.
    5. 음악 및 효과음 넣기