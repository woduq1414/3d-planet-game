// 업데이트 사항 (박재현)
// 1. 초반에 행성 3개 소환 후 화성을 만드는데, 이는 그냥 행성 1개를 만드는 것과 동일하여 createTestPlanet 함수 수정
// 2. 행성이 중력장 내에 위치하고 충분한 시간이 지나도 떨림 현상 발생. 이를 방지하기 위해 추가 코드 작성.
// 3. 발사 파워에서 게이지가 제대로 표시 안된점 수정, 최대 100% 까지 표시는되는데, 실제론 50%임 (50%를 100%로 표시되게.)
// 4. 발사시 딜레이 추가. 1초.

// 게임 설정 상수들 
const GAME_CONFIG = {
    gravity: 30,      // 중력 세기
    maxPower: 18,      // 최대 발사 파워
    areaSize: 5,      // 중력장 크기
    trajectorySteps: 80  // 궤적 계산 점의 개수
};

// 게임 변수들
let scene, camera, renderer, world;
let planets = [];
let gameContainer, gameArea;
let score = 0;
let bestScore = localStorage.getItem('sputnika3d-best') || 0;
let gameRunning = true;
let currentPlanetType = 0; // 현재 발사할 행성
let nextPlanetType = 0;    // 다음에 발사할 행성
let dropLine;
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();

// 행성 도감 관련 변수들
let discoveredPlanets = new Set(); // 발견된 행성들의 인덱스를 저장
let planetMiniRenderers = {}; // 각 행성별 미니 렌더러 저장

// 3D 뷰어 관련 변수들
let viewerScene, viewerCamera, viewerRenderer;
let viewerPlanet, viewerRing, viewerGlow;
let viewerContainer;
let viewerControls = {
    isDragging: false,
    previousMousePosition: { x: 0, y: 0 },
    rotation: { x: 0, y: 0 },
    distance: 5,
    minDistance: 2,
    maxDistance: 15
};

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
    acceleration: 0.003, // 가속도 (가로 방향 각도 회전)
    friction: 0.92,      // 마찰력
    maxSpeed: 0.05,      // 최대 속도 
    heightAcceleration: 0.008, // 높이 방향 가속도 
    heightMaxSpeed: 0.15       // 높이 방향 최대 속도 
};

// 카메라 움직임 제한 설정
const CAMERA_LIMITS = {
    angleMin: -Math.PI / 2,  // -90도 (왼쪽 한계)
    angleMax: Math.PI / 2,   // 90도 (오른쪽 한계)
    heightMin: 2,            // 최소 높이
    heightMax: 12            // 최대 높이
};

// 키보드 입력 상태 관리 (전역)
const pressedKeys = new Set();

// 행성 정의 
const PLANET_TYPES = [
    { name: '달', josa: "이", color: 0xC0C0C0, size: 0.3, points: 1, texture: 'moon.png', description: '지구의 위성인 달. 작지만 소중한 존재로 게임의 시작점이 됩니다.' },
    { name: '수성', josa: "이", color: 0x8C7853, size: 0.4, points: 2, texture: 'mercury.png', description: '태양계에서 가장 가까운 행성. 빠른 공전으로 유명합니다.' },
    { name: '금성', josa: "이", color: 0xFFC649, size: 0.5, points: 4, texture: 'venus.png', description: '샛별로 불리는 아름다운 행성. 강한 온실효과로 매우 뜨겁습니다.' },
    { name: '지구', josa: "가", color: 0x6B93D6, size: 0.6, points: 8, texture: 'earth.png', description: '우리가 살고 있는 푸른 행성. 물과 생명이 존재하는 유일한 행성입니다.' },
    { name: '화성', josa: "이", color: 0xCD5C5C, size: 0.7, points: 16, texture: 'mars.png', description: '붉은 행성으로 불리는 화성. 미래의 인류 거주지로 주목받고 있습니다.' },
    { name: '목성', josa: "이", color: 0xD8CA9D, size: 1.0, points: 32, texture: 'jupiter.png', description: '태양계 최대의 행성. 거대한 가스 행성으로 많은 위성을 가지고 있습니다.' },
    { name: '토성', josa: "이", color: 0xFAD5A5, size: 1.2, points: 64, texture: 'saturn.png', description: '아름다운 고리를 가진 행성. 독특한 고리계로 유명한 가스 행성입니다.' },
    { name: '천왕성', josa: "이", color: 0x4FD0E7, size: 1.0, points: 128, texture: 'uranus.png', description: '옆으로 누워서 자전하는 특이한 행성. 차가운 얼음 행성입니다.' },
    { name: '해왕성', josa: "이", color: 0x4B70DD, size: 1.0, points: 256, texture: 'neptune.png', description: '태양계의 가장 바깥쪽 행성. 강한 바람과 푸른색이 특징입니다.' },
    { name: '태양', josa: "이", color: 0xFFD700, size: 1.5, points: 512, texture: 'sun.png', description: '태양계의 중심이 되는 항성. 모든 행성에 빛과 열을 제공하는 생명의 원천입니다.' }
];

// 텍스처 로더
const textureLoader = new THREE.TextureLoader();

// 게임 영역 설정
const GAME_AREA = {
    radius: GAME_CONFIG.areaSize,
    height: GAME_CONFIG.areaSize * 2
};

/* 떨림 억제용 추가 상수  (박재현) */
const DEAD_ZONE = 0.15;   // 중앙 r < DEAD_ZONE 구간엔 중력 없음
const SNAP_SPEED = 0.03;   // |v| < SNAP_SPEED 이면 즉시 0으로 스냅
const MAX_SPEED_SLEEP = 8.0;    // 기존 maxSpeed 그대로 쓰도록 상수화
const SLEEP_SPEED = 0.05; // |v| < 0.05 m/s 이면 강제 sleep

// 배경음악 변수 추가 (박재현)
let backgroundMusic;

// 배경음악 초기화 함수 (박재현)
function initBackgroundMusic() {
    backgroundMusic = new Audio('sounds/First_Step.mp3');
    backgroundMusic.loop = true; // 반복 재생
    backgroundMusic.volume = 1; // 볼륨 설정 (0.0 ~ 1.0) (박재현)
}

