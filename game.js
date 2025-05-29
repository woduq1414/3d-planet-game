// 게임 설정 상수들 (UI에서 제어 가능)
const GAME_CONFIG = {
    gravity: 23.5,     // 중력 세기
    maxPower: 15,      // 최대 발사 파워
    areaSize: 6,       // 중력장 크기
    trajectorySteps: 120  // 궤적 계산 점의 개수
};

// 게임 설정 업데이트 함수
function updateGameConfig(setting, value) {
    const oldValue = GAME_CONFIG[setting];
    GAME_CONFIG[setting] = value;
    console.log(`🔧 게임 설정 업데이트: ${setting} = ${oldValue} → ${value}`);
    
    // 중력장 크기가 변경된 경우 게임 영역 업데이트
    if (setting === 'areaSize' && gameArea) {
        // 기존 게임 영역 제거
        scene.remove(gameArea);
        
        // 새로운 게임 영역 생성
        GAME_AREA.radius = value;
        GAME_AREA.height = value * 2;
        createGameArea();
        console.log(`🌍 중력장 크기 업데이트 완료: 반지름 ${value}`);
    }
    
    // 최대 파워가 변경된 경우 추가 로그
    if (setting === 'maxPower') {
        console.log(`⚡ 최대 발사 파워 업데이트 완료: ${value}`);
    }
    
    // 중력이 변경된 경우 추가 로그
    if (setting === 'gravity') {
        console.log(`🌌 중력 강도 업데이트 완료: ${value}`);
    }
    
    // 궤적 점 개수가 변경된 경우 추가 로그
    if (setting === 'trajectorySteps') {
        console.log(`📈 궤적 점 개수 업데이트 완료: ${value}`);
    }
}

// 전역 함수로 노출
window.updateGameConfig = updateGameConfig;
window.GAME_CONFIG = GAME_CONFIG;

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
let aimingPlanet; // 조준 중인 행성
let crosshair; // 십자선

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
    { name: '달', color: 0xC0C0C0, size: 0.3, points: 1 },
    { name: '수성', color: 0x8C7853, size: 0.4, points: 2 },
    { name: '금성', color: 0xFFC649, size: 0.5, points: 4 },
    { name: '지구', color: 0x6B93D6, size: 0.6, points: 8 },
    { name: '화성', color: 0xCD5C5C, size: 0.7, points: 16 },
    { name: '목성', color: 0xD8CA9D, size: 1.0, points: 32 },
    { name: '토성', color: 0xFAD5A5, size: 1.2, points: 64 },
    { name: '천왕성', color: 0x4FD0E7, size: 1.0, points: 128 },
    { name: '해왕성', color: 0x4B70DD, size: 1.0, points: 256 },
    { name: '태양', color: 0xFFD700, size: 1.5, points: 512 }
];

// 게임 영역 설정
const GAME_AREA = {
    radius: GAME_CONFIG.areaSize, // 구체 반지름을 설정에서 가져오기
    height: GAME_CONFIG.areaSize * 2  // 높이도 설정에서 가져오기
};

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
}

// 초기화
function init() {
    try {
        console.log('게임 초기화 시작...');
        
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
    const material = new THREE.MeshPhongMaterial({ 
        color: planetData.color,
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
    if (!gameRunning) return;
    
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
    
    console.log(`행성 발사! 카메라 각도: ${(cameraAngle * 180 / Math.PI).toFixed(1)}°`);
    console.log(`카메라 위치: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`);
    console.log(`발사 위치: (${startPosition.x.toFixed(1)}, ${startPosition.y.toFixed(1)}, ${startPosition.z.toFixed(1)})`);
    console.log(`발사 방향: (${worldDirection.x.toFixed(2)}, ${worldDirection.y.toFixed(2)}, ${worldDirection.z.toFixed(2)})`);
    
    const newPlanet = createPlanet(nextPlanetType, startPosition);
    newPlanet.body.velocity.copy(new CANNON.Vec3(velocity.x, velocity.y, velocity.z));
    
    // 다음 행성 설정
    setNextPlanet();
    updateAimingPlanet();
    
    // 궤적 라인 숨기기
    trajectoryLine.visible = false;
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
    createPlanet(0, new THREE.Vector3(0, -1, 0)); // 달
    createPlanet(1, new THREE.Vector3(1, -1, 0)); // 수성
    createPlanet(0, new THREE.Vector3(-1, -1, 0)); // 달
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
    preview.style.backgroundColor = `#${planetData.color.toString(16).padStart(6, '0')}`;
    preview.title = planetData.name;
}

// 이벤트 리스너 설정 (드래그 시스템)
function setupEventListeners() {
    // 마우스 다운 (드래그 시작)
    renderer.domElement.addEventListener('mousedown', (event) => {
        if (!gameRunning) return;
        
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
            launchPower = Math.min(rawPower, GAME_CONFIG.maxPower); // 설정에서 최대 파워 가져오기
            
            // 디버깅: 파워 계산 로그
            if (Math.floor(Date.now() / 500) % 2 === 0) { // 0.5초마다 로그 출력 (너무 많은 로그 방지)
                console.log(`🎯 발사 파워: 원시값 ${rawPower.toFixed(1)} → 제한값 ${launchPower.toFixed(1)} (최대: ${GAME_CONFIG.maxPower})`);
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
            
            launchPlanet(direction, launchPower);
        }
        
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
    });
    
    // 키보드 이벤트 (부드러운 카메라 움직임)
    window.addEventListener('keydown', (event) => {
        if (event.key === ' ') { // 스페이스바로 직진 발사
            const direction = new THREE.Vector3(0, 0, -1);
            launchPlanet(direction, 8);
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
    const material = new THREE.MeshPhongMaterial({ 
        color: planetData.color,
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
    
    // 합치기 효과
    createMergeEffect(newPosition);
    
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

// 합치기 효과 (개선된 버전)
function createMergeEffect(position) {
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    
    for (let i = 0; i < 15; i++) {
        const material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color().setHSL(Math.random(), 1, 0.5),
            transparent: true,
            opacity: 1
        });
        
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        particle.position.add(new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ));
        scene.add(particle);
        
        // 애니메이션
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 1000;
            
            if (progress < 1) {
                particle.material.opacity = 1 - progress;
                particle.scale.setScalar(1 + progress * 2);
                requestAnimationFrame(animate);
            } else {
                scene.remove(particle);
            }
        };
        animate();
    }
    
    // 소리 효과 (웹 오디오 API 사용)
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        // 오디오 지원하지 않는 브라우저에서는 무시
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
            gameOver();
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
function gameOver() {
    gameRunning = false;
    
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('sputnika3d-best', bestScore);
    }
    
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').style.display = 'block';
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
    
    // 충돌 체크
    if (gameRunning) {
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

// 게임 시작 (라이브러리 로딩 확인 후)
window.addEventListener('load', () => {
    console.log('페이지 로드 완료. 라이브러리 확인 시작...');
    setTimeout(checkLibrariesAndInit, 100); // 약간의 지연 후 확인
}); 