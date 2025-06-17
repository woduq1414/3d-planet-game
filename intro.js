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
let isTypingComplete = false;
let isSkipped = false;
const subtitle = document.getElementById("subtitle");
const gameTitle = document.getElementById("gameTitle");
const startButton = document.getElementById("startButton");
const typingSound = document.getElementById("typingSound");
const moonSound = document.getElementById("moonSound");
const titleSound = document.getElementById("titleSound");





function typeNextChar() {
    if (isSkipped) return; // 스킵되었으면 실행 중단
    
    if (currentLine >= introScript.length) {
        completeTyping();
        return;
    }

    const line = introScript[currentLine];
    
    if (currentChar === 0) {
        typingSound.currentTime = 0;
        typingSound.play();
    }

    if (currentChar < line.length) {
        subtitle.innerHTML += line[currentChar];
        currentChar++;
        setTimeout(typeNextChar, 50);
    } else {
        typingSound.pause();
        if (currentLine === 3) {
            initMoonAnimation();
            moonSound.currentTime = 0;
            moonSound.play();
        }
        subtitle.innerHTML += "<br/>";
        currentLine++;
        currentChar = 0;
        setTimeout(() => {
            if (isSkipped) return; // 스킵되었으면 실행 중단
            subtitle.innerHTML = '';
            typeNextChar();
        }, 1350);
    }
}

function completeTyping() {
    isTypingComplete = true;
    typingSound.pause();
    startButton.style.display = "inline-block";
    gameTitle.style.display = "block";
    titleSound.currentTime = 0;
    titleSound.play();
    hideSkipMessage();
}

function skipTyping() {
    if (isTypingComplete) return;
    
    // 스킵 플래그 설정으로 모든 진행 중인 애니메이션/사운드 중단
    isSkipped = true;
    
    // 모든 사운드 중단
    typingSound.pause();
    moonSound.pause();
    
    // 화면을 클리어 (원래 스크립트 완료 후 상태와 동일하게)
    subtitle.innerHTML = '';
    
    // 달 애니메이션을 즉시 초기화하고 표시
    if (!moonScene) {
        console.log("initMoonAnimation");
        initMoonAnimation();

        document.getElementById('introCenter').style.opacity = '1';
    }
    
    // 달 컨테이너를 즉시 보이게 함
    const moonContainer = document.getElementById('moonCanvasContainer');
    if (moonContainer) {
        moonContainer.style.display = 'block';
        moonContainer.style.opacity = '1';
    }
    
    completeTyping();
}

function showSkipMessage() {
    let skipMessage = document.getElementById('skipMessage');
    if (!skipMessage) {
        skipMessage = document.createElement('div');
        skipMessage.id = 'skipMessage';
        skipMessage.innerHTML = 'SPACE 키를 눌러 스킵';
        skipMessage.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            color: #ffffff;
            font-size: 14px;
            opacity: 0.7;
            z-index: 1000;
            font-family: inherit;
        `;
        document.body.appendChild(skipMessage);
    }
    skipMessage.style.display = 'block';
}

function hideSkipMessage() {
    const skipMessage = document.getElementById('skipMessage');
    if (skipMessage) {
        skipMessage.style.display = 'none';
    }
}

window.addEventListener('load', () => {
    setTimeout(() => {
        typeNextChar();
        showSkipMessage();
    }, 1000);
});

// 스페이스바 키 이벤트 리스너 추가
window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        event.preventDefault(); // 스페이스바의 기본 동작 방지
        skipTyping();
    }
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