// 배경음악 시작 (박재현)
function startBackgroundMusic() {
    if (backgroundMusic) {
        backgroundMusic.play().catch(error => {
            // 배경음악 재생 실패 시 무시
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
    if (typeof THREE === 'undefined') {
        document.body.innerHTML = '<div style="color: white; text-align: center; margin-top: 50px;"><h2>THREE.js 로딩 실패</h2><p>페이지를 새로고침해주세요.</p></div>';
        return;
    }

    if (typeof CANNON === 'undefined') {
        setTimeout(checkLibrariesAndInit, 3000);
        return;
    }

    init();
    startBackgroundMusic(); // 게임 시작 시 배경음악 시작 (박재현)
}

// 초기화
function init() {
    try {
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

        // 초기 행성들 설정 (현재 발사할 행성과 다음 행성)
        currentPlanetType = 0; // 달부터 시작
        setNextPlanet(); // 다음 행성 랜덤 설정

        // UI 업데이트
        updateUI();

        // 테스트용 초기 행성 생성
        createTestPlanets();

        // 조준용 행성 생성
        createAimingPlanet();

        // 카메라와 조준용 행성 위치 동기화
        updateCameraPosition();


        discoveredPlanets.add(0); // 달

        // 게임 루프 시작
        animate();

    } catch (error) {
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

// 궤적 라인 생성
function createTrajectoryLine() {
    const trajectoryGeometry = new THREE.BufferGeometry();


    const trajectoryMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 1.0,

    });

    trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
    scene.add(trajectoryLine);


    trajectoryLine.visible = false;
}

// 조준용 행성 생성
function createAimingPlanet() {
    const planetData = PLANET_TYPES[currentPlanetType];

    const geometry = new THREE.SphereGeometry(planetData.size, 16, 16);

    // 텍스처 로드 및 적용
    const texture = textureLoader.load(
        `textures/${planetData.texture}`,
        undefined,
        (error) => {
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
    const steps = GAME_CONFIG.trajectorySteps; // 궤적 길이
    const timeStep = 0.03;
    let pos = startPos.clone();
    let vel = velocity.clone();

    // 시작점 추가
    points.push(pos.clone());

    for (let i = 0; i < steps; i++) {
        // 중력 적용
        const distance = pos.length();
        if (distance > 0.1) {
            const gravityStrength = GAME_CONFIG.gravity;
            const gravityForce = gravityStrength / (distance * 0.5 + 1);
            const gravityDirection = pos.clone().normalize().multiplyScalar(-gravityForce * timeStep);
            vel.add(gravityDirection);
        }


        const speed = vel.length();
        const maxSpeed = 8.0;
        if (speed > maxSpeed) {
            vel.normalize().multiplyScalar(maxSpeed);
        }


        pos.add(vel.clone().multiplyScalar(timeStep));


        points.push(pos.clone());

        // 종료 조건을 발사 위치에 따라 동적으로 조정
        const startDistance = startPos.length(); // 발사 위치에서 중심까지의 거리
        const maxTrajectoryDistance = Math.max(
            GAME_AREA.radius + 8,
            startDistance + 15,
            25
        );

        if (distance > maxTrajectoryDistance) {
            break;
        }

        // 중력장에 너무 가까워지면 중단
        if (distance < 0.2) {
            break;
        }
    }

    // 궤적 라인 업데이트
    trajectoryLine.geometry.setFromPoints(points);
    trajectoryLine.geometry.attributes.position.needsUpdate = true;
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

    // 카메라 기준 고정 발사 위치 
    const launchOffset = new THREE.Vector3()
        .addScaledVector(cameraDirection, -3) // 카메라에서 3만큼 앞쪽
        .addScaledVector(upVector, -2); // 아래쪽 2만큼

    const startPosition = camera.position.clone().add(launchOffset);

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

    const newPlanet = createPlanet(currentPlanetType, startPosition);
    newPlanet.body.velocity.copy(new CANNON.Vec3(velocity.x, velocity.y, velocity.z));

    // 현재 행성을 다음 행성으로 교체하고, 새로운 다음 행성 설정
    currentPlanetType = nextPlanetType;
    setNextPlanet();
    updateAimingPlanet();

    // 궤적 라인 숨기기
    trajectoryLine.visible = false;

    // 발사 완료 후 상태 초기화
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

// 테스트용 초기 행성들 생성
function createTestPlanets() {
    // 중앙에 몇 개의 행성을 미리 배치해서 게임이 제대로 작동하는지 확인
    // 이러면 처음에 행성 3개가 생성되고 합쳐지는건데, 그냥 1개로 합침. (박재현)
    createPlanet(0, new THREE.Vector3(0, 0, 0)); // 달 ( 박재현)
}

// 게임 영역 생성
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

    // 바닥 표시용 원판
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

// 중력장 색상 업데이트 (위험도에 따라 색 변화화)
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

    // 기본 색상 (Cyan)
    const normalColor = new THREE.Color(0x00ffff);
    // 경고 색상 (Orange)
    const warningColor = new THREE.Color(0xff8800);
    // 위험 색상 (Red)
    const dangerColor = new THREE.Color(0xff0000);

    let targetColor = normalColor.clone();
    let warningLevel = 0; // 0: 안전, 1: 완전 위험

    if (maxDistance > warningThreshold) {
        if (maxDistance < dangerThreshold) {
            // 경고 구역: Cyan -> Orange
            const progress = (maxDistance - warningThreshold) / (dangerThreshold - warningThreshold);
            targetColor = normalColor.clone().lerp(warningColor, progress);
            warningLevel = progress * 0.5; // 0 ~ 0.5
        } else {
            // 위험 구역: Orange -> Red
            const progress = Math.min((maxDistance - dangerThreshold) / (gravityFieldRadius - dangerThreshold), 1);
            targetColor = warningColor.clone().lerp(dangerColor, progress);
            warningLevel = 0.5 + progress * 0.5; // 0.5 ~ 1.0

        }

        // 중력장 색상 업데이트
        gameArea.material.color.copy(targetColor);

        // 위험도에 따라 투명도도 조정
        const baseOpacity = 0.2;
        const maxOpacity = 0.6;
        gameArea.material.opacity = baseOpacity + (warningLevel * (maxOpacity - baseOpacity));

        // 위험할 때 깜빡이는 효과
        if (warningLevel > 0.8) {
            const pulseSpeed = 8.0;
            const pulse = Math.sin(Date.now() * 0.01 * pulseSpeed) * 0.3 + 0.7;
            gameArea.material.opacity *= pulse;
        } else if (warningLevel > 0.5) {
            const pulseSpeed = 3.0;
            const pulse = Math.sin(Date.now() * 0.01 * pulseSpeed) * 0.2 + 0.8;
            gameArea.material.opacity *= pulse;
        }

    } else {
        // 안전 구역: 기본 색상과 투명도 복구
        gameArea.material.color.copy(normalColor);
        gameArea.material.opacity = 0.2;
    }
}

// 조명 설정 
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
    // 발견된 행성들 중에서 발사 가능한 행성들만 필터링
    const availablePlanets = [];

    // 발견된 행성들 중에서 처음 5개까지만 발사 가능
    for (let i = 0; i < Math.min(5, PLANET_TYPES.length); i++) {
        if (discoveredPlanets.has(i)) {
            availablePlanets.push(i);
        }
    }

    // 발견된 행성이 없으면 기본적으로 첫 번째 행성(달) 사용
    if (availablePlanets.length === 0) {
        availablePlanets.push(0);
        discoveredPlanets.add(0); // 달을 자동으로 발견된 것으로 처리
    }

    // 발견된 행성들 중에서 랜덤 선택
    const randomIndex = Math.floor(Math.random() * availablePlanets.length);
    nextPlanetType = availablePlanets[randomIndex];

    updatePlanetPreview();
}

// 행성 미리보기 업데이트 
function updatePlanetPreview() {
    const preview = document.getElementById('planetPreview');
    const planetData = PLANET_TYPES[nextPlanetType];

    // 기존 원형 요소가 있는지 확인
    let circle = preview.querySelector('.planet-circle');
    let img = preview.querySelector('.planet-image');

    // 기존 요소가 없으면 새로 생성
    if (!circle) {
        circle = document.createElement('div');
        circle.className = 'planet-circle';
        circle.style.width = '100%';
        circle.style.height = '100%';
        circle.style.borderRadius = '50%';
        circle.style.overflow = 'hidden';
        circle.style.transition = 'background-color 0.3s ease, opacity 0.3s ease';
        circle.style.position = 'relative';

        img = document.createElement('img');
        img.className = 'planet-image';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.transition = 'opacity 0.3s ease';
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.left = '0';

        circle.appendChild(img);
        preview.appendChild(circle);
    }

    // 배경색 부드럽게 변경
    circle.style.backgroundColor = `#${planetData.color.toString(16).padStart(6, '0')}`;
    circle.title = planetData.name;

    // 새 이미지를 미리 로드하여 깜빡임 방지
    const newImg = new Image();
    newImg.onload = () => {
        // 이미지 로드 완료 후 부드럽게 교체
        img.style.opacity = '0';
        setTimeout(() => {
            img.src = newImg.src;
            img.style.opacity = '1';
        }, 150);
    };

    newImg.onerror = () => {
        // 이미지 로드 실패 시 기본 색상만 표시
        img.style.opacity = '0';
    };

    newImg.src = `textures/${planetData.texture}`;
}

// 좌표 정규화 함수
function getNormalizedCoordinates(clientX, clientY) {
    return {
        x: (clientX / window.innerWidth) * 2 - 1,
        y: -(clientY / window.innerHeight) * 2 + 1
    };
}

// 드래그 시작 처리 함수
function handleDragStart(clientX, clientY) {
    if (!gameRunning || !canDrag) return;

    isDragging = true;
    const coords = getNormalizedCoordinates(clientX, clientY);
    dragStart.x = coords.x;
    dragStart.y = coords.y;

    // UI 업데이트
    if (window.showTrajectoryInfo) {
        window.showTrajectoryInfo(true);
    }
}

// 드래그 중 처리 함수
function handleDragMove(clientX, clientY) {
    const coords = getNormalizedCoordinates(clientX, clientY);
    mouse.x = coords.x;
    mouse.y = coords.y;

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
        const velocity = worldDirection.clone().multiplyScalar(launchPower * 0.37);
        updateTrajectory(startPos, velocity);

        // 궤적 라인 스타일을 파워에 따라 조정
        if (trajectoryLine) {
            trajectoryLine.visible = true;

      
            const powerRatio = launchPower / GAME_CONFIG.maxPower;
            if (powerRatio < 0.3) {
                trajectoryLine.material.color.setHex(0x00ff00); // 약한 파워: 녹색
            } else if (powerRatio < 0.7) {
                trajectoryLine.material.color.setHex(0x00ffff); // 중간 파워: 시안색
            } else {
                trajectoryLine.material.color.setHex(0xff0088); // 강한 파워: 핑크색
            }
        }

        // 조준용 행성 위치 업데이트
        if (aimingPlanet) {
            aimingPlanet.position.copy(startPos);
            // 파워에 따라 행성 크기 조절
            const sizeScale = 1 + (launchPower / GAME_CONFIG.maxPower) * 0.3;
            aimingPlanet.scale.setScalar(sizeScale);
        }

        // 파워 미터 UI 업데이트
        if (window.updatePowerMeter) {
            window.updatePowerMeter(launchPower);
        }
    }
}

// 드래그 종료 처리 함수 
function handleDragEnd() {
    if (!gameRunning || !isDragging) return;

    isDragging = false;

    if (launchPower > 0.5) { // 최소 파워 체크
        const dragVector = new THREE.Vector2().subVectors(dragEnd, dragStart);
        const direction = new THREE.Vector3(-dragVector.x, -dragVector.y, -1).normalize();

        // 실제 발사 파워는 표시된 파워의 절반으로 설정 (박재현)
        const actualLaunchPower = launchPower * 0.5;

        // 드래그 불가능 상태로 설정 (박재현)
        canDrag = false;

        // 0.5초 후 드래그 가능 상태로 복구 (박재현)
        setTimeout(() => {
            canDrag = true;
        }, 500);

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
    }
}

// 이벤트 리스너 설정 
function setupEventListeners() {
    // 마우스 이벤트
    renderer.domElement.addEventListener('mousedown', (event) => {
        event.preventDefault();
        handleDragStart(event.clientX, event.clientY);
    });

    renderer.domElement.addEventListener('mousemove', (event) => {
        event.preventDefault();
        handleDragMove(event.clientX, event.clientY);
    });

    renderer.domElement.addEventListener('mouseup', (event) => {
        event.preventDefault();
        handleDragEnd();
    });

    // 터치 이벤트 
    renderer.domElement.addEventListener('touchstart', (event) => {
        event.preventDefault();
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            handleDragStart(touch.clientX, touch.clientY);
        }
    }, { passive: false });

    renderer.domElement.addEventListener('touchmove', (event) => {
        event.preventDefault();
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            handleDragMove(touch.clientX, touch.clientY);
        }
    }, { passive: false });

    renderer.domElement.addEventListener('touchend', (event) => {
        event.preventDefault();
        handleDragEnd();
    }, { passive: false });

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

// 행성 생성
function createPlanet(type, position) {
    const planetData = PLANET_TYPES[type];


    const geometry = new THREE.SphereGeometry(planetData.size, 32, 32);

    // 텍스처 로드 및 적용
    const texture = textureLoader.load(
        `textures/${planetData.texture}`,

        undefined,

        (error) => {
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
    body.material.restitution = 0.1; // 반발력
    body.material.friction = 0.8; // 마찰력

    /*  떨림 방지 속성 추가 (박재현)  */
    body.linearDamping = 0.2;   // 남은 직선 속도 빨리 감쇠
    body.angularDamping = 0.2;   // 남은 회전 속도 빨리 감쇠
    body.allowSleep = true;  // 느려지면 계산 제외
    body.sleepSpeedLimit = 0.05;  // |v| < 0.05 m/s 이면
    body.sleepTimeLimit = 0.5;   // 0.5초 지속되면 sleep
    body.linearDamping = 0.4;   // 0.2 → 0.4   더 빨리 속도 죽임
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
                // 중력장 내부에서 충돌한 행성들의 플래그 업데이트
                planet.hasCollided = true;
                otherPlanet.hasCollided = true;

                // 충돌 시 속도 감소
                body.velocity.scale(0.8, body.velocity);
                other.velocity.scale(0.8, other.velocity);
            }
        }
    });

    world.add(body);

    planets.push(planet);
    return planet;
}

