setupMobileNavigation();
setupBackground();

function setupMobileNavigation() {
    const nav = document.getElementById('navLinks');
    const hamburger = document.getElementById('hamburgerBtn');

    if (!nav || !hamburger) {
        return;
    }

    const closeMenu = () => {
        nav.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
    };

    hamburger.addEventListener('click', (event) => {
        event.stopPropagation();
        const willOpen = !nav.classList.contains('active');
        nav.classList.toggle('active', willOpen);
        hamburger.setAttribute('aria-expanded', String(willOpen));
    });

    nav.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', closeMenu);
    });

    document.addEventListener('click', (event) => {
        if (!nav.contains(event.target) && !hamburger.contains(event.target)) {
            closeMenu();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) {
            closeMenu();
        }
    });
}

async function setupBackground() {
    const canvas = document.getElementById('webgl');

    if (!canvas) {
        return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const allowInteractiveBackground =
        document.body.dataset.background === 'interactive' &&
        !prefersReducedMotion &&
        window.innerWidth > 900;

    if (!allowInteractiveBackground) {
        canvas.setAttribute('aria-hidden', 'true');
        return;
    }

    const THREE = await import('three');

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xffffff, 0.045);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const particleCount = 140;
    const connectionDistance = 1.8;
    const connectionDistanceSq = connectionDistance * connectionDistance;
    const bounds = 7;

    const particlesData = [];
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const palette = [
        new THREE.Color('#0056b3'),
        new THREE.Color('#6f42c1'),
        new THREE.Color('#20c997'),
        new THREE.Color('#2ac8eb')
    ];

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 15;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 15;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 15;

        particlesData.push({
            velocity: new THREE.Vector3(
                -1 + Math.random() * 2,
                -1 + Math.random() * 2,
                -1 + Math.random() * 2
            ).normalize().multiplyScalar(0.004)
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

    const pointCloud = new THREE.Points(
        particlesGeometry,
        new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.12,
            vertexColors: true,
            transparent: true,
            opacity: 0.78
        })
    );

    const maxConnections = particleCount * particleCount;
    const linePositions = new Float32Array(maxConnections * 3);
    const lineColors = new Float32Array(maxConnections * 3);
    const linesGeometry = new THREE.BufferGeometry();
    linesGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
    linesGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));

    const linesMesh = new THREE.LineSegments(
        linesGeometry,
        new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.28
        })
    );

    const group = new THREE.Group();
    group.add(pointCloud);
    group.add(linesMesh);
    scene.add(group);

    let mouseX = 0;
    let mouseY = 0;
    let animationFrameId = 0;

    const onMouseMove = (event) => {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', onMouseMove);

    const animate = () => {
        let vertexPos = 0;
        let colorPos = 0;
        let numConnected = 0;

        group.rotation.y += 0.00025;
        group.rotation.y += 0.018 * (mouseX * 0.14 - group.rotation.y);
        group.rotation.x += 0.018 * (mouseY * 0.14 - group.rotation.x);

        for (let i = 0; i < particleCount; i++) {
            const particle = particlesData[i];
            const px = positions[i * 3] += particle.velocity.x;
            const py = positions[i * 3 + 1] += particle.velocity.y;
            const pz = positions[i * 3 + 2] += particle.velocity.z;

            if (py < -bounds || py > bounds) particle.velocity.y = -particle.velocity.y;
            if (px < -bounds || px > bounds) particle.velocity.x = -particle.velocity.x;
            if (pz < -bounds || pz > bounds) particle.velocity.z = -particle.velocity.z;

            for (let j = i + 1; j < particleCount; j++) {
                const dx = px - positions[j * 3];
                const dy = py - positions[j * 3 + 1];
                const dz = pz - positions[j * 3 + 2];
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq >= connectionDistanceSq) {
                    continue;
                }

                linePositions[vertexPos++] = px;
                linePositions[vertexPos++] = py;
                linePositions[vertexPos++] = pz;
                linePositions[vertexPos++] = positions[j * 3];
                linePositions[vertexPos++] = positions[j * 3 + 1];
                linePositions[vertexPos++] = positions[j * 3 + 2];

                lineColors[colorPos++] = colors[i * 3];
                lineColors[colorPos++] = colors[i * 3 + 1];
                lineColors[colorPos++] = colors[i * 3 + 2];
                lineColors[colorPos++] = colors[j * 3];
                lineColors[colorPos++] = colors[j * 3 + 1];
                lineColors[colorPos++] = colors[j * 3 + 2];

                numConnected++;
            }
        }

        linesGeometry.setDrawRange(0, numConnected * 2);
        linesGeometry.attributes.position.needsUpdate = true;
        linesGeometry.attributes.color.needsUpdate = true;
        particlesGeometry.attributes.position.needsUpdate = true;

        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('pagehide', () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', onMouseMove);
        renderer.dispose();
        particlesGeometry.dispose();
        linesGeometry.dispose();
    });
}
