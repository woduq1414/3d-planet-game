const introScript = [
    "2050년",
    "우주의 균형을 지탱하던 태양계는 알 수 없는 힘에 의해 흩어지고 말았다.",
    "그 결과 우주에는 끝없는 어둠과",
    "",
    "작고 귀여운 달만이 그 자리를 지키고 있었다.",
    "달은 \"모든 행성을 다시 합치면 우주의 평화가 돌아올거야!\" 라고 외치며",
    "행성을 모아 새로운 태양을 만들기 위한 여정을 시작한다.",
    "당신은 이 여정의 유일한 조종사.",
    "마우스를 이용해 행성을 쏘아올리고",
    "같은 행성을 합쳐 진화시키는 것만이",
    "우주의 운명을 되돌릴 수 있는 유일한 방법이다.",
    ""
];

let currentLine = 0;
let currentChar = 0;
let typingTimeoutId = null;
let isTypingSkipped = false;
let skipTextElement = null; // 스킵 안내 텍스트 요소 참조
const subtitle = document.getElementById("subtitle");
const gameTitle = document.getElementById("gameTitle");
const startButton = document.getElementById("startButton");

function hideSkipText() {
    if (skipTextElement) {
        skipTextElement.style.display = 'none';
    }
}

function skipTyping() {
    if (isTypingSkipped) return; // 이미 스킵했다면 무시
    
    isTypingSkipped = true;
    if (typingTimeoutId) {
        clearTimeout(typingTimeoutId);
    }
    
    // 달 애니메이션 즉시 실행
    initMoonAnimation();
    
    // 게임 시작 버튼과 제목 표시
    startButton.style.display = "inline-block";
    gameTitle.style.display = "block";
    
    // 자막 초기화
    subtitle.innerHTML = '';
    
    // 스킵 안내 텍스트 숨기기
    hideSkipText();
}

function typeNextChar() {
    if (isTypingSkipped) return;
    
    if (currentLine >= introScript.length) {
        startButton.style.display = "inline-block";
        gameTitle.style.display = "block";
        // 타이핑이 자연스럽게 끝났을 때도 스킵 텍스트 숨기기
        hideSkipText();
        return;
    }

    const line = introScript[currentLine];

    if (currentChar < line.length) {
        subtitle.innerHTML += line[currentChar];
        currentChar++;
        typingTimeoutId = setTimeout(typeNextChar, 50);
    } else {
        if (currentLine === 3) {
            initMoonAnimation();
        }
        subtitle.innerHTML += "<br/>";
        currentLine++;
        currentChar = 0;
        typingTimeoutId = setTimeout(() => {
            subtitle.innerHTML = '';
            typeNextChar();
        }, 1350);
    }
}

// 스페이스바 키 이벤트 리스너 추가
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        event.preventDefault(); // 스페이스바 기본 동작 방지
        
        // 이미 스킵했거나 게임 시작 버튼이 표시된 경우 무시
        if (isTypingSkipped || startButton.style.display === "inline-block") {
            return;
        }
        
        skipTyping();
    }
});

window.addEventListener('load', () => {
    // 스킵 안내 텍스트 추가
    skipTextElement = document.createElement('div');
    skipTextElement.innerHTML = 'SPACE 키를 눌러 스킵하세요';
    skipTextElement.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        color: rgba(255, 255, 255, 0.7);
        font-size: 14px;
        font-family: Arial, sans-serif;
        text-align: center;
        z-index: 1000;
        animation: pulse 2s infinite;
    `;
    
    // 펄스 애니메이션 CSS 추가
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { opacity: 0.7; }
            50% { opacity: 1; }
            100% { opacity: 0.7; }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(skipTextElement);
    
    setTimeout(typeNextChar, 1000);
});

let moonScene, moonCamera, moonRenderer, moonMesh;

function initMoonAnimation() {
    moonScene = new THREE.Scene();
    moonCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    moonCamera.position.z = 3;

    moonRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    moonRenderer.setSize(200, 200);
    document.getElementById('moonCanvasContainer').appendChild(moonRenderer.domElement);

    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const texture = new THREE.TextureLoader().load('textures/moon.png');
    const material = new THREE.MeshStandardMaterial({ map: texture });
    moonMesh = new THREE.Mesh(geometry, material);
    moonScene.add(moonMesh);

    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(5, 5, 5);
    moonScene.add(light);

    animateMoon();
}

function animateMoon() {
    requestAnimationFrame(animateMoon);
    moonMesh.rotation.y += 0.01;
    moonRenderer.render(moonScene, moonCamera);
}

function startGame() {
    const intro = document.getElementById('introScreen');
    const gameContainer = document.getElementById('gameContainer');
    
    // 게임 컨테이너를 먼저 표시
    gameContainer.style.display = 'block';
    
    // 인트로 화면 페이드 아웃
    intro.style.animation = "fadeOut 1s forwards";
    
    setTimeout(() => {
        // 인트로 화면 숨기기
        intro.style.display = 'none';
        
        // 게임 초기화
        if (typeof checkLibrariesAndInit === 'function') {
            checkLibrariesAndInit();
        } else {
            console.error('게임 초기화 함수를 찾을 수 없습니다.');
        }
    }, 1000);
}
