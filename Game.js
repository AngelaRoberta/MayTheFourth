class Game {
  constructor() {
    window.game = this;
    this.entities = [];
    this.tiles = [];
    this.plants = [];
    this.zombies = [];
    this.projectiles = [];
    this.suns = [];
    this.lawnMowers = [];
    this.effects = [];
    this.scorchMarks = [];
    this.sun = 50;
    this.selectedPlant = null;
    this.shovelMode = false;
    this.isRunning = false;
    this.isPaused = false;
    this.sandboxMode = false;
    this.level = 1;
    this.wave = 1;
    this.waveTimer = 0;
    this.zombiesSpawned = 0;
    this.zombiesPerWave = 3;
    this.spawnTimer = 0;
    this.sunDropTimer = 2;
    this.clock = new THREE.Clock();
    this.plantCosts = { peashooter: 100, sunflower: 50, wallnut: 50, snowpea: 175, repeater: 200, potato_mine: 25, chomper: 150 };
    this.plantCooldowns = { peashooter: 7, sunflower: 7, wallnut: 25, snowpea: 12, repeater: 7, potato_mine: 30, chomper: 10 };
    this.plantCooldownTimers = { peashooter: 0, sunflower: 0, wallnut: 0, snowpea: 0, repeater: 0, potato_mine: 0, chomper: 0 };
    this.upgrades = { plasma: 0, shield: 0, solar: 0, cryo: 0 };
    this.plantLabels = {
      peashooter: 'Plasma Pod',
      sunflower: 'Solar Bloom',
      wallnut: 'Shield Nut',
      snowpea: 'Cryo Pod',
      repeater: 'Twin Plasma',
      potato_mine: 'Thermal Tuber',
      chomper: 'Sarlacc Bloom'
    };
    this.zombieLabels = {
      normal: 'Imperial Trooper',
      conehead: 'Conehead Trooper',
      buckethead: 'Heavy Trooper',
      scout: 'Scout Trooper',
      droid: 'Droid Walker'
    };
    this.waveNames = ['Scout Patrol', 'Sandstorm Push', 'Heavy Imperial Squad', 'Droid Advance'];
    this.environmentTimer = 18;
    this.sandstormTimer = 0;
    this.solarBoostTimer = 0;
    this.audioCtx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicDucked = false;
    this.musicVolume = this._readStoredVolume('musicVolume', 70);
    this.sfxVolume = this._readStoredVolume('sfxVolume', 80);
    this._lastSfx = {};

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xC8884A);
    this.scene.fog = new THREE.Fog(0xD4935A, 35, 110);

    // Camera
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 16, 20);
    this.camera.lookAt(1, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('gameContainer').appendChild(this.renderer.domElement);

    // Lighting - harsh Tatooine desert twin-sun feel
    const ambient = new THREE.AmbientLight(0xFFDDA0, 0.65);
    this.scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0xF5C97A, 0xC8934A, 0.7);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xFFE87A, 1.6);
    dir.position.set(14, 24, 6);
    dir.castShadow = true;
    dir.shadow.bias = -0.0005;
    dir.shadow.mapSize.set(4096, 4096);
    dir.shadow.radius = 2;
    dir.shadow.camera.left = -22; dir.shadow.camera.right = 22;
    dir.shadow.camera.top = 22; dir.shadow.camera.bottom = -22;
    this.scene.add(dir);
    // Second sun - slightly cooler fill from lower angle
    const fill = new THREE.DirectionalLight(0xFFCC55, 0.55);
    fill.position.set(-8, 12, -8);
    this.scene.add(fill);
    // Warm rim light
    const rim = new THREE.DirectionalLight(0xFF9944, 0.25);
    rim.position.set(-5, 6, -15);
    this.scene.add(rim);

    // Desert sky — amber/orange Tatooine gradient
    this.scene.background = null;
    const skyGeo = new THREE.SphereGeometry(90, 48, 24);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor:    { value: new THREE.Color(0xC86428) },
        midColor:    { value: new THREE.Color(0xE8924A) },
        bottomColor: { value: new THREE.Color(0xF5C87A) },
        offset:      { value: 10 },
        exponent:    { value: 0.45 }
      },
      vertexShader: `varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `uniform vec3 topColor; uniform vec3 midColor; uniform vec3 bottomColor;
        uniform float offset; uniform float exponent; varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + vec3(0,offset,0)).y;
          float t = max(0.0, h);
          vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.35, t));
          col = mix(col, topColor, smoothstep(0.35, 1.0, t));
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Twin suns of Tatooine
    const makeTatooSun = (x, y, z, color, glowColor, size) => {
      const sg = new THREE.Group();
      sg.position.set(x, y, z);
      this.scene.add(sg);
      sg.add(new THREE.Mesh(new THREE.SphereGeometry(size, 20, 20), new THREE.MeshBasicMaterial({ color })));
      sg.add(new THREE.Mesh(new THREE.SphereGeometry(size * 1.45, 16, 16), new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.32 })));
      sg.add(new THREE.Mesh(new THREE.SphereGeometry(size * 2.1, 12, 12), new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.14 })));
      sg.add(new THREE.Mesh(new THREE.SphereGeometry(size * 3.0, 10, 10), new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.07 })));
      const rayMat2 = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
      for (let i = 0; i < 10; i++) {
        const ray = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.4, size * 6), rayMat2);
        ray.rotation.z = (i / 10) * Math.PI * 2;
        sg.add(ray);
      }
      return sg;
    };
    this._skySunGroup  = makeTatooSun(20, 10, -34, 0xFFEE77, 0xFFCC44, 3.4);
    this._skySunGroup2 = makeTatooSun(32,  7, -36, 0xFF7744, 0xFF3311, 2.2);


    // No clouds on Tatooine — instead, distant heat-haze shimmer bands
    this._clouds = []; // kept as empty array so _updateAmbientEffects doesn't crash

    // Desert sand ground with dune-like vertex displacement
    const groundGeo = new THREE.PlaneGeometry(200, 200, 80, 80);
    const gPos = groundGeo.attributes.position;
    const groundColors = new Float32Array(gPos.count * 3);
    for (let i = 0; i < gPos.count; i++) {
      const x = gPos.getX(i);
      const y = gPos.getY(i);
      // Gentle dune undulation — but flatten completely inside the tile grid zone
      // Grid spans x: -10 to +12, z: -6 to +6 (with a small margin)
      const inGridX = x > -11 && x < 13;
      const inGridZ = y > -7 && y < 7;
      const gridBlend = (inGridX && inGridZ)
        ? Math.max(0, Math.min(1,
            Math.min(
              (x - (-11)) / 2,   // fade in from left
              (13 - x)   / 2,    // fade out to right
              (y - (-7)) / 2,    // fade in from top
              (7 - y)    / 2     // fade out to bottom
            )
          ))
        : 0;
      const dune = Math.sin(x * 0.08) * Math.cos(y * 0.06) * 0.6 + Math.sin(x * 0.18 + y * 0.12) * 0.25;
      gPos.setZ(i, dune * (1 - gridBlend));
      const dist = Math.sqrt(x * x + y * y);
      const t = Math.min(dist / 90, 1);
      // Sand color varies from light tan near lawn to darker orange-brown far
      const c = new THREE.Color().lerpColors(new THREE.Color(0xD4A855), new THREE.Color(0xB8823A), t);
      const n = (Math.sin(x * 1.2) * Math.cos(y * 0.9) * 0.5 + 0.5) * 0.06;
      groundColors[i * 3]     = Math.min(1, c.r + n);
      groundColors[i * 3 + 1] = Math.min(1, c.g + n * 0.7);
      groundColors[i * 3 + 2] = c.b;
    }
    gPos.needsUpdate = true;
    groundGeo.computeVertexNormals();
    groundGeo.setAttribute('color', new THREE.BufferAttribute(groundColors, 3));
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // (courtyard slab removed — tiles show directly on the ground)


    // Low sandstone wall border (Tatooine courtyard wall)
    const wallMtl = new THREE.MeshPhongMaterial({ color: 0xC8934A, shininess: 8 });
    const wallCapMtl = new THREE.MeshPhongMaterial({ color: 0xDDAA66, shininess: 12 });
    const addSandWall = (x1, x2, z) => {
      for (let x = x1; x < x2; x += 1.6) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.65, 0.30), wallMtl);
        seg.position.set(x + 0.77, 0.32, z);
        seg.castShadow = true;
        this.scene.add(seg);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.10, 0.36), wallCapMtl);
        cap.position.set(x + 0.77, 0.68, z);
        this.scene.add(cap);
        // Random sandstone weathering notch
        if (Math.random() > 0.7) {
          const chip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.32), new THREE.MeshPhongMaterial({ color: 0xAA7733 }));
          chip.position.set(x + 0.4 + Math.random() * 0.8, 0.58, z);
          this.scene.add(chip);
        }
      }
    };
    // Walls run along the sides of the yard — start at x=-9 (lawn mower line) and end at x=10
    addSandWall(-9, 10, -5.5);
    addSandWall(-9, 10,  5.5);

    // No grass on Tatooine — scattered desert rocks and bone-dry debris
    this._grassBlades = []; // kept empty so ambient update loop doesn't crash
    this._butterflies = []; // no butterflies
    // Scattered small rocks — kept strictly outside the grid/courtyard
    const rockColors = [0xBB8844, 0xAA7733, 0xCC9955, 0x997722];
    for (let i = 0; i < 120; i++) {
      let rx, rz;
      const zone = Math.random();
      if (zone < 0.35)      { rx = -10 + Math.random() * 30; rz = -6.5 - Math.random() * 6; }
      else if (zone < 0.70) { rx = -10 + Math.random() * 30; rz =  6.5 + Math.random() * 6; }
      else                  { rx = 12 + Math.random() * 8;   rz = -8 + Math.random() * 16; }
      const rs = 0.05 + Math.random() * 0.18;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(rs, 0),
        new THREE.MeshPhongMaterial({ color: rockColors[Math.floor(Math.random() * rockColors.length)], shininess: 5 })
      );
      rock.position.set(rx, rs * 0.4, rz);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      rock.castShadow = true;
      this.scene.add(rock);
    }

    // Floating sand/dust particles
    const particleCount = 260;
    const pPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const horizonBand = i < particleCount * 0.55;
      pPositions[i * 3]     = -22 + Math.random() * 48;
      pPositions[i * 3 + 1] = horizonBand ? 1.2 + Math.random() * 5.8 : 0.25 + Math.random() * 2.6;
      pPositions[i * 3 + 2] = horizonBand ? -19 + Math.random() * 12 : -9 + Math.random() * 18;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xE8B96A, size: 0.075, transparent: true, opacity: 0.50, blending: THREE.AdditiveBlending, depthWrite: false });
    this._dustParticles = new THREE.Points(pGeo, pMat);
    this.scene.add(this._dustParticles);
    this._dustTime = 0;

    // ── TATOOINE DWELLING — flat-fronted sandstone building with dome room ──
    // Matches reference: flat stucco front wall, rounded corners, dome atop, arched doorways
    // Positioned with right (front) face at x = -13, clear of lawn mowers at x≈-9
    const houseGroup = new THREE.Group();
    this.scene.add(houseGroup);
    const sandMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.90, metalness: 0.0 });
    const stuccoMain  = sandMat(0xD4A855);
    const stuccoDark  = sandMat(0xA8803A);
    const stuccoLight = sandMat(0xE8C878);
    const shadowMat   = sandMat(0x1A100A);

    // House parameters — right face (front) at x = -13.5
    const FX  = -13.5;  // front face X (facing the grid, right side)
    const HW  = 7.0;    // total building width along X axis
    const BW  = 5.5;    // depth along Z axis
    const BWH = 2.6;    // wall height
    const CX  = FX - HW * 0.5;  // building centre X

    // ── Ground base slab ──
    const baseSlab = new THREE.Mesh(
      new THREE.BoxGeometry(HW + 0.6, 0.22, BW + 0.6),
      stuccoDark
    );
    baseSlab.position.set(CX, 0.11, 0);
    baseSlab.receiveShadow = true;
    houseGroup.add(baseSlab);

    // ── Main wall body (box) ──
    const wallBox = new THREE.Mesh(
      new THREE.BoxGeometry(HW, BWH, BW),
      stuccoMain
    );
    wallBox.position.set(CX, BWH * 0.5 + 0.22, 0);
    wallBox.castShadow = true;
    wallBox.receiveShadow = true;
    houseGroup.add(wallBox);

    // ── Rounded corner cylinders (4 vertical pillars) ──
    const cornerR = 0.55;
    for (const [cx2, cz] of [
      [FX - HW + cornerR, -BW * 0.5 + cornerR],
      [FX - HW + cornerR,  BW * 0.5 - cornerR],
      [FX - cornerR,      -BW * 0.5 + cornerR],
      [FX - cornerR,       BW * 0.5 - cornerR]
    ]) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(cornerR, cornerR, BWH + 0.35, 18),
        stuccoLight
      );
      col.position.set(cx2, BWH * 0.5 + 0.22, cz);
      col.castShadow = true;
      houseGroup.add(col);
      // Cap disc on top of each corner column
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(cornerR + 0.06, cornerR + 0.06, 0.14, 18),
        stuccoDark
      );
      cap.position.set(cx2, BWH + 0.22 + 0.175 + 0.07, cz);
      houseGroup.add(cap);
    }

    // ── Parapet / top ledge ──
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(HW + cornerR * 2, 0.25, BW + cornerR * 2),
      stuccoDark
    );
    parapet.position.set(CX, BWH + 0.22 + 0.125, 0);
    houseGroup.add(parapet);

    // ── Central dome on top ──
    const domeR = 2.2;
    const domeY = BWH + 0.22 + 0.25;
    // Drum base for dome
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(domeR * 0.88, domeR * 0.92, 0.55, 28),
      stuccoMain
    );
    drum.position.set(CX, domeY + 0.275, 0);
    drum.castShadow = true;
    houseGroup.add(drum);
    // Dome hemisphere
    const domeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(domeR, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
      stuccoLight
    );
    domeMesh.position.set(CX, domeY + 0.55, 0);
    domeMesh.castShadow = true;
    houseGroup.add(domeMesh);
    // Dome base ring
    const domeRing = new THREE.Mesh(
      new THREE.TorusGeometry(domeR, 0.14, 10, 32),
      stuccoDark
    );
    domeRing.rotation.x = Math.PI / 2;
    domeRing.position.set(CX, domeY + 0.55, 0);
    houseGroup.add(domeRing);

    // ── Small secondary dome on left wing ──
    const dome2R = 1.1;
    const dome2X = CX - HW * 0.28;
    const drum2 = new THREE.Mesh(
      new THREE.CylinderGeometry(dome2R * 0.9, dome2R * 0.95, 0.38, 22),
      stuccoMain
    );
    drum2.position.set(dome2X, domeY + 0.19, -BW * 0.18);
    houseGroup.add(drum2);
    const dome2 = new THREE.Mesh(
      new THREE.SphereGeometry(dome2R, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      sandMat(0xCDA045)
    );
    dome2.position.set(dome2X, domeY + 0.38, -BW * 0.18);
    dome2.castShadow = true;
    houseGroup.add(dome2);

    // ── Front face arched doorway ──
    // Recessed arch opening carved into the front face
    const archW = 1.2;
    const archH = 2.0;
    const archDepth = 0.55;
    // Dark recess box
    const recessBox = new THREE.Mesh(
      new THREE.BoxGeometry(archDepth + 0.1, archH, archW),
      shadowMat
    );
    recessBox.position.set(FX - archDepth * 0.5 + 0.05, archH * 0.5 + 0.22, 0);
    houseGroup.add(recessBox);
    // Arch barrel top — half-cylinder
    const archBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(archW * 0.5, archW * 0.5, archDepth + 0.2, 16, 1, false, 0, Math.PI),
      shadowMat
    );
    archBarrel.rotation.z = Math.PI / 2;
    archBarrel.rotation.y = Math.PI / 2;
    archBarrel.position.set(FX - archDepth * 0.5, archH + 0.22, 0);
    houseGroup.add(archBarrel);
    // Arch surround frame on front face
    const archFrameL = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, archH + archW * 0.5, 0.22),
      stuccoLight
    );
    archFrameL.position.set(FX - 0.02, (archH + archW * 0.5) * 0.5 + 0.22, archW * 0.5 + 0.11);
    houseGroup.add(archFrameL);
    const archFrameR = archFrameL.clone();
    archFrameR.position.z = -(archW * 0.5 + 0.11);
    houseGroup.add(archFrameR);
    // Arch top semicircle frame
    const archTorus = new THREE.Mesh(
      new THREE.TorusGeometry(archW * 0.5 + 0.11, 0.10, 8, 20, Math.PI),
      stuccoLight
    );
    archTorus.rotation.y = Math.PI / 2;
    archTorus.position.set(FX - 0.02, archH + 0.22, 0);
    houseGroup.add(archTorus);
    // Wooden door panel inside arch
    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, archH * 0.85, archW * 0.82),
      sandMat(0x7A5520)
    );
    doorPanel.position.set(FX - 0.32, archH * 0.425 + 0.22, 0);
    houseGroup.add(doorPanel);
    // Door horizontal slat lines
    for (let si = 0; si < 5; si++) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.06, archW * 0.78),
        sandMat(0x5A3A10)
      );
      slat.position.set(FX - 0.32, 0.30 + si * 0.32 + 0.22, 0);
      houseGroup.add(slat);
    }

    // ── Small recessed window openings on front face ──
    for (const wz of [-1.8, 1.8]) {
      // Window recess
      const winBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.30, 0.9, 0.75),
        shadowMat
      );
      winBox.position.set(FX - 0.15, 1.55, wz);
      houseGroup.add(winBox);
      // Window arch top
      const winArch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.375, 0.375, 0.30, 12, 1, false, 0, Math.PI),
        shadowMat
      );
      winArch.rotation.z = Math.PI / 2;
      winArch.rotation.y = Math.PI / 2;
      winArch.position.set(FX - 0.15, 1.55 + 0.45, wz);
      houseGroup.add(winArch);
      // Surround
      const winSurr = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, 1.1, 0.92),
        stuccoLight
      );
      winSurr.position.set(FX - 0.01, 1.5, wz);
      houseGroup.add(winSurr);
    }

    // ── Moisture vaporator tower (right side, near front) ──
    const vapGroup = new THREE.Group();
    vapGroup.position.set(FX + 2.2, 0, -BW * 0.5 - 1.6);
    houseGroup.add(vapGroup);
    const vapBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.55), sandMat(0x7A6030));
    vapBase.position.y = 0.19;
    vapGroup.add(vapBase);
    const vapPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.0, 8), sandMat(0x3A3020));
    vapPole.position.y = 2.38;
    vapGroup.add(vapPole);
    for (let i = 0; i < 5; i++) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9 - i * 0.1, 6), sandMat(0x4A4030));
      arm.rotation.z = Math.PI / 2;
      arm.position.y = 0.7 + i * 0.68;
      vapGroup.add(arm);
      for (const side of [-1, 1]) {
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), sandMat(0x6A5830));
        tip.position.set(side * (0.43 - i * 0.045), 0.7 + i * 0.68, 0);
        vapGroup.add(tip);
      }
    }
    const vapDish = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      sandMat(0x5A5030)
    );
    vapDish.rotation.x = Math.PI;
    vapDish.position.y = 4.5;
    vapGroup.add(vapDish);



    // Extra Tatooine details
    this._createTrees();
    this._buildFlankingHouse(CX, -5.8);
    this._buildFlankingHouse(CX,  5.8);
    this._buildSpectatorDroids();
    this._buildGridVaporators();
    this._droidTime = 0;

    // Create tiles (5 rows x 9 cols)
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 9; c++) {
        const tile = new Tile(this.scene, r, c);
        this.tiles.push(tile);
        this.entities.push(tile);
      }
    }

    // Lawn mowers
    for (let r = 0; r < 5; r++) {
      const lm = new LawnMower(this.scene, r);
      this.lawnMowers.push(lm);
      this.entities.push(lm);
    }

    // Raycaster for clicking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Camera orbit controls
    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.cameraSpherical = new THREE.Spherical();
    this.cameraSpherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));

    this._sandboxPainting = false;
    this._lastPaintedTile = null;
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.lastMouse.x = e.clientX;
      this.lastMouse.y = e.clientY;
      // Start sandbox painting if plant selected
      if (this.sandboxMode && this.isRunning && !this.isPaused && this.selectedPlant && !this.shovelMode) {
        this._sandboxPainting = true;
        this._lastPaintedTile = null;
      }
    });
    this.renderer.domElement.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      if (this._sandboxPainting) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.lastMouse.x = e.clientX;
      this.lastMouse.y = e.clientY;
      this.cameraSpherical.theta -= dx * 0.005;
      this.cameraSpherical.phi -= dy * 0.005;
      this.cameraSpherical.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.05, this.cameraSpherical.phi));
      const pos = new THREE.Vector3().setFromSpherical(this.cameraSpherical).add(this.cameraTarget);
      this.camera.position.copy(pos);
      this.camera.lookAt(this.cameraTarget);
    });
    window.addEventListener('pointerup', () => { this.isDragging = false; this._sandboxPainting = false; this._lastPaintedTile = null; });

    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Get mouse position in NDC
      const mouseNDC = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      // Raycast to find world point under mouse
      const rc = new THREE.Raycaster();
      rc.setFromCamera(mouseNDC, this.camera);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const worldPoint = new THREE.Vector3();
      rc.ray.intersectPlane(groundPlane, worldPoint);

      const zoomFactor = 1 + e.deltaY * 0.001;
      const newRadius = Math.max(5, Math.min(40, this.cameraSpherical.radius * zoomFactor));
      const actualFactor = newRadius / this.cameraSpherical.radius;

      if (worldPoint && actualFactor !== 1) {
        // Move target towards the world point under mouse when zooming in
        const t = 1 - actualFactor; // positive when zooming in
        const shift = new THREE.Vector3().subVectors(worldPoint, this.cameraTarget).multiplyScalar(t * 1.0);
        this.cameraTarget.add(shift);
      }

      this.cameraSpherical.radius = newRadius;
      const pos = new THREE.Vector3().setFromSpherical(this.cameraSpherical).add(this.cameraTarget);
      this.camera.position.copy(pos);
      this.camera.lookAt(this.cameraTarget);
    }, { passive: false });

    // Hover preview
    this.hoverPreview = null;
    this.hoverTile = null;
    this.renderer.domElement.addEventListener('pointermove', (e) => { this._onHover(e); this._onSunHover(e); this._onSandboxPaint(e); });
    this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
    this._syncAudioSettingsUI();
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        this.togglePause();
      }
    });
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
    this._generatePlantIcons();
    this._generateSunIcon();
    this._drawShovelIcon();
    this._generateZombieHeadIcon();
    this._generateStartScreenCharacters();
    this.levelConfigs = [
      { waves: 2, baseZombies: 3, spawnInterval: [22, 14], coneChance: 0, bucketChance: 0, burstNormal: 2, burstFinal: 5 },
      { waves: 3, baseZombies: 3, spawnInterval: [20, 14, 11], coneChance: 0.1, bucketChance: 0, burstNormal: 2, burstFinal: 6 },
      { waves: 3, baseZombies: 4, spawnInterval: [18, 13, 10], coneChance: 0.15, bucketChance: 0.03, burstNormal: 3, burstFinal: 7 },
      { waves: 4, baseZombies: 4, spawnInterval: [17, 13, 10, 8], coneChance: 0.2, bucketChance: 0.06, burstNormal: 3, burstFinal: 8 },
      { waves: 4, baseZombies: 5, spawnInterval: [16, 12, 9, 7], coneChance: 0.22, bucketChance: 0.1, burstNormal: 4, burstFinal: 10 },
      { waves: 5, baseZombies: 5, spawnInterval: [15, 11, 9, 7, 6], coneChance: 0.25, bucketChance: 0.12, burstNormal: 5, burstFinal: 11 },
      { waves: 5, baseZombies: 6, spawnInterval: [14, 10, 8, 6, 5], coneChance: 0.28, bucketChance: 0.15, burstNormal: 5, burstFinal: 13 },
      { waves: 5, baseZombies: 7, spawnInterval: [13, 10, 8, 6, 5], coneChance: 0.3, bucketChance: 0.18, burstNormal: 6, burstFinal: 15 },
      { waves: 6, baseZombies: 8, spawnInterval: [12, 9, 7, 6, 5, 4], coneChance: 0.32, bucketChance: 0.2, burstNormal: 7, burstFinal: 17 },
      { waves: 6, baseZombies: 9, spawnInterval: [11, 8, 7, 5, 4, 4], coneChance: 0.35, bucketChance: 0.25, burstNormal: 8, burstFinal: 19 },
    ];
    this.zombiesKilledInWave = 0;
    this.waveBarProgress = 0;
    this.flagPositions = [50, 90];
    this.flagsTriggered = [false, false];
    this._applyLevelConfig();
    this._setupWaveBar();
  }

  _onSandboxPaint(e) {
    if (!this._sandboxPainting || !this.sandboxMode || !this.isRunning || this.isPaused || !this.selectedPlant) return;
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, this.camera);
    const tileMeshes = this.tiles.map(t => t.mesh).filter(m => m);
    const hits = this.raycaster.intersectObjects(tileMeshes);
    if (hits.length > 0) {
      const tile = this.tiles.find(t => t.mesh === hits[0].object);
      if (tile && !tile.plant && tile !== this._lastPaintedTile) {
        this._lastPaintedTile = tile;
        const plantType = this.selectedPlant;
        const plant = new Plant(this.scene, plantType, tile.row, tile.col);
        tile.plant = plant;
        this.plants.push(plant);
        this.entities.push(plant);
      }
    }
  }

  _onHover(e) {
    if (!this.isRunning || this.isPaused || !this.selectedPlant) {
      this._clearHoverPreview();
      return;
    }
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, this.camera);
    const tileMeshes = this.tiles.map(t => t.mesh).filter(m => m);
    const hits = this.raycaster.intersectObjects(tileMeshes);
    if (hits.length > 0) {
      const tile = this.tiles.find(t => t.mesh === hits[0].object);
      if (tile && !tile.plant) {
        if (this.hoverTile === tile && this.hoverPreview) return;
        this._clearHoverPreview();
        this.hoverTile = tile;
        // Create ghost plant
        const ghost = new Plant(this.scene, this.selectedPlant, tile.row, tile.col);
        ghost.mesh.rotation.y = Math.PI / 2;
        // Make semi-transparent
        ghost.mesh.traverse(child => {
          if (child.isMesh && child.material) {
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.opacity = 0.45;
          }
        });
        // Remove from entities so it doesn't update/shoot
        this.entities = this.entities.filter(en => en !== ghost);
        this.plants = this.plants.filter(p => p !== ghost);
        this.hoverPreview = ghost;
        return;
      }
    }
    this._clearHoverPreview();
  }

  _onSunHover(e) {
    if (!this.isRunning || this.isPaused) return;
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, this.camera);
    const sunMeshes = this.suns.filter(s => s.alive && !s.collected).map(s => s.mesh).filter(m => m);
    const sunHits = this.raycaster.intersectObjects(sunMeshes, true);
    if (sunHits.length > 0) {
      const sunObj = this.suns.find(s => s.mesh && (s.mesh === sunHits[0].object || s.mesh === sunHits[0].object.parent));
      if (sunObj) sunObj.collect();
    }
  }

  _clearHoverPreview() {
    if (this.hoverPreview) {
      this.scene.remove(this.hoverPreview.mesh);
      this.hoverPreview.alive = false;
      this.hoverPreview = null;
      this.hoverTile = null;
    }
  }

  toggleShovel() {
    if (this.isPaused) return;
    this._playSfx('ui');
    this._clearHoverPreview();
    this._deselectPlant();
    this.shovelMode = !this.shovelMode;
    const btn = document.getElementById('shovel-btn');
    if (this.shovelMode) {
      btn.style.borderColor = '#ffdd00';
      btn.style.boxShadow = '0 0 16px rgba(255,221,0,0.5), 0 4px 12px rgba(0,0,0,0.4)';
    } else {
      btn.style.borderColor = 'rgba(255,255,255,0.15)';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
    }
  }

  _deselectShovel() {
    this.shovelMode = false;
    const btn = document.getElementById('shovel-btn');
    if (btn) {
      btn.style.borderColor = 'rgba(255,255,255,0.15)';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
    }
  }

  selectPlant(type) {
    if (this.isPaused) return;
    this._clearHoverPreview();
    this._deselectShovel();
    if (this.selectedPlant === type) {
      this._playSfx('ui');
      this._deselectPlant();
      return;
    }
    if (!this.sandboxMode && this.plantCooldownTimers[type] > 0) { this._playSfx('deny'); return; }
    if (!this.sandboxMode && this.sun < this.plantCosts[type]) { this._playSfx('deny'); return; }
    this._playSfx('select');
    this.selectedPlant = type;
    document.querySelectorAll('.plant-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector(`[data-plant="${type}"]`).classList.add('selected');
  }

  togglePause() {
    if (!this.isRunning) return;
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  pauseGame() {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this._sandboxPainting = false;
    this.isDragging = false;
    this._clearHoverPreview();
    this._setMusicDucked(true);
    this._setPauseUI(true);
    this._setPauseButtonVisible(false);
  }

  resumeGame() {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.clock.getDelta();
    this._setMusicDucked(false);
    this._setPauseUI(false);
    this._setPauseButtonVisible(true);
  }

  _setPauseUI(paused) {
    const overlay = document.getElementById('pause-overlay');
    const btn = document.getElementById('pause-btn');
    if (overlay) overlay.style.display = paused ? 'flex' : 'none';
    if (btn) {
      btn.textContent = paused ? '▶' : 'II';
      btn.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
      btn.dataset.tooltip = paused ? 'Play' : 'Pause';
    }
  }

  _setPauseButtonVisible(visible) {
    const pauseBtn = document.getElementById('pause-btn');
    const audioBtn = document.getElementById('audio-btn');
    const resetBtn = document.getElementById('reset-view-btn');
    const quitBtn = document.getElementById('quit-btn');
    const audioPanel = document.getElementById('audio-panel');
    if (pauseBtn) pauseBtn.style.display = visible ? 'flex' : 'none';
    if (audioBtn) audioBtn.style.display = visible ? 'flex' : 'none';
    if (resetBtn) resetBtn.style.display = visible ? 'flex' : 'none';
    if (quitBtn) quitBtn.style.display = visible ? 'flex' : 'none';
    if (!visible && audioPanel) audioPanel.style.display = 'none';
  }

  quitGame() {
    if (!this.isRunning) return;
    this._playSfx('ui');
    this.returnToMenu();
  }

  _readStoredVolume(key, fallback) {
    const value = Number(localStorage.getItem(key) ?? fallback);
    if (!Number.isFinite(value)) return fallback / 100;
    return Math.max(0, Math.min(100, value)) / 100;
  }

  toggleAudioPanel() {
    this._playSfx('ui');
    const panel = document.getElementById('audio-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }

  _musicTargetVolume() {
    return (this.musicDucked ? 0.10 : 0.46) * this.musicVolume;
  }

  _syncAudioSettingsUI() {
    const music = Math.round(this.musicVolume * 100);
    const sfx = Math.round(this.sfxVolume * 100);
    const musicSlider = document.getElementById('music-volume');
    const sfxSlider = document.getElementById('sfx-volume');
    const musicValue = document.getElementById('music-volume-value');
    const sfxValue = document.getElementById('sfx-volume-value');
    if (musicSlider) musicSlider.value = String(music);
    if (sfxSlider) sfxSlider.value = String(sfx);
    if (musicValue) musicValue.textContent = music === 0 ? 'OFF' : `${music}%`;
    if (sfxValue) sfxValue.textContent = sfx === 0 ? 'OFF' : `${sfx}%`;
  }

  setMusicVolume(value) {
    const raw = Number(value);
    const next = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0)) / 100;
    this.musicVolume = next;
    localStorage.setItem('musicVolume', String(Math.round(next * 100)));
    this._syncAudioSettingsUI();
    if (this.audioCtx && this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.musicGain.gain.setTargetAtTime(this.musicTimer ? this._musicTargetVolume() : 0, this.audioCtx.currentTime, 0.12);
    }
  }

  setSfxVolume(value) {
    const raw = Number(value);
    const next = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0)) / 100;
    this.sfxVolume = next;
    localStorage.setItem('sfxVolume', String(Math.round(next * 100)));
    this._syncAudioSettingsUI();
    if (this.audioCtx && this.sfxGain) {
      this.sfxGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.audioCtx.currentTime, 0.04);
    }
  }

  _clearPauseState() {
    this.isPaused = false;
    this._setPauseUI(false);
  }

  _runWhenActive(callback) {
    if (!this.isRunning) return;
    if (this.isPaused) {
      setTimeout(() => this._runWhenActive(callback), 100);
      return;
    }
    callback();
  }

  _initAudio() {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.audioCtx = new AudioCtor();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 0.48;
    this.masterGain.connect(this.audioCtx.destination);
    this.sfxGain = this.audioCtx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.masterGain);
    this.musicGain = this.audioCtx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.masterGain);
  }

  _tone(freq, duration, opts = {}) {
    if (!this.audioCtx || !this.sfxGain) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime + (opts.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = opts.type || 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), now + duration);
    filter.type = opts.filterType || 'lowpass';
    filter.frequency.setValueAtTime(opts.filter || 1800, now);
    filter.Q.value = opts.q || 1.2;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(opts.gain || 0.18, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  _noise(duration, opts = {}) {
    if (!this.audioCtx || !this.sfxGain) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime + (opts.delay || 0);
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, opts.decay || 1.2);
    }
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    src.buffer = buffer;
    filter.type = opts.filterType || 'bandpass';
    filter.frequency.value = opts.filter || 1400;
    filter.Q.value = opts.q || 1.4;
    gain.gain.setValueAtTime(opts.gain || 0.10, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(opts.bus === 'music' && this.musicGain ? this.musicGain : this.sfxGain);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  _playSfx(name) {
    this._initAudio();
    if (!this.audioCtx) return;
    const nowMs = performance.now();
    const minGap = name === 'plasma' || name === 'ion' || name === 'hit' ? 45 : 90;
    if (this._lastSfx[name] && nowMs - this._lastSfx[name] < minGap) return;
    this._lastSfx[name] = nowMs;

    switch (name) {
      case 'ui':
        this._tone(620, 0.055, { to: 940, type: 'triangle', gain: 0.07, filter: 2400 });
        break;
      case 'select':
        this._tone(520, 0.060, { to: 880, type: 'triangle', gain: 0.08, filter: 2600 });
        this._tone(880, 0.070, { to: 1320, type: 'sine', gain: 0.05, delay: 0.045, filter: 3200 });
        break;
      case 'deny':
        this._tone(170, 0.120, { to: 120, type: 'square', gain: 0.07, filter: 700 });
        break;
      case 'place':
        this._tone(210, 0.080, { to: 95, type: 'sawtooth', gain: 0.09, filter: 900 });
        this._tone(760, 0.110, { to: 420, type: 'triangle', gain: 0.06, delay: 0.025, filter: 2200 });
        this._noise(0.090, { gain: 0.035, filter: 900, q: 0.8 });
        break;
      case 'recall':
        this._tone(430, 0.100, { to: 220, type: 'triangle', gain: 0.08, filter: 1800 });
        break;
      case 'collect':
        this._tone(880, 0.060, { to: 1320, type: 'sine', gain: 0.08, filter: 3600 });
        this._tone(1320, 0.100, { to: 1760, type: 'triangle', gain: 0.06, delay: 0.045, filter: 4200 });
        break;
      case 'plasma':
        this._tone(760, 0.075, { to: 180, type: 'sawtooth', gain: 0.075, filter: 2400 });
        this._noise(0.045, { gain: 0.020, filter: 2100, q: 2.2 });
        break;
      case 'ion':
        this._tone(1150, 0.110, { to: 360, type: 'triangle', gain: 0.085, filter: 3600 });
        this._tone(1720, 0.070, { to: 820, type: 'sine', gain: 0.045, delay: 0.025, filter: 4800 });
        break;
      case 'hit':
        this._noise(0.065, { gain: 0.035, filter: 650, q: 1.0 });
        this._tone(120, 0.055, { to: 90, type: 'square', gain: 0.035, filter: 600 });
        break;
      case 'explosion':
        this._noise(0.45, { gain: 0.16, filter: 180, q: 0.7, decay: 2.3 });
        this._tone(90, 0.42, { to: 32, type: 'sawtooth', gain: 0.11, filter: 420 });
        break;
      case 'wave':
        this._tone(330, 0.18, { to: 330, type: 'sawtooth', gain: 0.08, filter: 1300 });
        this._tone(392, 0.18, { to: 392, type: 'sawtooth', gain: 0.08, delay: 0.22, filter: 1300 });
        this._tone(294, 0.24, { to: 220, type: 'square', gain: 0.065, delay: 0.44, filter: 900 });
        break;
      case 'finalWave':
        this._tone(220, 0.20, { to: 180, type: 'square', gain: 0.09, filter: 900 });
        this._tone(220, 0.20, { to: 180, type: 'square', gain: 0.09, delay: 0.26, filter: 900 });
        this._tone(330, 0.32, { to: 110, type: 'sawtooth', gain: 0.10, delay: 0.52, filter: 900 });
        break;
      case 'start':
        this._tone(220, 0.12, { to: 440, type: 'triangle', gain: 0.07, filter: 1800 });
        this._tone(330, 0.14, { to: 660, type: 'triangle', gain: 0.06, delay: 0.12, filter: 2200 });
        this._tone(550, 0.18, { to: 990, type: 'sine', gain: 0.055, delay: 0.26, filter: 3000 });
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.18, { type: 'triangle', gain: 0.065, delay: i * 0.12, filter: 3600 }));
        break;
      case 'gameover':
        this._tone(260, 0.24, { to: 190, type: 'sawtooth', gain: 0.08, filter: 900 });
        this._tone(190, 0.36, { to: 82, type: 'square', gain: 0.07, delay: 0.20, filter: 650 });
        break;
    }
  }

  _musicTone(freq, duration, opts = {}) {
    if (!this.audioCtx || !this.musicGain) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime + (opts.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = opts.type || 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    if (opts.bend) osc.frequency.linearRampToValueAtTime(freq + opts.bend, now + duration * 0.5);
    filter.type = opts.filterType || 'bandpass';
    filter.frequency.setValueAtTime(opts.filter || 1100, now);
    filter.Q.value = opts.q || 1.8;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(opts.gain || 0.035, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(now);
    osc.stop(now + duration + 0.04);
  }

  _scheduleCantinaLoopStep() {
    if (!this.audioCtx || !this.musicGain || !this.isRunning || this.isPaused) return;
    const step = this.musicStep % 32;
    const beatDur = 0.18;
    const bass = [146.83, 174.61, 196.00, 220.00, 196.00, 174.61, 164.81, 174.61];
    const lead = [
      440.00, null, 523.25, 493.88, null, 392.00, 440.00, null,
      587.33, null, 523.25, 440.00, null, 349.23, 392.00, null,
      466.16, 523.25, null, 587.33, 523.25, null, 440.00, 392.00,
      null, 440.00, 493.88, null, 392.00, 349.23, null, 329.63
    ];
    const chordRoots = [293.66, 349.23, 329.63, 392.00];
    const swingDelay = step % 2 ? 0.035 : 0;

    this._musicTone(bass[step % bass.length], 0.16, { type: 'sawtooth', gain: 0.050, filter: 360, q: 0.9 });
    if (step % 4 === 1) {
      const root = chordRoots[Math.floor(step / 8) % chordRoots.length];
      this._musicTone(root, 0.12, { type: 'triangle', gain: 0.028, filter: 900, delay: 0.02 });
      this._musicTone(root * 1.25, 0.12, { type: 'triangle', gain: 0.022, filter: 1050, delay: 0.025 });
      this._musicTone(root * 1.5, 0.12, { type: 'triangle', gain: 0.018, filter: 1200, delay: 0.030 });
    }
    if (lead[step]) {
      this._musicTone(lead[step], beatDur, { type: 'square', gain: 0.052, filter: 1650, q: 2.6, delay: swingDelay, bend: step % 5 === 0 ? 8 : 0 });
      this._musicTone(lead[step] * 2.01, 0.085, { type: 'sine', gain: 0.014, filter: 3000, delay: swingDelay + 0.006 });
    }
    if (step % 2 === 0) {
      this._noise(0.050, { gain: 0.018, filter: 3100, q: 4.0, bus: 'music' });
    }
    this.musicStep++;
  }

  _startMusic() {
    this._initAudio();
    if (!this.audioCtx || !this.musicGain || this.musicTimer) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    this.musicStep = 0;
    this.musicDucked = false;
    this.musicGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
    this.musicGain.gain.setTargetAtTime(this._musicTargetVolume(), this.audioCtx.currentTime, 0.8);
    this._scheduleCantinaLoopStep();
    this.musicTimer = setInterval(() => this._scheduleCantinaLoopStep(), 180);
  }

  _stopMusic(fade = 0.4) {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.audioCtx && this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.musicGain.gain.setTargetAtTime(0.0, this.audioCtx.currentTime, fade);
    }
  }

  _setMusicDucked(ducked) {
    if (!this.audioCtx || !this.musicGain || !this.musicTimer) return;
    this.musicGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
    this.musicDucked = ducked;
    this.musicGain.gain.setTargetAtTime(this._musicTargetVolume(), this.audioCtx.currentTime, 0.35);
  }

  startLevel(lvl) {
    this._playSfx('start');
    this._startMusic();
    this._resetUpgrades();
    this.level = Math.max(1, Math.min(10, lvl));
    this.sandboxMode = false;
    this._clearPauseState();
    this._setPauseButtonVisible(true);
    this._applyLevelConfig();
    this._setupWaveBar();
    const levelLabel = document.getElementById('wave-level-label');
    if (levelLabel) levelLabel.textContent = 'Sector ' + this.level;
    const fillEl = document.getElementById('wave-bar-fill');
    if (fillEl) fillEl.style.width = '0%';
    const headEl = document.getElementById('wave-head');
    if (headEl) headEl.style.left = '100%';
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('start-wave-btn').style.display = 'none';
    document.getElementById('wave-bar-container').style.display = 'flex';
    this._applyInitialCooldowns();
    this._playReadySetPlant();
  }

  startGame() {
    this._playSfx('start');
    this._startMusic();
    this._resetUpgrades();
    this.sandboxMode = false;
    this.level = 1;
    this._applyLevelConfig();
    this._setupWaveBar();
    this._clearPauseState();
    this._setPauseButtonVisible(true);
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('start-wave-btn').style.display = 'none';
    document.getElementById('wave-bar-container').style.display = 'flex';
    this._applyInitialCooldowns();
    this._playReadySetPlant();
  }

  startSandbox() {
    this._playSfx('start');
    this._startMusic();
    this.sandboxMode = true;
    this._clearPauseState();
    this._setPauseButtonVisible(true);
    this.sun = 99999;
    document.getElementById('sun-amount').textContent = '∞';
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('wave-bar-container').style.display = 'none';
    document.getElementById('start-wave-btn').style.display = 'block';
    // No cooldowns in sandbox
    for (const type in this.plantCooldownTimers) this.plantCooldownTimers[type] = 0;
    this.isRunning = true;
  }

  startSandboxWave() {
    if (!this.sandboxMode || !this.isRunning || this.isPaused) return;
    this._showWaveAnnouncement(`${this.waveNames[Math.floor(Math.random() * this.waveNames.length)]}\nImperial Squad incoming`);
    const count = 10 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this._runWhenActive(() => {
          const row = Math.floor(Math.random() * 5);
          const x = 10 + Math.random() * 3;
          const type = this._pickZombieType(true);
          const z = new Zombie(this.scene, row, x, type);
          const baseByType = type === 'scout' ? 0.58 : type === 'droid' ? 0.32 : 0.35;
          z.baseSpeed = baseByType + Math.random() * 0.12;
          z.speed = z.baseSpeed;
          this.zombies.push(z);
          this.entities.push(z);
        });
      }, i * (400 + Math.random() * 400));
    }
  }

  _playReadySetPlant() {
    const overlay = document.createElement('div');
    overlay.id = 'rsp-overlay';
    overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:100;';
    const text = document.createElement('div');
    text.style.cssText = 'font-family:Orbitron,Rajdhani,Arial,sans-serif;font-weight:500;font-size:80px;color:#ff2222;text-shadow:4px 4px 8px rgba(0,0,0,0.8),-2px -2px 4px rgba(100,0,0,0.5);transform:scale(0);transition:transform 0.4s cubic-bezier(0.17,0.67,0.3,1.3),opacity 0.3s;opacity:1;';
    overlay.appendChild(text);
    document.getElementById('ui-layer').appendChild(overlay);

    const words = ['Systems...', 'Set...', 'DEFEND!'];
    let i = 0;
    const showNext = () => {
      if (i >= words.length) {
        text.style.opacity = '0';
        setTimeout(() => { overlay.remove(); this.isRunning = true; }, 300);
        return;
      }
      text.textContent = words[i];
      text.style.transform = 'scale(0)';
      requestAnimationFrame(() => { text.style.transform = 'scale(1)'; });
      i++;
      setTimeout(() => {
        text.style.transform = 'scale(1.3)';
        text.style.opacity = '0.5';
        setTimeout(() => { text.style.opacity = '1'; showNext(); }, 200);
      }, 600);
    };
    showNext();
  }

  getTile(row, col) {
    return this.tiles.find(t => t.row === row && t.col === col);
  }

  onClick(e) {
    if (!this.isRunning || this.isPaused) return;
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check sun clicks first
    const sunMeshes = this.suns.filter(s => s.alive && !s.collected).map(s => s.mesh).filter(m => m);
    const sunHits = this.raycaster.intersectObjects(sunMeshes, true);
    if (sunHits.length > 0) {
      const sunObj = this.suns.find(s => s.mesh && (s.mesh === sunHits[0].object || s.mesh === sunHits[0].object.parent));
      if (sunObj) { sunObj.collect(); return; }
    }

    // Shovel mode: remove plant from clicked tile
    if (this.shovelMode) {
      const tileMeshes = this.tiles.map(t => t.mesh).filter(m => m);
      const hits = this.raycaster.intersectObjects(tileMeshes);
      if (hits.length > 0) {
        const tile = this.tiles.find(t => t.mesh === hits[0].object);
        if (tile && tile.plant && tile.plant.alive) {
          tile.plant.destroy();
          tile.plant = null;
          this._playSfx('recall');
          this._deselectShovel();
        }
      }
      return;
    }

    // Check tile clicks
    if (!this.selectedPlant) return;
    if (this.plantCooldownTimers[this.selectedPlant] > 0) return;
    const tileMeshes = this.tiles.map(t => t.mesh).filter(m => m);
    const hits = this.raycaster.intersectObjects(tileMeshes);
    if (hits.length > 0) {
      const tile = this.tiles.find(t => t.mesh === hits[0].object);
      if (tile && !tile.plant) {
        const cost = this.plantCosts[this.selectedPlant];
        if (this.sun >= cost && this.plantCooldownTimers[this.selectedPlant] <= 0) {
          if (!this.sandboxMode) this.sun -= cost;
          document.getElementById('sun-amount').textContent = this.sandboxMode ? '∞' : this.sun;
          const plantType = this.selectedPlant;
          const plant = new Plant(this.scene, plantType, tile.row, tile.col);
          tile.plant = plant;
          this.plants.push(plant);
          this.entities.push(plant);
          this._playSfx('place');
          this.plantCooldownTimers[plantType] = this.sandboxMode ? 0 : this.plantCooldowns[plantType];
          this._updateCooldownUI(plantType);
          this._clearHoverPreview();
          if (!this.sandboxMode) this._deselectPlant();
        }
      }
      return;
    }
    // Clicked somewhere else with plant selected — deselect
    if (this.selectedPlant) {
      this._deselectPlant();
    }
  }

  _updateCooldownUI(type) {
    const btn = document.querySelector(`[data-plant="${type}"]`);
    if (!btn) return;
    let overlay = btn.querySelector('.cooldown-overlay');
    const remaining = this.plantCooldownTimers[type];
    const total = this.plantCooldowns[type];
    if (remaining <= 0) {
      if (overlay) overlay.remove();
      btn.style.pointerEvents = '';
      return;
    }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'cooldown-overlay';
      overlay.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);pointer-events:none;border-radius:0 0 7px 7px;transition:height 0.2s;';
      btn.style.position = 'relative';
      btn.appendChild(overlay);
    }
    const pct = (remaining / total) * 100;
    overlay.style.height = pct + '%';
  }

  _deselectPlant() {
    this._clearHoverPreview();
    this.selectedPlant = null;
    document.querySelectorAll('.plant-btn').forEach(b => b.classList.remove('selected'));
  }

  spawnZombie() {
    const row = Math.floor(Math.random() * 5);
    const x = 10 + Math.random() * 1;
    let type = 'normal';
    const spawnIndex = this.zombiesSpawned; // 0-based index of this spawn in current wave
    if (spawnIndex < 2) {
      // First 2 spawns are easy
      if (this.level >= 5 && spawnIndex === 1) {
        // Level 5+: second spawn is conehead or stronger
        if (this.level >= 8) type = 'buckethead';
        else type = 'conehead';
      } else {
        type = 'normal';
      }
    } else if (spawnIndex === 2) {
      // Third spawn still easy (normal)
      type = 'normal';
    } else {
      type = this._pickZombieType(false);
    }
    const z = new Zombie(this.scene, row, x, type);
    // Scale speed slightly with level
    const speedBonus = (this.level - 1) * 0.03 + Math.max(0, this.wave - 2) * 0.02;
    const baseByType = type === 'scout' ? 0.58 : type === 'droid' ? 0.32 : 0.4;
    z.baseSpeed = baseByType + speedBonus;
    z.speed = z.baseSpeed;
    this.zombies.push(z);
    this.entities.push(z);
    this.zombiesSpawned++;
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.isRunning || this.isPaused) return;

    if (!this.sandboxMode) {
    // Spawn zombies
    this.spawnTimer += dt;
    const cfg = this.levelConfigs[Math.min(this.level - 1, 9)];
    const waveIdx = Math.min(this.wave - 1, cfg.spawnInterval.length - 1);
    const spawnInterval = this.flagsTriggered[0] ? Math.max(cfg.spawnInterval[waveIdx] * 0.7, 2) : cfg.spawnInterval[waveIdx];
    if (this.spawnTimer >= spawnInterval && this.zombiesSpawned < this.zombiesPerWave) {
      this.spawnTimer = 0;
      this.spawnZombie();
    }

    // Wave complete
    if (this.zombiesSpawned >= this.zombiesPerWave && this.zombies.every(z => !z.alive)) {
      if (this.wave >= this.wavesInLevel) {
        // Level complete!
        this.isRunning = false;
        this._showLevelComplete();
      } else {
        this.wave++;
        this.zombiesSpawned = 0;
        this.zombiesKilledInWave = 0;
        this.zombiesPerWave = cfg.baseZombies + this.wave + Math.floor((this.level - 1) * 1.2);
        this.spawnTimer = -3;
      }
    }

    // Smooth wave bar update
    this._updateWaveBarSmooth(dt);

    // Check flag triggers
    this._checkFlagTriggers();
    }

    // Drop sun from sky
    this.sunDropTimer -= dt;
    if (this.sunDropTimer <= 0) {
      this.sunDropTimer = 7 + Math.random() * 5;
      const x = -8 + Math.random() * 16;
      const z = -4 + Math.random() * 8;
      const sun = new Sun(this.scene, x, 10, z, false);
      this.suns.push(sun);
      this.entities.push(sun);
    }

    // Update plant button brightness based on affordability
    document.querySelectorAll('.plant-btn').forEach(btn => {
      const type = btn.dataset.plant;
      const canAfford = this.sandboxMode || (this.sun >= this.plantCosts[type] && this.plantCooldownTimers[type] <= 0);
      btn.style.filter = canAfford ? 'brightness(1.3)' : 'brightness(0.7)';
    });

    // Update plant cooldowns
    for (const type in this.plantCooldownTimers) {
      if (this.plantCooldownTimers[type] > 0) {
        this.plantCooldownTimers[type] -= dt;
        if (this.plantCooldownTimers[type] <= 0) {
          this.plantCooldownTimers[type] = 0;
        }
        this._updateCooldownUI(type);
      }
    }

    // Update ambient effects
    this._updateAmbientEffects(dt);
    this._updateEnvironmentEvents(dt);
    this._updateEffects(dt);

    // Update all entities
    for (const e of this.entities) {
      if (e.alive) e.update(dt);
    }

    // Check if zombies reached the house
    for (const z of this.zombies) {
      if (!z.alive) continue;
      if (z.position.x <= -8.9) {
        // Trigger lawn mower
        const lm = this.lawnMowers.find(l => l.alive && !l.triggered && l.row === z.row);
        if (lm) {
          lm.trigger();
        } else if (z.position.x <= -10.2) {
          this.gameOver();
          return;
        }
      }
    }

    // Cleanup dead
    this.entities = this.entities.filter(e => e.alive);
    this.zombies = this.zombies.filter(z => z.alive);
    this.projectiles = this.projectiles.filter(p => p.alive);
    this.suns = this.suns.filter(s => s.alive);
    this.plants = this.plants.filter(p => p.alive);
    this.lawnMowers = this.lawnMowers.filter(l => l.alive);
  }

  gameOver() {
    this.isRunning = false;
    this._clearPauseState();
    this._setPauseButtonVisible(false);
    this._stopMusic(0.18);
    this._playSfx('gameover');
    // Render zombie image for game over screen
    const zombieImg = document.getElementById('gameover-zombie-img');
    if (this._gameoverZombieURL) {
      zombieImg.innerHTML = `<img src="${this._gameoverZombieURL}">`;
    } else {
      const size = 256;
      const iconRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      iconRenderer.setSize(size, size);
      const iconScene = new THREE.Scene();
      const iconCam = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
      iconCam.position.set(0.6, 0.8, 3.2);
      iconCam.lookAt(0, 0.3, 0);
      iconScene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dl = new THREE.DirectionalLight(0xffffff, 1);
      dl.position.set(2, 4, 3);
      iconScene.add(dl);
      const tempZ = new Zombie(iconScene, 0, 0);
      tempZ.mesh.position.set(0, -0.25, 0);
      tempZ.mesh.rotation.set(0, -0.2, 0);
      tempZ._setOpacity(tempZ.mesh, 1);
      iconRenderer.render(iconScene, iconCam);
      this._gameoverZombieURL = iconRenderer.domElement.toDataURL();
      iconScene.remove(tempZ.mesh);
      iconRenderer.dispose();
      zombieImg.innerHTML = `<img src="${this._gameoverZombieURL}">`;
    }
    // Show stats
    const statsEl = document.getElementById('gameover-stats');
    const plantsAlive = this.plants.filter(p => p.alive).length;
    statsEl.innerHTML = `Sector ${this.level}`;
    // Show with fresh animation
    const goEl = document.getElementById('game-over');
    goEl.style.display = 'none';
    void goEl.offsetWidth;
    goEl.style.display = 'flex';
  }

  restartLevel() {
    // Hide game over screen
    document.getElementById('game-over').style.display = 'none';
    this._clearPauseState();
    this._setPauseButtonVisible(true);
    this._clearVisualEffects();
    // Remove all dynamic entities from scene
    for (const e of this.entities) {
      if (e.mesh) this.scene.remove(e.mesh);
      if (e.detailGroup) this.scene.remove(e.detailGroup);
    }
    // Also clean up zombies/plants/projectiles/suns that may have been removed from entities
    for (const z of this.zombies) { if (z.mesh) this.scene.remove(z.mesh); }
    for (const p of this.plants) { if (p.mesh) this.scene.remove(p.mesh); }
    for (const pr of this.projectiles) { if (pr.mesh) this.scene.remove(pr.mesh); }
    for (const s of this.suns) { if (s.mesh) this.scene.remove(s.mesh); }
    for (const lm of this.lawnMowers) { if (lm.mesh) this.scene.remove(lm.mesh); }
    // Clear arrays
    this.entities = [];
    this.zombies = [];
    this.plants = [];
    this.projectiles = [];
    this.suns = [];
    this.lawnMowers = [];
    // Recreate tiles
    this.tiles = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 9; c++) {
        const tile = new Tile(this.scene, r, c);
        this.tiles.push(tile);
        this.entities.push(tile);
      }
    }
    // Recreate lawn mowers
    for (let r = 0; r < 5; r++) {
      const lm = new LawnMower(this.scene, r);
      this.lawnMowers.push(lm);
      this.entities.push(lm);
    }
    // Reset game state for current level
    this.sun = 50;
    document.getElementById('sun-amount').textContent = this.sun;
    this.selectedPlant = null;
    this.shovelMode = false;
    this.wave = 1;
    this.waveTimer = 0;
    this.zombiesSpawned = 0;
    this.zombiesPerWave = 3;
    this.spawnTimer = 0;
    this.sunDropTimer = 2;
    this.zombiesKilledInWave = 0;
    this.waveBarProgress = 0;
    this.flagsTriggered = [false, false];
    this._applyLevelConfig();
    for (const type in this.plantCooldownTimers) this.plantCooldownTimers[type] = 0;
    this._applyInitialCooldowns();
    this._setupWaveBar();
    this._deselectPlant();
    this._deselectShovel();
    this._clearHoverPreview();
    this.resetCamera();
    this.clock.getDelta(); // reset clock
    // Start with ready-set-plant
    this._playReadySetPlant();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  getObjectAt(screenX, screenY) {
    const mouse = new THREE.Vector2(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    const meshes = this.entities.map(e => e.mesh).filter(m => m);
    const intersects = raycaster.intersectObjects(meshes, true);
    if (intersects.length > 0) {
      return this.entities.find(e => e.mesh === intersects[0].object || e.mesh === intersects[0].object.parent);
    }
    return null;
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
  }

  _buildFlankingHouse(cx, zOffset) {
    const houseGroup = new THREE.Group();
    this.scene.add(houseGroup);
    const sandMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.90, metalness: 0.0 });
    const stuccoMain  = sandMat(0xCE9E45);
    const stuccoDark  = sandMat(0xA07830);
    const stuccoLight = sandMat(0xE0BC68);
    const shadowMat   = sandMat(0x1A100A);

    // Smaller building — narrower/shallower than the main house
    const FX2  = -13.5;
    const HW2  = 4.2;
    const BW2  = 3.8;
    const BWH2 = 2.0;
    const CX2  = cx;  // same centre X as main house

    // Base slab
    const baseSlab = new THREE.Mesh(
      new THREE.BoxGeometry(HW2 + 0.5, 0.20, BW2 + 0.5),
      stuccoDark
    );
    baseSlab.position.set(CX2, 0.10, zOffset);
    houseGroup.add(baseSlab);

    // Main wall body
    const wallBox = new THREE.Mesh(
      new THREE.BoxGeometry(HW2, BWH2, BW2),
      stuccoMain
    );
    wallBox.position.set(CX2, BWH2 * 0.5 + 0.20, zOffset);
    wallBox.castShadow = true;
    wallBox.receiveShadow = true;
    houseGroup.add(wallBox);

    // Rounded corner pillars
    const cornerR2 = 0.42;
    for (const [pcx, pz] of [
      [FX2 - HW2 + cornerR2, zOffset - BW2 * 0.5 + cornerR2],
      [FX2 - HW2 + cornerR2, zOffset + BW2 * 0.5 - cornerR2],
      [FX2 - cornerR2,       zOffset - BW2 * 0.5 + cornerR2],
      [FX2 - cornerR2,       zOffset + BW2 * 0.5 - cornerR2]
    ]) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(cornerR2, cornerR2, BWH2 + 0.28, 16),
        stuccoLight
      );
      col.position.set(pcx, BWH2 * 0.5 + 0.20, pz);
      col.castShadow = true;
      houseGroup.add(col);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(cornerR2 + 0.05, cornerR2 + 0.05, 0.11, 16),
        stuccoDark
      );
      cap.position.set(pcx, BWH2 + 0.20 + 0.14 + 0.055, pz);
      houseGroup.add(cap);
    }

    // Parapet ledge
    const parapet2 = new THREE.Mesh(
      new THREE.BoxGeometry(HW2 + cornerR2 * 2, 0.20, BW2 + cornerR2 * 2),
      stuccoDark
    );
    parapet2.position.set(CX2, BWH2 + 0.20 + 0.10, zOffset);
    houseGroup.add(parapet2);

    // Main dome — slightly smaller than the centre house dome
    const domeR2 = 1.55;
    const domeY2 = BWH2 + 0.20 + 0.20;
    const drum2 = new THREE.Mesh(
      new THREE.CylinderGeometry(domeR2 * 0.88, domeR2 * 0.92, 0.44, 24),
      stuccoMain
    );
    drum2.position.set(CX2, domeY2 + 0.22, zOffset);
    drum2.castShadow = true;
    houseGroup.add(drum2);
    const domeMesh2 = new THREE.Mesh(
      new THREE.SphereGeometry(domeR2, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
      stuccoLight
    );
    domeMesh2.position.set(CX2, domeY2 + 0.44, zOffset);
    domeMesh2.castShadow = true;
    houseGroup.add(domeMesh2);
    const domeRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(domeR2, 0.11, 8, 28),
      stuccoDark
    );
    domeRing2.rotation.x = Math.PI / 2;
    domeRing2.position.set(CX2, domeY2 + 0.44, zOffset);
    houseGroup.add(domeRing2);

    // Arched doorway (front face)
    const archW2 = 0.95;
    const archH2 = 1.55;
    const archD2 = 0.45;
    const recessBox2 = new THREE.Mesh(
      new THREE.BoxGeometry(archD2 + 0.08, archH2, archW2),
      shadowMat
    );
    recessBox2.position.set(FX2 - archD2 * 0.5 + 0.04, archH2 * 0.5 + 0.20, zOffset);
    houseGroup.add(recessBox2);
    const archBarrel2 = new THREE.Mesh(
      new THREE.CylinderGeometry(archW2 * 0.5, archW2 * 0.5, archD2 + 0.15, 14, 1, false, 0, Math.PI),
      shadowMat
    );
    archBarrel2.rotation.z = Math.PI / 2;
    archBarrel2.rotation.y = Math.PI / 2;
    archBarrel2.position.set(FX2 - archD2 * 0.5, archH2 + 0.20, zOffset);
    houseGroup.add(archBarrel2);
    // Door arch frame
    for (const fz of [zOffset - archW2 * 0.5 - 0.09, zOffset + archW2 * 0.5 + 0.09]) {
      const framePost = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, archH2 + archW2 * 0.5, 0.18),
        stuccoLight
      );
      framePost.position.set(FX2 - 0.02, (archH2 + archW2 * 0.5) * 0.5 + 0.20, fz);
      houseGroup.add(framePost);
    }
    // Small window
    for (const wz of [zOffset - 1.3, zOffset + 1.3]) {
      const winBox2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.70, 0.60),
        shadowMat
      );
      winBox2.position.set(FX2 - 0.12, 1.30, wz);
      houseGroup.add(winBox2);
      const winSurr2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.85, 0.76),
        stuccoLight
      );
      winSurr2.position.set(FX2 - 0.01, 1.26, wz);
      houseGroup.add(winSurr2);
    }
  }

  _buildSpectatorDroids() {
    this._spectatorDroids = [];
    const phong = (color, opts = {}) => new THREE.MeshPhongMaterial({
      color, shininess: opts.s !== undefined ? opts.s : 60,
      specular: opts.spec || 0x333333,
      emissive: opts.em || 0x000000,
      emissiveIntensity: opts.ei || 0
    });

    // ── Droid builder helpers ──

    // Type A: Barrel-body astromech with tank treads (inspired by Image 1)
    const buildAstromech = (x, z, facingAngle, colorAccent) => {
      const grp = new THREE.Group();
      this.scene.add(grp);
      // Barrel body
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.42, 0.72, 20),
        phong(0xF0EAD6, { s: 80, spec: 0x888888 })
      );
      body.position.y = 0.82;
      grp.add(body);
      // Accent panels on body
      for (const a of [0, Math.PI * 0.55, Math.PI, Math.PI * 1.45]) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.30, 0.04),
          phong(colorAccent, { s: 70 })
        );
        panel.position.set(Math.sin(a) * 0.40, 0.82, Math.cos(a) * 0.40);
        panel.rotation.y = a;
        grp.add(panel);
      }
      // Equator ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.40, 0.032, 8, 28),
        phong(0xCCC8B8, { s: 50 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.82;
      grp.add(ring);
      // Dome head
      const headGrp = new THREE.Group();
      headGrp.position.y = 1.27;
      grp.add(headGrp);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
        phong(0xF0EAD6, { s: 90, spec: 0x999999 })
      );
      headGrp.add(dome);
      // Dome accent stripe
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(0.30, 0.028, 7, 24),
        phong(colorAccent, { s: 70 })
      );
      stripe.rotation.x = Math.PI / 2;
      stripe.position.y = 0.12;
      headGrp.add(stripe);
      // Eye lens
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 14, 10),
        phong(0x0A1E3A, { s: 220, spec: 0x6699FF, em: 0x0A1E3A, ei: 0.3 })
      );
      eye.position.set(0.28, 0.10, 0);
      headGrp.add(eye);
      const eyeRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.098, 0.018, 7, 18),
        phong(colorAccent, { s: 80 })
      );
      eyeRim.rotation.y = Math.PI / 2;
      eyeRim.position.set(0.28, 0.10, 0);
      headGrp.add(eyeRim);
      // Two small sensor dots on top
      for (const [sz, ex] of [[0.12, 0.22], [-0.12, 0.20]]) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.028, 8, 8),
          phong(colorAccent, { s: 100, em: colorAccent, ei: 0.4 })
        );
        dot.position.set(ex, 0.28, sz);
        headGrp.add(dot);
      }
      // Tank treads (2 track boxes)
      for (const tz of [-0.28, 0.28]) {
        const tread = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.28, 0.20),
          phong(0x222220, { s: 10 })
        );
        tread.position.set(0, 0.14, tz);
        grp.add(tread);
        // Tread ribs
        for (let ti = 0; ti < 5; ti++) {
          const rib = new THREE.Mesh(
            new THREE.BoxGeometry(0.57, 0.05, 0.22),
            phong(0x333330, { s: 8 })
          );
          rib.position.set(-0.20 + ti * 0.10, 0.24, tz);
          grp.add(rib);
        }
        // Wheel drums at ends
        for (const tx of [-0.24, 0.24]) {
          const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.14, 0.22, 12),
            phong(0x3A3A38, { s: 20 })
          );
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(tx, 0.14, tz);
          grp.add(wheel);
        }
      }
      grp.position.set(x, 0, z);
      grp.rotation.y = facingAngle;
      const entry = { group: grp, head: headGrp, baseY: 0, baseHeadY: 0, wobbleSpeed: 0.9 + Math.random() * 0.4, wobbleOffset: Math.random() * Math.PI * 2, bobSpeed: 1.1 + Math.random() * 0.3, bobAmp: 0.015 };
      this._spectatorDroids.push(entry);
      return entry;
    };

    // Type B: Tall bipedal scout walker (AT-ST inspired — Image 3)
    const buildScoutWalker = (x, z, facingAngle) => {
      const grp = new THREE.Group();
      this.scene.add(grp);
      const metalMat = phong(0xB0AEA8, { s: 40, spec: 0x666660 });
      const darkMat  = phong(0x484844, { s: 20 });
      // Head/cockpit box
      const headGrp = new THREE.Group();
      headGrp.position.y = 2.0;
      grp.add(headGrp);
      const cockpit = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.55, 0.60),
        metalMat
      );
      headGrp.add(cockpit);
      // Cockpit viewport (dark inset)
      const viewport = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.18, 0.04),
        phong(0x111A22, { s: 200, spec: 0x4488BB, em: 0x0A1520, ei: 0.5 })
      );
      viewport.position.set(0, 0.06, 0.31);
      headGrp.add(viewport);
      // Two side eye ports
      for (const ex of [-0.20, 0.20]) {
        const port = new THREE.Mesh(
          new THREE.CylinderGeometry(0.065, 0.065, 0.10, 10),
          phong(0x111111, { s: 180 })
        );
        port.rotation.x = Math.PI / 2;
        port.position.set(ex, -0.08, 0.32);
        headGrp.add(port);
      }
      // Chin cannon
      const chin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.045, 0.45, 8),
        darkMat
      );
      chin.rotation.x = Math.PI / 2;
      chin.position.set(0, -0.22, 0.38);
      headGrp.add(chin);
      // Side ear flaps
      for (const ex of [-0.38, 0.38]) {
        const ear = new THREE.Mesh(
          new THREE.BoxGeometry(0.10, 0.36, 0.44),
          metalMat
        );
        ear.position.set(ex, 0, 0);
        headGrp.add(ear);
      }
      // Neck strut
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.07, 0.50, 8),
        darkMat
      );
      neck.position.y = 1.72;
      grp.add(neck);
      // Body gyro sphere (small)
      const gyro = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8),
        phong(0x888884, { s: 60 })
      );
      gyro.position.y = 1.45;
      grp.add(gyro);
      // Two legs
      for (const lx of [-0.18, 0.18]) {
        // Upper leg
        const upperLeg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.055, 0.70, 8),
          metalMat
        );
        upperLeg.position.set(lx, 1.05, 0.04);
        upperLeg.rotation.x = 0.15;
        grp.add(upperLeg);
        // Knee joint
        const knee = new THREE.Mesh(
          new THREE.SphereGeometry(0.065, 8, 8),
          darkMat
        );
        knee.position.set(lx, 0.70, 0.09);
        grp.add(knee);
        // Lower leg
        const lowerLeg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.038, 0.045, 0.68, 8),
          metalMat
        );
        lowerLeg.position.set(lx, 0.35, 0.07);
        lowerLeg.rotation.x = -0.12;
        grp.add(lowerLeg);
        // Foot pad
        const foot = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.06, 0.22),
          darkMat
        );
        foot.position.set(lx, 0.03, 0.10);
        grp.add(foot);
      }
      grp.position.set(x, 0, z);
      grp.rotation.y = facingAngle;
      const entry = { group: grp, head: headGrp, baseY: 0, baseHeadY: 0, wobbleSpeed: 0.5 + Math.random() * 0.3, wobbleOffset: Math.random() * Math.PI * 2, bobSpeed: 0.6 + Math.random() * 0.2, bobAmp: 0.010 };
      this._spectatorDroids.push(entry);
      return entry;
    };

    // Type C: Boxy protocol-style droid with box head and antenna (inspired by Image 4 gonk/box droid)
    const buildBoxDroid = (x, z, facingAngle, bodyColor) => {
      const grp = new THREE.Group();
      this.scene.add(grp);
      const boxMat  = phong(bodyColor, { s: 30, spec: 0x444440 });
      const darkMat = phong(0x2A2A28, { s: 15 });
      const lightMat = phong(0xC8C5B8, { s: 50 });
      // Main body box
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.70, 0.46),
        boxMat
      );
      body.position.y = 0.85;
      grp.add(body);
      // Body panel details — recessed rectangles
      const frontPanel = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.40, 0.04),
        phong(0x3A3A38, { s: 20 })
      );
      frontPanel.position.set(0, 0.88, 0.25);
      grp.add(frontPanel);
      // Panel indicator dots
      for (const [py, pz, c] of [[0.96, 0.25, 0xFF3311], [0.88, 0.25, 0x22CC44], [0.80, 0.25, 0xFFAA00]]) {
        const dot = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.04, 0.04),
          phong(c, { s: 120, em: c, ei: 0.6 })
        );
        dot.position.set(-0.08, py, pz);
        grp.add(dot);
      }
      // Ventilation slots on side
      for (let vi = 0; vi < 3; vi++) {
        const vent = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.05, 0.38),
          darkMat
        );
        vent.position.set(0.31, 0.72 + vi * 0.12, 0);
        grp.add(vent);
      }
      // Shoulder ledge
      const shoulder = new THREE.Mesh(
        new THREE.BoxGeometry(0.66, 0.08, 0.54),
        lightMat
      );
      shoulder.position.y = 1.24;
      grp.add(shoulder);
      // Head box (smaller, sits on shoulder)
      const headGrp = new THREE.Group();
      headGrp.position.y = 1.50;
      grp.add(headGrp);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.40, 0.38),
        boxMat
      );
      headGrp.add(head);
      // Head front face plate
      const facePlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.24, 0.04),
        phong(0x2A2A28, { s: 30 })
      );
      facePlate.position.set(0, 0.02, 0.21);
      headGrp.add(facePlate);
      // Eyes (two lenses)
      for (const ex of [-0.08, 0.08]) {
        const lens = new THREE.Mesh(
          new THREE.SphereGeometry(0.048, 10, 8),
          phong(0x0A2040, { s: 200, spec: 0x4488CC, em: 0x051020, ei: 0.6 })
        );
        lens.position.set(ex, 0.04, 0.22);
        headGrp.add(lens);
      }
      // Antenna
      const antBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.022, 0.10, 6),
        lightMat
      );
      antBase.position.set(0.08, 0.24, 0);
      headGrp.add(antBase);
      const antPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.010, 0.55, 6),
        phong(0x888880, { s: 50 })
      );
      antPole.position.set(0.08, 0.55, 0);
      headGrp.add(antPole);
      // Stubby legs
      for (const lx of [-0.18, 0.18]) {
        const legUpper = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.08, 0.35, 10),
          lightMat
        );
        legUpper.position.set(lx, 0.33, 0);
        grp.add(legUpper);
        const foot = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.10, 0.28),
          darkMat
        );
        foot.position.set(lx, 0.05, 0.04);
        grp.add(foot);
      }
      grp.position.set(x, 0, z);
      grp.rotation.y = facingAngle;
      const entry = { group: grp, head: headGrp, baseY: 0, baseHeadY: 0, wobbleSpeed: 0.7 + Math.random() * 0.5, wobbleOffset: Math.random() * Math.PI * 2, bobSpeed: 0.8 + Math.random() * 0.3, bobAmp: 0.012 };
      this._spectatorDroids.push(entry);
      return entry;
    };

    // Type D: Spindly mantis droid — tall with multi-jointed arms/legs (Image 2 inspired)
    const buildMantisDroid = (x, z, facingAngle) => {
      const grp = new THREE.Group();
      this.scene.add(grp);
      const copperMat = phong(0xA0522D, { s: 45, spec: 0x664422 });
      const darkMat   = phong(0x3A2010, { s: 15 });
      const jointMat  = phong(0x555548, { s: 30 });
      // Torso
      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.42, 0.22),
        copperMat
      );
      torso.position.y = 1.10;
      grp.add(torso);
      // Neck strut
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.034, 0.30, 8),
        copperMat
      );
      neck.position.y = 1.45;
      grp.add(neck);
      // Head: brim hat shape + large eye
      const headGrp = new THREE.Group();
      headGrp.position.y = 1.68;
      grp.add(headGrp);
      // Brim (flat disc)
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.30, 0.28, 0.06, 18),
        copperMat
      );
      brim.position.y = 0.04;
      headGrp.add(brim);
      // Dome on top
      const capDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.20, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
        copperMat
      );
      capDome.position.y = 0.06;
      headGrp.add(capDome);
      // Large single eye
      const eyeOuter = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 14, 10),
        phong(0x080E18, { s: 240, spec: 0x3366AA, em: 0x050A14, ei: 0.4 })
      );
      eyeOuter.position.set(0.17, 0, 0);
      headGrp.add(eyeOuter);
      // Eye glint
      const glint = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 6, 6),
        phong(0xFFFFFF, { s: 255, em: 0xFFFFFF, ei: 1.0 })
      );
      glint.position.set(0.255, 0.05, 0.04);
      headGrp.add(glint);
      // Antenna
      const ant = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.009, 0.70, 6),
        darkMat
      );
      ant.position.set(-0.04, 0.54, 0);
      ant.rotation.z = 0.15;
      headGrp.add(ant);
      // Arms — two articulated limbs
      for (const side of [-1, 1]) {
        const upperArm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.028, 0.38, 8),
          copperMat
        );
        upperArm.position.set(side * 0.22, 1.22, 0);
        upperArm.rotation.z = side * 0.55;
        grp.add(upperArm);
        const elbow = new THREE.Mesh(
          new THREE.SphereGeometry(0.038, 8, 8),
          jointMat
        );
        elbow.position.set(side * 0.40, 1.08, 0);
        grp.add(elbow);
        const lowerArm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.022, 0.32, 8),
          copperMat
        );
        lowerArm.position.set(side * 0.48, 0.92, 0);
        lowerArm.rotation.z = side * 0.30;
        grp.add(lowerArm);
        // Claw hand
        for (const ca of [-0.2, 0.2]) {
          const claw = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.12, 0.04),
            darkMat
          );
          claw.position.set(side * 0.54 + ca * side, 0.80, 0);
          grp.add(claw);
        }
      }
      // Two spindly legs
      for (const lx of [-0.10, 0.10]) {
        const thigh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.034, 0.50, 8),
          copperMat
        );
        thigh.position.set(lx, 0.77, 0);
        thigh.rotation.x = 0.12;
        grp.add(thigh);
        const kneeBall = new THREE.Mesh(
          new THREE.SphereGeometry(0.042, 8, 8),
          jointMat
        );
        kneeBall.position.set(lx, 0.52, 0.05);
        grp.add(kneeBall);
        const shin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.020, 0.026, 0.44, 8),
          copperMat
        );
        shin.position.set(lx, 0.28, 0.06);
        shin.rotation.x = -0.15;
        grp.add(shin);
        const ankle = new THREE.Mesh(
          new THREE.SphereGeometry(0.038, 8, 8),
          jointMat
        );
        ankle.position.set(lx, 0.07, 0.08);
        grp.add(ankle);
        const toe = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.05, 0.16),
          darkMat
        );
        toe.position.set(lx, 0.025, 0.12);
        grp.add(toe);
      }
      grp.position.set(x, 0, z);
      grp.rotation.y = facingAngle;
      const entry = { group: grp, head: headGrp, baseY: 0, baseHeadY: 0, wobbleSpeed: 0.6 + Math.random() * 0.5, wobbleOffset: Math.random() * Math.PI * 2, bobSpeed: 0.5 + Math.random() * 0.3, bobAmp: 0.018 };
      this._spectatorDroids.push(entry);
      return entry;
    };

    // ── Place droids along near side (z = -6.8) and far side (z = 6.8) ──
    // Near side (z < 0), facing the grid (positive Z direction = Math.PI)
    // Grid x spans roughly -8 to +8, so spread droids along that range
    const nearZ = -6.9;
    const farZ  =  6.9;
    const faceNear = Math.PI * 0.5;  // face +Z (toward grid)
    const faceFar  = -Math.PI * 0.5; // face -Z (toward grid)

    // Near side — 4 droids at various x positions
    buildAstromech(-4.5, nearZ, faceNear, 0xE8730A);  // orange accent (BB-unit ish)
    buildScoutWalker(0.5, nearZ, faceNear);            // AT-ST scout
    buildBoxDroid(4.8, nearZ, faceNear, 0x666660);     // grey gonk-style
    buildMantisDroid(-8.0, nearZ, faceNear + 0.3);     // mantis near house end

    // Far side — 4 droids, different types/colors for variety
    buildAstromech(6.5,  farZ, faceFar, 0xCC5500);     // dark orange accent astromech
    buildBoxDroid(-2.5,  farZ, faceFar, 0x8B6030);     // brown box droid
    buildScoutWalker(-6.5, farZ, faceFar - 0.2);       // second scout walker
    buildMantisDroid(2.0, farZ, faceFar + 0.1);        // second mantis
  }

  _buildBackgroundDomeHouse(bx, bz, scale) {
    const grp = new THREE.Group();
    this.scene.add(grp);
    grp.scale.setScalar(scale);

    const sandMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.0 });
    const stuccoMain  = sandMat(0xD2A24C);
    const stuccoDark  = sandMat(0xA87830);
    const stuccoLight = sandMat(0xEAC870);
    const shadowMat   = sandMat(0x140C06);

    // ── Main wide body ──
    const BW = 7.0, BD = 4.8, BWH = 2.4;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(BW, BWH, BD),
      stuccoMain
    );
    body.position.set(0, BWH * 0.5 + 0.15, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    grp.add(body);

    // Ground slab
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(BW + 0.8, 0.20, BD + 0.8),
      stuccoDark
    );
    slab.position.set(0, 0.10, 0);
    grp.add(slab);

    // Parapet ledge
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(BW + 0.8, 0.22, BD + 0.8),
      stuccoDark
    );
    parapet.position.set(0, BWH + 0.15 + 0.11, 0);
    grp.add(parapet);

    // ── Rounded corner pillars ──
    const cR = 0.50;
    const pillarH = BWH + 0.30;
    for (const [px, pz] of [
      [-BW * 0.5 + cR, -BD * 0.5 + cR],
      [-BW * 0.5 + cR,  BD * 0.5 - cR],
      [ BW * 0.5 - cR, -BD * 0.5 + cR],
      [ BW * 0.5 - cR,  BD * 0.5 - cR]
    ]) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(cR, cR, pillarH, 16),
        stuccoLight
      );
      col.position.set(px, pillarH * 0.5 + 0.15, pz);
      col.castShadow = true;
      grp.add(col);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(cR + 0.06, cR + 0.06, 0.13, 16),
        stuccoDark
      );
      cap.position.set(px, pillarH + 0.15 + 0.065, pz);
      grp.add(cap);
    }

    // ── Large central dome ──
    const dR = 2.0;
    const domeBaseY = BWH + 0.15 + 0.22;
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(dR * 0.88, dR * 0.92, 0.50, 26),
      stuccoMain
    );
    drum.position.set(0, domeBaseY + 0.25, 0);
    drum.castShadow = true;
    grp.add(drum);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(dR, 30, 16, 0, Math.PI * 2, 0, Math.PI * 0.54),
      stuccoLight
    );
    dome.position.set(0, domeBaseY + 0.50, 0);
    dome.castShadow = true;
    grp.add(dome);
    const domeRing = new THREE.Mesh(
      new THREE.TorusGeometry(dR, 0.13, 8, 28),
      stuccoDark
    );
    domeRing.rotation.x = Math.PI / 2;
    domeRing.position.set(0, domeBaseY + 0.50, 0);
    grp.add(domeRing);

    // ── Two smaller side domes ──
    for (const sx of [-2.2, 2.2]) {
      const sr = 0.95;
      const sDrum = new THREE.Mesh(
        new THREE.CylinderGeometry(sr * 0.88, sr * 0.92, 0.32, 18),
        stuccoMain
      );
      sDrum.position.set(sx, domeBaseY + 0.16, 0);
      grp.add(sDrum);
      const sDome = new THREE.Mesh(
        new THREE.SphereGeometry(sr, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
        sandMat(0xC9A040)
      );
      sDome.position.set(sx, domeBaseY + 0.32, 0);
      sDome.castShadow = true;
      grp.add(sDome);
      const sRing = new THREE.Mesh(
        new THREE.TorusGeometry(sr, 0.08, 6, 20),
        stuccoDark
      );
      sRing.rotation.x = Math.PI / 2;
      sRing.position.set(sx, domeBaseY + 0.32, 0);
      grp.add(sRing);
    }

    // ── Arched doorway on front face (facing -X toward player) ──
    const aW = 1.10, aH = 1.90, aD = 0.45;
    const frontX = -BW * 0.5;
    const recess = new THREE.Mesh(
      new THREE.BoxGeometry(aD + 0.10, aH, aW),
      shadowMat
    );
    recess.position.set(frontX - aD * 0.5 + 0.05, aH * 0.5 + 0.15, 0);
    grp.add(recess);
    const archTop = new THREE.Mesh(
      new THREE.CylinderGeometry(aW * 0.5, aW * 0.5, aD + 0.15, 14, 1, false, 0, Math.PI),
      shadowMat
    );
    archTop.rotation.z = Math.PI / 2;
    archTop.rotation.y = Math.PI / 2;
    archTop.position.set(frontX - aD * 0.5, aH + 0.15, 0);
    grp.add(archTop);
    // Arch frame
    const archTorus = new THREE.Mesh(
      new THREE.TorusGeometry(aW * 0.5 + 0.10, 0.09, 7, 18, Math.PI),
      stuccoLight
    );
    archTorus.rotation.y = Math.PI / 2;
    archTorus.position.set(frontX - 0.02, aH + 0.15, 0);
    grp.add(archTorus);

    // ── Side windows (2 per side) ──
    for (const wz of [-1.6, 1.6]) {
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.75, 0.65),
        shadowMat
      );
      win.position.set(frontX - 0.14, 1.45, wz);
      grp.add(win);
      const winSurr = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.90, 0.82),
        stuccoLight
      );
      winSurr.position.set(frontX - 0.01, 1.40, wz);
      grp.add(winSurr);
    }

    // ── Dot texture pattern on dome (decorative) ──
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const dotR = dR * 0.85;
      const dotY = domeBaseY + 0.50 + dR * 0.45;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 6, 6),
        sandMat(0xB8902A)
      );
      dot.position.set(
        Math.cos(angle) * dotR * 0.72,
        dotY,
        Math.sin(angle) * dotR * 0.72
      );
      grp.add(dot);
    }

    grp.position.set(bx, 0, bz);
    grp.rotation.y = Math.PI * 0.5; // face toward player
  }

  _createTrees() {
    // Just a few gentle sand dunes — no cacti, no spires
    const makeDune = (x, z, rx, rz, ry) => {
      const g = new THREE.Group();
      // Main dune mound — squished sphere
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 20, 12),
        new THREE.MeshLambertMaterial({ color: 0xC8A048 })
      );
      mound.scale.set(rx, 0.32, rz);
      mound.position.y = 0.0;
      g.add(mound);
      // Subtle highlight ridge on top
      const ridge = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 14, 8),
        new THREE.MeshLambertMaterial({ color: 0xDDB85A })
      );
      ridge.scale.set(rx * 0.55, 0.18, rz * 0.45);
      ridge.position.set(0, 0.04, 0);
      g.add(ridge);
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      g.receiveShadow = true;
      this.scene.add(g);
    };

    // 4 dunes placed well outside the playing field
    makeDune(-2,  -10.5, 4.0, 2.2, 0.3);  // behind lawn (negative z side)
    makeDune( 7,  -11.0, 3.2, 1.8, -0.5); // behind lawn, right
    makeDune( 4,   10.5, 3.6, 2.0, 0.8);  // in front of lawn (positive z side)
    makeDune(14.5,  1.5, 2.4, 1.6, 1.1);  // far right (zombie spawn side)
  }

  _generatePlantIcons() {
    const types = ['peashooter', 'sunflower', 'wallnut', 'snowpea', 'repeater', 'potato_mine', 'chomper'];
    const size = 128;
    const iconRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    iconRenderer.setSize(size, size);
    const iconScene = new THREE.Scene();
    const iconCam = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
    iconCam.position.set(-1.4, 0.5, 2.0);
    iconCam.lookAt(0, 0.2, 0);
    const amb = new THREE.AmbientLight(0xffffff, 0.8);
    iconScene.add(amb);
    const dl = new THREE.DirectionalLight(0xffffff, 1);
    dl.position.set(2, 4, 3);
    iconScene.add(dl);

    for (const type of types) {
      // Create a temporary plant to grab its mesh
      const tempPlant = new Plant(iconScene, type, 0, 0);
      // Center the mesh - adjust chomper to show full plant
      const yOff = type === 'peashooter' ? -0.18 : type === 'sunflower' ? -0.15 : type === 'chomper' ? -0.15 : type === 'wallnut' ? -0.1 : 0;
      tempPlant.mesh.position.set(0, yOff, 0);
      tempPlant.mesh.rotation.set(0, 0, 0);
      // Zoom out camera for taller silhouettes to avoid top cutoff
      if (type === 'chomper') {
        iconCam.position.set(-1.4, 0.6, 1.9);
        iconCam.lookAt(0, 0.25, 0);
      } else if (type === 'peashooter') {
        iconCam.position.set(-1.45, 0.42, 2.35);
        iconCam.lookAt(0, 0.05, 0);
      } else {
        iconCam.position.set(-1.4, 0.5, 2.0);
        iconCam.lookAt(0, 0.2, 0);
      }
      iconRenderer.render(iconScene, iconCam);
      const dataURL = iconRenderer.domElement.toDataURL();
      // Remove temp plant from icon scene
      iconScene.remove(tempPlant.mesh);

      // Update button
      const btn = document.querySelector(`[data-plant="${type}"]`);
      if (btn) {
        const label = this.plantLabels[type] || btn.dataset.label || type;
        const cost = this.plantCosts[type];
        const imgH = 52;
        const imgWidth = type === 'peashooter' ? 44 : 38;
        const imgStyle = 'width:' + imgWidth + 'px;height:' + imgH + 'px;display:block;margin:0 auto;position:relative;z-index:10;object-fit:contain;';
        btn.dataset.label = label;
        btn.innerHTML = `<div style="height:${imgH}px;display:flex;align-items:flex-end;justify-content:center;flex:1;"><img src="${dataURL}" style="${imgStyle}"></div><div style="background:rgba(200,240,200,0.88);margin:2px -6px -4px -6px;padding:2px 2px 3px;border-radius:0 0 7px 7px;height:34px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;"><span style="line-height:1.05;font-size:10px;color:#1d281d;max-width:66px;white-space:normal;min-height:20px;display:flex;align-items:center;justify-content:center;text-align:center;">${label}</span><span style="display:inline-flex;align-items:center;justify-content:center;line-height:1;font-size:12px;color:#222;margin-top:1px;height:11px;">${cost}<span class="cost-icon">☀️</span></span></div>`;
      }
    }
    iconRenderer.dispose();
  }

  _generateSunIcon() {
    const size = 256;
    const iconRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    iconRenderer.setSize(size, size);
    iconRenderer.setPixelRatio(1);
    const iconScene = new THREE.Scene();
    const iconCam = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
    iconCam.position.set(0, 0, 2.5);
    iconCam.lookAt(0, 0, 0);
    const amb = new THREE.AmbientLight(0xffffff, 0.8);
    iconScene.add(amb);
    const dl = new THREE.DirectionalLight(0xffffff, 1);
    dl.position.set(2, 4, 3);
    iconScene.add(dl);
    const tempSun = new Sun(iconScene, 0, 0, 0, false);
    tempSun.mesh.position.set(0, 0, 0);
    tempSun.mesh.rotation.set(0, 0, 0);
    iconRenderer.render(iconScene, iconCam);
    this._sunDataURL = iconRenderer.domElement.toDataURL();
    const canvas = document.getElementById('sun-icon');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, 128, 128); };
    img.src = this._sunDataURL;
    iconScene.remove(tempSun.mesh);
    iconRenderer.dispose();
    // Replace star-power placeholders in plant buttons with the rendered icon.
    document.querySelectorAll('.plant-btn').forEach(btn => {
      btn.innerHTML = btn.innerHTML.replace(/☀️/g, `<img src="${this._sunDataURL}" title="Star power" style="width:18px;height:18px;vertical-align:middle;margin-left:2px;">`);
    });
  }

  _generateZombieHeadIcon() {
    const size = 64;
    const iconRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    iconRenderer.setSize(size, size);
    const iconScene = new THREE.Scene();
    const iconCam = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
    iconCam.position.set(0, 0.1, 1.5);
    iconCam.lookAt(0, 0.1, 0);
    const amb = new THREE.AmbientLight(0xffffff, 0.8);
    iconScene.add(amb);
    const dl = new THREE.DirectionalLight(0xffffff, 1);
    dl.position.set(2, 4, 3);
    iconScene.add(dl);
    // Create a temp zombie and extract just the head
    const tempZ = new Zombie(iconScene, 0, 0);
    // Hide everything except head (child 1)
    for (let i = 0; i < tempZ.mesh.children.length; i++) {
      if (i !== 1) tempZ.mesh.children[i].visible = false;
    }
    tempZ.mesh.position.set(0, -0.55, 0);
    tempZ.mesh.rotation.set(0, -Math.PI / 4, 0);
    // Force full opacity
    tempZ._setOpacity(tempZ.mesh, 1);
    iconRenderer.render(iconScene, iconCam);
    this._zombieHeadDataURL = iconRenderer.domElement.toDataURL();
    iconScene.remove(tempZ.mesh);
    iconRenderer.dispose();
    // Set the wave-head to use the rendered image
    const headEl = document.getElementById('wave-head');
    headEl.innerHTML = `<img src="${this._zombieHeadDataURL}" style="width:36px;height:36px;">`;
  }

  _generateStartScreenCharacters() {
    const peaImg = document.getElementById('start-peashooter');
    const zImg = document.getElementById('start-zombie');
    if (peaImg) peaImg.src = 'assets/Peashooter-transparent.png';
    if (zImg) zImg.src = 'assets/Conehead%20Trooper.png';
  }

  _drawShovelIcon() {
    const canvas = document.getElementById('shovel-icon');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw an angled shovel (~25 degrees tilted right)
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(0.45 + Math.PI); // point bottom-left
    ctx.translate(-w / 2, -h / 2);

    const cx = w / 2;
    const padTop = 6;
    const padBot = 8;

    // === BLADE (spade shape at top) ===
    const bladeTop = padTop;
    const bladeBot = padTop + 24;
    const bladeGrad = ctx.createLinearGradient(0, bladeTop, 0, bladeBot);
    bladeGrad.addColorStop(0, '#999999');
    bladeGrad.addColorStop(0.15, '#DDDDDD');
    bladeGrad.addColorStop(0.5, '#BBBBBB');
    bladeGrad.addColorStop(1, '#888888');
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.moveTo(cx, bladeTop);  // pointed tip
    ctx.bezierCurveTo(cx + 6, bladeTop + 2, cx + 14, bladeTop + 8, cx + 14, bladeTop + 14);
    ctx.lineTo(cx + 12, bladeBot);
    ctx.lineTo(cx - 12, bladeBot);
    ctx.lineTo(cx - 14, bladeTop + 14);
    ctx.bezierCurveTo(cx - 14, bladeTop + 8, cx - 6, bladeTop + 2, cx, bladeTop);
    ctx.closePath();
    ctx.fill();

    // Blade edge highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - 13, bladeTop + 12);
    ctx.bezierCurveTo(cx - 13, bladeTop + 7, cx - 5, bladeTop + 1, cx, bladeTop);
    ctx.bezierCurveTo(cx + 5, bladeTop + 1, cx + 13, bladeTop + 7, cx + 13, bladeTop + 12);
    ctx.stroke();

    // Blade center ridge
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, bladeTop + 3);
    ctx.lineTo(cx, bladeBot - 2);
    ctx.stroke();

    // Blade shadow at bottom
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.moveTo(cx - 12, bladeBot);
    ctx.lineTo(cx + 12, bladeBot);
    ctx.lineTo(cx + 11, bladeBot - 3);
    ctx.lineTo(cx - 11, bladeBot - 3);
    ctx.closePath();
    ctx.fill();

    // === COLLAR (metal socket) ===
    const collarTop = bladeBot;
    const collarBot = collarTop + 5;
    const collarGrad = ctx.createLinearGradient(0, collarTop, 0, collarBot);
    collarGrad.addColorStop(0, '#777777');
    collarGrad.addColorStop(0.5, '#999999');
    collarGrad.addColorStop(1, '#666666');
    ctx.fillStyle = collarGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 6, collarTop);
    ctx.lineTo(cx + 6, collarTop);
    ctx.lineTo(cx + 5, collarBot);
    ctx.lineTo(cx - 5, collarBot);
    ctx.closePath();
    ctx.fill();
    // Rivet dots
    ctx.fillStyle = '#AAAAAA';
    ctx.beginPath();
    ctx.arc(cx - 3, collarTop + 2.5, 1, 0, Math.PI * 2);
    ctx.arc(cx + 3, collarTop + 2.5, 1, 0, Math.PI * 2);
    ctx.fill();

    // === WOODEN SHAFT ===
    const shaftTop = collarBot;
    const shaftBot = h - padBot - 8;
    const shaftW = 4;
    const shaftGrad = ctx.createLinearGradient(cx - shaftW, 0, cx + shaftW, 0);
    shaftGrad.addColorStop(0, '#7A5518');
    shaftGrad.addColorStop(0.25, '#B8892E');
    shaftGrad.addColorStop(0.5, '#D4A843');
    shaftGrad.addColorStop(0.75, '#B8892E');
    shaftGrad.addColorStop(1, '#7A5518');
    ctx.fillStyle = shaftGrad;
    ctx.beginPath();
    ctx.roundRect(cx - shaftW, shaftTop, shaftW * 2, shaftBot - shaftTop, 2);
    ctx.fill();

    // Wood grain lines
    ctx.strokeStyle = 'rgba(90,55,10,0.25)';
    ctx.lineWidth = 0.6;
    for (let y = shaftTop + 4; y < shaftBot - 2; y += 6) {
      ctx.beginPath();
      ctx.moveTo(cx - shaftW + 1, y);
      ctx.lineTo(cx + shaftW - 1, y + 1);
      ctx.stroke();
    }

    // === T-GRIP HANDLE ===
    const gripY = shaftBot;
    const gripH = 6;
    const gripW = 11;
    const gripGrad = ctx.createLinearGradient(0, gripY, 0, gripY + gripH);
    gripGrad.addColorStop(0, '#8B6520');
    gripGrad.addColorStop(0.5, '#C49838');
    gripGrad.addColorStop(1, '#7A5518');
    ctx.fillStyle = gripGrad;
    ctx.beginPath();
    ctx.roundRect(cx - gripW, gripY, gripW * 2, gripH, 3);
    ctx.fill();

    // Grip highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.roundRect(cx - gripW + 2, gripY + 1, gripW * 2 - 4, 2, 1);
    ctx.fill();

    ctx.restore();
  }

  _setupWaveBar() {
    const flagsEl = document.getElementById('wave-flags');
    flagsEl.innerHTML = '';
    this.flagsTriggered = [false, false];
    const flagPositions = this.flagPositions;
    for (const pct of flagPositions) {
      const flag = document.createElement('div');
      flag.className = 'wave-flag';
      flag.style.left = (100 - pct) + '%';
      // Draw a simple flag: pole + triangular flag
      flag.innerHTML = `<svg width="18" height="24" viewBox="0 0 18 24" style="display:block;">
        <line x1="3" y1="2" x2="3" y2="23" stroke="#5a3a1a" stroke-width="2" stroke-linecap="round"/>
        <polygon points="4,2 17,6 4,10" fill="#cc2222" stroke="#991111" stroke-width="0.5"/>
        <circle cx="3" cy="2" r="1.5" fill="#daa520"/>
      </svg>`;
      flagsEl.appendChild(flag);
    }
  }

  _buildGridVaporators() {
    const makeVaporator = (x, z, scale = 1) => {
      const group = new THREE.Group();
      const metal = new THREE.MeshPhongMaterial({ color: 0xD8D3C8, shininess: 80, specular: 0xFFFFFF });
      const dark = new THREE.MeshPhongMaterial({ color: 0x3A332A, shininess: 30 });
      const glow = new THREE.MeshBasicMaterial({ color: 0x8DEBFF, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 1.25, 10), metal);
      mast.position.y = 0.70;
      group.add(mast);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.28, 0.18, 12), dark);
      base.position.y = 0.09;
      group.add(base);
      for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.60, 0.18), metal);
        fin.position.y = 0.76;
        fin.rotation.y = (i / 3) * Math.PI * 2;
        fin.position.x = Math.cos(fin.rotation.y) * 0.14;
        fin.position.z = Math.sin(fin.rotation.y) * 0.14;
        group.add(fin);
      }
      const dish = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.18, 18, 1, true), metal);
      dish.position.y = 1.42;
      dish.rotation.x = Math.PI;
      group.add(dish);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), glow);
      light.position.y = 1.08;
      group.add(light);

      group.position.set(x, 0.02, z);
      group.scale.setScalar(scale);
      group.castShadow = true;
      this.scene.add(group);
      if (!this._gridProps) this._gridProps = [];
      this._gridProps.push({ group, light, baseY: group.position.y, phase: Math.random() * Math.PI * 2 });
    };

    makeVaporator(-7.3, -6.75, 0.72);
    makeVaporator(4.9, 6.65, 0.62);
    makeVaporator(9.5, -4.9, 0.55);
  }

  _checkFlagTriggers() {
    const progressPct = this.waveBarProgress * 100;
    for (let i = 0; i < this.flagPositions.length; i++) {
      if (!this.flagsTriggered[i] && progressPct >= this.flagPositions[i] - 2) {
        this.flagsTriggered[i] = true;
        const isFinal = (i === this.flagPositions.length - 1);
        this._showWaveAnnouncement(isFinal ? `FINAL IMPERIAL ASSAULT!\n${this._waveName()}` : `${this._waveName()}\nImperial Squad incoming`);
        // Spawn a burst of zombies
        const cfg = this.levelConfigs[Math.min(this.level - 1, 9)];
        const burstCount = isFinal ? cfg.burstFinal : cfg.burstNormal;
        for (let j = 0; j < burstCount; j++) {
          setTimeout(() => {
            this._runWhenActive(() => this._spawnBurstZombie(isFinal));
          }, j * 800);
        }
      }
    }
  }

  _waveName() {
    if (this.wave >= this.wavesInLevel) return 'Heavy Imperial Squad';
    return this.waveNames[(this.wave - 1) % this.waveNames.length];
  }

  _pickZombieType(isFinal = false) {
    const cfg = this.levelConfigs[Math.min(this.level - 1, 9)];
    const roll = Math.random();
    const scoutChance = Math.min(0.08 + this.level * 0.012, 0.20);
    const droidChance = Math.max(0, Math.min((this.level - 3) * 0.018, 0.16));
    const heavyChance = isFinal ? cfg.bucketChance * 1.5 : cfg.bucketChance;
    const coneChance = isFinal ? cfg.coneChance * 1.5 : cfg.coneChance;
    if (roll < droidChance) return 'droid';
    if (roll < droidChance + heavyChance) return 'buckethead';
    if (roll < droidChance + heavyChance + coneChance) return 'conehead';
    if (roll < droidChance + heavyChance + coneChance + scoutChance) return 'scout';
    return 'normal';
  }

  _spawnBurstZombie(isFinal) {
    const row = Math.floor(Math.random() * 5);
    const x = 10 + Math.random() * 3;
    const type = this._pickZombieType(isFinal);
    const z = new Zombie(this.scene, row, x, type);
    const speedBonus = (this.level - 1) * 0.03;
    const baseByType = type === 'scout' ? 0.58 : type === 'droid' ? 0.32 : 0.4;
    z.baseSpeed = baseByType + speedBonus;
    z.speed = z.baseSpeed;
    this.zombies.push(z);
    this.entities.push(z);
  }

  _showWaveAnnouncement(text) {
    this._playSfx(text.includes('FINAL') ? 'finalWave' : 'wave');
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:100;';
    const msg = document.createElement('div');
    msg.innerHTML = text.replace('\n', '<br>');
    const color = text.includes('FINAL') ? '#ff2222' : '#ff6600';
    msg.style.cssText = `font-family:Orbitron,Rajdhani,Arial,sans-serif;font-weight:700;font-size:48px;color:${color};text-shadow:3px 3px 6px rgba(0,0,0,0.8),-1px -1px 3px rgba(0,0,0,0.5);transform:scale(0);transition:transform 0.5s cubic-bezier(0.17,0.67,0.3,1.3),opacity 0.8s;opacity:1;text-align:center;line-height:1.2;`;
    overlay.appendChild(msg);
    document.getElementById('ui-layer').appendChild(overlay);
    requestAnimationFrame(() => { msg.style.transform = 'scale(1)'; });
    setTimeout(() => {
      msg.style.opacity = '0';
      msg.style.transform = 'scale(1.2)';
      setTimeout(() => overlay.remove(), 1000);
    }, 4000);
  }

  _spawnHitEffect(x, y, z, kind = 'plasma') {
    const color = kind === 'cryo' ? 0x66E8FF : kind === 'thermal' ? 0xFF8A18 : 0x55FF77;
    const core = kind === 'cryo' ? 0xE7FDFF : kind === 'thermal' ? 0xFFE0A0 : 0xDDFFE4;
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 12, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    flash.scale.set(1.35, 0.85, 1.35);
    group.add(flash);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.018, 8, 24),
      new THREE.MeshBasicMaterial({ color: core, transparent: true, opacity: 0.68, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    for (let i = 0; i < 5; i++) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 6, 5),
        new THREE.MeshBasicMaterial({ color: core, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      spark.userData.vel = new THREE.Vector3(-0.2 - Math.random() * 0.8, 0.4 + Math.random() * 0.7, (Math.random() - 0.5) * 1.3);
      group.add(spark);
    }

    this.scene.add(group);
    this.effects.push({ group, life: 0.34, maxLife: 0.34, flash, ring });
    this._spawnScorchMark(x - 0.15, z, kind);
  }

  _spawnScorchMark(x, z, kind = 'plasma') {
    if (this.scorchMarks.length > 34) {
      const old = this.scorchMarks.shift();
      if (old && old.mesh) this.scene.remove(old.mesh);
    }
    const color = kind === 'cryo' ? 0x7BC8D8 : kind === 'thermal' ? 0x53240B : 0x27351A;
    const mark = new THREE.Mesh(
      new THREE.CircleGeometry(0.18 + Math.random() * 0.10, 18),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: kind === 'cryo' ? 0.28 : 0.36, depthWrite: false })
    );
    mark.rotation.x = -Math.PI / 2;
    mark.rotation.z = Math.random() * Math.PI;
    mark.scale.set(1.45, 0.72, 1);
    mark.position.set(x, 0.126, z + (Math.random() - 0.5) * 0.28);
    this.scene.add(mark);
    this.scorchMarks.push({ mesh: mark, life: 24 });
  }

  _updateEffects(dt) {
    for (const effect of this.effects) {
      effect.life -= dt;
      const t = Math.max(0, effect.life / effect.maxLife);
      effect.group.scale.setScalar(1 + (1 - t) * 1.2);
      effect.group.traverse(child => {
        if (child.isMesh && child.material && child.material.opacity !== undefined) {
          child.material.opacity = Math.min(child.material.opacity, t * 0.82);
        }
        if (child.userData.vel) {
          child.position.add(child.userData.vel.clone().multiplyScalar(dt));
          child.userData.vel.y -= dt * 1.4;
        }
      });
      if (effect.ring) effect.ring.rotation.z += dt * 8;
    }
    for (const mark of this.scorchMarks) {
      mark.life -= dt;
      if (mark.mesh && mark.mesh.material) mark.mesh.material.opacity *= 0.999;
    }
    const deadEffects = this.effects.filter(e => e.life <= 0);
    for (const e of deadEffects) this.scene.remove(e.group);
    this.effects = this.effects.filter(e => e.life > 0);
    const deadMarks = this.scorchMarks.filter(m => m.life <= 0);
    for (const m of deadMarks) if (m.mesh) this.scene.remove(m.mesh);
    this.scorchMarks = this.scorchMarks.filter(m => m.life > 0);
  }

  _clearVisualEffects() {
    for (const e of this.effects) if (e.group) this.scene.remove(e.group);
    for (const m of this.scorchMarks) if (m.mesh) this.scene.remove(m.mesh);
    this.effects = [];
    this.scorchMarks = [];
  }

  _updateEnvironmentEvents(dt) {
    if (this.sandboxMode) return;
    this.environmentTimer -= dt;
    if (this.environmentTimer <= 0) {
      this.environmentTimer = 38 + Math.random() * 22;
      if (Math.random() < 0.55) {
        this.sandstormTimer = 8;
        this._showWaveAnnouncement('Sandstorm Push');
      } else {
        this.solarBoostTimer = 9;
        this._showWaveAnnouncement('Twin Suns Surge');
      }
    }
    if (this.sandstormTimer > 0) {
      this.sandstormTimer -= dt;
      this.scene.fog.near = 18;
      this.scene.fog.far = 62;
    } else {
      this.scene.fog.near += (35 - this.scene.fog.near) * Math.min(1, dt * 2);
      this.scene.fog.far += (110 - this.scene.fog.far) * Math.min(1, dt * 2);
    }
    if (this.solarBoostTimer > 0) this.solarBoostTimer -= dt;
  }

  getSolarBloomInterval(firstSunProduced) {
    const boosted = this.solarBoostTimer > 0;
    const normal = firstSunProduced ? 12 : 5;
    const upgradeFactor = Math.pow(0.88, this.upgrades.solar || 0);
    const interval = normal * upgradeFactor;
    return boosted ? Math.max(3.5, interval * 0.65) : interval;
  }

  getPlantFireInterval(type) {
    const base = 1.5;
    if (type === 'peashooter' || type === 'repeater') return Math.max(0.85, base * Math.pow(0.88, this.upgrades.plasma || 0));
    if (type === 'snowpea') return Math.max(0.95, base * Math.pow(0.90, this.upgrades.cryo || 0));
    return base;
  }

  getPlantMaxHp(type) {
    const base = type === 'wallnut' ? 1800 : 200;
    if (type === 'wallnut') return Math.round(base * (1 + (this.upgrades.shield || 0) * 0.28));
    return base;
  }

  getFreezeDuration() {
    return 3 + (this.upgrades.cryo || 0) * 0.55;
  }

  _upgradeOptions() {
    return [
      { key: 'plasma', title: 'Plasma Capacitors', body: 'Plasma Pod and Twin Plasma fire 12% faster.', color: '#55ff7a' },
      { key: 'shield', title: 'Beskar Root Plating', body: 'Shield Nut gains 28% more armor.', color: '#ffb347' },
      { key: 'solar', title: 'Twin Suns Array', body: 'Solar Bloom produces star power 12% faster.', color: '#ff4d8d' },
      { key: 'cryo', title: 'Cryo Condensers', body: 'Cryo Pod fires faster and slows enemies longer.', color: '#6eeaff' }
    ];
  }

  _chooseSectorUpgrade(key, overlay) {
    if (!this.upgrades[key] && this.upgrades[key] !== 0) return;
    this._playSfx('select');
    this.upgrades[key]++;
    if (overlay) overlay.remove();
    this.nextLevel();
  }

  _resetUpgrades() {
    this.upgrades = { plasma: 0, shield: 0, solar: 0, cryo: 0 };
  }

  _updateWaveBarSmooth(dt) {
    // Progress within current level
    const spawnInterval = this.wave <= 1 ? 12 : this.wave <= 2 ? 8 : this.wave <= 3 ? 6 : this.wave <= 5 ? 4 : 3;
    const waveDuration = this.zombiesPerWave * spawnInterval;
    const timeElapsed = this.zombiesSpawned * spawnInterval + Math.max(0, this.spawnTimer);
    const waveProgress = waveDuration > 0 ? Math.min(1, timeElapsed / waveDuration) : 0;
    
    let targetProgress = ((this.wave - 1) + waveProgress) / this.wavesInLevel;
    targetProgress = Math.min(targetProgress, 1);
    
    // Never go backwards
    if (targetProgress < this.waveBarProgress) {
      targetProgress = this.waveBarProgress;
    }
    
    // Smoothly lerp toward target
    this.waveBarProgress += (targetProgress - this.waveBarProgress) * Math.min(1, dt * 3);
    
    const fillEl = document.getElementById('wave-bar-fill');
    const headEl = document.getElementById('wave-head');
    const leftLabel = document.getElementById('wave-label-left');
    fillEl.style.width = (this.waveBarProgress * 100) + '%';
    const headPct = 100 - this.waveBarProgress * 100;
    headEl.style.left = headPct + '%';

    // Update level label
    const levelLabel = document.getElementById('wave-level-label');
    if (levelLabel) levelLabel.textContent = 'Sector ' + this.level;
    // Hide labels
    const rightLabel = document.getElementById('wave-label-right');
    if (rightLabel) rightLabel.textContent = '';
  }

  _updateAmbientEffects(dt) {
    // Animate twin sun rays
    if (this._skySunGroup) {
      this._skySunGroup.rotation.z += dt * 0.06;
      const pulse = 1 + Math.sin(Date.now() * 0.0008) * 0.07;
      if (this._skySunGroup.children[1]) this._skySunGroup.children[1].scale.setScalar(pulse);
      if (this._skySunGroup.children[2]) this._skySunGroup.children[2].scale.setScalar(pulse * 1.04);
    }
    if (this._skySunGroup2) {
      this._skySunGroup2.rotation.z -= dt * 0.04;
      const pulse2 = 1 + Math.sin(Date.now() * 0.0012 + 1) * 0.06;
      if (this._skySunGroup2.children[1]) this._skySunGroup2.children[1].scale.setScalar(pulse2);
    }
    // Animate spectator droids (idle head wobble)
    if (this._spectatorDroids) {
      this._droidTime += dt;
      for (const d of this._spectatorDroids) {
        if (d.head) {
          d.head.rotation.y = d.baseHeadY + Math.sin(this._droidTime * d.wobbleSpeed + d.wobbleOffset) * 0.18;
          d.head.rotation.x = Math.sin(this._droidTime * d.wobbleSpeed * 0.6 + d.wobbleOffset) * 0.05;
        }
        if (d.group) {
          d.group.position.y = d.baseY + Math.sin(this._droidTime * d.bobSpeed + d.wobbleOffset) * d.bobAmp;
        }
      }
    }
    // Animate dust/pollen
    if (this._dustParticles) {
      this._dustTime += dt;
      const pos = this._dustParticles.geometry.attributes.position;
      const storm = this.sandstormTimer > 0 ? 1 : 0;
      this._dustParticles.material.opacity += (((storm ? 0.86 : 0.50) - this._dustParticles.material.opacity) * Math.min(1, dt * 2));
      this._dustParticles.material.size = storm ? 0.12 : 0.075;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i);
        let x = pos.getX(i);
        y += dt * (0.16 + storm * 0.24);
        x += dt * (0.45 + storm * 1.5) + Math.sin(this._dustTime + i) * dt * 0.12;
        if (y > 6.8) y = 0.35 + Math.random() * 1.2;
        if (x > 25) x = -23;
        pos.setY(i, y);
        pos.setX(i, x);
      }
      pos.needsUpdate = true;
    }
    if (this._gridProps) {
      for (const prop of this._gridProps) {
        const pulse = 0.4 + Math.sin(this._dustTime * 3 + prop.phase) * 0.25;
        if (prop.light) prop.light.material.opacity = Math.max(0.18, pulse);
        prop.group.position.y = prop.baseY + Math.sin(this._dustTime * 1.2 + prop.phase) * 0.015;
      }
    }
  }

  _applyInitialCooldowns() {
    for (const type in this.plantCooldownTimers) {
      if (type !== 'sunflower') {
        this.plantCooldownTimers[type] = this.plantCooldowns[type];
        this._updateCooldownUI(type);
      }
    }
  }

  _applyLevelConfig() {
    const cfg = this.levelConfigs[Math.min(this.level - 1, 9)];
    this.wavesInLevel = cfg.waves;
    this.zombiesPerWave = cfg.baseZombies + 1 + Math.floor((this.level - 1) * 1.2);
  }

  _showLevelComplete() {
    this._clearPauseState();
    this._setPauseButtonVisible(false);
    this._stopMusic(0.25);
    this._playSfx('win');
    const isLastLevel = this.level >= 10;
    const overlay = document.createElement('div');
    overlay.id = 'level-complete';
    overlay.style.cssText = 'pointer-events:auto;position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(0,30,0,0.7) 0%,rgba(0,0,0,0.92) 100%);z-index:50;animation:gameoverBgFade 0.8s ease forwards;';
    const inner = document.createElement('div');
    inner.style.cssText = 'background:linear-gradient(165deg,rgba(20,60,20,0.97) 0%,rgba(10,35,10,0.98) 50%,rgba(15,25,10,0.98) 100%);border-radius:24px;padding:30px 36px 34px;text-align:center;box-shadow:0 0 100px rgba(60,180,60,0.3),0 0 0 1px rgba(100,255,100,0.15),inset 0 1px 0 rgba(255,255,255,0.08);max-width:660px;width:92%;overflow:hidden;animation:gameoverSlideIn 0.6s cubic-bezier(0.17,0.67,0.3,1.15) forwards;transform:translateY(40px);opacity:0;';

    const trophy = document.createElement('div');
    trophy.style.cssText = 'font-size:72px;margin-bottom:8px;animation:gameoverZombieBob 2s ease-in-out infinite;';
    if (isLastLevel) {
      trophy.textContent = '🏆';
    } else {
      // Use peashooter image
      const peaIcon = document.querySelector('[data-plant="peashooter"] img');
      if (peaIcon) {
        trophy.innerHTML = `<img src="${peaIcon.src}" style="width:72px;height:72px;">`;
      } else {
        trophy.textContent = '🌱';
      }
    }
    inner.appendChild(trophy);

    const title = document.createElement('h1');
    title.style.cssText = 'font-size:36px;font-weight:600;color:#44DD44;text-shadow:0 0 30px rgba(60,200,60,0.6),0 2px 4px rgba(0,0,0,0.8);margin:0 0 10px;letter-spacing:3px;';
    title.textContent = isLastLevel ? 'SETTLEMENT SECURED!' : 'SECTOR SECURED!';
    inner.appendChild(title);

    const divider = document.createElement('div');
    divider.style.cssText = 'width:80px;height:2px;background:linear-gradient(90deg,transparent,rgba(100,255,100,0.6),transparent);margin:0 auto 14px;';
    inner.appendChild(divider);

    const desc = document.createElement('p');
    desc.style.cssText = 'color:rgba(255,255,255,0.6);font-size:15px;margin:0 0 6px;font-weight:400;line-height:1.5;';
    desc.textContent = isLastLevel ? 'You defended the settlement against every Imperial assault!' : `Sector ${this.level} cleared!`;
    inner.appendChild(desc);

    const stats = document.createElement('div');
    stats.style.cssText = 'color:rgba(200,255,200,0.7);font-size:13px;margin:0 0 22px;font-weight:400;';
    const plantsAlive = this.plants.filter(p => p.alive).length;
    stats.textContent = `Defenders surviving: ${plantsAlive}`;
    inner.appendChild(stats);

    if (!isLastLevel) {
      const upgradeTitle = document.createElement('div');
      upgradeTitle.style.cssText = 'font-family:Orbitron,Rajdhani,Arial,sans-serif;color:#ffdd76;font-size:14px;font-weight:700;letter-spacing:2px;margin:0 0 12px;text-transform:uppercase;';
      upgradeTitle.textContent = 'Choose Sector Upgrade';
      inner.appendChild(upgradeTitle);

      const upgradeGrid = document.createElement('div');
      upgradeGrid.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 14px;';
      for (const option of this._upgradeOptions()) {
        const card = document.createElement('button');
        const level = this.upgrades[option.key] || 0;
        card.style.cssText = `min-height:128px;padding:12px 10px;background:linear-gradient(180deg,rgba(35,42,32,0.96),rgba(12,16,14,0.98));border:1px solid ${option.color};border-radius:12px;color:white;cursor:pointer;font-family:Rajdhani,Orbitron,Arial,sans-serif;text-align:left;box-shadow:0 0 18px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.08);transition:transform 0.15s ease,box-shadow 0.15s ease;`;
        card.innerHTML = `<div style="font-family:Orbitron,Rajdhani,Arial,sans-serif;font-size:11px;line-height:1.25;color:${option.color};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${option.title}</div><div style="font-size:14px;line-height:1.25;color:rgba(255,255,255,0.82);margin-bottom:10px;">${option.body}</div><div style="font-size:12px;color:rgba(255,255,255,0.48);">Current rank: ${level}</div>`;
        card.onmouseenter = () => { card.style.transform = 'translateY(-3px)'; card.style.boxShadow = `0 0 24px ${option.color}55,0 8px 24px rgba(0,0,0,0.45)`; };
        card.onmouseleave = () => { card.style.transform = ''; card.style.boxShadow = '0 0 18px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.08)'; };
        card.onclick = () => this._chooseSectorUpgrade(option.key, overlay);
        upgradeGrid.appendChild(card);
      }
      inner.appendChild(upgradeGrid);
    }

    const menuBtn = document.createElement('button');
    menuBtn.style.cssText = 'display:block;width:100%;font-size:14px;padding:10px 0;background:transparent;color:rgba(255,255,255,0.45);border:2px solid rgba(255,255,255,0.15);border-radius:50px;cursor:pointer;font-family:Orbitron,Rajdhani,Arial,sans-serif;font-weight:500;letter-spacing:2px;transition:all 0.2s ease;';
    menuBtn.textContent = isLastLevel ? 'PLAY AGAIN' : 'COMMAND CENTER';
    menuBtn.onclick = () => { overlay.remove(); this.returnToMenu(); };
    inner.appendChild(menuBtn);

    overlay.appendChild(inner);
    document.getElementById('ui-layer').appendChild(overlay);
  }

  nextLevel() {
    this.level++;
    this._startMusic();
    this._clearPauseState();
    this._setPauseButtonVisible(true);
    this._clearVisualEffects();
    // Remove all dynamic entities from scene
    for (const e of this.entities) { if (e.mesh) this.scene.remove(e.mesh); if (e.detailGroup) this.scene.remove(e.detailGroup); }
    for (const z of this.zombies) { if (z.mesh) this.scene.remove(z.mesh); }
    for (const p of this.plants) { if (p.mesh) this.scene.remove(p.mesh); }
    for (const pr of this.projectiles) { if (pr.mesh) this.scene.remove(pr.mesh); }
    for (const s of this.suns) { if (s.mesh) this.scene.remove(s.mesh); }
    for (const lm of this.lawnMowers) { if (lm.mesh) this.scene.remove(lm.mesh); }
    this.entities = [];
    this.zombies = [];
    this.plants = [];
    this.projectiles = [];
    this.suns = [];
    this.lawnMowers = [];
    this.tiles = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 9; c++) {
        const tile = new Tile(this.scene, r, c);
        this.tiles.push(tile);
        this.entities.push(tile);
      }
    }
    for (let r = 0; r < 5; r++) {
      const lm = new LawnMower(this.scene, r);
      this.lawnMowers.push(lm);
      this.entities.push(lm);
    }
    this.sun = 50;
    document.getElementById('sun-amount').textContent = this.sun;
    this.selectedPlant = null;
    this.shovelMode = false;
    this.wave = 1;
    this.waveTimer = 0;
    this.zombiesSpawned = 0;
    this.spawnTimer = 0;
    this.sunDropTimer = 2;
    this.zombiesKilledInWave = 0;
    this.waveBarProgress = 0;
    this.flagsTriggered = [false, false];
    this._applyLevelConfig();
    for (const type in this.plantCooldownTimers) this.plantCooldownTimers[type] = 0;
    this._applyInitialCooldowns();
    this._setupWaveBar();
    // Immediately update level label and progress bar
    const levelLabel = document.getElementById('wave-level-label');
    if (levelLabel) levelLabel.textContent = 'Sector ' + this.level;
    const fillEl = document.getElementById('wave-bar-fill');
    if (fillEl) fillEl.style.width = '0%';
    const headEl = document.getElementById('wave-head');
    if (headEl) headEl.style.left = '100%';
    this._deselectPlant();
    this._deselectShovel();
    this._clearHoverPreview();
    this.resetCamera();
    this.clock.getDelta();
    this._playReadySetPlant();
  }

  returnToMenu() {
    this.isRunning = false;
    this._clearPauseState();
    this._setPauseButtonVisible(false);
    this._stopMusic(0.25);
    this._clearVisualEffects();
    // Remove all dynamic entities from scene
    for (const e of this.entities) { if (e.mesh) this.scene.remove(e.mesh); if (e.detailGroup) this.scene.remove(e.detailGroup); }
    for (const z of this.zombies) { if (z.mesh) this.scene.remove(z.mesh); }
    for (const p of this.plants) { if (p.mesh) this.scene.remove(p.mesh); }
    for (const pr of this.projectiles) { if (pr.mesh) this.scene.remove(pr.mesh); }
    for (const s of this.suns) { if (s.mesh) this.scene.remove(s.mesh); }
    for (const lm of this.lawnMowers) { if (lm.mesh) this.scene.remove(lm.mesh); }
    this.entities = [];
    this.zombies = [];
    this.plants = [];
    this.projectiles = [];
    this.suns = [];
    this.lawnMowers = [];
    this.tiles = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 9; c++) {
        const tile = new Tile(this.scene, r, c);
        this.tiles.push(tile);
        this.entities.push(tile);
      }
    }
    for (let r = 0; r < 5; r++) {
      const lm = new LawnMower(this.scene, r);
      this.lawnMowers.push(lm);
      this.entities.push(lm);
    }
    this.level = 1;
    this.sun = 50;
    document.getElementById('sun-amount').textContent = this.sun;
    this.selectedPlant = null;
    this.shovelMode = false;
    this.wave = 1;
    this.waveTimer = 0;
    this.zombiesSpawned = 0;
    this.spawnTimer = 0;
    this.sunDropTimer = 2;
    this.zombiesKilledInWave = 0;
    this.waveBarProgress = 0;
    this.flagsTriggered = [false, false];
    this._applyLevelConfig();
    for (const type in this.plantCooldownTimers) this.plantCooldownTimers[type] = 0;
    this._setupWaveBar();
    const levelLabel = document.getElementById('wave-level-label');
    if (levelLabel) levelLabel.textContent = 'Sector 1';
    const fillEl = document.getElementById('wave-bar-fill');
    if (fillEl) fillEl.style.width = '0%';
    const headEl = document.getElementById('wave-head');
    if (headEl) headEl.style.left = '100%';
    this._deselectPlant();
    this._deselectShovel();
    this._clearHoverPreview();
    this.resetCamera();
    this.clock.getDelta();
    // Remove any lingering overlays
    const lc = document.getElementById('level-complete');
    if (lc) lc.remove();
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('start-wave-btn').style.display = 'none';
    document.getElementById('wave-bar-container').style.display = 'flex';
    this.sandboxMode = false;
    // Show start screen
    document.getElementById('start-screen').style.display = 'flex';
  }

  resetCamera() {
    this.cameraTarget.set(1, 0, 0);
    this.camera.position.set(0, 16, 20);
    this.camera.lookAt(1, 0, 0);
    this.cameraSpherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      this.update();
      this.render();
    };
    loop();
  }
}