// 중앙으로 끌어당기는 중력 적용 
function applyCentralGravity() {
    const gravityStrength = GAME_CONFIG.gravity;

    planets.forEach(planet => {
        // 중앙(0,0,0)으로부터의 거리와 방향 계산
        const position = planet.body.position;
        const distance = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);

        if (distance > 0.1) {
            // 중앙 방향으로의 단위 벡터
            const forceDirection = new CANNON.Vec3(
                -position.x / distance,
                -position.y / distance,
                -position.z / distance
            );

            // 중력 힘 = 질량 * 중력강도 / 거리^2 
            const forceMagnitude = planet.body.mass * gravityStrength / (distance * 0.5 + 1);

            // 힘 적용
            planet.body.force.x += forceDirection.x * forceMagnitude;
            planet.body.force.y += forceDirection.y * forceMagnitude;
            planet.body.force.z += forceDirection.z * forceMagnitude;
        }

        // 속도 제한 
        const velocity = planet.body.velocity;
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
        const maxSpeed = 8.0;

        if (speed > maxSpeed) {
            const scale = maxSpeed / speed;
            velocity.x *= scale;
            velocity.y *= scale;
            velocity.z *= scale;
        }
    });
}

// 충돌 감지 및 합치기 
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

                // 충돌 감지 조건을 약간 느슨하게게
                if (distance < minDistance * 1.1) {
                    mergePlanets(planet1, planet2);
                    return;
                }
            }
        }
    }
}

