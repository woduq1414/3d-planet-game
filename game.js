// 업데이트 사항 (박재현)
// 1. 초반에 행성 3개 소환 후 화성을 만드는데, 이는 그냥 행성 1개를 만드는 것과 동일하여 createTestPlanet 함수 수정
// 2. 행성이 중력장 내에 위치하고 충분한 시간이 지나도 떨림 현상 발생. 이를 방지하기 위해 추가 코드 작성.
// 3. 발사 파워에서 게이지가 제대로 표시 안된점 수정, 최대 100% 까지 표시는되는데, 실제론 50%임 (50%를 100%로 표시되게.)
// 4. 발사시 딜레이 추가. 1초.

// 게임 설정 상수들 (고정값으로 변경)
const GAME_CONFIG = {
    gravity: 35,      // 중력 세기
    maxPower: 6,      // 최대 발사 파워
    areaSize: 5,      // 중력장 크기
    trajectorySteps: 120  // 궤적 계산 점의 개수
};

// 게임 변수들
let scene, camera, renderer, world;
let planets = [];
let gameContainer, gameArea;
let score = 0;
let bestScore = localStorage.getItem('sputnika3d-best') || 0;
let gameRunning = true;
let nextPlanetType = 0;
let dropLine;
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();

// 발사 시스템 변수들
let isDragging = false;
let dragStart = new THREE.Vector2();
let dragEnd = new THREE.Vector2();
let launchPower = 0;
let trajectoryLine;
let aimingPlanet; // 조준용 행성
let crosshair; // 십자선
let isLaunching = false; // 발사 중복 방지를 위한 상태 변수 추가
let canDrag = true; // 드래그 가능 여부를 나타내는 변수 추가 (박재현)

// 카메라 공전 시스템 변수들
let cameraAngle = 0; // Y축 기준 회전 각도 (라디안)
let cameraDistance = 15; // 중력장 중심으로부터의 거리 (20에서 15로 감소)
let cameraHeight = 5; // Y 높이를 0에서 5로 변경

// 카메라 부드러운 움직임을 위한 속도 변수들
let cameraAngleVelocity = 0; // 각도 회전 속도
let cameraHeightVelocity = 0; // 높이 변화 속도

// 카메라 움직임 설정
const CAMERA_SETTINGS = {
    acceleration: 0.003, // 가속도 (각도 회전용)
    friction: 0.92,      // 마찰력 (0~1, 1에 가까울수록 부드럽게 감속)
    maxSpeed: 0.05,      // 최대 속도 (각도 회전용)
    heightAcceleration: 0.008, // 높이 방향 가속도 (W/S키 - 더 빠름)
    heightMaxSpeed: 0.15       // 높이 방향 최대 속도 (더 빠름)
};

// 키보드 입력 상태 관리 (전역)
const pressedKeys = new Set();

// 행성 정의 (크기 순서대로)
const PLANET_TYPES = [
    { name: '달', color: 0xC0C0C0, size: 0.3, points: 1, texture: 'moon.png' },
    { name: '수성', color: 0x8C7853, size: 0.4, points: 2, texture: 'mercury.png' },
    { name: '금성', color: 0xFFC649, size: 0.5, points: 4, texture: 'venus.png' },
    { name: '지구', color: 0x6B93D6, size: 0.6, points: 8, texture: 'earth.png' },
    { name: '화성', color: 0xCD5C5C, size: 0.7, points: 16, texture: 'mars.png' },
    { name: '목성', color: 0xD8CA9D, size: 1.0, points: 32, texture: 'jupiter.png' },
    { name: '토성', color: 0xFAD5A5, size: 1.2, points: 64, texture: 'saturn.png' },
    { name: '천왕성', color: 0x4FD0E7, size: 1.0, points: 128, texture: 'uranus.png' },
    { name: '해왕성', color: 0x4B70DD, size: 1.0, points: 256, texture: 'neptune.png' },
    { name: '태양', color: 0xFFD700, size: 1.5, points: 512, texture: 'sun.png' }
];

// 텍스처 로더
const textureLoader = new THREE.TextureLoader();

// 게임 영역 설정
const GAME_AREA = {
    radius: GAME_CONFIG.areaSize, // 구체 반지름을 설정에서 가져오기
    height: GAME_CONFIG.areaSize * 2  // 높이도 설정에서 가져오기
};

/* 떨림 억제용 추가 상수  (박재현) */
const DEAD_ZONE         = 0.15;   // 중앙 r < DEAD_ZONE 구간엔 중력 없음
const SNAP_SPEED        = 0.03;   // |v| < SNAP_SPEED 이면 즉시 0으로 스냅
const MAX_SPEED_SLEEP   = 8.0;    // 기존 maxSpeed 그대로 쓰도록 상수화
const SLEEP_SPEED = 0.05; // |v| < 0.05 m/s 이면 강제 sleep

// 배경음악 변수 추가 (박재현)
let backgroundMusic;

// 배경음악 초기화 함수 (박재현)
function initBackgroundMusic() {
    backgroundMusic = new Audio('sound/First_Step.mp3');
    backgroundMusic.loop = true; // 반복 재생
    backgroundMusic.volume = 1; // 볼륨 설정 (0.0 ~ 1.0) (박재현)
}

// 배경음악 시작 (박재현)
function startBackgroundMusic() {
    if (backgroundMusic) {
        backgroundMusic.play().catch(error => {
            console.log('배경음악 재생 실패:', error);
        });
    }
}

// 배경음악 정지 (박재현)
function stopBackgroundMusic() {
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
}

// 라이브러리 로딩 확인 및 초기화
function checkLibrariesAndInit() {
    console.log('라이브러리 확인 중...');
    
    if (typeof THREE === 'undefined') {
        console.error('THREE.js가 로드되지 않았습니다.');
        document.body.innerHTML = '<div style="color: white; text-align: center; margin-top: 50px;"><h2>THREE.js 로딩 실패</h2><p>페이지를 새로고침해주세요.</p></div>';
        return;
    }
    
    if (typeof CANNON === 'undefined') {
        console.error('CANNON.js가 로드되지 않았습니다. 3초 후 재시도...');
        setTimeout(checkLibrariesAndInit, 3000);
        return;
    }
    
    console.log('모든 라이브러리 로드 완료. 게임 초기화 시작...');
    init();
    startBackgroundMusic(); // 게임 시작 시 배경음악 시작 (박재현)
}

// 초기화
function init() {
    try {
        console.log('게임 초기화 시작...');
        
        // 배경음악 초기화 (박재현)
        initBackgroundMusic();
        
        // Three.js 설정
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000022);
        
        // 1인칭 시점 카메라 설정 (중력장 바깥에 위치)
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        // 초기 위치를 cameraAngle=0, cameraDistance=15에 맞게 설정
        camera.position.set(0, 5, 15); // Math.sin(0)*15=0, Math.cos(0)*15=15
        camera.lookAt(0, 0, 0);
        
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('gameContainer').appendChild(renderer.domElement);
        
        // Cannon.js 물리 엔진 설정 (중력 없음 - 직접 구현)
        world = new CANNON.World();
        world.gravity.set(0, 0, 0); // 기본 중력 제거
        world.broadphase = new CANNON.NaiveBroadphase();
        
        console.log('물리 엔진 초기화 완료');
        
        // 게임 영역 생성
        createGameArea();
        
        // 조명 설정
        setupLights();
        
        // 별 배경 생성
        createStarField();
        
        // 십자선 생성
        createCrosshair();
        
        // 궤적 라인 생성
        createTrajectoryLine();
        
        // 이벤트 리스너
        setupEventListeners();
        
        // 다음 행성 설정
        setNextPlanet();
        
        // UI 업데이트
        updateUI();
        
        // 테스트용 초기 행성 생성
        createTestPlanets();
        
        // 조준용 행성 생성
        createAimingPlanet();
        
        // 카메라와 조준용 행성 위치 동기화
        updateCameraPosition();
        
        console.log('게임 초기화 완료!');
        
        // 게임 루프 시작
        animate();
        
    } catch (error) {
        console.error('게임 초기화 중 오류 발생:', error);
        document.body.innerHTML = `<div style="color: white; text-align: center; margin-top: 50px;">
            <h2>게임 초기화 실패</h2>
            <p>오류: ${error.message}</p>
            <button onclick="location.reload()">페이지 새로고침</button>
        </div>`;
    }
}

// 십자선 생성
function createCrosshair() {
    const crosshairGeometry = new THREE.BufferGeometry();
    const crosshairMaterial = new THREE.LineBasicMaterial({ 
        color: 0xff0000, 
        transparent: true, 
        opacity: 0.8 
    });
    
    // 십자선 점들
    const points = [
        new THREE.Vector3(-0.1, 0, -2), new THREE.Vector3(0.1, 0, -2),
        new THREE.Vector3(0, -0.1, -2), new THREE.Vector3(0, 0.1, -2)
    ];
    
    crosshairGeometry.setFromPoints(points);
    crosshair = new THREE.LineSegments(crosshairGeometry, crosshairMaterial);
    camera.add(crosshair); // 카메라에 부착
    scene.add(camera);
}

// 궤적 라인 생성 (개선된 버전)
function createTrajectoryLine() {
    const trajectoryGeometry = new THREE.BufferGeometry();
    
    // linewidth가 작동하지 않는 경우를 대비해 더 강한 색상과 효과 사용
    const trajectoryMaterial = new THREE.LineBasicMaterial({ 
        color: 0x00ffff, // 더 밝은 시안색으로 변경
        transparent: true, 
        opacity: 1.0, // 완전 불투명으로 변경
        // linewidth는 대부분 브라우저에서 무시되므로 제거
    });
    
    trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
    scene.add(trajectoryLine);
    
    // 궤적 점들을 위한 추가 시각 효과
    trajectoryLine.visible = false; // 초기에는 숨김
    
    console.log('궤적 라인 생성 완료');
}

// 조준용 행성 생성
function createAimingPlanet() {
    const planetData = PLANET_TYPES[nextPlanetType];
    
    const geometry = new THREE.SphereGeometry(planetData.size, 16, 16);
    
    // 텍스처 로드 및 적용
    const texture = textureLoader.load(
        `textures/${planetData.texture}`,
        undefined,
        (error) => {
            console.warn(`조준용 행성 텍스처 로드 실패 (${planetData.texture}):`, error);
            material.color.setHex(planetData.color);
        }
    );
    
    const material = new THREE.MeshPhongMaterial({ 
        map: texture,
        transparent: true,
        opacity: 0.8
    });
    
    aimingPlanet = new THREE.Mesh(geometry, material);
    
    // 초기 위치를 카메라 기준으로 계산하여 설정
    const cameraDirection = new THREE.Vector3(
        Math.sin(cameraAngle),
        0,
        Math.cos(cameraAngle)
    ).normalize();
    
    const upVector = new THREE.Vector3(0, 1, 0);
    
    const launchOffset = new THREE.Vector3()
        .addScaledVector(cameraDirection, -3) // 카메라에서 3만큼 앞쪽
        .addScaledVector(upVector, -2); // 아래쪽 2만큼
    
    const initialPosition = camera.position.clone().add(launchOffset);
    aimingPlanet.position.copy(initialPosition);
    
    scene.add(aimingPlanet);
}

