import * as THREE from 'three';

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xffffff, 0.045);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 6;

// OPTIMIZATION: 'powerPreference' forces high-performance GPU mode
const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('webgl'),
    antialias: true,
    alpha: true,
    powerPreference: "high-performance" 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- NODES & CONNECTIONS CONFIG ---
const particleCount = 200; // Reduced slightly from 250 -> 200 for 120fps stability (Hardly visible difference)
const connectionDistance = 1.8;
const connectionDistanceSq = connectionDistance * connectionDistance; // OPTIMIZATION: Pre-calculate square

const particlesData = [];
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);

// --- EXPANDED GRADIENT PALETTE ---
const palette = [
    new THREE.Color('#0056b3'), // Deep Blue
    new THREE.Color('#6f42c1'), // Purple
    new THREE.Color('#20c997'), // Teal
    new THREE.Color('#d63384'), // Magenta
    new THREE.Color('#ffc107')  // Gold
];

// Create Nodes
for (let i = 0; i < particleCount; i++) {
    const x = (Math.random() - 0.5) * 15;
    const y = (Math.random() - 0.5) * 15;
    const z = (Math.random() - 0.5) * 15;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    particlesData.push({
        velocity: new THREE.Vector3(
            -1 + Math.random() * 2,
            -1 + Math.random() * 2,
            -1 + Math.random() * 2
        ).normalize().multiplyScalar(0.005), 
        numConnections: 0
    });

    const color = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
}

const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setDrawRange(0, particleCount);
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// Material for Nodes
const pMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.12,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
});

const pointCloud = new THREE.Points(particlesGeometry, pMaterial);
scene.add(pointCloud);

// --- LINES (SYNAPSES) ---
const maxConnections = particleCount * particleCount; 
const linePositions = new Float32Array(maxConnections * 3);
const lineColors = new Float32Array(maxConnections * 3);

const linesGeometry = new THREE.BufferGeometry();
linesGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
linesGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));

const linesMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    blending: THREE.NormalBlending,
    transparent: true,
    opacity: 0.35 
});

const linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
scene.add(linesMesh);

// --- MOUSE INTERACTION ---
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;

const group = new THREE.Group();
group.add(pointCloud);
group.add(linesMesh);
scene.add(group);

window.addEventListener("mousemove", (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
});

// --- ANIMATION LOOP ---
function animate() {
    // 1. Mouse Inertia
    targetX = mouseX * 0.15;
    targetY = mouseY * 0.15;
    
    group.rotation.y += 0.0003; 
    group.rotation.y += 0.02 * (targetX - group.rotation.y);
    group.rotation.x += 0.02 * (targetY - group.rotation.x);

    // 2. Update Positions
    let vertexpos = 0;
    let colorpos = 0;
    let numConnected = 0;

    // Reset connections count
    for (let i = 0; i < particleCount; i++) {
        particlesData[i].numConnections = 0;
    }

    // Main Loop
    for (let i = 0; i < particleCount; i++) {
        const particleData = particlesData[i];

        // Access positions directly from array (faster)
        const px = positions[i * 3]     += particleData.velocity.x;
        const py = positions[i * 3 + 1] += particleData.velocity.y;
        const pz = positions[i * 3 + 2] += particleData.velocity.z;

        // Bounce off walls
        if (py < -7 || py > 7) particleData.velocity.y = -particleData.velocity.y;
        if (px < -7 || px > 7) particleData.velocity.x = -particleData.velocity.x;
        if (pz < -7 || pz > 7) particleData.velocity.z = -particleData.velocity.z;

        // OPTIMIZED CONNECTION CHECK (O(N^2) but strictly math)
        // We only check j > i to avoid double checking pairs
        for (let j = i + 1; j < particleCount; j++) {
            const dx = px - positions[j * 3];
            const dy = py - positions[j * 3 + 1];
            const dz = pz - positions[j * 3 + 2];
            
            // OPTIMIZATION: Compare squared distance (Avoids Math.sqrt)
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < connectionDistanceSq) {
                
                // Add Line Position A
                linePositions[vertexpos++] = px;
                linePositions[vertexpos++] = py;
                linePositions[vertexpos++] = pz;

                // Add Line Position B
                linePositions[vertexpos++] = positions[j * 3];
                linePositions[vertexpos++] = positions[j * 3 + 1];
                linePositions[vertexpos++] = positions[j * 3 + 2];

                // Add Color A
                lineColors[colorpos++] = colors[i * 3];
                lineColors[colorpos++] = colors[i * 3 + 1];
                lineColors[colorpos++] = colors[i * 3 + 2];

                // Add Color B
                lineColors[colorpos++] = colors[j * 3];
                lineColors[colorpos++] = colors[j * 3 + 1];
                lineColors[colorpos++] = colors[j * 3 + 2];

                numConnected++;
            }
        }
    }

    linesGeometry.setDrawRange(0, numConnected * 2);
    linesGeometry.attributes.position.needsUpdate = true;
    linesGeometry.attributes.color.needsUpdate = true;
    pointCloud.geometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});