// 행성 합치기 
function mergePlanets(planet1, planet2) {
    if (!planet1 || !planet2 || planet1.type !== planet2.type) {
        return;
    }

    // 새로운 행성 타입 
    const newType = planet1.type + 1;

    if (newType >= PLANET_TYPES.length) {
        return;
    }

    // 새로운 행성 위치 (두 행성의 중점으로로)
    const pos1 = planet1.body.position;
    const pos2 = planet2.body.position;
    const newPosition = new THREE.Vector3(
        (pos1.x + pos2.x) / 2,
        (pos1.y + pos2.y) / 2,
        (pos1.z + pos2.z) / 2
    );

    // 운동량 보존 (두 행성의 속도의 합의 30%로) 
    const vel1 = planet1.body.velocity;
    const vel2 = planet2.body.velocity;
    const newVelocity = new CANNON.Vec3(
        (vel1.x + vel2.x) * 0.3,
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

    // 기존 행성들 제거
    removePlanet(planet1);
    removePlanet(planet2);

    // 새로운 행성 생성
    const newPlanet = createPlanet(newType, newPosition);

    // 부모 행성들이 충돌한 적이 있다면 새 행성도 충돌 플래그 설정
    newPlanet.hasCollided = planet1.hasCollided || planet2.hasCollided;

    // 새로운 행성 발견 체크 및 토스트 알림
    if (!discoveredPlanets.has(newType)) {
        discoveredPlanets.add(newType);
        showPlanetDiscoveryToast(PLANET_TYPES[newType].name, newType);
    }

    // 운동량 적용 (감소된 속도)
    newPlanet.body.velocity.copy(newVelocity);

    // 중앙으로 약간 끌어당기는 힘 적용
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
        createSunEffect(newPosition);
    }
}

// 행성 제거 
function removePlanet(planet) {
    if (!planet) {
        return;
    }

    try {
        // Three.js 객체들 제거
        if (planet.mesh) {
            scene.remove(planet.mesh);
        }

        if (planet.mesh?.userData?.ring) {
            scene.remove(planet.mesh.userData.ring);
        }

        if (planet.mesh?.userData?.glow) {
            scene.remove(planet.mesh.userData.glow);
        }

        // 물리 바디 제거
        if (planet.body) {
            world.remove(planet.body);
        }

        // 배열에서 제거 
        const index = planets.indexOf(planet);
        if (index > -1) {
            planets.splice(index, 1);
        }

    } catch (error) {
        // 에러 무시
    }
}

// 우주 파동 합치기 효과 
function createMergeEffect(position, planetLevel = 0) {
    // 행성 레벨에 따른 스케일 계산 (레벨이 높을수록 더 큰 효과)
    const scale = (1 + (planetLevel * 0.6)) * 0.12;
    const intensity = (1 + (planetLevel * 0.3)) * 1;

    // 행성 타입에 따른 색상 가져오기
    const planetData = PLANET_TYPES[planetLevel] || PLANET_TYPES[0];
    const planetColor = new THREE.Color(planetData.color);

    // 1. 중심 폭발 빛 효과
    createCentralExplosion(position, scale, intensity, planetColor);

    // 2. 파동 링 효과 (여러 겹)
    createShockwaveRings(position, scale, intensity, planetColor);

    // 3. 나선 파티클 효과
    createSpiralParticles(position, scale, intensity, planetColor);

    // 4. 별빛 흩어짐 효과
    createStarBurst(position, scale, intensity, planetColor);


    // 소리 효과는 mergePlanets에서 행성별로 재생됨
}

// 중심 폭발 빛 효과
function createCentralExplosion(position, scale = 1, intensity = 1, planetColor = new THREE.Color(0xffffff)) {
    const geometry = new THREE.SphereGeometry(0.5 * scale, 16, 16);
    const material = new THREE.MeshBasicMaterial({
        color: planetColor.clone(),
        transparent: true,
        opacity: 1.0 * intensity
    });

    const explosion = new THREE.Mesh(geometry, material);
    explosion.position.copy(position);
    scene.add(explosion);

    // 중심 폭발 애니메이션
    const duration = (1000 + (scale - 1) * 500) * 0.5; // 스케일에 따라 지속시간 증가
    const startTime = Date.now();
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;

        if (progress < 1) {
            // 빠르게 커졌다가 서서히 사라짐
            const maxScale = 15 * scale;
            const currentScale = progress < 0.2 ? progress * maxScale : (3 * scale) - (progress * 2 * scale);
            explosion.scale.setScalar(Math.max(0.1, currentScale));

            // 행성 색상에 따른 밝기 변화
            const brightness = (1 - progress * 0.8) * intensity;
            const currentColor = planetColor.clone().multiplyScalar(brightness);
            explosion.material.color.copy(currentColor);

            explosion.material.opacity = Math.max(0, (1 - progress) * intensity);

            requestAnimationFrame(animate);
        } else {
            scene.remove(explosion);
            explosion.geometry.dispose();
            explosion.material.dispose();
        }
    };
    animate();
}

// 파동 링 효과 
function createShockwaveRings(position, scale = 1, intensity = 1, planetColor = new THREE.Color(0xffffff)) {
    // 간단한 링 메시 생성 
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

    // 링 확산 애니메이션 
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
            scene.remove(ring);
            ring.geometry.dispose();
            ring.material.dispose();
        }
    };
    animate();
}