// 궤적 계산 및 표시
function updateTrajectory(startPos, velocity) {
    const points = [];
    const steps = GAME_CONFIG.trajectorySteps; // 점의 개수를 설정에서 가져오기
    const timeStep = 0.03; // 시간 간격을 0.05에서 0.03으로 감소 (더 세밀한 계산)
    
    // 디버깅: 발사 위치 분석
    const startDistance = startPos.length();
    const maxTrajectoryDistance = Math.max(
        GAME_AREA.radius + 8,
        startDistance + 15,
        25
    );
    console.log(`🎯 궤적 시작: 발사거리=${startDistance.toFixed(1)}, 최대궤적거리=${maxTrajectoryDistance.toFixed(1)}, 중력=${GAME_CONFIG.gravity}`);
    
    let pos = startPos.clone();
    let vel = velocity.clone();
    
    // 시작점 추가
    points.push(pos.clone());
    
    for (let i = 0; i < steps; i++) {
        // 중력 적용 (게임의 실제 중력과 동일하게)
        const distance = pos.length();
        if (distance > 0.1) {
            const gravityStrength = GAME_CONFIG.gravity; // 설정에서 중력 강도 가져오기
            const gravityForce = gravityStrength / (distance * 0.5 + 1);
            const gravityDirection = pos.clone().normalize().multiplyScalar(-gravityForce * timeStep);
            vel.add(gravityDirection);
        }
        
        // 속도 제한 (실제 게임과 동일)
        const speed = vel.length();
        const maxSpeed = 8.0;
        if (speed > maxSpeed) {
            vel.normalize().multiplyScalar(maxSpeed);
        }
        
        // 위치 업데이트
        pos.add(vel.clone().multiplyScalar(timeStep));
        
        // 매 스텝마다 점 추가 (더 조밀한 궤적)
        points.push(pos.clone());
        
        // 종료 조건을 발사 위치에 따라 동적으로 조정
        const startDistance = startPos.length(); // 발사 위치에서 중심까지의 거리
        const maxTrajectoryDistance = Math.max(
            GAME_AREA.radius + 8,           // 기본 종료 거리
            startDistance + 15,             // 발사 위치에서 15만큼 더
            25                              // 최소 25 거리 보장
        );
        
        if (distance > maxTrajectoryDistance) {
            console.log(`궤적 종료: 최대 거리 도달 (${distance.toFixed(1)} > ${maxTrajectoryDistance.toFixed(1)}, 시작거리: ${startDistance.toFixed(1)})`);
            break;
        }
        
        // 중력장에 너무 가까워지면 중단
        if (distance < 0.2) {
            console.log(`궤적 종료: 중심에 너무 가까움 (${distance.toFixed(1)})`);
            break;
        }
    }
    
    // 궤적 라인 업데이트
    trajectoryLine.geometry.setFromPoints(points);
    trajectoryLine.geometry.attributes.position.needsUpdate = true;
    
    // 디버깅: 궤적 라인 상태 로그
    console.log(`🌟 궤적 라인 상태: 가시성=${trajectoryLine.visible}, 점수=${points.length}, 첫점(${points[0].x.toFixed(1)}, ${points[0].y.toFixed(1)}, ${points[0].z.toFixed(1)})`);
    
    console.log(`궤적 계산 완료: ${points.length}개 점, 시작점: (${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}, ${startPos.z.toFixed(1)})`);
    console.log(`궤적 가시성: ${trajectoryLine.visible}, 색상: ${trajectoryLine.material.color.getHexString()}`);
    
    // 궤적 길이 계산하여 로그 출력
    let trajectoryLength = 0;
    for (let i = 1; i < points.length; i++) {
        trajectoryLength += points[i].distanceTo(points[i-1]);
    }
    console.log(`궤적 총 길이: ${trajectoryLength.toFixed(2)} units`);
}

// 행성 발사 (카메라 기준 고정 위치에서 발사)
function launchPlanet(direction, power) {
    if (!gameRunning || isLaunching) return; // 이미 발사 중이면 리턴
    
    isLaunching = true; // 발사 시작
    
    // 카메라 기준 좌표계 설정
    const cameraDirection = new THREE.Vector3(
        Math.sin(cameraAngle),
        0,
        Math.cos(cameraAngle)
    ).normalize();
    
    const rightVector = new THREE.Vector3().crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
    const upVector = new THREE.Vector3(0, 1, 0);
    
    // 카메라 기준 고정 발사 위치 (화면 하단 중앙에서 약간 앞쪽)
    const launchOffset = new THREE.Vector3()
        .addScaledVector(cameraDirection, -3) // 카메라에서 3만큼 앞쪽
        .addScaledVector(upVector, -2); // 아래쪽 2만큼
    
    const startPosition = camera.position.clone().add(launchOffset);
    
    // 디버깅: 카메라 높이와 발사 위치 로그
    console.log(`🎯 궤적 디버깅: 카메라(${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}) → 발사위치(${startPosition.x.toFixed(1)}, ${startPosition.y.toFixed(1)}, ${startPosition.z.toFixed(1)})`);
    
    // 마우스 드래그 방향을 월드 좌표계로 변환
    const worldDirection = new THREE.Vector3()
        .addScaledVector(rightVector, -direction.x) // 좌우 방향
        .addScaledVector(upVector, direction.y)     // 상하 방향
        .addScaledVector(cameraDirection, -direction.z) // 전후 방향 (카메라 쪽으로)
        .normalize();
    
    // 카메라 쪽으로 날아가는 것을 방지 (z 성분을 양수로 제한)
    const cameraDot = worldDirection.dot(cameraDirection);
    if (cameraDot > 0) {
        // 카메라 방향 성분을 제거하고 재정규화
        worldDirection.addScaledVector(cameraDirection, -cameraDot);
        worldDirection.normalize();
    }
    
    const velocity = worldDirection.clone().multiplyScalar(power);
    //(제거 예정)
    //console.log(`행성 발사! 카메라 각도: ${(cameraAngle * 180 / Math.PI).toFixed(1)}°`);
    //console.log(`카메라 위치: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`);
    //console.log(`발사 위치: (${startPosition.x.toFixed(1)}, ${startPosition.y.toFixed(1)}, ${startPosition.z.toFixed(1)})`);
    //console.log(`발사 방향: (${worldDirection.x.toFixed(2)}, ${worldDirection.y.toFixed(2)}, ${worldDirection.z.toFixed(2)})`);
    
    const newPlanet = createPlanet(nextPlanetType, startPosition);
    newPlanet.body.velocity.copy(new CANNON.Vec3(velocity.x, velocity.y, velocity.z));
    
    // 다음 행성 설정
    setNextPlanet();
    updateAimingPlanet();
    
    // 궤적 라인 숨기기
    trajectoryLine.visible = false;
    
    // 발사 완료 후 상태 초기화 (약간의 지연 후)
    setTimeout(() => {
        isLaunching = false;
    }, 500);
}

// 조준용 행성 업데이트
function updateAimingPlanet() {
    if (aimingPlanet) {
        scene.remove(aimingPlanet);
    }
    createAimingPlanet();
}

// 테스트용 초기 행성들 생성 (게임 영역 내부에)
function createTestPlanets() {
    // 중앙에 몇 개의 행성을 미리 배치해서 게임이 제대로 작동하는지 확인
    // 이러면 처음에 행성 3개가 생성되고 합쳐지는건데, 그냥 1개로 합침. (박재현)
    createPlanet(4, new THREE.Vector3(0, 0, 0)); // 화성 ( 박재현)
}

// 게임 영역 생성 (더 명확한 구체)
function createGameArea() {
    const geometry = new THREE.SphereGeometry(GAME_AREA.radius, 32, 32);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true, 
        opacity: 0.2,
        wireframe: true 
    });
    gameArea = new THREE.Mesh(geometry, material);
    scene.add(gameArea);
    
    // 바닥 표시용 원판 추가
    const floorGeometry = new THREE.CircleGeometry(GAME_AREA.radius, 32);
    const floorMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x333333, 
        transparent: true, 
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -GAME_AREA.radius;
    scene.add(floor);
}

// 중력장 색상 업데이트 (위험도에 따라 붉은색으로 변화)
function updateGravityFieldColor() {
    if (!gameArea || planets.length === 0) return;
    
    // 충돌한 적이 있는 행성들 중에서 중심으로부터 가장 먼 거리 찾기
    let maxDistance = 0;
    let hasCollidedPlanets = false;
    
    planets.forEach(planet => {
        // 충돌한 적이 있는 행성만 고려
        if (planet.hasCollided) {
            hasCollidedPlanets = true;
            const distance = planet.mesh.position.distanceTo(new THREE.Vector3(0, 0, 0));
            if (distance > maxDistance) {
                maxDistance = distance;
            }
        }
    });
    
    // 충돌한 행성이 없으면 경고 시스템 비활성화
    if (!hasCollidedPlanets) {
        gameArea.material.color.copy(new THREE.Color(0x00ffff));
        gameArea.material.opacity = 0.2;
        return;
    }
    
    const gravityFieldRadius = GAME_CONFIG.areaSize;
    const warningThreshold = gravityFieldRadius * 0.7; // 70%부터 경고 시작
    const dangerThreshold = gravityFieldRadius * 0.9;  // 90%부터 위험 레벨
    
    // 기본 색상 (시안색)
    const normalColor = new THREE.Color(0x00ffff);
    // 경고 색상 (주황색)
    const warningColor = new THREE.Color(0xff8800);
    // 위험 색상 (빨간색)
    const dangerColor = new THREE.Color(0xff0000);
    
    let targetColor = normalColor.clone();
    let warningLevel = 0; // 0: 안전, 1: 완전 위험
    
    if (maxDistance > warningThreshold) {
        if (maxDistance < dangerThreshold) {
            // 경고 구역: 시안색 -> 주황색
            const progress = (maxDistance - warningThreshold) / (dangerThreshold - warningThreshold);
            targetColor = normalColor.clone().lerp(warningColor, progress);
            warningLevel = progress * 0.5; // 0 ~ 0.5
            console.log(`⚠️ 경고 구역: 거리 ${maxDistance.toFixed(2)}/${gravityFieldRadius.toFixed(2)}, 진행도 ${(progress * 100).toFixed(1)}%`);
        } else {
            // 위험 구역: 주황색 -> 빨간색
            const progress = Math.min((maxDistance - dangerThreshold) / (gravityFieldRadius - dangerThreshold), 1);
            targetColor = warningColor.clone().lerp(dangerColor, progress);
            warningLevel = 0.5 + progress * 0.5; // 0.5 ~ 1.0
            console.log(`🚨 위험 구역: 거리 ${maxDistance.toFixed(2)}/${gravityFieldRadius.toFixed(2)}, 진행도 ${(progress * 100).toFixed(1)}%`);
        }
        
        // 중력장 색상 업데이트
        gameArea.material.color.copy(targetColor);
        
        // 위험도에 따라 투명도도 조정 (더 선명하게)
        const baseOpacity = 0.2;
        const maxOpacity = 0.6;
        gameArea.material.opacity = baseOpacity + (warningLevel * (maxOpacity - baseOpacity));
        
        // 위험할 때 깜빡이는 효과
        if (warningLevel > 0.8) {
            const pulseSpeed = 8.0; // 빠른 깜빡임
            const pulse = Math.sin(Date.now() * 0.01 * pulseSpeed) * 0.3 + 0.7;
            gameArea.material.opacity *= pulse;
        } else if (warningLevel > 0.5) {
            const pulseSpeed = 3.0; // 느린 깜빡임
            const pulse = Math.sin(Date.now() * 0.01 * pulseSpeed) * 0.2 + 0.8;
            gameArea.material.opacity *= pulse;
        }
        
    } else {
        // 안전 구역: 기본 색상과 투명도 복구
        gameArea.material.color.copy(normalColor);
        gameArea.material.opacity = 0.2;
    }
}

// 조명 설정 (더 밝게)
function setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(0, 8, 0);
    scene.add(pointLight);
    
    // 추가 조명
    const pointLight2 = new THREE.PointLight(0xffffff, 0.5);
    pointLight2.position.set(-5, 5, 5);
    scene.add(pointLight2);
}

// 별 배경 생성
function createStarField() {
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2 });
    
    const starVertices = [];
    for (let i = 0; i < 1000; i++) {
        const x = (Math.random() - 0.5) * 200;
        const y = (Math.random() - 0.5) * 200;
        const z = (Math.random() - 0.5) * 200;
        starVertices.push(x, y, z);
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

// 다음 행성 설정
function setNextPlanet() {
    nextPlanetType = Math.floor(Math.random() * Math.min(5, PLANET_TYPES.length));
    updatePlanetPreview();
}

// 행성 미리보기 업데이트
function updatePlanetPreview() {
    const preview = document.getElementById('planetPreview');
    const planetData = PLANET_TYPES[nextPlanetType];
    
    // 기존 내용 제거
    preview.innerHTML = '';
    
    // 원형 배경 생성
    const circle = document.createElement('div');
    circle.style.width = '100%';
    circle.style.height = '100%';
    circle.style.borderRadius = '50%';
    circle.style.overflow = 'hidden';
    circle.style.backgroundColor = `#${planetData.color.toString(16).padStart(6, '0')}`;
    circle.title = planetData.name;
    
    // 행성 이미지 추가
    const img = document.createElement('img');
    img.src = `textures/${planetData.texture}`;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    
    circle.appendChild(img);
    preview.appendChild(circle);
}

// 이벤트 리스너 설정 (드래그 시스템)
function setupEventListeners() {
    // 마우스 다운 (드래그 시작)
    renderer.domElement.addEventListener('mousedown', (event) => {
        if (!gameRunning || !canDrag) return;
        
        isDragging = true;
        dragStart.x = (event.clientX / window.innerWidth) * 2 - 1;
        dragStart.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        console.log('드래그 시작');
        
        // UI 업데이트
        if (window.showTrajectoryInfo) {
            window.showTrajectoryInfo(true);
        }
    });
    
    // 마우스 이동 (드래그 중)
    renderer.domElement.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        if (isDragging) {
            dragEnd.x = mouse.x;
            dragEnd.y = mouse.y;
            
            // 드래그 벡터 계산
            const dragVector = new THREE.Vector2().subVectors(dragEnd, dragStart);
            const rawPower = dragVector.length() * 10;
            
            // 파워 계산 로직 수정 (박재현)
            // 실제 파워는 최대 파워의 50%까지만 사용
            const maxDragPower = GAME_CONFIG.maxPower * 0.5;
            const actualPower = Math.min(rawPower, maxDragPower);
            
            // 파워 게이지 표시는 100% 스케일로 보여줌 (박재현)
            launchPower = actualPower * 2;
            
            // 디버깅: 파워 계산 로그
            if (Math.floor(Date.now() / 500) % 2 === 0) { // 0.5초마다 로그 출력 (너무 많은 로그 방지)
                console.log(`🎯 발사 파워: 원시값 ${rawPower.toFixed(1)} → 실제값 ${actualPower.toFixed(1)} → 표시값 ${launchPower.toFixed(1)} (최대: ${GAME_CONFIG.maxPower})`);
            }
            
            // 발사 방향 계산 (드래그 반대 방향)
            const direction = new THREE.Vector3(-dragVector.x, -dragVector.y, -1).normalize();
            
            // 카메라 기준 좌표계 설정
            const cameraDirection = new THREE.Vector3(
                Math.sin(cameraAngle),
                0,
                Math.cos(cameraAngle)
            ).normalize();
            
            const rightVector = new THREE.Vector3().crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
            const upVector = new THREE.Vector3(0, 1, 0);
            
            // 카메라 기준 고정 발사 위치
            const launchOffset = new THREE.Vector3()
                .addScaledVector(cameraDirection, -3) // 카메라에서 3만큼 앞쪽
                .addScaledVector(upVector, -2); // 아래쪽 2만큼
            
            const startPos = camera.position.clone().add(launchOffset);
            
            // 디버깅: 카메라 높이와 발사 위치 로그
            console.log(`🎯 궤적 디버깅: 카메라(${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}) → 발사위치(${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}, ${startPos.z.toFixed(1)})`);
            
            // 마우스 드래그 방향을 월드 좌표계로 변환
            const worldDirection = new THREE.Vector3()
                .addScaledVector(rightVector, -direction.x) // 좌우 방향
                .addScaledVector(upVector, direction.y)     // 상하 방향
                .addScaledVector(cameraDirection, -direction.z) // 전후 방향 (카메라 쪽으로)
                .normalize();
            
            // 카메라 쪽으로 날아가는 것을 방지 (z 성분을 양수로 제한)
            const cameraDot = worldDirection.dot(cameraDirection);
            if (cameraDot > 0) {
                // 카메라 방향 성분을 제거하고 재정규화
                worldDirection.addScaledVector(cameraDirection, -cameraDot);
                worldDirection.normalize();
            }
            
            // 궤적 표시 (파워에 비례한 속도로)
            const velocity = worldDirection.clone().multiplyScalar(launchPower * 0.5); // 궤적용 속도를 0.3에서 0.5로 증가
            updateTrajectory(startPos, velocity);
            
            // 궤적 라인 스타일을 파워에 따라 조정
            if (trajectoryLine) {
                trajectoryLine.visible = true;
                
                // 디버깅: 궤적 라인과 카메라 거리 확인
                const cameraToTrajectory = startPos.distanceTo(camera.position);
                console.log(`📏 카메라-궤적 거리: ${cameraToTrajectory.toFixed(2)}, 카메라 near/far: ${camera.near}/${camera.far}`);
                
                // 파워에 따른 색상 변화를 더 명확하게
                const powerRatio = launchPower / GAME_CONFIG.maxPower;
                if (powerRatio < 0.3) {
                    trajectoryLine.material.color.setHex(0x00ff00); // 약한 파워: 녹색
                } else if (powerRatio < 0.7) {
                    trajectoryLine.material.color.setHex(0x00ffff); // 중간 파워: 시안색
                } else {
                    trajectoryLine.material.color.setHex(0xff0088); // 강한 파워: 핑크색
                }
                
                console.log(`궤적 표시: 파워 ${launchPower.toFixed(1)}, 색상 변경됨, 카메라높이 ${camera.position.y.toFixed(1)}`);
            }
            
            // 조준용 행성 위치 업데이트 (발사 지점에 표시)
            if (aimingPlanet) {
                aimingPlanet.position.copy(startPos);
                // 파워에 따라 행성 크기도 살짝 조절
                const sizeScale = 1 + (launchPower / GAME_CONFIG.maxPower) * 0.3;
                aimingPlanet.scale.setScalar(sizeScale);
            }
            
            // 파워 미터 UI 업데이트
            if (window.updatePowerMeter) {
                window.updatePowerMeter(launchPower);
            }
        }
    });
    
    // 마우스 업 (발사)
    renderer.domElement.addEventListener('mouseup', (event) => {
        if (!gameRunning || !isDragging) return;
        
        isDragging = false;
        
        if (launchPower > 0.5) { // 최소 파워 체크
            const dragVector = new THREE.Vector2().subVectors(dragEnd, dragStart);
            const direction = new THREE.Vector3(-dragVector.x, -dragVector.y, -1).normalize();
            
            // 실제 발사 파워는 표시된 파워의 절반으로 설정 (박재현)
            const actualLaunchPower = launchPower * 0.5;
            
            // 드래그 불가능 상태로 설정 (박재현)
            canDrag = false;
            
            // 1초 후 드래그 가능 상태로 복구 (박재현)
            setTimeout(() => {
                canDrag = true;
                console.log('드래그 가능 상태로 복구');
            }, 1000);
            
            launchPlanet(direction, actualLaunchPower);
            
            // 조준용 행성을 원래 위치로 되돌리기
            if (aimingPlanet) {
                const cameraDirection = new THREE.Vector3(
                    Math.sin(cameraAngle),
                    0,
                    Math.cos(cameraAngle)
                ).normalize();
                
                const upVector = new THREE.Vector3(0, 1, 0);
                
                const launchOffset = new THREE.Vector3()
                    .addScaledVector(cameraDirection, -3) // 카메라에서 3만큼 앞쪽
                    .addScaledVector(upVector, -2); // 아래쪽 2만큼
                
                const aimingPosition = camera.position.clone().add(launchOffset);
                aimingPlanet.position.copy(aimingPosition);
                
                // 크기도 원래대로 되돌리기
                aimingPlanet.scale.setScalar(1);
            }
            
            // 궤적 라인 숨기기
            trajectoryLine.visible = false;
            
            // UI 업데이트
            if (window.showTrajectoryInfo) {
                window.showTrajectoryInfo(false);
            }
            if (window.updatePowerMeter) {
                window.updatePowerMeter(0);
            }
            
            console.log('드래그 종료, 발사!');
        }
    });
    
    // 키보드 이벤트 (부드러운 카메라 움직임)
    window.addEventListener('keydown', (event) => {
        if (event.key === ' ') { // 스페이스바로 직진 발사
            launchStraightPlanet();
        }
        
        // 키 눌림 상태 추가
        pressedKeys.add(event.key.toLowerCase());
    });
    
    window.addEventListener('keyup', (event) => {
        // 키 떼어짐 상태 제거
        pressedKeys.delete(event.key.toLowerCase());
    });
    
    // 윈도우 리사이즈
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// 행성 생성 (반발력 감소)
function createPlanet(type, position) {
    const planetData = PLANET_TYPES[type];
    console.log(`행성 생성: ${planetData.name}, 위치: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    
    // Three.js 메시
    const geometry = new THREE.SphereGeometry(planetData.size, 32, 32);
    
    // 텍스처 로드 및 적용
    const texture = textureLoader.load(
        `textures/${planetData.texture}`,
        // 성공 콜백
        undefined,
        // 에러 콜백
        (error) => {
            console.warn(`텍스처 로드 실패 (${planetData.texture}):`, error);
            // 텍스처 로드 실패 시 기본 색상 사용
            material.color.setHex(planetData.color);
        }
    );
    const material = new THREE.MeshPhongMaterial({ 
        map: texture,
        shininess: 30
    });
    
    // 특별한 효과 (태양의 경우)
    if (type === 9) { // 태양
        material.emissive = new THREE.Color(0x332200);
        material.emissiveIntensity = 0.3;
        
        // 태양 주변에 빛나는 효과
        const glowGeometry = new THREE.SphereGeometry(planetData.size * 1.5, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        material.glow = glow;
    }
    
    // 토성의 고리
    if (type === 6) { // 토성
        const ringGeometry = new THREE.RingGeometry(planetData.size * 1.2, planetData.size * 1.8, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xC4A484, 
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        material.ring = ring;
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    
    // 토성 고리 추가
    if (material.ring) {
        material.ring.position.copy(position);
        scene.add(material.ring);
        mesh.userData.ring = material.ring;
    }
    
    // 태양 글로우 추가
    if (material.glow) {
        material.glow.position.copy(position);
        scene.add(material.glow);
        mesh.userData.glow = material.glow;
    }
    
    // Cannon.js 물리 바디 (반발력 크게 감소)
    const shape = new CANNON.Sphere(planetData.size);
    const body = new CANNON.Body({ mass: planetData.size * planetData.size * 10 });
    body.addShape(shape);
    body.position.copy(position);
    body.material = new CANNON.Material();
    body.material.restitution = 0.1; // 반발력을 0.4에서 0.1로 크게 감소
    body.material.friction = 0.8; // 마찰력 증가로 안정성 향상
    
    /*  떨림 방지 속성 추가 (박재현)  */
    body.linearDamping   = 0.2;   // 남은 직선 속도 빨리 감쇠
    body.angularDamping  = 0.2;   // 남은 회전 속도 빨리 감쇠
    body.allowSleep      = true;  // 느려지면 계산 제외
    body.sleepSpeedLimit = 0.05;  // |v| < 0.05 m/s 이면
    body.sleepTimeLimit  = 0.5;   // 0.5초 지속되면 sleep
    body.linearDamping  = 0.4;   // 0.2 → 0.4   더 빨리 속도 죽임
    body.angularDamping = 0.4;
    /* 여기까지.*/
    
    const planet = {
        type: type,
        mesh: mesh,
        body: body,
        data: planetData,
        hasCollided: false // 충돌 여부 추적 플래그 추가
    };
    
    // 충돌 이벤트 리스너 추가
    body.addEventListener('collide', (event) => {
        const contact = event.contact;
        const other = event.target === body ? event.body : event.target;
        
        // 다른 행성과의 충돌인지 확인
        const otherPlanet = planets.find(p => p.body === other);
        if (otherPlanet) {
            // 현재 행성이 중력장 내부에 있는지 확인
            const currentDistance = Math.sqrt(
                body.position.x * body.position.x + 
                body.position.y * body.position.y + 
                body.position.z * body.position.z
            );
            
            // 상대 행성이 중력장 내부에 있는지 확인
            const otherDistance = Math.sqrt(
                other.position.x * other.position.x + 
                other.position.y * other.position.y + 
                other.position.z * other.position.z
            );
            
            // 둘 다 중력장 내부에 있을 때만 충돌로 인정
            const gravityFieldRadius = GAME_CONFIG.areaSize;
            
            if (currentDistance <= gravityFieldRadius && otherDistance <= gravityFieldRadius) {
                console.log(`✅ 중력장 내 충돌 감지: ${planetData.name} vs ${otherPlanet.data.name} (거리: ${currentDistance.toFixed(1)}, ${otherDistance.toFixed(1)})`);
                
                // 중력장 내부에서 충돌한 행성들의 플래그 업데이트
                planet.hasCollided = true;
                otherPlanet.hasCollided = true;
                
                // 충돌 시 속도 감소 (추가 안정화)
                body.velocity.scale(0.8, body.velocity);
                other.velocity.scale(0.8, other.velocity);
            } else {
                console.log(`⚠️ 중력장 외부 충돌 무시: ${planetData.name} vs ${otherPlanet.data.name} (거리: ${currentDistance.toFixed(1)}, ${otherDistance.toFixed(1)})`);
            }
        }
    });
    
    world.add(body);
    
    planets.push(planet);
    console.log(`총 행성 수: ${planets.length}`);
    return planet;
}

// 중앙으로 끌어당기는 중력 적용 (안정화 개선)
function applyCentralGravity() {
    const gravityStrength = GAME_CONFIG.gravity; // 설정에서 중력 강도 가져오기
    
    planets.forEach(planet => {
        // 중앙(0,0,0)으로부터의 거리와 방향 계산
        const position = planet.body.position;
        const distance = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);
        
        if (distance > 0.1) { // 0으로 나누기 방지
            // 중앙 방향으로의 단위 벡터
            const forceDirection = new CANNON.Vec3(
                -position.x / distance,
                -position.y / distance,
                -position.z / distance
            );
            
            // 중력 힘 = 질량 * 중력강도 / 거리^2 (하지만 너무 강하지 않게)
            const forceMagnitude = planet.body.mass * gravityStrength / (distance * 0.5 + 1);
            
            // 힘 적용
            planet.body.force.x += forceDirection.x * forceMagnitude;
            planet.body.force.y += forceDirection.y * forceMagnitude;
            planet.body.force.z += forceDirection.z * forceMagnitude;
        }
        
        // 속도 제한 (너무 빠르게 움직이지 않도록)
        const velocity = planet.body.velocity;
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
        const maxSpeed = 8.0; // 최대 속도 제한
        
        if (speed > maxSpeed) {
            const scale = maxSpeed / speed;
            velocity.x *= scale;
            velocity.y *= scale;
            velocity.z *= scale;
        }
    });
}

// 충돌 감지 및 합치기 (개선된 버전)
function checkCollisions() {
    for (let i = 0; i < planets.length; i++) {
        for (let j = i + 1; j < planets.length; j++) {
            const planet1 = planets[i];
            const planet2 = planets[j];
            
            // 같은 타입이고, 태양이 아닌 경우에만 합치기 가능
            if (planet1.type === planet2.type && planet1.type < PLANET_TYPES.length - 1) {
                const pos1 = planet1.body.position;
                const pos2 = planet2.body.position;
                const distance = Math.sqrt(
                    (pos1.x - pos2.x) * (pos1.x - pos2.x) +
                    (pos1.y - pos2.y) * (pos1.y - pos2.y) +
                    (pos1.z - pos2.z) * (pos1.z - pos2.z)
                );
                const minDistance = planet1.data.size + planet2.data.size;
                
                // 충돌 감지 조건을 더 관대하게
                if (distance < minDistance * 1.1) {
                    console.log(`충돌 감지! ${planet1.data.name} + ${planet2.data.name} (거리: ${distance.toFixed(2)}, 최소거리: ${minDistance.toFixed(2)})`);
                    mergePlanets(planet1, planet2);
                    return; // 한 번에 하나씩만 합치기
                }
            }
        }
    }
}

// 행성 합치기 (개선된 버전 - 반발력 감소)
function mergePlanets(planet1, planet2) {
    if (!planet1 || !planet2 || planet1.type !== planet2.type) {
        console.error('잘못된 merge 시도:', planet1, planet2);
        return;
    }
    
    // 새로운 행성 타입 (다음 레벨)
    const newType = planet1.type + 1;
    
    if (newType >= PLANET_TYPES.length) {
        console.log('최대 레벨 행성입니다. merge 불가능');
        return;
    }
    
    // 새로운 행성 위치 (두 행성의 중점)
    const pos1 = planet1.body.position;
    const pos2 = planet2.body.position;
    const newPosition = new THREE.Vector3(
        (pos1.x + pos2.x) / 2,
        (pos1.y + pos2.y) / 2,
        (pos1.z + pos2.z) / 2
    );
    
    // 운동량 보존 (두 행성의 속도 평균) - 반발력 크게 감소
    const vel1 = planet1.body.velocity;
    const vel2 = planet2.body.velocity;
    const newVelocity = new CANNON.Vec3(
        (vel1.x + vel2.x) * 0.3, // 속도를 30%로 감소
        (vel1.y + vel2.y) * 0.3,
        (vel1.z + vel2.z) * 0.3
    );
    
    // 속도 제한 (최대 속도 설정)
    const maxSpeed = 3.0;
    const currentSpeed = Math.sqrt(newVelocity.x * newVelocity.x + newVelocity.y * newVelocity.y + newVelocity.z * newVelocity.z);
    if (currentSpeed > maxSpeed) {
        const scale = maxSpeed / currentSpeed;
        newVelocity.x *= scale;
        newVelocity.y *= scale;
        newVelocity.z *= scale;
    }
    
    // 점수 추가
    score += PLANET_TYPES[newType].points;
    
    console.log(`🌟 MERGE 성공! ${PLANET_TYPES[planet1.type].name} + ${PLANET_TYPES[planet2.type].name} = ${PLANET_TYPES[newType].name} (+${PLANET_TYPES[newType].points}점)`);
    
    // 기존 행성들 제거
    removePlanet(planet1);
    removePlanet(planet2);
    
    // 새로운 행성 생성
    const newPlanet = createPlanet(newType, newPosition);
    
    // 부모 행성들이 충돌한 적이 있다면 새 행성도 충돌 플래그 설정
    newPlanet.hasCollided = planet1.hasCollided || planet2.hasCollided;
    
    // 운동량 적용 (감소된 속도)
    newPlanet.body.velocity.copy(newVelocity);
    
    // 추가 안정화: 중앙으로 약간 끌어당기는 힘 적용
    const centerDistance = Math.sqrt(newPosition.x * newPosition.x + newPosition.y * newPosition.y + newPosition.z * newPosition.z);
    if (centerDistance > 0.1) {
        const pullForce = 2.0; // 중앙으로 끌어당기는 힘
        newPlanet.body.force.x -= (newPosition.x / centerDistance) * pullForce;
        newPlanet.body.force.y -= (newPosition.y / centerDistance) * pullForce;
        newPlanet.body.force.z -= (newPosition.z / centerDistance) * pullForce;
    }
    
    // 합치기 효과 (새로 생성되는 행성의 레벨 전달)
    createMergeEffect(newPosition, newType);
    
    // 행성 종류에 따른 음계 재생
    playPlanetSound(newType);
    
    // UI 업데이트
    updateUI();
    
    // 태양을 만들었다면 특별한 효과
    if (newType === PLANET_TYPES.length - 1) {
        console.log('🌟 축하합니다! 태양을 만들었습니다! 🌟');
        createSunEffect(newPosition);
    }
}

// 행성 제거 (개선된 버전)
function removePlanet(planet) {
    if (!planet) {
        console.warn('⚠️ removePlanet: null 또는 undefined 행성');
        return;
    }
    
    console.log(`🗑️ 행성 제거 시작: ${planet.data?.name || '알 수 없음'}`);
    
    try {
        // Three.js 객체들 제거
        if (planet.mesh) {
            scene.remove(planet.mesh);
            console.log(`  ✓ 메시 제거 완료`);
        }
        
        if (planet.mesh?.userData?.ring) {
            scene.remove(planet.mesh.userData.ring);
            console.log(`  ✓ 토성 고리 제거 완료`);
        }
        
        if (planet.mesh?.userData?.glow) {
            scene.remove(planet.mesh.userData.glow);
            console.log(`  ✓ 태양 글로우 제거 완료`);
        }
        
        // 물리 바디 제거
        if (planet.body) {
            world.remove(planet.body);
            console.log(`  ✓ 물리 바디 제거 완료`);
        }
        
        // 배열에서 제거 (더 안전한 방식)
        const index = planets.indexOf(planet);
        if (index > -1) {
            planets.splice(index, 1);
            console.log(`  ✓ 배열에서 제거 완료. 남은 행성 수: ${planets.length}`);
        } else {
            console.warn(`  ⚠️ 배열에서 행성을 찾을 수 없음`);
        }
        
    } catch (error) {
        console.error(`❌ 행성 제거 중 오류:`, error);
    }
}

// 우주 파동 합치기 효과 (멋진 3D 버전) - 레벨 스케일링
function createMergeEffect(position, planetLevel = 0) {
    console.log('🌟 Merge 효과 시작! 위치:', position, '레벨:', planetLevel);
    
    // 행성 레벨에 따른 스케일 계산 (레벨이 높을수록 더 큰 효과)
    const scale = (1 + (planetLevel * 0.6)) * 0.12; // 레벨당 50% 증가
    const intensity = (1 + (planetLevel * 0.3)) * 1; // 레벨당 30% 강도 증가
    
    // 행성 타입에 따른 색상 가져오기
    const planetData = PLANET_TYPES[planetLevel] || PLANET_TYPES[0];
    const planetColor = new THREE.Color(planetData.color);

    console.log('📏 효과 스케일:', scale, '강도:', intensity, '색상:', planetData.name, planetColor.getHexString());
    
    // 1. 중심 폭발 빛 효과
    createCentralExplosion(position, scale, intensity, planetColor);
    
    // 2. 파동 링 효과 (여러 겹)
    createShockwaveRings(position, scale, intensity, planetColor);
    
    // 3. 나선 파티클 효과
    createSpiralParticles(position, scale, intensity, planetColor);
    
    // 4. 별빛 흩어짐 효과
    createStarBurst(position, scale, intensity, planetColor);
    
    // 5. 공간 왜곡 효과
    // createSpaceDistortion(position);
    
        // 소리 효과는 mergePlanets에서 행성별로 재생됨
}

// 중심 폭발 빛 효과 (행성 색상) - 스케일링
function createCentralExplosion(position, scale = 1, intensity = 1, planetColor = new THREE.Color(0xffffff)) {
    console.log('💥 중심 폭발 효과 생성 중... 스케일:', scale, '강도:', intensity, '색상:', planetColor.getHexString());
    
    const geometry = new THREE.SphereGeometry(0.5 * scale, 16, 16);
        const material = new THREE.MeshBasicMaterial({ 
        color: planetColor.clone(),
        transparent: true,
        opacity: 1.0 * intensity
    });
    
    const explosion = new THREE.Mesh(geometry, material);
    explosion.position.copy(position);
    scene.add(explosion);
    console.log('💥 중심 폭발 생성 완료, 위치:', explosion.position, '크기:', geometry.parameters.radius);
    
    // 중심 폭발 애니메이션
    const duration = (1000 + (scale - 1) * 500) * 0.5; // 스케일에 따라 지속시간 증가
    const startTime = Date.now();
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;
        
        if (progress < 1) {
            // 빠르게 커졌다가 서서히 사라짐 (스케일에 비례)
            const maxScale = 15 * scale;
            const currentScale = progress < 0.2 ? progress * maxScale : (3 * scale) - (progress * 2 * scale);
            explosion.scale.setScalar(Math.max(0.1, currentScale));
            
            // 행성 색상에 따른 밝기 변화 (밝게 -> 어둡게)
            const brightness = (1 - progress * 0.8) * intensity;
            const currentColor = planetColor.clone().multiplyScalar(brightness);
            explosion.material.color.copy(currentColor);
            
            explosion.material.opacity = Math.max(0, (1 - progress) * intensity);
            
            requestAnimationFrame(animate);
        } else {
            console.log('💥 중심 폭발 제거');
            scene.remove(explosion);
            explosion.geometry.dispose();
            explosion.material.dispose();
        }
    };
    animate();
}

// 파동 링 효과 (한 겹, 선명한 그라데이션, 행성 색상) - 스케일링 버전
function createShockwaveRings(position, scale = 1, intensity = 1, planetColor = new THREE.Color(0xffffff)) {
    console.log('🌊 파동 링 효과 생성 중... 스케일:', scale, '강도:', intensity, '색상:', planetColor.getHexString());
    
    // 간단한 링 메시 생성 (스케일에 비례)
    const innerRadius = 0.3 * scale;
    const outerRadius = 1.0 * scale;
    const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
        color: planetColor.clone(),
        transparent: true,
        opacity: 0.8 * intensity,
        side: THREE.DoubleSide
    });
    
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(position);
    
    // XY 평면에 수평으로 배치
    ring.rotation.x = -Math.PI / 2;
    
    scene.add(ring);
    console.log('🌊 파동 링 생성 완료, 위치:', ring.position, '내부반지름:', innerRadius, '외부반지름:', outerRadius);
    
    // 링 확산 애니메이션 (스케일에 따라 지속시간과 최대 크기 조정)
    const duration = (3000 + (scale - 1) * 1000) * 0.5; // 스케일에 따라 지속시간 증가
    const maxExpansion = 20 * scale; // 최대 확장 크기도 스케일에 비례
    
    const startTime = Date.now();
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;
        
        if (progress < 1) {
            // 크기 확장 (스케일에 비례)
            const currentScale = 1 + progress * maxExpansion;
            ring.scale.setScalar(currentScale);
            
            // 투명도 변화
            const fadeStart = 0.3; // 30% 지점부터 페이드 시작
            let opacity;
            if (progress < fadeStart) {
                opacity = 0.8 * intensity;
            } else {
                opacity = 0.8 * intensity * (1 - ((progress - fadeStart) / (1.0 - fadeStart)));
            }
            ring.material.opacity = opacity;
            
            // 색상 변화 (행성 색상 기반으로 밝기 변화)
            const brightness = (1 - progress * 0.5) * intensity;
            const currentColor = planetColor.clone().multiplyScalar(brightness);
            ring.material.color.copy(currentColor);
            
            // 미세한 회전 효과 (스케일에 따라 속도 조정)
            ring.rotation.z += 0.01 / scale;
            
            requestAnimationFrame(animate);
        } else {
            console.log('🌊 파동 링 제거');
            scene.remove(ring);
            ring.geometry.dispose();
            ring.material.dispose();
        }
    };
    animate();
}

// 나선 파티클 효과 (행성 색상) - 스케일링
function createSpiralParticles(position, scale = 1, intensity = 1, planetColor = new THREE.Color(0xffffff)) {
    console.log('🌀 나선 파티클 효과 생성 중... 스케일:', scale, '강도:', intensity, '색상:', planetColor.getHexString());
    
    const particleCount = Math.floor(20 * scale); // 파티클 수도 스케일에 비례
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.SphereGeometry(0.1 * scale, 8, 8); // 크기 스케일링
        
        // 행성 색상 기반 밝기 그라데이션
        const brightness = (0.8 - (i / particleCount) * 0.3) * intensity;
        const particleColor = planetColor.clone().multiplyScalar(brightness);
        const material = new THREE.MeshBasicMaterial({ 
            color: particleColor,
            transparent: true,
            opacity: 1
        });
        
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        scene.add(particle);
        
        particles.push({
            mesh: particle,
            angle: (i / particleCount) * Math.PI * 2, // 1바퀴 나선
            radius: 0,
            height: 0,
            speed: (0.08 + Math.random() * 0.05) * scale, // 속도도 스케일에 비례
            brightness: brightness,
            baseColor: particleColor.clone()
        });
    }
    
    console.log('🌀 나선 파티클 생성 완료, 개수:', particles.length, '파티클 크기:', 0.1 * scale);
    
    // 나선 애니메이션 (스케일에 따라 지속시간 조정)
    const duration = 2500 + (scale - 1) * 1000; // 스케일에 따라 지속시간 증가
    const startTime = Date.now();
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;
        
        if (progress < 1) {
            particles.forEach((particle, index) => {
                // 나선형으로 퍼져나감
                particle.radius += particle.speed;
                particle.height += particle.speed * 0.2;
                particle.angle += 0.05;
                
                // 나선 위치 계산
                const x = position.x + Math.cos(particle.angle) * particle.radius;
                const y = position.y + particle.height * (index % 2 === 0 ? 1 : -1);
                const z = position.z + Math.sin(particle.angle) * particle.radius;
                
                particle.mesh.position.set(x, y, z);
                particle.mesh.material.opacity = Math.max(0, 1 - progress);
                
                // 파티클 크기 변화 (스케일에 비례)
                const currentScale = 1 + progress * 1.5 * scale;
                particle.mesh.scale.setScalar(currentScale);
                
                // 밝기도 점진적으로 감소 (행성 색상 기반)
                const currentBrightness = particle.brightness * (1 - progress * 0.3);
                const currentColor = particle.baseColor.clone().multiplyScalar(currentBrightness / particle.brightness);
                particle.mesh.material.color.copy(currentColor);
            });
            
            requestAnimationFrame(animate);
        } else {
            console.log('🌀 나선 파티클 제거');
            particles.forEach(particle => {
                scene.remove(particle.mesh);
                particle.mesh.geometry.dispose();
                particle.mesh.material.dispose();
            });
        }
    };
    animate();
}

// 별빛 흩어짐 효과 (행성 색상) - 스케일링
function createStarBurst(position, scale = 1, intensity = 1, planetColor = new THREE.Color(0xffffff)) {
    console.log('⭐ 별빛 흩어짐 효과 생성 중... 스케일:', scale, '강도:', intensity, '색상:', planetColor.getHexString());
    
    const starCount = Math.floor(15 * scale); // 별 개수도 스케일에 비례
    const stars = [];
    
    for (let i = 0; i < starCount; i++) {
        const geometry = new THREE.SphereGeometry(0.05 * scale, 6, 6); // 크기 스케일링
        
        // 각 별마다 밝기 (강도에 비례, 행성 색상 기반)
        const brightness = (0.7 + Math.random() * 0.3) * intensity;
        const starColor = planetColor.clone().multiplyScalar(brightness);
        const material = new THREE.MeshBasicMaterial({ 
            color: starColor,
            transparent: true,
            opacity: 1
        });
        
        const star = new THREE.Mesh(geometry, material);
        star.position.copy(position);
        scene.add(star);
        
        // 랜덤한 방향으로 속도 설정 (스케일에 비례)
        const direction = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ).normalize();
        
        stars.push({
            mesh: star,
            velocity: direction.multiplyScalar((0.15 + Math.random() * 0.1) * scale),
            life: 1.0,
            originalBrightness: brightness,
            baseColor: starColor.clone()
        });
    }
    
    console.log('⭐ 별빛 생성 완료, 개수:', stars.length, '별 크기:', 0.05 * scale);
    
    // 별 흩어짐 애니메이션 (스케일에 따라 생명력 감소 속도 조정)
    const lifeDecay = 0.015 / scale; // 큰 스케일일수록 더 오래 지속
    
    const animate = () => {
        let activeStars = 0;
        
        stars.forEach(star => {
            if (star.life > 0) {
                activeStars++;
                
                // 위치 업데이트
                star.mesh.position.add(star.velocity);
                
                // 생명력 감소 (스케일에 따라 조정)
                star.life -= lifeDecay;
                star.mesh.material.opacity = Math.max(0, star.life);
                
                // 중력의 영향으로 속도 조금씩 감소
                star.velocity.multiplyScalar(0.99);
                
                // 별이 깜빡이는 효과 (스케일에 비례)
                const flicker = 0.8 + Math.sin(Date.now() * 0.008 + star.mesh.id) * 0.2;
                star.mesh.scale.setScalar(flicker * scale);
                
                // 생명력에 따른 밝기 감소 (행성 색상 기반)
                const currentBrightness = star.originalBrightness * star.life;
                const currentColor = star.baseColor.clone().multiplyScalar(star.life);
                star.mesh.material.color.copy(currentColor);
            }
        });
        
        if (activeStars > 0) {
            requestAnimationFrame(animate);
        } else {
            console.log('⭐ 별빛 제거');
            stars.forEach(star => {
                scene.remove(star.mesh);
                star.mesh.geometry.dispose();
                star.mesh.material.dispose();
            });
        }
    };
    animate();
}

// 공간 왜곡 효과
function createSpaceDistortion(position) {
    const distortionGeometry = new THREE.SphereGeometry(1, 32, 32);
    const distortionMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x4400ff,
        transparent: true,
        opacity: 0.1,
        wireframe: true
    });
    
    const distortion = new THREE.Mesh(distortionGeometry, distortionMaterial);
    distortion.position.copy(position);
    scene.add(distortion);
    
    // 왜곡 애니메이션
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
        const progress = elapsed / 1200; // 1.2초
            
            if (progress < 1) {
            // 불규칙한 크기 변화로 공간 왜곡 표현
            const waveX = 1 + Math.sin(progress * Math.PI * 4) * 0.3;
            const waveY = 1 + Math.cos(progress * Math.PI * 6) * 0.2;
            const waveZ = 1 + Math.sin(progress * Math.PI * 8) * 0.25;
            
            distortion.scale.set(waveX * (1 + progress * 3), waveY * (1 + progress * 3), waveZ * (1 + progress * 3));
            distortion.material.opacity = 0.1 * (1 - progress);
            
            // 회전 효과
            distortion.rotation.x += 0.05;
            distortion.rotation.y += 0.03;
            
                requestAnimationFrame(animate);
            } else {
            scene.remove(distortion);
            }
        };
        animate();
    }
    
// 행성별 음계 사운드 (도-레-미-파-솔-라-시-도)
function playPlanetSound(planetType) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 음계 주파수 정의 (C3 옥타브 기준 - 한 옥타브 낮음)
        const musicalNotes = [
            130.81, // 도 (C3) - 달
            146.83, // 레 (D3) - 수성
            164.81, // 미 (E3) - 금성
            174.61, // 파 (F3) - 지구
            196.00, // 솔 (G3) - 화성
            220.00, // 라 (A3) - 목성
            246.94, // 시 (B3) - 토성
            261.63, // 도 (C4) - 천왕성
            293.66, // 레 (D4) - 해왕성
            329.63  // 미 (E4) - 태양
        ];
        
        // 행성 타입에 해당하는 주파수 선택
        const baseFrequency = musicalNotes[planetType] || musicalNotes[0];
        
        console.log(`🎵 행성 사운드 재생: ${PLANET_TYPES[planetType]?.name || '알 수 없음'} - ${baseFrequency.toFixed(2)}Hz`);
        
        // 리버브 효과를 위한 컨볼버 생성 (우주적인 울림)
        const convolver = audioContext.createConvolver();
        const reverbGain = audioContext.createGain();
        reverbGain.gain.setValueAtTime(0.4, audioContext.currentTime); // 리버브 강도
        
        // 인공 리버브 임펄스 응답 생성 (우주적인 긴 울림)
        const impulseLength = audioContext.sampleRate * 3; // 3초 리버브
        const impulse = audioContext.createBuffer(2, impulseLength, audioContext.sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < impulseLength; i++) {
                const decay = Math.pow(1 - (i / impulseLength), 2); // 제곱 감쇠
                channelData[i] = (Math.random() * 2 - 1) * decay * 0.3; // 노이즈 기반 리버브
            }
        }
        convolver.buffer = impulse;
        
        // 리버브 체인 설정
        convolver.connect(reverbGain);
        reverbGain.connect(audioContext.destination);
        
        // 메인 톤 (기본 음계)
        const mainOsc = audioContext.createOscillator();
        const mainGain = audioContext.createGain();
        const mainDryGain = audioContext.createGain();
        const mainWetGain = audioContext.createGain();
        
        mainOsc.connect(mainGain);
        mainGain.connect(mainDryGain);
        mainGain.connect(mainWetGain);
        mainDryGain.connect(audioContext.destination); // 드라이 신호
        mainWetGain.connect(convolver); // 웨트 신호 (리버브)
        
        mainDryGain.gain.setValueAtTime(0.6, audioContext.currentTime); // 드라이 60%
        mainWetGain.gain.setValueAtTime(0.4, audioContext.currentTime); // 웨트 40%
        
        mainOsc.type = 'sine'; // 부드러운 사인파
        mainOsc.frequency.setValueAtTime(baseFrequency, audioContext.currentTime);
        mainGain.gain.setValueAtTime(0.3, audioContext.currentTime);
        mainGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.2);
        
        // 하모닉 톤 (5도 위 화음)
        const harmOsc = audioContext.createOscillator();
        const harmGain = audioContext.createGain();
        const harmDryGain = audioContext.createGain();
        const harmWetGain = audioContext.createGain();
        
        harmOsc.connect(harmGain);
        harmGain.connect(harmDryGain);
        harmGain.connect(harmWetGain);
        harmDryGain.connect(audioContext.destination); // 드라이 신호
        harmWetGain.connect(convolver); // 웨트 신호 (리버브)
        
        harmDryGain.gain.setValueAtTime(0.6, audioContext.currentTime); // 드라이 60%
        harmWetGain.gain.setValueAtTime(0.4, audioContext.currentTime); // 웨트 40%
        
        harmOsc.type = 'sine';
        harmOsc.frequency.setValueAtTime(baseFrequency * 1.5, audioContext.currentTime); // 완전5도
        harmGain.gain.setValueAtTime(0.15, audioContext.currentTime);
        harmGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.0);
        
        // 옥타브 하모닉 (높은 음)
        const octaveOsc = audioContext.createOscillator();
        const octaveGain = audioContext.createGain();
        const octaveDryGain = audioContext.createGain();
        const octaveWetGain = audioContext.createGain();
        
        octaveOsc.connect(octaveGain);
        octaveGain.connect(octaveDryGain);
        octaveGain.connect(octaveWetGain);
        octaveDryGain.connect(audioContext.destination); // 드라이 신호
        octaveWetGain.connect(convolver); // 웨트 신호 (리버브)
        
        octaveDryGain.gain.setValueAtTime(0.5, audioContext.currentTime); // 드라이 50%
        octaveWetGain.gain.setValueAtTime(0.5, audioContext.currentTime); // 웨트 50% (고음은 더 많은 리버브)
        
        octaveOsc.type = 'triangle'; // 삼각파로 밝은 소리
        octaveOsc.frequency.setValueAtTime(baseFrequency * 2, audioContext.currentTime); // 옥타브
        octaveGain.gain.setValueAtTime(0.1, audioContext.currentTime);
        octaveGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
        
        // // 행성 크기에 따른 저음 강화 (큰 행성일수록 더 풍성한 저음)
        // if (planetType >= 5) { // 목성 이상의 큰 행성들
        //     const bassOsc = audioContext.createOscillator();
        //     const bassGain = audioContext.createGain();
        //     bassOsc.connect(bassGain);
        //     bassGain.connect(audioContext.destination);
            
        //     bassOsc.type = 'sawtooth'; // 톱니파로 풍성한 저음
        //     bassOsc.frequency.setValueAtTime(baseFrequency / 2, audioContext.currentTime); // 낮은 옥타브
        //     bassGain.gain.setValueAtTime(0.2, audioContext.currentTime);
        //     bassGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
            
        //     bassOsc.start(audioContext.currentTime);
        //     bassOsc.stop(audioContext.currentTime + 1.5);
        // }
        
        // 태양의 경우 특별한 효과음 추가
        if (planetType === 9) { // 태양
            const sunSparkleOsc = audioContext.createOscillator();
            const sunSparkleGain = audioContext.createGain();
            const sunSparkleDryGain = audioContext.createGain();
            const sunSparkleWetGain = audioContext.createGain();
            
            sunSparkleOsc.connect(sunSparkleGain);
            sunSparkleGain.connect(sunSparkleDryGain);
            sunSparkleGain.connect(sunSparkleWetGain);
            sunSparkleDryGain.connect(audioContext.destination); // 드라이 신호
            sunSparkleWetGain.connect(convolver); // 웨트 신호 (리버브)
            
            sunSparkleDryGain.gain.setValueAtTime(0.3, audioContext.currentTime); // 드라이 30%
            sunSparkleWetGain.gain.setValueAtTime(0.7, audioContext.currentTime); // 웨트 70% (특수 효과는 더 많은 리버브)
            
            sunSparkleOsc.type = 'square';
            sunSparkleOsc.frequency.setValueAtTime(baseFrequency * 4, audioContext.currentTime);
            sunSparkleOsc.frequency.exponentialRampToValueAtTime(baseFrequency * 8, audioContext.currentTime + 0.3);
            sunSparkleGain.gain.setValueAtTime(0.05, audioContext.currentTime);
            sunSparkleGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            sunSparkleOsc.start(audioContext.currentTime);
            sunSparkleOsc.stop(audioContext.currentTime + 0.5);
        }
        
        // 모든 오실레이터 시작
        mainOsc.start(audioContext.currentTime);
        harmOsc.start(audioContext.currentTime);
        octaveOsc.start(audioContext.currentTime);
        
        // 정리
        mainOsc.stop(audioContext.currentTime + 1.2);
        harmOsc.stop(audioContext.currentTime + 1.0);
        octaveOsc.stop(audioContext.currentTime + 0.8);
        
    } catch (e) {
        console.log('행성 사운드 재생 실패:', e);
    }
}

// 우주적인 사운드 효과 (기존 함수 - 필요시 사용)
function playCosmicSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 메인 톤 (저음)
        const mainOsc = audioContext.createOscillator();
        const mainGain = audioContext.createGain();
        mainOsc.connect(mainGain);
        mainGain.connect(audioContext.destination);
        
        mainOsc.frequency.setValueAtTime(200, audioContext.currentTime);
        mainOsc.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 1.0);
        mainGain.gain.setValueAtTime(0.15, audioContext.currentTime);
        mainGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.0);
        
        // 하모닉 톤 (중음)
        const harmOsc = audioContext.createOscillator();
        const harmGain = audioContext.createGain();
        harmOsc.connect(harmGain);
        harmGain.connect(audioContext.destination);
        
        harmOsc.frequency.setValueAtTime(400, audioContext.currentTime);
        harmOsc.frequency.exponentialRampToValueAtTime(160, audioContext.currentTime + 0.8);
        harmGain.gain.setValueAtTime(0.1, audioContext.currentTime);
        harmGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
        
        // 고음 반짝임
        const sparkleOsc = audioContext.createOscillator();
        const sparkleGain = audioContext.createGain();
        sparkleOsc.connect(sparkleGain);
        sparkleGain.connect(audioContext.destination);
        
        sparkleOsc.frequency.setValueAtTime(1200, audioContext.currentTime);
        sparkleOsc.frequency.exponentialRampToValueAtTime(2400, audioContext.currentTime + 0.3);
        sparkleGain.gain.setValueAtTime(0.08, audioContext.currentTime);
        sparkleGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        // 모든 오실레이터 시작
        mainOsc.start(audioContext.currentTime);
        harmOsc.start(audioContext.currentTime);
        sparkleOsc.start(audioContext.currentTime);
        
        // 정리
        mainOsc.stop(audioContext.currentTime + 1.0);
        harmOsc.stop(audioContext.currentTime + 0.8);
        sparkleOsc.stop(audioContext.currentTime + 0.5);
        
    } catch (e) {
        console.log('오디오 효과 재생 실패:', e);
    }
}

// 태양 생성 특별 효과
function createSunEffect(position) {
    const geometry = new THREE.SphereGeometry(0.2, 8, 8);
    
    for (let i = 0; i < 20; i++) {
        const material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color().setHSL(Math.random() * 0.1 + 0.1, 1, 0.5),
            transparent: true,
            opacity: 1
        });
        
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        
        const direction = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );
        
        scene.add(particle);
        
        // 애니메이션
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 2000; // 2초 동안
            
            if (progress < 1) {
                particle.position.add(direction.clone().multiplyScalar(0.01));
                particle.material.opacity = 1 - progress;
                particle.scale.setScalar(1 + progress * 3);
                requestAnimationFrame(animate);
            } else {
                scene.remove(particle);
            }
        };
        animate();
    }
}

// 게임 오버 체크 (중력장 내에서 충돌한 행성이 중력장 밖으로 나갔을 때)
function checkGameOver() {
    let warningCount = 0;
    
    for (let planet of planets) {
        const distance = planet.mesh.position.distanceTo(new THREE.Vector3(0, 0, 0));
        // 게임 오버 기준: 정확히 중력장 크기
        const gravityFieldRadius = GAME_CONFIG.areaSize;
        const warningDistance = GAME_CONFIG.areaSize * 0.9; // 경고 구역: 중력장의 90%
        
        // 중력장 내에서 충돌한 적이 있는 행성이 중력장 밖으로 나갔을 때 게임 오버
        if (planet.hasCollided && distance > gravityFieldRadius) {
            console.log(`🚨 게임 오버: 충돌한 행성 ${planet.data.name}이 중력장을 벗어남 (거리: ${distance.toFixed(2)} > 중력장: ${gravityFieldRadius})`);
            gameOver(planet); // 위반 행성을 전달
            return;
        } else if (distance > warningDistance) {
            warningCount++;
            // 경고 구역에 있는 행성을 중앙으로 약간 끌어당기기
            const pullStrength = 3.0;
            const centerDirection = new CANNON.Vec3(
                -planet.body.position.x / distance,
                -planet.body.position.y / distance,
                -planet.body.position.z / distance
            );
            planet.body.force.x += centerDirection.x * pullStrength;
            planet.body.force.y += centerDirection.y * pullStrength;
            planet.body.force.z += centerDirection.z * pullStrength;
        }
    }
    
    // 경고 표시
    if (warningCount > 0) {
        console.log(`⚠️ 경고: ${warningCount}개 행성이 중력장 경계 근처에 있습니다!`);
    }
}

// 게임 오버
function gameOver(violatingPlanet = null) {
    gameRunning = false;
    stopBackgroundMusic(); // 배경음악 정지 (박재현)
    
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('sputnika3d-best', bestScore);
    }
    
    // 위반 행성이 있으면 클로즈업 애니메이션 실행
    if (violatingPlanet) {
        startGameOverCloseup(violatingPlanet);
    } else {
        // 위반 행성이 없으면 바로 게임 오버 화면 표시
        showGameOverScreen();
    }
}

// 게임 오버 화면 표시
function showGameOverScreen() {
    const gameOverScreen = document.getElementById('gameOver');
    const finalScore = document.getElementById('finalScore');
    finalScore.textContent = score;
    gameOverScreen.style.display = 'block';
}

// 게임 오버 클로즈업 애니메이션
function startGameOverCloseup(violatingPlanet) {
    console.log(`🎬 게임 오버 클로즈업 시작: ${violatingPlanet.data.name}`);
    
    // 원래 카메라 상태 저장
    const originalCameraPos = camera.position.clone();
    const originalCameraAngle = cameraAngle;
    const originalCameraHeight = cameraHeight;
    const originalCameraDistance = cameraDistance;
    
    // 클로즈업 애니메이션 상태
    let closeupProgress = 0;
    const moveToTargetDuration = 1500; // 1.5초 동안 목표 위치로 이동
    const orbitDuration = 1500; // 1.5초 동안 궤도 회전
    const totalDuration = moveToTargetDuration + orbitDuration; // 총 3초
    const startTime = Date.now();
    
    // 목표 카메라 위치 계산 (행성 주변)
    const planetPos = violatingPlanet.mesh.position.clone();
    const planetSize = violatingPlanet.data.size;
    
    // 행성 주변에서 좋은 각도 찾기
    const offsetDistance = planetSize * 4; // 행성 크기의 4배 거리
    const targetCameraPos = planetPos.clone().add(new THREE.Vector3(
        offsetDistance * 0.7,  // 약간 옆에서
        offsetDistance * 0.5,  // 약간 위에서
        offsetDistance * 0.8   // 약간 뒤에서
    ));
    
    // 클로즈업 효과를 위한 특별한 조명 추가
    const spotLight = new THREE.SpotLight(0xff4444, 2, 0, Math.PI / 6, 0.5, 2);
    spotLight.position.copy(targetCameraPos);
    spotLight.target.position.copy(planetPos);
    scene.add(spotLight);
    scene.add(spotLight.target);
    
    // 클로즈업 애니메이션 함수
    const animateCloseup = () => {
        const elapsed = Date.now() - startTime;
        closeupProgress = Math.min(elapsed / totalDuration, 1);
        
        if (closeupProgress < 1) {
            if (elapsed < moveToTargetDuration) {
                // 1단계: 목표 위치로 이동 (ease-out 트랜지션)
                const moveProgress = elapsed / moveToTargetDuration;
                
                // ease-out 이징 함수 (부드럽게 감속하며 도착)
                const easeOutProgress = 1 - Math.pow(1 - moveProgress, 3);
                
                // 카메라 위치 보간
                camera.position.lerpVectors(originalCameraPos, targetCameraPos, easeOutProgress);
                
                // 카메라가 행성을 바라보도록 설정
                camera.lookAt(planetPos);
                
            } else {
                // 2단계: 목표 위치에서 궤도 회전
                const orbitProgress = (elapsed - moveToTargetDuration) / orbitDuration;
                
                // 부드러운 이징 함수 (ease-in-out)
                const easeOrbitProgress = orbitProgress < 0.5 
                    ? 2 * orbitProgress * orbitProgress 
                    : 1 - Math.pow(-2 * orbitProgress + 2, 3) / 2;
                
                // 행성 주변으로 천천히 회전하는 효과
                const rotationAngle = easeOrbitProgress * Math.PI * 0.75; // 135도 회전 (더 역동적)
                const rotatedPos = targetCameraPos.clone();
                
                // Y축 기준 회전
                rotatedPos.x = targetCameraPos.x * Math.cos(rotationAngle) - targetCameraPos.z * Math.sin(rotationAngle);
                rotatedPos.z = targetCameraPos.x * Math.sin(rotationAngle) + targetCameraPos.z * Math.cos(rotationAngle);
                
                // 약간의 높이 변화도 추가 (더 역동적인 움직임)
                rotatedPos.y += Math.sin(rotationAngle) * offsetDistance * 0.3;
                
                camera.position.copy(rotatedPos);
                camera.lookAt(planetPos);
            }
            
            // 위반 행성을 강조하는 효과
            if (violatingPlanet.mesh) {
                // 행성 크기 살짝 키우기
                const pulseScale = 1 + Math.sin(elapsed * 0.008) * 0.1;
                violatingPlanet.mesh.scale.setScalar(pulseScale);
                
                // 행성 색상을 빨갛게 변경
                if (violatingPlanet.mesh.material) {
                    const redTint = new THREE.Color(1, 0.3, 0.3);
                    violatingPlanet.mesh.material.color.copy(redTint);
                    violatingPlanet.mesh.material.emissive.setHex(0x330000);
                }
            }
            
            // 스포트라이트 강도 조절
            spotLight.intensity = 1 + Math.sin(elapsed * 0.01) * 0.5;
            
            requestAnimationFrame(animateCloseup);
        } else {
            // 클로즈업 완료 후 원래 위치로 복귀 시작
            console.log('🎬 클로즈업 완료, 원래 위치로 복귀 시작');
            
            // 복귀 애니메이션 시작
            startReturnToOriginalPosition(
                violatingPlanet, 
                spotLight, 
                originalCameraPos, 
                originalCameraAngle, 
                originalCameraHeight, 
                originalCameraDistance
            );
        }
    };
    
    // 클로즈업 애니메이션 시작
    animateCloseup();
}

// 원래 위치로 복귀하는 애니메이션
function startReturnToOriginalPosition(violatingPlanet, spotLight, originalCameraPos, originalCameraAngle, originalCameraHeight, originalCameraDistance) {
    console.log('🔄 원래 위치로 복귀 애니메이션 시작');
    
    // 현재 카메라 위치 저장
    const currentCameraPos = camera.position.clone();
    
    // 복귀 애니메이션 상태
    const returnDuration = 2000; // 2초 동안 복귀
    const startTime = Date.now();
    
    // 복귀 애니메이션 함수
    const animateReturn = () => {
        const elapsed = Date.now() - startTime;
        const returnProgress = Math.min(elapsed / returnDuration, 1);
        
        // ease-in-out 이징 함수 (부드럽게 시작해서 부드럽게 끝남)
        const easeProgress = returnProgress < 0.5 
            ? 2 * returnProgress * returnProgress 
            : 1 - Math.pow(-2 * returnProgress + 2, 3) / 2;
        
        if (returnProgress < 1) {
            // 카메라 위치를 부드럽게 원래 위치로 복귀
            camera.position.lerpVectors(currentCameraPos, originalCameraPos, easeProgress);
            
            // 시선도 부드럽게 중앙으로 복귀
            const currentLookAt = violatingPlanet.mesh.position.clone();
            const targetLookAt = new THREE.Vector3(0, 0, 0);
            const lerpedLookAt = currentLookAt.lerp(targetLookAt, easeProgress);
            camera.lookAt(lerpedLookAt);
            
            // 행성 효과도 점진적으로 제거
            if (violatingPlanet.mesh) {
                // 크기 효과 점진적 제거
                const pulseScale = 1 + Math.sin(elapsed * 0.008) * 0.1 * (1 - easeProgress);
                violatingPlanet.mesh.scale.setScalar(pulseScale);
                
                // 색상 효과 점진적 제거
                if (violatingPlanet.mesh.material) {
                    const redTint = new THREE.Color(1, 0.3 + easeProgress * 0.7, 0.3 + easeProgress * 0.7);
                    violatingPlanet.mesh.material.color.copy(redTint);
                    
                    const emissiveIntensity = 0x330000 * (1 - easeProgress);
                    violatingPlanet.mesh.material.emissive.setHex(emissiveIntensity);
                }
            }
            
            // 스포트라이트 강도도 점진적으로 감소
            if (spotLight) {
                const baseIntensity = 1 + Math.sin(elapsed * 0.01) * 0.5;
                spotLight.intensity = baseIntensity * (1 - easeProgress);
            }
            
            requestAnimationFrame(animateReturn);
        } else {
            // 복귀 완료 후 정리
            console.log('🔄 복귀 애니메이션 완료');
            
            // 스포트라이트 제거
            if (spotLight) {
                scene.remove(spotLight);
                scene.remove(spotLight.target);
            }
            
            // 행성 효과 완전 제거
            if (violatingPlanet.mesh) {
                violatingPlanet.mesh.scale.setScalar(1);
                if (violatingPlanet.mesh.material) {
                    violatingPlanet.mesh.material.emissive.setHex(0x000000);
                    // 원래 색상으로 복구 (텍스처가 있다면 텍스처 색상, 없다면 기본 색상)
                    if (violatingPlanet.mesh.material.map) {
                        violatingPlanet.mesh.material.color.setHex(0xffffff);
                    } else {
                        violatingPlanet.mesh.material.color.setHex(violatingPlanet.data.color);
                    }
                }
            }
            
            // 카메라 상태 완전 복구
            camera.position.copy(originalCameraPos);
            cameraAngle = originalCameraAngle;
            cameraHeight = originalCameraHeight;
            cameraDistance = originalCameraDistance;
            camera.lookAt(0, 0, 0);
            
            console.log('🎮 카메라 상태 복구 완료');
            
            // 게임 오버 화면 표시
            showGameOverScreen();
        }
    };
    
    // 복귀 애니메이션 시작
    animateReturn();
}

// 게임 재시작
function restartGame() {
    console.log(`🔄 게임 재시작 시작: 현재 행성 수 ${planets.length}`);
    
    // 모든 행성 제거 (안전한 방식)
    const planetsToRemove = [...planets]; // 배열 복사본 생성
    planetsToRemove.forEach(planet => {
        if (planet) {
            console.log(`🗑️ 행성 제거 중: ${planet.data?.name || '알 수 없음'}`);
            removePlanet(planet);
        }
    });
    
    // 배열 완전 초기화
    planets.length = 0;
    console.log(`✅ 행성 제거 완료: 남은 행성 수 ${planets.length}`);
    
    // 게임 상태 초기화
    score = 0;
    gameRunning = true;
    
    // 카메라 위치 초기화
    cameraAngle = 0;
    cameraHeight = 5;
    
    // 카메라 속도 초기화 (부드러운 움직임)
    cameraAngleVelocity = 0;
    cameraHeightVelocity = 0;
    
    // UI 업데이트
    updateUI();
    setNextPlanet();
    updateAimingPlanet();
    
    // 카메라와 조준용 행성 위치 동기화
    updateCameraPosition();
    
    // 테스트 행성 다시 생성
    createTestPlanets();
    console.log(`🎮 게임 재시작 완료: 새 행성 수 ${planets.length}`);
    
    document.getElementById('gameOver').style.display = 'none';
    
    // 배경음악 재시작 (박재현)
    startBackgroundMusic();
}

// UI 업데이트
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('bestScore').textContent = bestScore;
}

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);
    
    // 부드러운 카메라 움직임 업데이트
    updateCameraMovement();
    
    // 중앙으로 끌어당기는 중력 적용
    if (gameRunning) {
        applyCentralGravity();
        stabilisePlanets();   // 떨림 억제 (박재현)
    }
    
    // 물리 시뮬레이션 업데이트
    world.step(1/60);
    
    // 행성 위치 동기화
    planets.forEach(planet => {
        planet.mesh.position.copy(planet.body.position);
        planet.mesh.quaternion.copy(planet.body.quaternion);
        
        // 토성 고리 동기화
        if (planet.mesh.userData.ring) {
            planet.mesh.userData.ring.position.copy(planet.body.position);
        }
        
        // 태양 글로우 동기화
        if (planet.mesh.userData.glow) {
            planet.mesh.userData.glow.position.copy(planet.body.position);
        }
    });
    
    // 충돌 체크 및 중력장 색상 업데이트
    if (gameRunning) {
        updateGravityFieldColor(); // 중력장 위험도에 따른 색상 변경
        checkCollisions();
        checkGameOver();
    }
    
    // 렌더링
    renderer.render(scene, camera);
}

// 카메라 위치 업데이트 (공전)
function updateCameraPosition() {
    // 극좌표를 직교좌표로 변환
    camera.position.x = Math.sin(cameraAngle) * cameraDistance;
    camera.position.y = cameraHeight;
    camera.position.z = Math.cos(cameraAngle) * cameraDistance;
    
    // 항상 중력장 중심을 바라보도록 설정
    camera.lookAt(0, 0, 0);
    
    // 조준용 행성 위치도 업데이트
    if (aimingPlanet) {
        const cameraDirection = new THREE.Vector3(
            Math.sin(cameraAngle),
            0,
            Math.cos(cameraAngle)
        ).normalize();
        
        const upVector = new THREE.Vector3(0, 1, 0);
        
        const launchOffset = new THREE.Vector3()
            .addScaledVector(cameraDirection, -3) // 카메라에서 3만큼 앞쪽
            .addScaledVector(upVector, -2); // 아래쪽 2만큼
        
        const aimingPosition = camera.position.clone().add(launchOffset);
        aimingPlanet.position.copy(aimingPosition);
    }
    
    console.log(`카메라 위치: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}), 각도: ${(cameraAngle * 180 / Math.PI).toFixed(1)}°`);
}

// 카메라 움직임 업데이트 함수 (애니메이션 루프에서 호출)
function updateCameraMovement() {
    let angleAcceleration = 0;
    let heightAcceleration = 0;
    
    // 키 입력에 따른 가속도 적용
    if (pressedKeys.has('a')) {
        angleAcceleration -= CAMERA_SETTINGS.acceleration; // 반시계방향
    }
    if (pressedKeys.has('d')) {
        angleAcceleration += CAMERA_SETTINGS.acceleration; // 시계방향
    }
    if (pressedKeys.has('w')) {
        heightAcceleration += CAMERA_SETTINGS.heightAcceleration; // 위로 (더 빠름)
    }
    if (pressedKeys.has('s')) {
        heightAcceleration -= CAMERA_SETTINGS.heightAcceleration; // 아래로 (더 빠름)
    }
    
    // 속도에 가속도 적용
    cameraAngleVelocity += angleAcceleration;
    cameraHeightVelocity += heightAcceleration;
    
    // 최대 속도 제한 (높이와 각도에 다른 최대값 적용)
    cameraAngleVelocity = Math.max(-CAMERA_SETTINGS.maxSpeed, Math.min(CAMERA_SETTINGS.maxSpeed, cameraAngleVelocity));
    cameraHeightVelocity = Math.max(-CAMERA_SETTINGS.heightMaxSpeed, Math.min(CAMERA_SETTINGS.heightMaxSpeed, cameraHeightVelocity));
    
    // 마찰력 적용 (부드러운 감속)
    cameraAngleVelocity *= CAMERA_SETTINGS.friction;
    cameraHeightVelocity *= CAMERA_SETTINGS.friction;
    
    // 매우 작은 속도는 0으로 처리 (떨림 방지)
    if (Math.abs(cameraAngleVelocity) < 0.001) cameraAngleVelocity = 0;
    if (Math.abs(cameraHeightVelocity) < 0.001) cameraHeightVelocity = 0;
    
    // 카메라 위치 업데이트
    if (cameraAngleVelocity !== 0 || cameraHeightVelocity !== 0) {
        cameraAngle += cameraAngleVelocity;
        cameraHeight += cameraHeightVelocity;
        updateCameraPosition();
    }
}

/* 떨림 억제용 보정(박재현) */
function stabilisePlanets() {
    planets.forEach(planet => {
        // 1) Dead-zone : 중심 아주 근처면 힘 제거
        const pos   = planet.body.position;
        const dist2 = pos.x*pos.x + pos.y*pos.y + pos.z*pos.z;
        if (dist2 < DEAD_ZONE * DEAD_ZONE) {           // r < DEAD_ZONE
            planet.body.force.set(0, 0, 0);
        }

        // 2) 저속 스냅 : 미세 진동 제거
        const v       = planet.body.velocity;
        const speed2  = v.x*v.x + v.y*v.y + v.z*v.z;
        if (speed2 < SNAP_SPEED * SNAP_SPEED) {        // |v| < SNAP_SPEED
            v.set(0, 0, 0);
            planet.body.angularVelocity.set(0, 0, 0);
            planet.body.sleep();              // 강제 수면 (박재현)
            planet.body.force.set(0, 0, 0);   // 잔여 힘 제거 (박재현   )
        }
    });
}

// 스페이스바 발사용 함수 추가
function launchStraightPlanet() {
    if (!gameRunning || isLaunching) return;
    
    isLaunching = true;
    
    // 카메라가 바라보는 방향으로 발사 방향 설정 (수정)
    const cameraDirection = new THREE.Vector3(
        -Math.sin(cameraAngle),  // 부호 반전
        0,
        -Math.cos(cameraAngle)   // 부호 반전
    ).normalize();
    
    // 카메라 기준 고정 발사 위치
    const launchOffset = new THREE.Vector3()
        .addScaledVector(cameraDirection, -3)
        .addScaledVector(new THREE.Vector3(0, 1, 0), -2);
    
    const startPosition = camera.position.clone().add(launchOffset);
    
    // 새로운 행성 생성
    const newPlanet = createPlanet(nextPlanetType, startPosition);
    
    // 직선 속도 설정 (중력의 영향을 받지 않도록 충분히 빠른 속도로)
    const straightVelocity = cameraDirection.clone().multiplyScalar(15);
    newPlanet.body.velocity.copy(new CANNON.Vec3(straightVelocity.x, straightVelocity.y, straightVelocity.z));
    
    // 다음 행성 설정
    setNextPlanet();
    updateAimingPlanet();
    
    // 발사 완료 후 상태 초기화
    setTimeout(() => {
        isLaunching = false;
    }, 300);
}

// 게임 시작 (라이브러리 로딩 확인 후)
//window.addEventListener('load', () => {
    //console.log('페이지 로드 완료. 라이브러리 확인 시작...');
    //setTimeout(checkLibrariesAndInit, 100); // 약간의 지연 후 확인
//}); 

// -> 게임 시작은, 스타트 버튼 1번만 누르고 되어야 함.