// 나선 파티클 효과 
function createSpiralParticles(position, scale = 1, intensity = 1, planetColor = new THREE.Color(0xffffff)) {
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

    // 나선 애니메이션
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

                // 파티클 크기 변화 
                const currentScale = 1 + progress * 1.5 * scale;
                particle.mesh.scale.setScalar(currentScale);

                // 밝기도 점진적으로 감소 
                const currentBrightness = particle.brightness * (1 - progress * 0.3);
                const currentColor = particle.baseColor.clone().multiplyScalar(currentBrightness / particle.brightness);
                particle.mesh.material.color.copy(currentColor);
            });

            requestAnimationFrame(animate);
        } else {
            particles.forEach(particle => {
                scene.remove(particle.mesh);
                particle.mesh.geometry.dispose();
                particle.mesh.material.dispose();
            });
        }
    };
    animate();
}

// 별빛 흩어짐 효과 
function createStarBurst(position, scale = 1, intensity = 1, planetColor = new THREE.Color(0xffffff)) {
    const starCount = Math.floor(15 * scale); // 별 개수도 스케일에 비례
    const stars = [];

    for (let i = 0; i < starCount; i++) {
        const geometry = new THREE.SphereGeometry(0.05 * scale, 6, 6); // 크기 스케일링

        // 각 별마다 밝기 
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

    // 별 흩어짐 애니메이션 
    const lifeDecay = 0.015 / scale; // 큰 스케일일수록 더 오래 지속

    const animate = () => {
        let activeStars = 0;

        stars.forEach(star => {
            if (star.life > 0) {
                activeStars++;

                // 위치 업데이트
                star.mesh.position.add(star.velocity);

                // 지속 시간 감소 
                star.life -= lifeDecay;
                star.mesh.material.opacity = Math.max(0, star.life);

                // 중력의 영향으로 속도 조금씩 감소
                star.velocity.multiplyScalar(0.99);

                // 별이 깜빡이는 효과 
                const flicker = 0.8 + Math.sin(Date.now() * 0.008 + star.mesh.id) * 0.2;
                star.mesh.scale.setScalar(flicker * scale);

                // 지속 시간에에 따른 밝기 감소
                const currentBrightness = star.originalBrightness * star.life;
                const currentColor = star.baseColor.clone().multiplyScalar(star.life);
                star.mesh.material.color.copy(currentColor);
            }
        });

        if (activeStars > 0) {
            requestAnimationFrame(animate);
        } else {
            stars.forEach(star => {
                scene.remove(star.mesh);
                star.mesh.geometry.dispose();
                star.mesh.material.dispose();
            });
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


        const convolver = audioContext.createConvolver();
        const reverbGain = audioContext.createGain();
        reverbGain.gain.setValueAtTime(0.4, audioContext.currentTime); // 리버브 강도


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
        mainWetGain.connect(convolver); // 웨트 신호 

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
        octaveWetGain.gain.setValueAtTime(0.5, audioContext.currentTime); // 웨트 50% (

        octaveOsc.type = 'triangle'; // 삼각파로 밝은 소리
        octaveOsc.frequency.setValueAtTime(baseFrequency * 2, audioContext.currentTime); // 옥타브
        octaveGain.gain.setValueAtTime(0.1, audioContext.currentTime);
        octaveGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);

        // 행성 크기에 따른 저음 강화 
        if (planetType >= 5) { // 목성 이상의 큰 행성들
            const bassOsc = audioContext.createOscillator();
            const bassGain = audioContext.createGain();
            bassOsc.connect(bassGain);
            bassGain.connect(audioContext.destination);

            bassOsc.type = 'sine';
            bassOsc.frequency.setValueAtTime(baseFrequency / 2, audioContext.currentTime); // 낮은 옥타브
            bassGain.gain.setValueAtTime(0.2, audioContext.currentTime);
            bassGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);

            bassOsc.start(audioContext.currentTime);
            bassOsc.stop(audioContext.currentTime + 1.5);
        }

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
            sunSparkleWetGain.gain.setValueAtTime(0.7, audioContext.currentTime); // 웨트 70% 

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
        // 사운드 재생 실패 무시
    }
}


// 태양 생성 효과
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
            gameOver(planet);
            return;
        } else if (distance > warningDistance) {
            warningCount++;
            // 경고 구역에 있는 행성을 중앙으로 약간 끌어당기게 하여 난이도 조절
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

    // 행성 주변에서 적절한 각도 계산
    const offsetDistance = planetSize * 4;
    const targetCameraPos = planetPos.clone().add(new THREE.Vector3(
        offsetDistance * 0.7,  // 약간 옆에서
        offsetDistance * 0.5,  // 약간 위에서
        offsetDistance * 0.8   // 약간 뒤에서
    ));

    // 스포트라이트 추가
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

                const moveProgress = elapsed / moveToTargetDuration;

                const easeOutProgress = 1 - Math.pow(1 - moveProgress, 3);

                // 카메라 위치 보간
                camera.position.lerpVectors(originalCameraPos, targetCameraPos, easeOutProgress);

                // 카메라가 행성을 바라보도록 설정
                camera.lookAt(planetPos);

            } else {
                // 2단계: 목표 위치에서 궤도 회전
                const orbitProgress = (elapsed - moveToTargetDuration) / orbitDuration;

                const easeOrbitProgress = orbitProgress < 0.5
                    ? 2 * orbitProgress * orbitProgress
                    : 1 - Math.pow(-2 * orbitProgress + 2, 3) / 2;

                // 행성 주변으로 천천히 회전하는 효과
                const rotationAngle = easeOrbitProgress * Math.PI * 0.75; 
                const rotatedPos = targetCameraPos.clone();

                // Y축 기준 회전
                rotatedPos.x = targetCameraPos.x * Math.cos(rotationAngle) - targetCameraPos.z * Math.sin(rotationAngle);
                rotatedPos.z = targetCameraPos.x * Math.sin(rotationAngle) + targetCameraPos.z * Math.cos(rotationAngle);
            
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

    // 현재 카메라 위치 저장
    const currentCameraPos = camera.position.clone();

    // 복귀 애니메이션 상태
    const returnDuration = 2000; // 2초 동안 복귀
    const startTime = Date.now();

    // 복귀 애니메이션 함수
    const animateReturn = () => {
        const elapsed = Date.now() - startTime;
        const returnProgress = Math.min(elapsed / returnDuration, 1);

        const easeProgress = returnProgress < 0.5
            ? 2 * returnProgress * returnProgress
            : 1 - Math.pow(-2 * returnProgress + 2, 3) / 2;

        if (returnProgress < 1) {
            // 카메라 위치 원래 위치로 복귀
            camera.position.lerpVectors(currentCameraPos, originalCameraPos, easeProgress);

            // 시선 중앙으로 복귀
            const currentLookAt = violatingPlanet.mesh.position.clone();
            const targetLookAt = new THREE.Vector3(0, 0, 0);
            const lerpedLookAt = currentLookAt.lerp(targetLookAt, easeProgress);
            camera.lookAt(lerpedLookAt);

            // 행성 효과도 제거
            if (violatingPlanet.mesh) {
                // 크기 효과 제거
                const pulseScale = 1 + Math.sin(elapsed * 0.008) * 0.1 * (1 - easeProgress);
                violatingPlanet.mesh.scale.setScalar(pulseScale);

                // 색상 효과 제거
                if (violatingPlanet.mesh.material) {
                    const redTint = new THREE.Color(1, 0.3 + easeProgress * 0.7, 0.3 + easeProgress * 0.7);
                    violatingPlanet.mesh.material.color.copy(redTint);

                    const emissiveIntensity = 0x330000 * (1 - easeProgress);
                    violatingPlanet.mesh.material.emissive.setHex(emissiveIntensity);
                }
            }

            // 스포트라이트 강도 감소
            if (spotLight) {
                const baseIntensity = 1 + Math.sin(elapsed * 0.01) * 0.5;
                spotLight.intensity = baseIntensity * (1 - easeProgress);
            }

            requestAnimationFrame(animateReturn);
        } else {
            // 복귀 완료 후 정리


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
                    // 원래 색상으로 복구
                    if (violatingPlanet.mesh.material.map) {
                        violatingPlanet.mesh.material.color.setHex(0xffffff);
                    } else {
                        violatingPlanet.mesh.material.color.setHex(violatingPlanet.data.color);
                    }
                }
            }

            // 카메라 상태 복구
            camera.position.copy(originalCameraPos);
            cameraAngle = originalCameraAngle;
            cameraHeight = originalCameraHeight;
            cameraDistance = originalCameraDistance;
            camera.lookAt(0, 0, 0);

            // 게임 오버 화면 표시
            showGameOverScreen();
        }
    };

    // 복귀 애니메이션 시작
    animateReturn();
}

// 게임 재시작
function restartGame() {
    // 모든 행성 제거
    const planetsToRemove = [...planets]; // 배열 복사본 생성
    planetsToRemove.forEach(planet => {
        if (planet) {
            removePlanet(planet);
        }
    });

    // 배열 완전 초기화
    planets.length = 0;


    // 게임 상태 초기화
    score = 0;
    gameRunning = true;

    // 카메라 위치 초기화
    cameraAngle = 0;
    cameraHeight = 5;

    // 카메라 속도 초기화
    cameraAngleVelocity = 0;
    cameraHeightVelocity = 0;

    // UI 업데이트
    updateUI();

    // 초기 행성들 설정 (현재 발사할 행성과 다음 행성)
    currentPlanetType = 0; // 달부터 시작
    setNextPlanet(); // 다음 행성 랜덤 설정
    updateAimingPlanet();

    // 카메라와 조준용 행성 위치 동기화
    updateCameraPosition();

    // 테스트 행성 다시 생성
    createTestPlanets();

    document.getElementById('gameOver').style.display = 'none';

    // 배경음악 재시작 (박재현)
    startBackgroundMusic();

    // 발견된 행성 정보는 게임 재시작해도 유지됨 (discoveredPlanets 초기화 안함)
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
    world.step(1 / 60);

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
}

// 카메라 움직임 업데이트 함수 (애니메이션 루프에서 호출)
function updateCameraMovement() {
    let angleAcceleration = 0;
    let heightAcceleration = 0;

    // 키 입력에 따른 가속도 적용
    if (pressedKeys.has('a') || pressedKeys.has("A") || pressedKeys.has("ㅁ")) {
        angleAcceleration -= CAMERA_SETTINGS.acceleration; // 반시계방향
    }
    if (pressedKeys.has('d') || pressedKeys.has("D") || pressedKeys.has("ㅇ")) {
        angleAcceleration += CAMERA_SETTINGS.acceleration; // 시계방향
    }
    if (pressedKeys.has('w') || pressedKeys.has("W") || pressedKeys.has("ㅈ")) {
        heightAcceleration += CAMERA_SETTINGS.heightAcceleration; // 위로 (더 빠름)
    }
    if (pressedKeys.has('s') || pressedKeys.has("S") || pressedKeys.has("ㄴ")) {
        heightAcceleration -= CAMERA_SETTINGS.heightAcceleration; // 아래로 (더 빠름)
    }

    // 속도에 가속도 적용
    cameraAngleVelocity += angleAcceleration;
    cameraHeightVelocity += heightAcceleration;

    // 최대 속도 제한
    cameraAngleVelocity = Math.max(-CAMERA_SETTINGS.maxSpeed, Math.min(CAMERA_SETTINGS.maxSpeed, cameraAngleVelocity));
    cameraHeightVelocity = Math.max(-CAMERA_SETTINGS.heightMaxSpeed, Math.min(CAMERA_SETTINGS.heightMaxSpeed, cameraHeightVelocity));

    // 마찰력 적용
    cameraAngleVelocity *= CAMERA_SETTINGS.friction;
    cameraHeightVelocity *= CAMERA_SETTINGS.friction;

    // 매우 작은 속도는 0으로 처리 (떨림 방지)
    if (Math.abs(cameraAngleVelocity) < 0.001) cameraAngleVelocity = 0;
    if (Math.abs(cameraHeightVelocity) < 0.001) cameraHeightVelocity = 0;

    // 카메라 위치 업데이트
    if (cameraAngleVelocity !== 0 || cameraHeightVelocity !== 0) {
        // 각도 제한 적용
        const newAngle = cameraAngle + cameraAngleVelocity;
        if (newAngle >= CAMERA_LIMITS.angleMin && newAngle <= CAMERA_LIMITS.angleMax) {
            cameraAngle = newAngle;
        } else {
            // 제한에 도달하면 속도를 0으로 설정
            cameraAngleVelocity = 0;
            cameraAngle = Math.max(CAMERA_LIMITS.angleMin, Math.min(CAMERA_LIMITS.angleMax, cameraAngle));
        }

        // 높이 제한 적용
        const newHeight = cameraHeight + cameraHeightVelocity;
        if (newHeight >= CAMERA_LIMITS.heightMin && newHeight <= CAMERA_LIMITS.heightMax) {
            cameraHeight = newHeight;
        } else {
            // 제한에 도달하면 속도를 0으로 설정
            cameraHeightVelocity = 0;
            cameraHeight = Math.max(CAMERA_LIMITS.heightMin, Math.min(CAMERA_LIMITS.heightMax, cameraHeight));
        }

        updateCameraPosition();
    }
}

/* 떨림 억제용 보정(박재현) */
function stabilisePlanets() {
    planets.forEach(planet => {
        // Dead-zone : 중심 아주 근처면 힘 제거
        const pos = planet.body.position;
        const dist2 = pos.x * pos.x + pos.y * pos.y + pos.z * pos.z;
        if (dist2 < DEAD_ZONE * DEAD_ZONE) {           // r < DEAD_ZONE
            planet.body.force.set(0, 0, 0);
        }

        // 저속 스냅 : 미세 진동 제거
        const v = planet.body.velocity;
        const speed2 = v.x * v.x + v.y * v.y + v.z * v.z;
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

    // 카메라가 바라보는 방향으로 발사 방향 설정
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
    const newPlanet = createPlanet(currentPlanetType, startPosition);

    // 직선 속도 설정
    const straightVelocity = cameraDirection.clone().multiplyScalar(15);
    newPlanet.body.velocity.copy(new CANNON.Vec3(straightVelocity.x, straightVelocity.y, straightVelocity.z));

    // 현재 행성을 다음 행성으로 교체하고, 새로운 다음 행성 설정
    currentPlanetType = nextPlanetType;
    setNextPlanet();
    updateAimingPlanet();

    // 발사 완료 후 상태 초기화
    setTimeout(() => {
        isLaunching = false;
    }, 300);
}

// 게임 시작 (라이브러리 로딩 확인 후)
//window.addEventListener('load', () => {
//setTimeout(checkLibrariesAndInit, 100); // 약간의 지연 후 확인
//}); 

// -> 게임 시작은, 스타트 버튼 1번만 누르고 되어야 함.

// ================== 행성 도감 관련 함수들 ==================

// 행성 발견 토스트 알림 표시
function showPlanetDiscoveryToast(planetName, planetIndex) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = ` ${planetName}${PLANET_TYPES[planetIndex].josa} 발견되었습니다! `;

    document.body.appendChild(toast);

    // 3초 후 토스트 제거
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 500);
    }, 3000);
}

// 행성 도감 모달 열기
function openPlanetEncyclopedia() {
    const modal = document.getElementById('planetEncyclopediaModal');
    modal.style.display = 'flex';
    updatePlanetsGrid();
}

// 행성 도감 모달 닫기
function closePlanetEncyclopedia() {
    const modal = document.getElementById('planetEncyclopediaModal');
    modal.style.display = 'none';

    // 미니 렌더러들 정리
    Object.values(planetMiniRenderers).forEach(rendererData => {
        if (rendererData.animationId) {
            cancelAnimationFrame(rendererData.animationId);
        }
    });
    planetMiniRenderers = {};
}

// 행성 그리드 업데이트
function updatePlanetsGrid() {
    const planetsGrid = document.getElementById('planetsGrid');
    planetsGrid.innerHTML = '';

    PLANET_TYPES.forEach((planetData, index) => {
        const planetCard = document.createElement('div');
        planetCard.className = 'planet-card';

        const isDiscovered = discoveredPlanets.has(index);
        if (!isDiscovered) {
            planetCard.classList.add('locked');
        }

        // 3D 미리보기 컨테이너
        const preview3D = document.createElement('div');
        preview3D.className = 'planet-preview-3d';
        preview3D.id = `planet-preview-${index}`;

        // 행성 정보
        const planetInfo = document.createElement('div');
        planetInfo.className = 'planet-info';

        const planetName = document.createElement('div');
        planetName.className = 'planet-name';
        planetName.textContent = isDiscovered ? planetData.name : '???';

        const planetDescription = document.createElement('div');
        planetDescription.className = 'planet-description';
        planetDescription.textContent = isDiscovered ? planetData.description : '아직 발견되지 않은 행성입니다.';

        const planetStats = document.createElement('div');
        planetStats.className = 'planet-stats';
        if (isDiscovered) {
            planetStats.innerHTML = `
                점수: ${planetData.points}
            `;
        } else {
            planetStats.textContent = '발견하면 정보가 공개됩니다.';
        }

        planetInfo.appendChild(planetName);
        planetInfo.appendChild(planetDescription);
        planetInfo.appendChild(planetStats);

        planetCard.appendChild(preview3D);
        planetCard.appendChild(planetInfo);
        planetsGrid.appendChild(planetCard);

        // 발견된 행성만 3D 미리보기 생성 및 클릭 이벤트 추가
        if (isDiscovered) {
            setTimeout(() => createPlanetMiniPreview(index, preview3D), 100);

            // 행성 카드 클릭 시 3D 뷰어 열기
            planetCard.addEventListener('click', () => {
                openPlanetViewer(index);
            });
        } else {
            // 잠금 아이콘 표시
            preview3D.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 2em; color: #666;">🔒</div>';
        }
    });
}

// 행성 미니 3D 미리보기 생성
function createPlanetMiniPreview(planetIndex, container) {
    if (!container || planetMiniRenderers[planetIndex]) return;

    const planetData = PLANET_TYPES[planetIndex];

    // 미니 3D 씬 설정
    const miniScene = new THREE.Scene();
    const miniCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    const miniRenderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true
    });

    miniRenderer.setSize(80, 80);
    miniRenderer.setClearColor(0x000000, 0);
    container.appendChild(miniRenderer.domElement);

    // 조명 설정
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    miniScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    miniScene.add(directionalLight);

    // 행성 메시 생성
    const geometry = new THREE.SphereGeometry(1, 16, 16);

    // 텍스처 로드 및 적용
    const texture = textureLoader.load(
        `textures/${planetData.texture}`,
        undefined,
        (error) => {
            material.color.setHex(planetData.color);
        }
    );

    const material = new THREE.MeshPhongMaterial({
        map: texture
    });

    // 태양의 경우 발광 효과
    if (planetIndex === 9) {
        material.emissive = new THREE.Color(0x332200);
        material.emissiveIntensity = 0.3;
    }

    const mesh = new THREE.Mesh(geometry, material);
    miniScene.add(mesh);

    // 토성의 고리 추가
    if (planetIndex === 6) {
        const ringGeometry = new THREE.RingGeometry(1.2, 1.8, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xC4A484,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        miniScene.add(ring);
    }

    // 카메라 위치 설정
    miniCamera.position.set(2, 1, 2);
    miniCamera.lookAt(0, 0, 0);

    // 애니메이션 저장
    planetMiniRenderers[planetIndex] = {
        scene: miniScene,
        camera: miniCamera,
        renderer: miniRenderer,
        mesh: mesh,
        animationId: null
    };

    // 회전 애니메이션
    function animateMiniPlanet() {
        const rendererData = planetMiniRenderers[planetIndex];
        if (!rendererData) return;

        rendererData.mesh.rotation.y += 0.01;
        rendererData.renderer.render(rendererData.scene, rendererData.camera);
        rendererData.animationId = requestAnimationFrame(animateMiniPlanet);
    }

    animateMiniPlanet();
}

// ================== 3D 뷰어 관련 함수들 ==================

// 3D 뷰어 열기
function openPlanetViewer(planetIndex) {
    const planetData = PLANET_TYPES[planetIndex];

    // 헤더 업데이트
    document.getElementById('viewerHeader').textContent = ` ${planetData.name} `;

    // 모달 표시
    const modal = document.getElementById('planetViewerModal');
    modal.style.display = 'flex';

    // 3D 뷰어 초기화
    initPlanetViewer(planetIndex);
}

// 3D 뷰어 닫기
function closePlanetViewer() {
    const modal = document.getElementById('planetViewerModal');
    modal.style.display = 'none';

    // 3D 뷰어 정리
    cleanupPlanetViewer();
}

// 3D 뷰어 초기화
function initPlanetViewer(planetIndex) {
    const planetData = PLANET_TYPES[planetIndex];
    viewerContainer = document.getElementById('viewer3DContainer');

    // 기존 뷰어 정리
    cleanupPlanetViewer();

    // 3D 씬 설정
    viewerScene = new THREE.Scene();
    viewerScene.background = new THREE.Color(0x000011);

    // 카메라 설정
    const aspect = viewerContainer.clientWidth / viewerContainer.clientHeight;
    viewerCamera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);

    // 렌더러 설정
    viewerRenderer = new THREE.WebGLRenderer({ antialias: true });
    viewerRenderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
    viewerRenderer.shadowMap.enabled = true;
    viewerRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    viewerContainer.appendChild(viewerRenderer.domElement);

    // 조명 설정
    setupViewerLights();

    // 행성 생성
    createViewerPlanet(planetIndex);

    // 컨트롤 초기화
    viewerControls.rotation = { x: 0, y: 0 };
    viewerControls.distance = 5;
    updateViewerCameraPosition();

    // 이벤트 리스너 설정
    setupViewerEventListeners();

    // 애니메이션 시작
    animateViewer();
}

// 뷰어 조명 설정
function setupViewerLights() {
    // 환경 조명
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    viewerScene.add(ambientLight);

    // 주 조명
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    viewerScene.add(directionalLight);

    // 보조 조명
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-5, 3, 5);
    viewerScene.add(pointLight);
}

// 뷰어용 행성 생성
function createViewerPlanet(planetIndex) {
    const planetData = PLANET_TYPES[planetIndex];

    // 행성 메시 생성
    const geometry = new THREE.SphereGeometry(1, 64, 64);

    // 텍스처 로드
    const texture = textureLoader.load(
        `textures/${planetData.texture}`,
        undefined,
        (error) => {
            material.color.setHex(planetData.color);
        }
    );

    const material = new THREE.MeshPhongMaterial({
        map: texture,
        shininess: 50
    });

    // 태양의 경우 발광 효과
    if (planetIndex === 9) {
        material.emissive = new THREE.Color(0x332200);
        material.emissiveIntensity = 0.4;

        // 태양 글로우 효과
        const glowGeometry = new THREE.SphereGeometry(1.3, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.2
        });
        viewerGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        viewerScene.add(viewerGlow);
    }

    viewerPlanet = new THREE.Mesh(geometry, material);
    viewerPlanet.castShadow = true;
    viewerPlanet.receiveShadow = true;
    viewerScene.add(viewerPlanet);

    // 토성의 고리
    if (planetIndex === 6) {
        const ringGeometry = new THREE.RingGeometry(1.5, 2.2, 64);
        const ringMaterial = new THREE.MeshPhongMaterial({
            color: 0xC4A484,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        viewerRing = new THREE.Mesh(ringGeometry, ringMaterial);
        viewerRing.rotation.x = Math.PI / 2;
        viewerRing.castShadow = true;
        viewerRing.receiveShadow = true;
        viewerScene.add(viewerRing);
    }
}

// 뷰어 카메라 위치 업데이트
function updateViewerCameraPosition() {
    const x = Math.sin(viewerControls.rotation.y) * Math.cos(viewerControls.rotation.x) * viewerControls.distance;
    const y = Math.sin(viewerControls.rotation.x) * viewerControls.distance;
    const z = Math.cos(viewerControls.rotation.y) * Math.cos(viewerControls.rotation.x) * viewerControls.distance;

    viewerCamera.position.set(x, y, z);
    viewerCamera.lookAt(0, 0, 0);
}

// 뷰어 이벤트 리스너 설정
function setupViewerEventListeners() {
    const canvas = viewerRenderer.domElement;

    // 마우스 다운
    canvas.addEventListener('mousedown', (event) => {
        viewerControls.isDragging = true;
        viewerControls.previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
        canvas.style.cursor = 'grabbing';
    });

    // 마우스 이동
    canvas.addEventListener('mousemove', (event) => {
        if (!viewerControls.isDragging) return;

        const deltaX = event.clientX - viewerControls.previousMousePosition.x;
        const deltaY = event.clientY - viewerControls.previousMousePosition.y;

        viewerControls.rotation.y += deltaX * 0.01;
        viewerControls.rotation.x += deltaY * 0.01;

        // X 회전 제한 (위아래)
        viewerControls.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, viewerControls.rotation.x));

        viewerControls.previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };

        updateViewerCameraPosition();
    });

    // 마우스 업
    canvas.addEventListener('mouseup', () => {
        viewerControls.isDragging = false;
        canvas.style.cursor = 'grab';
    });

    // 마우스 리브
    canvas.addEventListener('mouseleave', () => {
        viewerControls.isDragging = false;
        canvas.style.cursor = 'grab';
    });

    // 마우스 휠 (확대/축소)
    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();

        const zoomSpeed = 0.5;
        viewerControls.distance += event.deltaY * 0.01 * zoomSpeed;
        viewerControls.distance = Math.max(viewerControls.minDistance, Math.min(viewerControls.maxDistance, viewerControls.distance));

        updateViewerCameraPosition();
    });

    // 초기 커서 설정
    canvas.style.cursor = 'grab';
}

// 뷰어 애니메이션
function animateViewer() {
    if (!viewerScene || !viewerCamera || !viewerRenderer) return;

    // 행성 자전
    if (viewerPlanet) {
        viewerPlanet.rotation.y += 0.005;
    }

    // 토성 고리 회전
    if (viewerRing) {
        viewerRing.rotation.z += 0.002;
    }

    // 태양 글로우 효과
    if (viewerGlow) {
        const pulse = Math.sin(Date.now() * 0.002) * 0.1 + 0.2;
        viewerGlow.material.opacity = pulse;
        viewerGlow.rotation.y += 0.001;
    }

    viewerRenderer.render(viewerScene, viewerCamera);

    // 모달이 열려있을 때만 애니메이션 계속
    const modal = document.getElementById('planetViewerModal');
    if (modal && modal.style.display === 'flex') {
        requestAnimationFrame(animateViewer);
    }
}

// 뷰어 정리
function cleanupPlanetViewer() {
    if (viewerRenderer && viewerContainer) {
        viewerContainer.innerHTML = '';
    }

    viewerScene = null;
    viewerCamera = null;
    viewerRenderer = null;
    viewerPlanet = null;
    viewerRing = null;
    viewerGlow = null;
}

// 전역 함수로 노출
window.openPlanetEncyclopedia = openPlanetEncyclopedia;
window.closePlanetEncyclopedia = closePlanetEncyclopedia;
window.openPlanetViewer = openPlanetViewer;
window.closePlanetViewer = closePlanetViewer;