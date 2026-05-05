class Plant extends GameObject3D {
  constructor(scene, type, row, col) {
    super(scene);
    this.name = 'Plant';
    this.type = type;
    this.row = row;
    this.col = col;
    this.hp = window.game && window.game.getPlantMaxHp ? window.game.getPlantMaxHp(type) : (type === 'wallnut' ? 1800 : 200);
    this.repeaterSecondShot = 0;
    this.mineArmed = false;
    this.mineArmTimer = 0;
    this.chomperState = 'idle'; // idle, lunging, chewing
    this.chomperTimer = 0;
    this.chomperLungeTarget = null;
    this.maxHp = this.hp;
    this.shootTimer = 0;
    this.sunTimer = 0;
    this.firstSunProduced = false;
    this.shootAnim = 0;
    this.plasmaAnimTime = 0;
    this.plasmaIdleFrame = 0;
    this.plasmaShootFrame = -1;
    this.idlePhase = Math.random() * Math.PI * 2;
    this.hitFlash = 0;
    this.position.set(col * 2 - 8, type === 'potato_mine' ? 0.1 : 0.6, row * 2 - 4);
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const phong = (color, opts = {}) => new THREE.MeshPhongMaterial({
      color,
      shininess: opts.shininess !== undefined ? opts.shininess : 58,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.ei || 0,
      specular: opts.specular || 0x333333,
      reflectivity: opts.reflectivity !== undefined ? opts.reflectivity : 0.28,
      side: opts.side || THREE.FrontSide
    });

    if (this.type === 'peashooter') {
      this._buildPeashooter(group, phong, false);
    } else if (this.type === 'snowpea') {
      this._buildSnowPea(group, phong);
    } else if (this.type === 'sunflower') {
      this._buildSunflower(group, phong);
    } else if (this.type === 'wallnut') {
      this._buildWallnut(group, phong);
    } else if (this.type === 'repeater') {
      this._buildRepeater(group, phong);
    } else if (this.type === 'potato_mine') {
      this._buildPotatoMine(group, phong);
    } else if (this.type === 'chomper') {
      this._buildChomper(group, phong);
    }

    this._addSharedPolish(group);

    group.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.geometry) child.geometry.computeVertexNormals();
      }
    });
    group.castShadow = true;
    this.rotation.y = Math.PI / 2;
    this.mesh = group;
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  _addSharedPolish(group) {
    if (this.type === 'peashooter' || this.type === 'snowpea' || this.type === 'repeater') {
      const glowColor = this.type === 'snowpea' ? 0x5CEAFF : 0x5AFF78;
      const chargeGlow = new THREE.Mesh(
        new THREE.SphereGeometry(this.type === 'peashooter' ? 0.13 : 0.16, 16, 12),
        new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      chargeGlow.position.set(0, this.type === 'peashooter' ? 0.18 : 0.64, this.type === 'peashooter' ? 0.92 : 0.98);
      chargeGlow.scale.set(1.1, 1.1, 0.45);
      group.add(chargeGlow);
      const chargeLight = new THREE.PointLight(glowColor, 0, 1.4);
      chargeLight.position.copy(chargeGlow.position);
      group.add(chargeLight);
      this._chargeGlow = chargeGlow;
      this._chargeLight = chargeLight;
    }

    if (this.type === 'repeater') {
      const antennaMat = new THREE.MeshBasicMaterial({ color: 0xB6FF66, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false });
      const antenna = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), antennaMat);
      antenna.position.set(0, 1.08, 0.14);
      group.add(antenna);
      this._antennaGlow = antenna;
    }
  }

  _addCuteEyes(group, phong, x, y, z, eyeSize, isIce) {
    for (let side = -1; side <= 1; side += 2) {
      // Big white eye
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(eyeSize, 14, 14), phong(0xffffff, { shininess: 90 }));
      eyeW.position.set(side * x, y, z);
      eyeW.scale.set(1, 1.15, 0.9);
      group.add(eyeW);
      // Large colored iris
      const irisColor = isIce ? 0x44AAEE : 0x33AA55;
      const iris = new THREE.Mesh(new THREE.SphereGeometry(eyeSize * 0.6, 10, 10), phong(irisColor, { shininess: 60 }));
      iris.position.set(side * x, y - eyeSize * 0.05, z + eyeSize * 0.6);
      group.add(iris);
      // Dark pupil
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeSize * 0.32, 8, 8), phong(0x111122));
      pupil.position.set(side * x, y - eyeSize * 0.05, z + eyeSize * 0.78);
      group.add(pupil);
      // Big sparkle highlight
      const hl1 = new THREE.Mesh(new THREE.SphereGeometry(eyeSize * 0.2, 6, 6), phong(0xffffff, { emissive: 0xffffff, ei: 0.8 }));
      hl1.position.set(side * (x - eyeSize * 0.2), y + eyeSize * 0.25, z + eyeSize * 0.85);
      group.add(hl1);
      // Small secondary sparkle
      const hl2 = new THREE.Mesh(new THREE.SphereGeometry(eyeSize * 0.1, 4, 4), phong(0xffffff, { emissive: 0xffffff, ei: 0.8 }));
      hl2.position.set(side * (x + eyeSize * 0.15), y - eyeSize * 0.15, z + eyeSize * 0.85);
      group.add(hl2);
      // Cute curved eyelid line on top
      const lid = new THREE.Mesh(new THREE.TorusGeometry(eyeSize * 0.85, eyeSize * 0.06, 6, 12, Math.PI * 0.6), phong(0x228833));
      lid.position.set(side * x, y + eyeSize * 0.5, z + eyeSize * 0.2);
      lid.rotation.z = Math.PI;
      lid.rotation.x = -0.15;
      group.add(lid);
    }
  }

  _addRosyCheeks(group, phong, x, y, z, size) {
    // Blush removed for cleaner look
  }

  _addCuteSmile(group, phong, y, z, size, color) {
    const smile = new THREE.Mesh(new THREE.TorusGeometry(size, size * 0.2, 8, 14, Math.PI), phong(color || 0x1A5A1A));
    smile.position.set(0, y, z);
    smile.rotation.x = Math.PI;
    smile.rotation.z = Math.PI;
    group.add(smile);
    // Little tongue
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(size * 0.45, 6, 6), phong(0xFF7788, { shininess: 50 }));
    tongue.position.set(0, y - size * 0.3, z + 0.01);
    tongue.scale.set(1, 0.6, 0.5);
    group.add(tongue);
  }

  _buildCutePot(group, phong) {
    // Rounded cute pot
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.2, 14), phong(0xCC8855, { shininess: 30 }));
    pot.position.y = -0.4;
    group.add(pot);
    const potRim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 14), phong(0xDD9966));
    potRim.position.y = -0.3;
    potRim.rotation.x = Math.PI / 2;
    group.add(potRim);
    // Cute face on pot - tiny closed eyes
    for (let side = -1; side <= 1; side += 2) {
      const potEye = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 6, 8, Math.PI), phong(0x664422));
      potEye.position.set(side * 0.1, -0.37, 0.23);
      potEye.rotation.z = Math.PI;
      group.add(potEye);
    }
    const potSmile = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 8, Math.PI), phong(0x664422));
    potSmile.position.set(0, -0.42, 0.23);
    potSmile.rotation.x = Math.PI;
    potSmile.rotation.z = Math.PI;
    group.add(potSmile);
    // Dirt with little sprouts
    const dirt = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 12), phong(0x5A3A1A));
    dirt.position.y = -0.29;
    group.add(dirt);
  }

  _buildPeashooter(group, phong, isIce) {
    if (!isIce) {
      this._buildPlasmaPod(group, phong);
      return;
    }

    // ── Alien Peashooter color palette ──
    const HEAD_COLOR   = isIce ? 0x4AABB8 : 0x28BFAE;  // glossy teal head
    const HEAD_SPEC    = isIce ? 0x224455 : 0x112233;  // very low specular
    const SPECKLE_COL  = isIce ? 0xBBEECC : 0xF2D75A;  // yellow paint-like patches
    const STEM_COLOR   = isIce ? 0x3399AA : 0x177F7A;  // teal segmented stem
    const RING_COLOR   = isIce ? 0x2244BB : 0x21E6F2;  // cyan glowing joint rings
    const LEAF_COLOR   = isIce ? 0x44BBCC : 0x1E8C6C;  // glossy green mid leaves
    const BASE_COLOR   = isIce ? 0x55AABB : 0x28AFA0;  // teal bulbous base pods
    const BASE_RING    = 0x111A55;                       // dark navy connector ring
    const PETAL_COLOR  = isIce ? 0xAA88EE : 0xA23BE0;  // purple alien petals
    const PETAL_EDGE   = isIce ? 0x88AAFF : 0x5D28C8;  // darker purple/blue petal edge
    const CANNON_COLOR = isIce ? 0xDDCC55 : 0xF4C133;  // gold cannon barrels
    const CANNON_RIM   = isIce ? 0xEEDD88 : 0xFFE061;
    const CANNON_DARK  = 0x0A0A0A;                      // dark barrel opening
    const COLLAR_COLOR = isIce ? 0x88CCEE : 0x44AACC;  // teal/cyan collar around head base

    // ── Teal bulbous base pods (two round bumps) — matte organic look ──
    for (let side = -1; side <= 1; side += 2) {
      const pod = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 14),
        phong(BASE_COLOR, { shininess: 6, specular: 0x080808 })
      );
      pod.position.set(side * 0.22, -0.38, 0);
      pod.scale.set(1.28, 0.72, 1.04);
      group.add(pod);
      // Speckle patches on pods
      for (let i = 0; i < 4; i++) {
        const sp = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 6, 6),
          phong(SPECKLE_COL, { shininess: 20 })
        );
        const a = (i / 4) * Math.PI * 2;
        sp.position.set(side * 0.22 + Math.cos(a) * 0.18, -0.38 + Math.sin(a) * 0.14, Math.sin(a * 0.5) * 0.12);
        sp.scale.setScalar(0.55);
        group.add(sp);
      }
    }

    // ── Dark navy connector ring at base ──
    const baseRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.21, 0.14, 16),
      phong(BASE_RING, { shininess: 80 })
    );
    baseRing.position.y = -0.26;
    group.add(baseRing);
    // Glowing blue accent on ring
    const baseRingGlow = new THREE.Mesh(
      new THREE.TorusGeometry(0.23, 0.030, 8, 18),
      phong(RING_COLOR, { shininess: 100, emissive: RING_COLOR, ei: 0.5 })
    );
    baseRingGlow.position.y = -0.22;
    baseRingGlow.rotation.x = Math.PI / 2;
    group.add(baseRingGlow);

    // ── Extra leaf cluster at base — gives plant character ──
    for (let side = -1; side <= 1; side += 2) {
      for (let li = 0; li < 2; li++) {
        const bLeaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.20, 10, 7),
          phong(isIce ? 0x3A9AAA : 0x1A7040, { shininess: 5 })
        );
        bLeaf.scale.set(2.2, 0.22, 1.0);
        bLeaf.position.set(side * (0.28 + li * 0.14), -0.50 + li * 0.10, 0.04);
        bLeaf.rotation.z = side * (0.30 + li * 0.20);
        group.add(bLeaf);
        // vein
        const bv = new THREE.Mesh(
          new THREE.CylinderGeometry(0.009, 0.007, 0.36, 4),
          phong(isIce ? 0x206070 : 0x0E4A28, { shininess: 4 })
        );
        bv.rotation.z = Math.PI / 2;
        bv.position.set(side * (0.28 + li * 0.14), -0.50 + li * 0.10, 0.05);
        group.add(bv);
      }
    }

    // ── Segmented teal stem ──
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.20, 0),
      new THREE.Vector3(0.06, 0.02, 0.01),
      new THREE.Vector3(-0.03, 0.22, 0.01),
      new THREE.Vector3(0.0, 0.38, 0)
    ]);
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 16, 0.095, 10, false),
      phong(STEM_COLOR, { shininess: 6, specular: 0x080808 })
    );
    group.add(stem);
    // Speckle patches on stem
    for (let i = 0; i < 5; i++) {
      const t = 0.15 + i * 0.18;
      const pt = stemCurve.getPoint(t);
      const sp = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 6, 6),
        phong(SPECKLE_COL, { shininess: 15 })
      );
      sp.position.copy(pt);
      sp.scale.set(1.4, 0.5, 1.0);
      group.add(sp);
    }
    // Blue glowing joint rings along stem
    const ringTs = [0.25, 0.55, 0.82];
    for (const t of ringTs) {
      const pt = stemCurve.getPoint(t);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.105, 0.022, 7, 14),
        phong(RING_COLOR, { shininess: 100, emissive: RING_COLOR, ei: 0.55 })
      );
      ring.position.copy(pt);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }

    // ── Green mid-stem leaves (2 broad leaves) ──
    for (let side = -1; side <= 1; side += 2) {
      const leafGrp = new THREE.Group();
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 8),
        phong(LEAF_COLOR, { shininess: 30 })
      );
      leaf.scale.set(2.25, 0.38, 1.25);
      leafGrp.add(leaf);
      // Leaf vein
      const vein = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.38, 4),
        phong(0x1A6644)
      );
      vein.rotation.z = Math.PI / 2;
      vein.position.x = 0.06;
      leafGrp.add(vein);
      // Speckle on leaf
      for (let i = 0; i < 3; i++) {
        const lsp = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 5, 5),
          phong(SPECKLE_COL, { shininess: 10 })
        );
        lsp.position.set(side * (0.05 + i * 0.07), 0.02, 0.03);
        lsp.scale.set(1.6, 0.3, 1.2);
        leafGrp.add(lsp);
      }
      leafGrp.position.set(side * 0.24, 0.02, 0.05);
      leafGrp.rotation.z = side * 0.50;
      leafGrp.rotation.y = side * 0.25;
      group.add(leafGrp);
    }

    // ── Teal head — smoother, rounder repeater-like face shape ──
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.50, 34, 30),
      phong(HEAD_COLOR, { shininess: 42, specular: 0x66EEDC, emissive: 0x08645D, ei: 0.08 })
    );
    head.position.y = 0.66;
    head.scale.set(1.0, 0.97, 0.95);
    group.add(head);
    const headSheen = new THREE.Mesh(
      new THREE.SphereGeometry(0.30, 14, 12),
      phong(isIce ? 0x88F7FF : 0x67F0D3, { shininess: 90, specular: 0x88ffff, emissive: isIce ? 0x226677 : 0x116655, ei: 0.12 })
    );
    headSheen.position.set(-0.10, 0.82, 0.31);
    headSheen.scale.set(1.22, 0.70, 0.22);
    headSheen.material.transparent = true;
    headSheen.material.opacity = 0.30;
    group.add(headSheen);
    // Yellow-green speckle blotches on head
    const speckleData = [
      [-0.24, 0.76, 0.35], [-0.18, 0.65, 0.42], [-0.10, 0.84, 0.31],
      [0.12, 0.56, 0.45], [0.22, 0.68, 0.38], [0.02, 0.48, 0.48],
      [-0.28, 0.55, 0.32], [0.08, 0.90, 0.28], [0.28, 0.82, 0.24],
      [-0.04, 0.68, 0.48], [0.20, 0.48, 0.34]
    ];
    for (const [sx, sy, sz] of speckleData) {
      const sp = new THREE.Mesh(
        new THREE.SphereGeometry(0.060 + Math.abs(sx) * 0.055, 7, 7),
        phong(SPECKLE_COL, { shininess: 30, specular: 0xFFF2A0 })
      );
      sp.position.set(sx, sy, sz);
      sp.scale.set(1.55, 0.82, 0.30);
      group.add(sp);
    }

    // ── Teal collar/neck ring where head meets stem ──
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.052, 8, 20),
      phong(COLLAR_COLOR, { shininess: 80, specular: 0xAAFFFF, emissive: RING_COLOR, ei: 0.35 })
    );
    collar.position.y = 0.40;
    collar.rotation.x = Math.PI / 2;
    group.add(collar);

    // ── Repeater-like face: large oval eyes with expressive brows ──
    for (let side = -1; side <= 1; side += 2) {
      // Eye socket recess (slight teal ring)
      const socket = new THREE.Mesh(
        new THREE.SphereGeometry(0.136, 16, 14),
        phong(0x0C6E63, { shininess: 12 })
      );
      socket.position.set(side * 0.175, 0.70, 0.405);
      socket.scale.set(1, 1.18, 0.55);
      group.add(socket);
      // Large black eye
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.110, 18, 16),
        phong(0x020408, { shininess: 100, specular: 0x224455 })
      );
      eye.position.set(side * 0.175, 0.70, 0.440);
      eye.scale.set(1, 1.22, 0.62);
      group.add(eye);
      // Single tiny white sparkle (alien reflection)
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 7, 7),
        phong(0xffffff, { emissive: 0xffffff, ei: 1.0 })
      );
      spark.position.set(side * 0.155, 0.720, 0.480);
      group.add(spark);
      const browCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.055, 0.805, 0.420),
        new THREE.Vector3(side * 0.175, 0.825, 0.405),
        new THREE.Vector3(side * 0.290, 0.765, 0.355)
      ]);
      const brow = new THREE.Mesh(
        new THREE.TubeGeometry(browCurve, 7, 0.026, 8, false),
        phong(0x171006, { shininess: 35, specular: 0x221100 })
      );
      group.add(brow);
    }

    // ── Leaf petals fanning from back/top of head — organic flat leaf look ──
    const petalCount = 8;
    for (let i = 0; i < petalCount; i++) {
      const petalGrp = new THREE.Group();
      // Main petal body — broad flat leaf
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.20, 12, 8),
        phong(PETAL_COLOR, { shininess: 35, specular: 0xCC88FF, emissive: 0x310066, ei: 0.08 })
      );
      petal.scale.set(0.9, 2.15, 0.20);
      petalGrp.add(petal);
      // Darker mid-vein line
      const vein = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 7, 7),
        phong(PETAL_EDGE, { shininess: 30, emissive: 0x1A1177, ei: 0.10 })
      );
      vein.scale.set(0.30, 2.25, 0.10);
      vein.position.y = 0.0;
      petalGrp.add(vein);
      // Subtle lighter edge (no glow)
      const edgeHl = new THREE.Mesh(
        new THREE.SphereGeometry(0.10, 7, 7),
        phong(isIce ? 0x88CCDD : 0x7D78FF, { shininess: 60, emissive: 0x2222AA, ei: 0.20 })
      );
      edgeHl.scale.set(0.22, 1.85, 0.08);
      edgeHl.position.set(0.14, 0.0, 0.0);
      petalGrp.add(edgeHl);

      // Fan petals in a wide arc behind/above the head
      const spanAngle = Math.PI * 1.35;
      const startAngle = -spanAngle / 2 + Math.PI / 2;
      const a = startAngle + (i / (petalCount - 1)) * spanAngle;
      const radius = 0.53;
      petalGrp.position.set(
        Math.cos(a) * radius,
        0.62 + Math.sin(a) * radius,
        -0.13
      );
      petalGrp.rotation.z = a - Math.PI / 2;
      group.add(petalGrp);
      const petalRib = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(a) * (radius - 0.02), 0.62 + Math.sin(a) * (radius - 0.02), -0.05),
          new THREE.Vector3(Math.cos(a) * (radius + 0.08), 0.62 + Math.sin(a) * (radius + 0.08), -0.035)
        ]), 3, 0.008, 4, false),
        phong(isIce ? 0x53DDEB : 0x662A99, { shininess: 20, emissive: isIce ? 0x114466 : 0x220044, ei: 0.08 })
      );
      group.add(petalRib);
    }

    for (let i = 0; i < 4; i++) {
      const a = -Math.PI * 0.55 + (i / 3) * Math.PI * 1.10 + Math.PI / 2;
      const smallPetal = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 10, 7),
        phong(0xC04DF0, { shininess: 40, specular: 0xDD99FF, emissive: 0x3A0066, ei: 0.08 })
      );
      smallPetal.scale.set(0.78, 1.45, 0.18);
      smallPetal.position.set(Math.cos(a) * 0.38, 0.62 + Math.sin(a) * 0.38, -0.05);
      smallPetal.rotation.z = a - Math.PI / 2;
      group.add(smallPetal);
    }

    // ── Single centered cannon barrel — repeater-like face silhouette ──
    const cannonGrp = new THREE.Group();
    const barrelLength = 0.62;
    const connector = new THREE.Mesh(
      new THREE.CylinderGeometry(0.155, 0.190, 0.24, 22),
      phong(COLLAR_COLOR, { shininess: 58, specular: 0xAAFFFF, emissive: RING_COLOR, ei: 0.12 })
    );
    connector.rotation.x = Math.PI / 2;
    connector.position.z = -0.18;
    cannonGrp.add(connector);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.150, 0.205, barrelLength, 28),
      phong(CANNON_COLOR, { shininess: 115, specular: 0xFFF0AA })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.12;
    cannonGrp.add(barrel);

    for (let r = 0; r < 4; r++) {
      const ridge = new THREE.Mesh(
        new THREE.TorusGeometry(0.186 - r * 0.008, 0.020, 8, 22),
        phong(CANNON_RIM, { shininess: 120, specular: 0xFFF8CC })
      );
      ridge.position.z = -0.08 + r * 0.125;
      ridge.rotation.x = Math.PI / 2;
      cannonGrp.add(ridge);
    }

    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.118, 0.118, 0.085, 22),
      phong(CANNON_DARK, { shininess: 8 })
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.z = 0.455;
    cannonGrp.add(muzzle);

    const muzzleRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.205, 0.158, 0.080, 28),
      phong(CANNON_RIM, { shininess: 130, specular: 0xFFF8CC })
    );
    muzzleRing.rotation.x = Math.PI / 2;
    muzzleRing.position.z = 0.420;
    cannonGrp.add(muzzleRing);

    const lipHighlight = new THREE.Mesh(
      new THREE.TorusGeometry(0.176, 0.012, 8, 24),
      phong(0xFFF4A6, { shininess: 140, specular: 0xFFFFFF, emissive: 0x5A4200, ei: 0.06 })
    );
    lipHighlight.position.z = 0.465;
    lipHighlight.rotation.x = Math.PI / 2;
    cannonGrp.add(lipHighlight);

    cannonGrp.position.set(0, 0.60, 0.62);
    group.add(cannonGrp);

    // ── Ice crystals overlay for snowpea variant ──
    if (isIce) {
      for (let i = 0; i < 5; i++) {
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.045, 0),
          phong(0xCCEEFF, { shininess: 18, specular: 0x556677, emissive: 0x224466, ei: 0.10 })
        );
        const a = (i / 5) * Math.PI * 2;
        crystal.position.set(Math.cos(a) * 0.42, 0.68 + Math.sin(i * 1.4) * 0.08, Math.sin(a) * 0.22);
        crystal.rotation.set(i * 0.8, i * 0.5, 0);
        group.add(crystal);
      }
    }
  }

  _buildPlasmaPod(group, phong) {
    const HEAD = 0xF01899;
    const HEAD_DARK = 0x5B0B60;
    const HEAD_LIGHT = 0xFF67BF;
    const BARREL = 0xEA1A97;
    const BARREL_RIM = 0xFF5FBA;
    const BARREL_INNER = 0x100014;
    const STEM = 0x1E6B22;
    const STEM_DARK = 0x073111;
    const LEAF = 0x55B714;
    const LEAF_DARK = 0x17680D;
    const LEAF_LIGHT = 0x88E02A;

    const rigRoot = new THREE.Group();
    group.add(rigRoot);

    const makeLeaf = (length, width, color = LEAF) => {
      const leafGroup = new THREE.Group();
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 18, 12),
        phong(color, { shininess: 36, specular: 0x224411, emissive: 0x103600, ei: 0.04 })
      );
      leaf.scale.set(width, length, 0.18);
      leafGroup.add(leaf);

      const vein = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -0.24 * length, 0.035),
          new THREE.Vector3(0.018, -0.02 * length, 0.045),
          new THREE.Vector3(0, 0.25 * length, 0.035)
        ]), 7, 0.010, 5, false),
        phong(LEAF_DARK, { shininess: 12 })
      );
      leafGroup.add(vein);

      const shine = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 10, 8),
        phong(LEAF_LIGHT, { shininess: 60, emissive: LEAF_LIGHT, ei: 0.05 })
      );
      shine.scale.set(width * 0.55, length * 0.22, 0.08);
      shine.position.set(-0.03, length * 0.10, 0.05);
      shine.material.transparent = true;
      shine.material.opacity = 0.38;
      leafGroup.add(shine);
      return leafGroup;
    };

    const baseShadow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.62, 0.055, 28),
      phong(0x0A2608, { shininess: 8, specular: 0x000000 })
    );
    baseShadow.position.y = -0.58;
    baseShadow.scale.z = 0.72;
    rigRoot.add(baseShadow);

    const baseLeaves = [
      [-0.42, -0.45, 0.04, -0.82, 1.55, 1.95, LEAF],
      [0.42, -0.45, 0.04, 0.82, 1.55, 1.95, LEAF],
      [-0.18, -0.50, 0.16, -0.38, 1.30, 1.50, LEAF_DARK],
      [0.18, -0.50, 0.16, 0.38, 1.30, 1.50, LEAF_DARK],
      [0.00, -0.42, -0.12, 0.02, 1.32, 1.75, 0x3D9F10]
    ];
    const leafGroups = [];
    for (const [x, y, z, rz, len, wid, color] of baseLeaves) {
      const leaf = makeLeaf(len, wid, color);
      leaf.position.set(x, y, z);
      leaf.rotation.z = rz;
      leaf.rotation.y = -rz * 0.16;
      rigRoot.add(leaf);
      leafGroups.push({ node: leaf, baseZ: rz, baseY: y });
    }

    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.45, 0.02),
      new THREE.Vector3(0.05, -0.12, 0.00),
      new THREE.Vector3(-0.06, 0.22, 0.02),
      new THREE.Vector3(0.00, 0.55, 0.04)
    ]);
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 24, 0.075, 12, false),
      phong(STEM, { shininess: 28, specular: 0x225522, emissive: 0x062A0A, ei: 0.04 })
    );
    rigRoot.add(stem);

    const stemShade = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 24, 0.032, 8, false),
      phong(STEM_DARK, { shininess: 12 })
    );
    stemShade.position.set(-0.030, -0.01, -0.035);
    rigRoot.add(stemShade);

    const neckLeaves = [];
    for (let side = -1; side <= 1; side += 2) {
      const neckLeaf = makeLeaf(0.78, 0.74, side < 0 ? LEAF_DARK : LEAF);
      neckLeaf.position.set(side * 0.15, 0.45, 0.01);
      neckLeaf.rotation.z = side * 0.62;
      neckLeaf.rotation.y = side * 0.18;
      rigRoot.add(neckLeaf);
      neckLeaves.push({ node: neckLeaf, baseZ: neckLeaf.rotation.z });
    }

    const headGroup = new THREE.Group();
    headGroup.position.set(-0.02, 0.77, 0.15);
    rigRoot.add(headGroup);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 38, 32),
      phong(HEAD, { shininess: 78, specular: 0xFF8CCC, emissive: 0x4C063A, ei: 0.12 })
    );
    head.scale.set(1.35, 0.92, 0.88);
    headGroup.add(head);

    const headShade = new THREE.Mesh(
      new THREE.SphereGeometry(0.39, 20, 16),
      phong(HEAD_DARK, { shininess: 18, specular: 0x220022 })
    );
    headShade.position.set(-0.10, -0.17, 0.02);
    headShade.scale.set(1.20, 0.44, 0.38);
    headShade.material.transparent = true;
    headShade.material.opacity = 0.56;
    headGroup.add(headShade);

    const headGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12),
      phong(HEAD_LIGHT, { shininess: 110, specular: 0xFFFFFF, emissive: HEAD_LIGHT, ei: 0.16 })
    );
    headGlow.position.set(-0.13, 0.15, 0.34);
    headGlow.scale.set(1.45, 0.55, 0.16);
    headGlow.material.transparent = true;
    headGlow.material.opacity = 0.46;
    headGroup.add(headGlow);

    for (let side = -1; side <= 1; side += 2) {
      const eyeSocket = new THREE.Mesh(
        new THREE.SphereGeometry(0.135, 18, 16),
        phong(0x7B0C82, { shininess: 65, specular: 0xCC55DD, emissive: 0x250024, ei: 0.05 })
      );
      eyeSocket.position.set(side * 0.255, 0.125, 0.485);
      eyeSocket.scale.set(0.86, 1.18, 0.34);
      headGroup.add(eyeSocket);

      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.113, 20, 18),
        phong(0x050009, { shininess: 100, specular: 0x442266 })
      );
      eye.position.set(side * 0.255, 0.125, 0.525);
      eye.scale.set(0.82, 1.18, 0.38);
      headGroup.add(eye);

      const eyeSpark = new THREE.Mesh(
        new THREE.SphereGeometry(0.024, 8, 8),
        phong(0xFFFFFF, { shininess: 120, emissive: 0xFFFFFF, ei: 1.0 })
      );
      eyeSpark.position.set(side * 0.232, 0.184, 0.555);
      headGroup.add(eyeSpark);

      const brow = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.150, 0.265, 0.470),
          new THREE.Vector3(side * 0.255, 0.318, 0.505),
          new THREE.Vector3(side * 0.360, 0.265, 0.470)
        ]), 8, 0.020, 8, false),
        phong(0x180013, { shininess: 28 })
      );
      headGroup.add(brow);
    }

    const barrelGroup = new THREE.Group();
    barrelGroup.position.set(0, -0.005, 0.34);
    headGroup.add(barrelGroup);

    const throat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.205, 0.265, 0.38, 32),
      phong(BARREL, { shininess: 78, specular: 0xFF91D4, emissive: 0x4C063A, ei: 0.08 })
    );
    throat.rotation.x = Math.PI / 2;
    throat.position.z = 0.05;
    throat.scale.x = 0.78;
    barrelGroup.add(throat);

    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.245, 0.205, 0.30, 36),
      phong(BARREL, { shininess: 86, specular: 0xFFA7DD, emissive: 0x5C0641, ei: 0.10 })
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.z = 0.30;
    muzzle.scale.x = 0.82;
    barrelGroup.add(muzzle);

    const rimOuter = new THREE.Mesh(
      new THREE.TorusGeometry(0.245, 0.040, 12, 36),
      phong(BARREL_RIM, { shininess: 125, specular: 0xFFFFFF, emissive: 0x6E004B, ei: 0.16 })
    );
    rimOuter.position.z = 0.455;
    rimOuter.rotation.x = Math.PI / 2;
    barrelGroup.add(rimOuter);

    const rimInner = new THREE.Mesh(
      new THREE.TorusGeometry(0.165, 0.026, 10, 28),
      phong(0xC70F83, { shininess: 95, specular: 0xFFAAEE })
    );
    rimInner.position.z = 0.462;
    rimInner.rotation.x = Math.PI / 2;
    barrelGroup.add(rimInner);

    const mouth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.150, 0.150, 0.060, 28),
      phong(BARREL_INNER, { shininess: 4, specular: 0x000000 })
    );
    mouth.rotation.x = Math.PI / 2;
    mouth.position.z = 0.490;
    barrelGroup.add(mouth);

    const rimHighlight = new THREE.Mesh(
      new THREE.TorusGeometry(0.222, 0.012, 8, 30),
      phong(0xFF92D2, { shininess: 140, specular: 0xFFFFFF, emissive: 0x5E0041, ei: 0.12 })
    );
    rimHighlight.position.set(-0.018, 0.045, 0.476);
    rimHighlight.rotation.x = Math.PI / 2;
    rimHighlight.scale.set(0.94, 0.74, 1);
    barrelGroup.add(rimHighlight);

    const shootGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xFF55C4, transparent: true, opacity: 0 })
    );
    shootGlow.position.z = 0.535;
    shootGlow.scale.set(1.15, 1.15, 0.45);
    barrelGroup.add(shootGlow);

    this._plasmaPodRig = {
      root: rigRoot,
      stem,
      stemBaseScale: stem.scale.clone(),
      stemShade,
      stemShadeBaseScale: stemShade.scale.clone(),
      headGroup,
      headBase: headGroup.position.clone(),
      headBaseScale: headGroup.scale.clone(),
      barrelGroup,
      barrelBase: barrelGroup.position.clone(),
      barrelBaseScale: barrelGroup.scale.clone(),
      mouth,
      mouthBaseScale: mouth.scale.clone(),
      shootGlow,
      leafGroups,
      neckLeaves
    };
  }

  _buildSnowPea(group, phong) {
    const HEAD_COLOR = 0x16C6B9;
    const HEAD_DARK = 0x08606D;
    const HEAD_LIGHT = 0x69F2C8;
    const LEAF_DARK = 0x073F5A;
    const LEAF_MID = 0x0C8B80;
    const LEAF_LIGHT = 0x55E8A6;
    const STEM_COLOR = 0x0F6F52;
    const STEM_DARK = 0x052E35;
    const RIM_COLOR = 0x4EF2BD;
    const MOUTH_DARK = 0x02131C;

    const makeLeaf = (length, width, color, lightColor) => {
      const g = new THREE.Group();
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 18, 12),
        phong(color, { shininess: 24, specular: 0x226666, emissive: color, ei: 0.03 })
      );
      leaf.scale.set(width, length, 0.20);
      g.add(leaf);
      const vein = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -0.22 * length, 0.035),
          new THREE.Vector3(0.015, 0, 0.045),
          new THREE.Vector3(0, 0.25 * length, 0.035)
        ]), 6, 0.010, 5, false),
        phong(lightColor, { shininess: 35, emissive: lightColor, ei: 0.12 })
      );
      g.add(vein);
      return g;
    };

    const baseLeaves = [
      [-0.36, -0.44, -0.10, -0.55, 1.6, 1.8],
      [0.36, -0.44, -0.10, 0.55, 1.6, 1.8],
      [-0.18, -0.50, 0.08, -0.25, 1.3, 1.5],
      [0.18, -0.50, 0.08, 0.25, 1.3, 1.5]
    ];
    for (const [x, y, z, rz, len, wid] of baseLeaves) {
      const leaf = makeLeaf(len, wid, LEAF_DARK, LEAF_LIGHT);
      leaf.position.set(x, y, z);
      leaf.rotation.z = rz;
      group.add(leaf);
    }

    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.42, 0),
      new THREE.Vector3(0.08, -0.12, 0.02),
      new THREE.Vector3(-0.04, 0.22, 0.01),
      new THREE.Vector3(0.03, 0.58, 0)
    ]);
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 20, 0.070, 10, false),
      phong(STEM_COLOR, { shininess: 20, specular: 0x225544 })
    );
    group.add(stem);
    const stemShadow = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 20, 0.030, 7, false),
      phong(STEM_DARK, { shininess: 10 })
    );
    stemShadow.position.z = -0.035;
    group.add(stemShadow);

    for (let side = -1; side <= 1; side += 2) {
      const curlCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.06, -0.05, 0),
        new THREE.Vector3(side * 0.28, 0.08, 0.01),
        new THREE.Vector3(side * 0.42, 0.24, 0),
        new THREE.Vector3(side * 0.36, 0.38, 0),
        new THREE.Vector3(side * 0.24, 0.36, 0)
      ]);
      const curl = new THREE.Mesh(
        new THREE.TubeGeometry(curlCurve, 14, 0.022, 6, false),
        phong(STEM_DARK, { shininess: 18 })
      );
      group.add(curl);
    }

    for (let side = -1; side <= 1; side += 2) {
      const highCurlCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.12, 0.46, -0.02),
        new THREE.Vector3(side * 0.42, 0.68, -0.03),
        new THREE.Vector3(side * 0.64, 0.88, -0.04),
        new THREE.Vector3(side * 0.58, 1.05, -0.04),
        new THREE.Vector3(side * 0.42, 1.02, -0.04)
      ]);
      const highCurl = new THREE.Mesh(
        new THREE.TubeGeometry(highCurlCurve, 16, 0.016, 5, false),
        phong(STEM_DARK, { shininess: 16 })
      );
      group.add(highCurl);
    }

    const fanData = [
      [-0.42, 0.82, -0.08, -0.85, 2.0, 1.0, LEAF_DARK],
      [-0.26, 0.95, -0.10, -0.46, 2.35, 1.0, LEAF_MID],
      [0.00, 1.05, -0.12, 0.00, 2.95, 1.08, LEAF_LIGHT],
      [0.28, 0.95, -0.10, 0.48, 2.25, 0.98, LEAF_MID],
      [0.45, 0.78, -0.08, 0.92, 1.85, 0.88, LEAF_DARK],
      [-0.54, 0.60, -0.07, -1.20, 1.65, 0.90, LEAF_MID],
      [0.53, 0.60, -0.07, 1.18, 1.55, 0.86, LEAF_MID]
    ];
    for (const [x, y, z, rz, len, wid, color] of fanData) {
      const leaf = makeLeaf(len, wid, color, LEAF_LIGHT);
      leaf.position.set(x, y, z);
      leaf.rotation.z = rz;
      leaf.rotation.y = -rz * 0.15;
      group.add(leaf);
    }

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 32, 28),
      phong(HEAD_COLOR, { shininess: 38, specular: 0x55DDE0, emissive: 0x087A72, ei: 0.10 })
    );
    head.position.set(0.12, 0.68, 0.20);
    head.scale.set(1.03, 0.98, 0.88);
    group.add(head);
    const headShade = new THREE.Mesh(
      new THREE.SphereGeometry(0.30, 16, 12),
      phong(HEAD_DARK, { shininess: 15 })
    );
    headShade.position.set(0.02, 0.55, 0.02);
    headShade.scale.set(0.85, 0.60, 0.35);
    headShade.material.transparent = true;
    headShade.material.opacity = 0.45;
    group.add(headShade);
    const headGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      phong(HEAD_LIGHT, { shininess: 90, specular: 0xAAFFFF, emissive: HEAD_LIGHT, ei: 0.22 })
    );
    headGlow.position.set(-0.02, 0.78, 0.42);
    headGlow.scale.set(1.1, 0.65, 0.22);
    headGlow.material.transparent = true;
    headGlow.material.opacity = 0.34;
    group.add(headGlow);

    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.070, 12, 12),
      phong(0x01131A, { shininess: 60, specular: 0x112233 })
    );
    eye.position.set(-0.10, 0.72, 0.50);
    eye.scale.set(0.78, 1.15, 0.55);
    group.add(eye);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.215, 0.54, 28),
      phong(HEAD_COLOR, { shininess: 44, specular: 0x66FFFF, emissive: 0x0E8F82, ei: 0.08 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.68, 0.56);
    group.add(barrel);
    const barrelBase = new THREE.Mesh(
      new THREE.TorusGeometry(0.205, 0.024, 8, 22),
      phong(HEAD_DARK, { shininess: 48, specular: 0x338888 })
    );
    barrelBase.position.set(0, 0.68, 0.31);
    group.add(barrelBase);
    const barrelRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.205, 0.040, 12, 28),
      phong(RIM_COLOR, { shininess: 90, specular: 0xAAFFFF, emissive: RIM_COLOR, ei: 0.25 })
    );
    barrelRim.position.set(0, 0.68, 0.83);
    group.add(barrelRim);
    const barrelInner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.122, 0.122, 0.065, 22),
      phong(MOUTH_DARK, { shininess: 5 })
    );
    barrelInner.rotation.x = Math.PI / 2;
    barrelInner.position.set(0, 0.68, 0.865);
    group.add(barrelInner);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.23, 0.035, 8, 20),
      phong(RIM_COLOR, { shininess: 80, emissive: RIM_COLOR, ei: 0.18 })
    );
    collar.position.set(0.10, 0.48, 0.08);
    collar.rotation.x = Math.PI / 2;
    group.add(collar);
  }

  _buildSunflower(group, phong) {
    // Color palette — warm Solar Bloom tones
    const BASE_COLOR   = 0x5A1130;
    const STEM_COLOR   = 0x8A1E22;
    const PETAL_DARK   = 0x8A123D;
    const PETAL_MID    = 0xD72655;
    const PETAL_LIGHT  = 0xFF7A1A;
    const FACE_COLOR   = 0xFF3D88;
    const FACE_DARK    = 0xB51342;
    const DOT_COLOR    = 0xFF9A18;
    const ORB_COLOR    = 0xFF4B2E;
    const ARM_COLOR    = 0x7A1C20;
    const ROOT_COLOR   = 0x4A1118;
    const OUTLINE      = 0x19040A;

    const leafMaterial = (color, glow = 0) => new THREE.MeshPhongMaterial({
      color,
      shininess: 14,
      specular: 0x441020,
      emissive: color,
      emissiveIntensity: glow,
      side: THREE.DoubleSide
    });

    const createPetal = (color, outlineColor, dotColor, length, width, glow) => {
      const petalGrp = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.52);
      shape.bezierCurveTo(-0.46, -0.30, -0.46, 0.22, 0, 0.58);
      shape.bezierCurveTo(0.46, 0.22, 0.46, -0.30, 0, -0.52);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 1 });
      geo.center();

      const outline = new THREE.Mesh(geo, phong(outlineColor, { shininess: 4, specular: 0x000000 }));
      outline.scale.set(width * 1.14, length * 1.09, 1.5);
      outline.position.z = -0.012;
      petalGrp.add(outline);

      const petal = new THREE.Mesh(geo, leafMaterial(color, glow));
      petal.scale.set(width, length, 1);
      petal.position.z = 0.012;
      petalGrp.add(petal);

      const veinCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.38 * length, 0.045),
        new THREE.Vector3(0.02 * width, -0.08 * length, 0.052),
        new THREE.Vector3(-0.015 * width, 0.20 * length, 0.052),
        new THREE.Vector3(0, 0.42 * length, 0.045)
      ]);
      const vein = new THREE.Mesh(
        new THREE.TubeGeometry(veinCurve, 8, 0.008, 5, false),
        phong(0x5A0B1A, { shininess: 5 })
      );
      petalGrp.add(vein);

      for (let i = -1; i <= 1; i += 2) {
        const sideVein = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.0, -0.06 * length, 0.05),
            new THREE.Vector3(i * 0.10 * width, 0.04 * length, 0.052),
            new THREE.Vector3(i * 0.20 * width, 0.17 * length, 0.05)
          ]), 5, 0.0045, 4, false),
          phong(0x76102A, { shininess: 4 })
        );
        petalGrp.add(sideVein);
      }

      const dew = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 9, 9),
        phong(dotColor, { shininess: 120, specular: 0xFFD18A, emissive: dotColor, ei: 0.65 })
      );
      dew.position.set(width * 0.14, length * 0.15, 0.075);
      dew.scale.set(0.86, 1.05, 0.75);
      petalGrp.add(dew);

      const dewHighlight = new THREE.Mesh(
        new THREE.SphereGeometry(0.010, 6, 6),
        phong(0xffffff, { shininess: 120, emissive: 0xffffff, ei: 0.9 })
      );
      dewHighlight.position.set(width * 0.125, length * 0.17, 0.104);
      petalGrp.add(dewHighlight);

      return petalGrp;
    };

    // ── Dark teal oval base (replaces pot) ──
    const base = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      phong(BASE_COLOR, { shininess: 40, specular: 0x7A2440 })
    );
    base.position.y = -0.42;
    base.scale.set(1.3, 0.55, 1.1);
    base.rotation.x = Math.PI;
    group.add(base);

    // Base rim ring
    const baseRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.035, 8, 18),
      phong(0x3A0918, { shininess: 30 })
    );
    baseRim.position.y = -0.42;
    baseRim.rotation.x = Math.PI / 2;
    baseRim.scale.set(1.3, 1, 1.1);
    group.add(baseRim);

    // ── Curling roots (6 tendrils) ──
    const rootAngles = [0, 0.6, 1.2, Math.PI, Math.PI + 0.6, Math.PI + 1.2];
    for (let i = 0; i < rootAngles.length; i++) {
      const a = rootAngles[i];
      const curl = i % 2 === 0 ? 1 : -1;
      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.15, -0.38, Math.sin(a) * 0.10),
        new THREE.Vector3(Math.cos(a) * 0.30, -0.50, Math.sin(a) * 0.18),
        new THREE.Vector3(Math.cos(a) * 0.45, -0.56, Math.sin(a) * 0.25),
        new THREE.Vector3(Math.cos(a) * 0.55 + curl * 0.08, -0.58, Math.sin(a) * 0.30)
      ]);
      const root = new THREE.Mesh(
        new THREE.TubeGeometry(rootCurve, 8, 0.028, 6, false),
        phong(ROOT_COLOR, { shininess: 15 })
      );
      group.add(root);
    }

    // ── Twisted main stem ──
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.38, 0),
      new THREE.Vector3(0.06, -0.10, 0.02),
      new THREE.Vector3(-0.04, 0.18, 0.01),
      new THREE.Vector3(0.03, 0.38, 0)
    ]);
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 18, 0.085, 10, false),
      phong(STEM_COLOR, { shininess: 20 })
    );
    group.add(stem);

    // Stem highlight stripe
    const stemHlCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.015, -0.35, 0.06),
      new THREE.Vector3(0.06, -0.05, 0.06),
      new THREE.Vector3(-0.02, 0.22, 0.06),
      new THREE.Vector3(0.03, 0.38, 0.06)
    ]);
    const stemHl = new THREE.Mesh(
      new THREE.TubeGeometry(stemHlCurve, 14, 0.018, 6, false),
      phong(0xD64A24, { shininess: 25 })
    );
    group.add(stemHl);

    // ── Side arm LEFT — curvy vine with orb ──
    const lArmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.10, 0),
      new THREE.Vector3(-0.18, 0.05, 0.02),
      new THREE.Vector3(-0.38, 0.02, 0.03),
      new THREE.Vector3(-0.52, 0.08, 0.02),
      new THREE.Vector3(-0.62, 0.18, 0)
    ]);
    const lArm = new THREE.Mesh(
      new THREE.TubeGeometry(lArmCurve, 12, 0.038, 8, false),
      phong(ARM_COLOR, { shininess: 18 })
    );
    group.add(lArm);
    // Left orb
    const lOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 14, 14),
      phong(ORB_COLOR, { shininess: 8, specular: 0x080808 })
    );
    lOrb.position.set(-0.62, 0.18, 0);
    group.add(lOrb);
    // Hex pattern cells on orb (subtle darker spots)
    for (let i = 0; i < 8; i++) {
      const cell = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 6, 6),
        phong(0xFF8A18, { shininess: 60 })
      );
      const ca = (i / 8) * Math.PI * 2;
      const cp = Math.PI * 0.35;
      cell.position.set(
        -0.62 + Math.sin(cp) * Math.cos(ca) * 0.14,
        0.18 + Math.cos(cp) * 0.14,
        Math.sin(cp) * Math.sin(ca) * 0.14
      );
      cell.scale.setScalar(0.55);
      group.add(cell);
    }

    // ── Side arm RIGHT ──
    const rArmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.10, 0),
      new THREE.Vector3(0.18, 0.05, 0.02),
      new THREE.Vector3(0.38, 0.02, 0.03),
      new THREE.Vector3(0.52, 0.08, 0.02),
      new THREE.Vector3(0.62, 0.18, 0)
    ]);
    const rArm = new THREE.Mesh(
      new THREE.TubeGeometry(rArmCurve, 12, 0.038, 8, false),
      phong(ARM_COLOR, { shininess: 18 })
    );
    group.add(rArm);
    // Right orb
    const rOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 14, 14),
      phong(ORB_COLOR, { shininess: 8, specular: 0x080808 })
    );
    rOrb.position.set(0.62, 0.18, 0);
    group.add(rOrb);
    for (let i = 0; i < 8; i++) {
      const cell = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 6, 6),
        phong(0xFF8A18, { shininess: 60 })
      );
      const ca = (i / 8) * Math.PI * 2;
      const cp = Math.PI * 0.35;
      cell.position.set(
        0.62 + Math.sin(cp) * Math.cos(ca) * 0.14,
        0.18 + Math.cos(cp) * 0.14,
        Math.sin(cp) * Math.sin(ca) * 0.14
      );
      cell.scale.setScalar(0.55);
      group.add(cell);
    }

    // ── Layered leaf-petal crown, flatter and more realistic like the reference ──
    const addPetalRing = (count, radiusX, radiusY, yCenter, z, color, length, width, angleOffset, glow) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + angleOffset;
        const petalGrp = createPetal(color, OUTLINE, DOT_COLOR, length, width, glow);
        petalGrp.position.set(Math.cos(a) * radiusX, yCenter + Math.sin(a) * radiusY, z);
        petalGrp.rotation.z = a - Math.PI / 2;
        petalGrp.rotation.x = Math.sin(a) * 0.12;
        petalGrp.rotation.y = -Math.cos(a) * 0.08;
        group.add(petalGrp);
      }
    };
    addPetalRing(11, 0.56, 0.52, 0.62, -0.07, PETAL_DARK, 0.50, 0.18, -0.08, 0.02);
    addPetalRing(10, 0.48, 0.44, 0.62, -0.01, PETAL_MID, 0.44, 0.16, Math.PI / 10, 0.04);
    addPetalRing(8, 0.38, 0.35, 0.63, 0.055, PETAL_LIGHT, 0.35, 0.13, Math.PI / 8, 0.07);

    // ── FACE — warm fuchsia sphere ──
    const face = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 28, 24),
      phong(FACE_COLOR, { shininess: 22, specular: 0x7A2440, emissive: 0xD61D5D, ei: 0.12 })
    );
    face.position.y = 0.62;
    face.scale.set(1.02, 0.98, 0.82);
    group.add(face);

    const faceGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.348, 24, 18),
      new THREE.MeshPhongMaterial({ color: 0xFF6A9E, transparent: true, opacity: 0.18, shininess: 40, emissive: 0xFF2A5F, emissiveIntensity: 0.25 })
    );
    faceGlow.position.y = 0.62;
    faceGlow.scale.set(1.05, 1.01, 0.85);
    group.add(faceGlow);

    // Crater/spot texture on face
    const spotPositions = [
      [-0.20, 0.49, 0.23, 0.040], [-0.23, 0.58, 0.25, 0.032],
      [-0.20, 0.66, 0.25, 0.025], [-0.13, 0.45, 0.24, 0.030],
      [0.18, 0.53, 0.23, 0.022], [0.12, 0.74, 0.22, 0.018]
    ];
    for (const [sx, sy, sz, size] of spotPositions) {
      const spot = new THREE.Mesh(
        new THREE.SphereGeometry(size, 8, 8),
        phong(FACE_DARK, { shininess: 18, specular: 0x5A1626 })
      );
      spot.position.set(sx, sy, sz);
      spot.scale.set(1.05, 0.9, 0.28);
      group.add(spot);
    }

    // ── Eyes — black, cartoon-style ──
    for (let side = -1; side <= 1; side += 2) {
      // White sclera
      const eyeW = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 12, 12),
        phong(0xffffff, { shininess: 80 })
      );
      eyeW.position.set(side * 0.12, 0.68, 0.27);
      eyeW.scale.set(1, 1.1, 0.75);
      group.add(eyeW);
      // Large black iris+pupil
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.062, 10, 10),
        phong(0x0A0A0A, { shininess: 120, specular: 0x222244 })
      );
      pupil.position.set(side * 0.12, 0.675, 0.305);
      group.add(pupil);
      // White sparkle
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 6, 6),
        phong(0xffffff, { emissive: 0xffffff, ei: 0.9 })
      );
      spark.position.set(side * 0.108, 0.692, 0.318);
      group.add(spark);
      // Curved brow (slightly raised on inner side = friendly)
      const brow = new THREE.Mesh(
        new THREE.TorusGeometry(0.055, 0.014, 6, 10, Math.PI * 0.55),
        phong(0x0A0A0A)
      );
      brow.position.set(side * 0.12, 0.755, 0.255);
      brow.rotation.z = side > 0 ? 0.35 : -0.35;
      brow.rotation.x = -0.2;
      group.add(brow);
    }

    // ── Smile ──
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.065, 0.018, 8, 14, Math.PI * 0.75),
      phong(0x0A0A0A)
    );
    smile.position.set(0, 0.58, 0.295);
    smile.rotation.z = Math.PI + 0.2;
    smile.rotation.x = -0.1;
    group.add(smile);
  }

  _buildRepeater(group, phong) {
    // ── Color palette — organic plant tones ──
    const HEAD_COLOR   = 0x6AAE10;  // yellow-green head — slightly muted
    const HEAD_DARK    = 0x5A9810;  // darker green shading on head
    const SPOT_COLOR   = 0x4A7A0C;  // dark green spots on head
    const STEM_COLOR   = 0x5AB010;  // medium green stem
    const LEAF_COLOR   = 0x4A9A0A;  // dark green side leaves
    const LEAF_LIGHT   = 0x6CC018;  // lighter highlight on leaves
    const LEAF_VEIN    = 0x2A6008;  // very dark leaf vein
    const ROOT_COLOR   = 0x4A9A0A;  // green curling root tendrils
    const ROOT_TIP     = 0x3A7808;  // darker tip of tendrils
    const TUBE_COLOR   = 0x5AB010;  // green cannon barrel
    const TUBE_RIM     = 0x6CC018;  // lighter cannon rim
    const TUBE_DARK    = 0x060A02;  // dark barrel opening
    const PLUME_STEM   = 0x8B1A3A;  // dark maroon plume stem
    const PLUME_BRIGHT = 0xE8185A;  // hot pink outer plume petals
    const PLUME_MID    = 0xC41448;  // deeper pink inner plume
    const PLUME_TIP    = 0xFF4488;  // bright pink petal tip highlight
    const BROW_COLOR   = 0x1A0800;  // near-black angry brows
    const OUTLINE      = 0x081500;  // dark green/black outline accents

    // ── Curling octopus-like root tendrils (8 roots radiating outward) ──
    const rootAngles = [0, 0.42, 0.9, 1.38, Math.PI, Math.PI + 0.42, Math.PI + 0.9, Math.PI + 1.38];
    for (let i = 0; i < rootAngles.length; i++) {
      const a = rootAngles[i];
      const curl = (i % 2 === 0) ? 1 : -1;
      const spread = 0.62 + (i % 3) * 0.08;
      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.10, -0.30, Math.sin(a) * 0.08),
        new THREE.Vector3(Math.cos(a) * 0.30, -0.42, Math.sin(a) * 0.20),
        new THREE.Vector3(Math.cos(a) * 0.50, -0.52, Math.sin(a) * 0.34),
        new THREE.Vector3(Math.cos(a) * spread, -0.58, Math.sin(a) * (spread * 0.55)),
        new THREE.Vector3(Math.cos(a) * spread + curl * 0.10, -0.60, Math.sin(a) * (spread * 0.55) + curl * 0.06)
      ]);
      const root = new THREE.Mesh(
        new THREE.TubeGeometry(rootCurve, 10, 0.055 - (i % 3) * 0.008, 8, false),
        phong(ROOT_COLOR, { shininess: 25 })
      );
      group.add(root);
      // Small bulb at the tendril tip
      const tipPt = rootCurve.getPoint(1);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.072 - (i % 3) * 0.010, 8, 8),
        phong(ROOT_TIP, { shininess: 30 })
      );
      tip.position.copy(tipPt);
      group.add(tip);
    }

    // ── Slim curved stem ──
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.28, 0),
      new THREE.Vector3(0.04, 0.00, 0.01),
      new THREE.Vector3(-0.02, 0.24, 0.01),
      new THREE.Vector3(0.0, 0.42, 0)
    ]);
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 14, 0.090, 10, false),
      phong(STEM_COLOR, { shininess: 30 })
    );
    group.add(stem);
    // Lighter highlight stripe on stem
    const stemHl = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 14, 0.032, 7, false),
      phong(LEAF_LIGHT, { shininess: 40 })
    );
    stemHl.position.z = 0.05;
    group.add(stemHl);
    // Spots/bumps on stem
    for (let i = 0; i < 4; i++) {
      const t = 0.15 + i * 0.22;
      const pt = stemCurve.getPoint(t);
      const sp = new THREE.Mesh(
        new THREE.SphereGeometry(0.038, 7, 7),
        phong(SPOT_COLOR, { shininess: 15 })
      );
      sp.position.copy(pt);
      sp.scale.set(1.5, 0.55, 1.0);
      group.add(sp);
    }

    // ── Two large side leaves (at mid-stem, raised up like arms) ──
    for (let side = -1; side <= 1; side += 2) {
      const leafGrp = new THREE.Group();
      // Main broad leaf blade
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.30, 14, 10),
        phong(LEAF_COLOR, { shininess: 28, specular: 0x55AA22 })
      );
      leaf.scale.set(2.4, 0.30, 1.2);
      leafGrp.add(leaf);
      // Light surface sheen
      const leafHl = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 10, 8),
        phong(LEAF_LIGHT, { shininess: 40 })
      );
      leafHl.scale.set(2.0, 0.18, 0.9);
      leafHl.position.set(side * 0.04, 0.02, 0.02);
      leafGrp.add(leafHl);
      // Leaf vein
      const vein = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.010, 0.55, 5),
        phong(LEAF_VEIN, { shininess: 10 })
      );
      vein.rotation.z = Math.PI / 2;
      vein.position.x = side * 0.06;
      leafGrp.add(vein);
      // 2 secondary veins
      for (let v = 0; v < 2; v++) {
        const sv = new THREE.Mesh(
          new THREE.CylinderGeometry(0.007, 0.005, 0.22, 4),
          phong(LEAF_VEIN, { shininess: 8 })
        );
        sv.rotation.z = side * (0.55 + v * 0.30);
        sv.position.set(side * (0.10 + v * 0.12), 0.02, 0.01);
        leafGrp.add(sv);
      }
      // Pointed leaf tip
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.055, 0.18, 6),
        phong(LEAF_COLOR, { shininess: 22 })
      );
      tip.rotation.z = side * (Math.PI / 2);
      tip.position.x = side * 0.38;
      leafGrp.add(tip);

      // Position leaf: upper stem, angled upward like raised arms
      leafGrp.position.set(side * 0.14, 0.32, 0.04);
      leafGrp.rotation.z = side * 0.45;
      leafGrp.rotation.y = side * 0.20;
      group.add(leafGrp);
    }

    // ── Large round yellow-green head — matte organic ──
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.50, 22, 22),
      phong(HEAD_COLOR, { shininess: 7, specular: 0x080808 })
    );
    head.position.y = 0.68;
    head.scale.set(1.0, 0.97, 0.95);
    group.add(head);
    const headGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 16, 14),
      phong(0xB8F018, { shininess: 90, specular: 0xCCFF66, emissive: 0x668800, ei: 0.10 })
    );
    headGlow.position.set(0.10, 0.82, 0.35);
    headGlow.scale.set(0.90, 0.55, 0.22);
    headGlow.material.transparent = true;
    headGlow.material.opacity = 0.28;
    group.add(headGlow);

    // Darker shading on lower-back of head
    const headShade = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 14, 14),
      phong(HEAD_DARK, { shininess: 20 })
    );
    headShade.position.set(-0.08, 0.54, -0.06);
    headShade.scale.set(0.82, 0.65, 0.78);
    headShade.material.transparent = true;
    headShade.material.opacity = 0.50;
    group.add(headShade);

    // Dark spots scattered across head (like image)
    const spotData = [
      [ 0.00, 0.78, 0.42, 0.060],
      [ 0.24, 0.72, 0.36, 0.052],
      [-0.26, 0.68, 0.34, 0.068],
      [ 0.12, 0.58, 0.46, 0.044],
      [-0.10, 0.62, 0.44, 0.058],
      [ 0.28, 0.84, 0.28, 0.046],
      [-0.18, 0.84, 0.32, 0.040],
      [ 0.06, 0.92, 0.36, 0.050],
    ];
    for (const [sx, sy, sz, ss] of spotData) {
      const spot = new THREE.Mesh(
        new THREE.SphereGeometry(ss, 9, 7),
        phong(SPOT_COLOR, { shininess: 15 })
      );
      spot.position.set(sx, sy, sz);
      spot.scale.set(1.0, 1.0, 0.32);
      group.add(spot);
    }

    // ── Angry furrowed brows ──
    for (let side = -1; side <= 1; side += 2) {
      const browCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.06, 0.80, 0.42),
        new THREE.Vector3(side * 0.18, 0.82, 0.40),
        new THREE.Vector3(side * 0.30, 0.76, 0.35)
      ]);
      const brow = new THREE.Mesh(
        new THREE.TubeGeometry(browCurve, 6, 0.036, 8, false),
        phong(BROW_COLOR, { shininess: 20 })
      );
      group.add(brow);
      // Inner downward brow spike
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.022, 0.090, 6),
        phong(BROW_COLOR, { shininess: 15 })
      );
      spike.position.set(side * 0.08, 0.730, 0.445);
      spike.rotation.x = 0.28;
      spike.rotation.z = side * -0.32;
      group.add(spike);
    }

    // ── Glossy dark oval eyes with the same readable style as the muzzle plants ──
    for (let side = -1; side <= 1; side += 2) {
      const eyeSocket = new THREE.Mesh(
        new THREE.SphereGeometry(0.108, 14, 12),
        phong(0x243A04, { shininess: 55, specular: 0x77AA22, emissive: 0x102000, ei: 0.05 })
      );
      eyeSocket.position.set(side * 0.175, 0.70, 0.415);
      eyeSocket.scale.set(1.05, 1.22, 0.42);
      group.add(eyeSocket);

      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 16, 14),
        phong(0x050707, { shininess: 110, specular: 0x445544 })
      );
      eye.position.set(side * 0.175, 0.70, 0.455);
      eye.scale.set(0.86, 1.18, 0.46);
      group.add(eye);

      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.023, 6, 6),
        phong(0xFFFFEE, { emissive: 0xffffff, ei: 0.85 })
      );
      spark.position.set(side * 0.155, 0.728, 0.492);
      group.add(spark);
    }

    // ── Single front-facing cannon barrel — organic plant tube ──
    const barrelOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.165, 0.200, 0.52, 16),
      phong(TUBE_COLOR, { shininess: 7, specular: 0x080808 })
    );
    barrelOuter.rotation.x = Math.PI / 2;
    barrelOuter.position.set(0, 0.60, 0.66);
    group.add(barrelOuter);
    // Ribbed rings on barrel
    for (let r = 0; r < 3; r++) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(0.195 - r * 0.010, 0.022, 7, 16),
        phong(TUBE_RIM, { shininess: 65 })
      );
      rib.position.set(0, 0.60, 0.44 + r * 0.12);
      group.add(rib);
    }
    // Dark barrel mouth opening
    const barrelMouth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.110, 0.110, 0.08, 14),
      phong(TUBE_DARK, { shininess: 10 })
    );
    barrelMouth.rotation.x = Math.PI / 2;
    barrelMouth.position.set(0, 0.60, 0.930);
    group.add(barrelMouth);
    // Flared muzzle lip ring
    const muzzleRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.175, 0.040, 10, 18),
      phong(TUBE_COLOR, { shininess: 65, specular: 0x99DD55 })
    );
    muzzleRing.position.set(0, 0.60, 0.920);
    group.add(muzzleRing);

    // ── Two hot-pink feathery plume antennae sprouting from top of head ──
    for (let side = -1; side <= 1; side += 2) {
      const plumeBase = new THREE.Group();

      // Dark maroon thick stem for plume
      const plumeStemCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(side * 0.05, 0.22, 0.01),
        new THREE.Vector3(side * 0.08, 0.50, 0.02),
        new THREE.Vector3(side * 0.10, 0.78, 0.01)
      ]);
      const plumeStem = new THREE.Mesh(
        new THREE.TubeGeometry(plumeStemCurve, 12, 0.048, 8, false),
        phong(PLUME_STEM, { shininess: 35 })
      );
      plumeBase.add(plumeStem);

      // Fan of petals at top of each plume stem (5 petals fanning outward)
      const petalCount = 5;
      for (let p = 0; p < petalCount; p++) {
        const petalGrp = new THREE.Group();
        // Main petal — elongated tapered ellipse
        const petal = new THREE.Mesh(
          new THREE.SphereGeometry(0.115, 10, 8),
          phong(PLUME_BRIGHT, { shininess: 55, specular: 0xFF88BB })
        );
        petal.scale.set(0.55, 2.2, 0.22);
        petalGrp.add(petal);
        // Darker center rib on petal
        const rib = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 7, 7),
          phong(PLUME_MID, { shininess: 40 })
        );
        rib.scale.set(0.28, 2.0, 0.15);
        petalGrp.add(rib);
        // Bright tip highlight
        const tipHl = new THREE.Mesh(
          new THREE.SphereGeometry(0.040, 6, 6),
          phong(PLUME_TIP, { shininess: 80, emissive: PLUME_TIP, ei: 0.12 })
        );
        tipHl.position.y = 0.20;
        tipHl.scale.set(0.5, 1.2, 0.4);
        petalGrp.add(tipHl);

        // Fan petals in a wide arc
        const fanSpan = Math.PI * 0.85;
        const fanStart = -fanSpan / 2 + (side > 0 ? -0.12 : 0.12);
        const pa = fanStart + (p / (petalCount - 1)) * fanSpan;
        const pr = 0.22;
        const tipPt = plumeStemCurve.getPoint(1);
        petalGrp.position.set(
          tipPt.x + Math.cos(pa + Math.PI / 2) * pr,
          tipPt.y + Math.sin(pa + Math.PI / 2) * pr,
          tipPt.z
        );
        petalGrp.rotation.z = pa;
        plumeBase.add(petalGrp);
      }

      // Second smaller fan cluster (below the main fan, gives fuller look)
      for (let p = 0; p < 3; p++) {
        const petalGrp2 = new THREE.Group();
        const petal2 = new THREE.Mesh(
          new THREE.SphereGeometry(0.090, 9, 7),
          phong(PLUME_MID, { shininess: 45 })
        );
        petal2.scale.set(0.50, 1.8, 0.20);
        petalGrp2.add(petal2);
        const fanSpan2 = Math.PI * 0.60;
        const fanStart2 = -fanSpan2 / 2 + (side > 0 ? -0.08 : 0.08);
        const pa2 = fanStart2 + (p / 2) * fanSpan2;
        const midPt = plumeStemCurve.getPoint(0.65);
        petalGrp2.position.set(
          midPt.x + Math.cos(pa2 + Math.PI / 2) * 0.16,
          midPt.y + Math.sin(pa2 + Math.PI / 2) * 0.16,
          midPt.z
        );
        petalGrp2.rotation.z = pa2;
        plumeBase.add(petalGrp2);
      }

      // Position plume base on top of head, angled outward
      plumeBase.position.set(side * 0.18, 1.10, -0.05);
      plumeBase.rotation.z = side * 0.22;
      group.add(plumeBase);
    }

    // Dark outline arc under the head, echoing the reference illustration.
    const lowerHeadArc = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.34, 0.50, 0.43),
        new THREE.Vector3(-0.12, 0.43, 0.50),
        new THREE.Vector3(0.12, 0.43, 0.50),
        new THREE.Vector3(0.34, 0.50, 0.43)
      ]), 10, 0.025, 7, false),
      phong(OUTLINE, { shininess: 8 })
    );
    group.add(lowerHeadArc);

    // ── Small pointed green leaves at plume base (collar leaves on head top) ──
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const smallLeaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.10, 8, 6),
        phong(LEAF_COLOR, { shininess: 20 })
      );
      smallLeaf.scale.set(0.55, 1.8, 0.22);
      smallLeaf.position.set(
        Math.cos(a) * 0.28, 1.10, Math.sin(a) * 0.12
      );
      smallLeaf.rotation.z = a + Math.PI;
      group.add(smallLeaf);
    }
  }

  _buildChomper(group, phong) {
    // ── Venus Flytrap color palette (from image) ──
    const HEAD_ORANGE  = 0xE85A0A;  // deep orange head body
    const HEAD_DARK    = 0xC04408;  // darker orange shading on head
    const SPOT_COLOR   = 0x4A9A12;  // bright yellow-green spots on head
    const LIP_COLOR    = 0x3A8A18;  // bright green lip/jaw trim
    const LIP_DARK     = 0x226010;  // darker green lip edge
    const MOUTH_RED    = 0x8B0A1A;  // dark red inner mouth
    const MOUTH_PINK   = 0xCC1A2A;  // brighter red mid-mouth
    const TOOTH_COLOR  = 0xEEE8C8;  // creamy ivory teeth
    const TOOTH_DARK   = 0xBBB090;  // darker tooth base
    const STEM_COLOR   = 0x2A8818;  // bright green main stem
    const STEM_DARK    = 0x185A0C;  // darker green stem shadow
    const STEM_LIGHT   = 0x44BB22;  // lighter green highlight
    const THORN_COLOR  = 0xCC4408;  // orange-red thorns
    const LEAF_COLOR   = 0x228B18;  // medium green leaves
    const LEAF_DARK    = 0x145A0C;  // dark green leaf shading
    const LEAF_VEIN    = 0x0E4008;  // very dark vein
    const CURL_COLOR   = 0x3A9E22;  // bright green curling vine
    const OUTLINE      = 0x061600;

    // ── Large broad base leaves (4 leaves fanning out at base) ──
    const leafData = [
      { side: -1, angle: -0.35, xOff: -0.30, zOff: 0.05 },
      { side: -1, angle: -0.65, xOff: -0.20, zOff: -0.08 },
      { side:  1, angle:  0.35, xOff:  0.30, zOff: 0.05 },
      { side:  1, angle:  0.65, xOff:  0.20, zOff: -0.08 },
    ];
    for (const ld of leafData) {
      const leafGrp = new THREE.Group();
      // Broad main leaf blade
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 14, 10),
        phong(LEAF_COLOR, { shininess: 25, specular: 0x55AA22 })
      );
      leaf.scale.set(2.5, 0.22, 1.0);
      leafGrp.add(leaf);
      // Darker underside shading
      const leafShade = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 10, 8),
        phong(LEAF_DARK, { shininess: 10 })
      );
      leafShade.scale.set(2.2, 0.15, 0.9);
      leafShade.position.y = -0.02;
      leafGrp.add(leafShade);
      // Center vein
      const vein = new THREE.Mesh(
        new THREE.CylinderGeometry(0.010, 0.008, 0.60, 4),
        phong(LEAF_VEIN, { shininess: 10 })
      );
      vein.rotation.z = Math.PI / 2;
      vein.position.x = ld.side * 0.08;
      leafGrp.add(vein);
      // 3 secondary veins branching out
      for (let v = 0; v < 3; v++) {
        const sv = new THREE.Mesh(
          new THREE.CylinderGeometry(0.006, 0.004, 0.24, 4),
          phong(LEAF_VEIN, { shininess: 8 })
        );
        sv.rotation.z = ld.side * (0.5 + v * 0.22);
        sv.position.set(ld.side * (0.08 + v * 0.09), 0.01, 0.01);
        leafGrp.add(sv);
      }
      // Pointed leaf tip
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.14, 6),
        phong(LEAF_COLOR, { shininess: 20 })
      );
      tip.rotation.z = ld.side * (Math.PI / 2);
      tip.position.x = ld.side * 0.42;
      leafGrp.add(tip);

      leafGrp.position.set(ld.xOff, -0.40, ld.zOff);
      leafGrp.rotation.z = ld.angle;
      leafGrp.rotation.y = ld.side * 0.15;
      group.add(leafGrp);
    }

    // ── Thick main curved stem with thorns ──
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.38, 0),
      new THREE.Vector3(-0.05, -0.10, 0.02),
      new THREE.Vector3(0.06,  0.20, 0.01),
      new THREE.Vector3(-0.04, 0.50, 0.01),
      new THREE.Vector3(0.0,   0.72, 0)
    ]);
    // Main stem body
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 20, 0.115, 12, false),
      phong(STEM_COLOR, { shininess: 30, specular: 0x66BB22 })
    );
    group.add(stem);
    // Dark shadow band on stem
    const stemDarkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.04, -0.36, -0.04),
      new THREE.Vector3(-0.09, -0.08, -0.03),
      new THREE.Vector3(0.02,  0.22, -0.03),
      new THREE.Vector3(-0.08, 0.52, -0.03),
      new THREE.Vector3(-0.04, 0.72, 0)
    ]);
    const stemDark = new THREE.Mesh(
      new THREE.TubeGeometry(stemDarkCurve, 16, 0.052, 8, false),
      phong(STEM_DARK, { shininess: 10 })
    );
    group.add(stemDark);
    // Highlight stripe
    const stemHlCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.04, -0.34, 0.07),
      new THREE.Vector3(-0.01, -0.06, 0.08),
      new THREE.Vector3(0.10,  0.24, 0.07),
      new THREE.Vector3(0.00,  0.54, 0.07),
      new THREE.Vector3(0.04,  0.72, 0)
    ]);
    const stemHl = new THREE.Mesh(
      new THREE.TubeGeometry(stemHlCurve, 14, 0.028, 6, false),
      phong(STEM_LIGHT, { shininess: 45 })
    );
    group.add(stemHl);

    // Thorns along the stem (6 small orange-red spikes)
    const thornTs = [0.12, 0.25, 0.40, 0.55, 0.70, 0.85];
    const thornSides = [1, -1, 1, -1, 1, -1];
    for (let i = 0; i < thornTs.length; i++) {
      const t = thornTs[i];
      const pt = stemCurve.getPoint(t);
      const tangent = stemCurve.getTangent(t);
      const normal = new THREE.Vector3(thornSides[i], 0, 0.3).normalize();
      const thorn = new THREE.Mesh(
        new THREE.ConeGeometry(0.030, 0.14, 5),
        phong(THORN_COLOR, { shininess: 40 })
      );
      thorn.position.copy(pt).addScaledVector(normal, 0.11);
      thorn.lookAt(pt.clone().addScaledVector(normal, -1));
      group.add(thorn);
    }

    // ── Left curling tendril (tall S-curve behind stem) ──
    const leftCurlCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.15, -0.20, 0),
      new THREE.Vector3(-0.35, 0.05, 0.02),
      new THREE.Vector3(-0.55, 0.30, 0.01),
      new THREE.Vector3(-0.60, 0.60, 0),
      new THREE.Vector3(-0.50, 0.90, 0),
      new THREE.Vector3(-0.28, 1.05, 0),
      new THREE.Vector3(-0.12, 1.00, 0),
      new THREE.Vector3(-0.05, 0.88, 0)
    ]);
    const leftCurl = new THREE.Mesh(
      new THREE.TubeGeometry(leftCurlCurve, 22, 0.055, 8, false),
      phong(CURL_COLOR, { shininess: 35 })
    );
    group.add(leftCurl);
    // Thorns on left curl
    for (let i = 0; i < 4; i++) {
      const t = 0.15 + i * 0.22;
      const pt = leftCurlCurve.getPoint(t);
      const thorn = new THREE.Mesh(
        new THREE.ConeGeometry(0.022, 0.10, 5),
        phong(THORN_COLOR, { shininess: 35 })
      );
      thorn.position.copy(pt);
      thorn.position.x -= 0.08;
      thorn.rotation.z = 0.5;
      group.add(thorn);
    }

    // ── Right small curling side tendril ──
    const rightCurlCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3( 0.18, -0.25, 0),
      new THREE.Vector3( 0.38, -0.10, 0.01),
      new THREE.Vector3( 0.52,  0.08, 0),
      new THREE.Vector3( 0.50,  0.28, 0),
      new THREE.Vector3( 0.38,  0.36, 0),
      new THREE.Vector3( 0.28,  0.34, 0)
    ]);
    const rightCurl = new THREE.Mesh(
      new THREE.TubeGeometry(rightCurlCurve, 14, 0.048, 8, false),
      phong(CURL_COLOR, { shininess: 35 })
    );
    group.add(rightCurl);
    // Thorns on right curl
    for (let i = 0; i < 3; i++) {
      const t = 0.20 + i * 0.28;
      const pt = rightCurlCurve.getPoint(t);
      const thorn = new THREE.Mesh(
        new THREE.ConeGeometry(0.020, 0.09, 5),
        phong(THORN_COLOR, { shininess: 35 })
      );
      thorn.position.copy(pt);
      thorn.position.y += 0.07;
      thorn.rotation.z = -0.4;
      group.add(thorn);
    }

    // ── Upper head (matte orange, upper hemisphere) ──
    const upperPivot = new THREE.Group();
    upperPivot.position.set(0, 0.78, -0.05);
    group.add(upperPivot);
    this._upperPivot = upperPivot;

    // Upper dome — matte orange sphere upper half
    const upperDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
      phong(HEAD_ORANGE, { shininess: 7, specular: 0x0a0a0a })
    );
    upperDome.position.set(0, 0.04, 0.08);
    upperDome.scale.set(1.08, 0.88, 1.0);
    upperPivot.add(upperDome);
    this._upperJaw = upperDome;
    const upperGloss = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      phong(0xFF7A18, { shininess: 90, specular: 0xFFAA44, emissive: 0x772000, ei: 0.08 })
    );
    upperGloss.position.set(0.08, 0.22, 0.42);
    upperGloss.scale.set(1.2, 0.45, 0.18);
    upperGloss.material.transparent = true;
    upperGloss.material.opacity = 0.30;
    upperPivot.add(upperGloss);

    // Dark shading patch on upper dome (back)
    const upperShade = new THREE.Mesh(
      new THREE.SphereGeometry(0.50, 14, 10),
      phong(HEAD_DARK, { shininess: 20 })
    );
    upperShade.position.set(-0.12, 0.08, -0.08);
    upperShade.scale.set(0.82, 0.60, 0.78);
    upperShade.material.transparent = true;
    upperShade.material.opacity = 0.55;
    upperPivot.add(upperShade);

    // Yellow-green spots on upper head (8 scattered ovals)
    const upSpots = [
      [ 0.00, 0.22, 0.44, 0.12],
      [ 0.22, 0.16, 0.38, 0.10],
      [-0.24, 0.14, 0.38, 0.13],
      [ 0.12, 0.05, 0.48, 0.08],
      [-0.10, 0.08, 0.46, 0.11],
      [ 0.28, 0.22, 0.30, 0.09],
      [-0.28, 0.24, 0.30, 0.10],
      [ 0.06, 0.30, 0.38, 0.07],
    ];
    for (const [sx, sy, sz, ss] of upSpots) {
      const spot = new THREE.Mesh(
        new THREE.SphereGeometry(ss, 10, 8),
        phong(SPOT_COLOR, { shininess: 25 })
      );
      spot.position.set(sx, sy, sz);
      spot.scale.set(1.0, 0.75, 0.35);
      upperPivot.add(spot);
    }

    // Green lip / rim on upper jaw
    const upperLip = new THREE.Mesh(
      new THREE.TorusGeometry(0.50, 0.075, 10, 24),
      phong(LIP_COLOR, { shininess: 8, specular: 0x080808 })
    );
    upperLip.position.set(0, 0.06, 0.08);
    upperLip.rotation.x = Math.PI / 2;
    upperLip.scale.set(1.08, 1, 1.0);
    upperPivot.add(upperLip);

    // Upper teeth (pointing downward from green lip)
    const upperToothAngles = [-0.55, -0.35, -0.14, 0.0, 0.14, 0.35, 0.55];
    for (let i = 0; i < upperToothAngles.length; i++) {
      const angle = upperToothAngles[i];
      const tx = Math.sin(angle) * 0.48;
      const toothH = 0.22 - Math.abs(angle) * 0.10;
      const toothW = 0.055 - Math.abs(angle) * 0.012;
      const tooth = new THREE.Mesh(
        new THREE.ConeGeometry(toothW, toothH, 5),
        phong(TOOTH_COLOR, { shininess: 70, specular: 0xEEEECC })
      );
      tooth.position.set(tx, -0.04, 0.46);
      tooth.rotation.x = Math.PI; // point downward
      // Dark tooth base
      const toothBase = new THREE.Mesh(
        new THREE.CylinderGeometry(toothW * 0.8, toothW, 0.06, 5),
        phong(TOOTH_DARK, { shininess: 40 })
      );
      toothBase.position.set(tx, 0.00, 0.46);
      upperPivot.add(toothBase);
      upperPivot.add(tooth);
    }

    // ── Lower jaw (stays fixed to group, forms bottom half) ──
    const lowerPivot = new THREE.Group();
    lowerPivot.position.set(0, 0.78, -0.05);
    group.add(lowerPivot);
    this._lowerPivot = lowerPivot;

    // Lower dome — dark orange lower hemisphere
    const lowerDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.50, 22, 16, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52),
      phong(HEAD_DARK, { shininess: 45 })
    );
    lowerDome.position.set(0, -0.04, 0.08);
    lowerDome.scale.set(1.05, 0.85, 1.0);
    lowerPivot.add(lowerDome);
    this._lowerJaw = lowerDome;

    // Green lip on lower jaw
    const lowerLip = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.065, 10, 24),
      phong(LIP_COLOR, { shininess: 8, specular: 0x080808 })
    );
    lowerLip.position.set(0, -0.04, 0.08);
    lowerLip.rotation.x = Math.PI / 2;
    lowerLip.scale.set(1.05, 1, 1.0);
    lowerPivot.add(lowerLip);

    const mouthOutline = new THREE.Mesh(
      new THREE.TorusGeometry(0.50, 0.022, 8, 24),
      phong(OUTLINE, { shininess: 5 })
    );
    mouthOutline.position.set(0, 0.02, 0.10);
    mouthOutline.rotation.x = Math.PI / 2;
    mouthOutline.scale.set(1.12, 1, 1.0);
    lowerPivot.add(mouthOutline);

    // Dark red inner mouth (visible when open)
    const innerMouthMat = new THREE.MeshPhongMaterial({ color: MOUTH_RED, shininess: 15, side: THREE.DoubleSide });
    const innerMouth = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 18, 14),
      innerMouthMat
    );
    innerMouth.position.set(0, 0.0, 0.08);
    innerMouth.scale.set(1.0, 0.55, 0.95);
    lowerPivot.add(innerMouth);

    // Brighter pink/red mid-mouth
    const midMouth = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 14, 10),
      phong(MOUTH_PINK, { shininess: 20 })
    );
    midMouth.position.set(0, 0.0, 0.18);
    midMouth.scale.set(1.0, 0.40, 0.80);
    lowerPivot.add(midMouth);

    // Lower teeth (pointing upward)
    const lowerToothAngles = [-0.60, -0.40, -0.20, 0.0, 0.20, 0.40, 0.60, -0.50, 0.50];
    for (let i = 0; i < lowerToothAngles.length; i++) {
      const angle = lowerToothAngles[i];
      const tx = Math.sin(angle) * 0.44;
      const toothH = 0.20 - Math.abs(angle) * 0.08;
      const toothW = 0.048 - Math.abs(angle) * 0.008;
      const tooth = new THREE.Mesh(
        new THREE.ConeGeometry(toothW, toothH, 5),
        phong(TOOTH_COLOR, { shininess: 70, specular: 0xEEEECC })
      );
      tooth.position.set(tx, 0.06, 0.44);
      tooth.rotation.x = 0; // point upward
      const toothBase = new THREE.Mesh(
        new THREE.CylinderGeometry(toothW * 0.8, toothW, 0.05, 5),
        phong(TOOTH_DARK, { shininess: 40 })
      );
      toothBase.position.set(tx, 0.00, 0.44);
      lowerPivot.add(toothBase);
      lowerPivot.add(tooth);
    }

    // Tongue
    const tongue = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      phong(0xFF3344, { shininess: 55 })
    );
    tongue.position.set(0, -0.02, 0.30);
    tongue.scale.set(1.0, 0.38, 1.2);
    lowerPivot.add(tongue);
  }

  _buildPotatoMine(group, phong) {
    // ── Color palette (from image) ──
    const BODY_COLOR  = 0x44CC22;  // bright green body
    const BODY_SHADE  = 0x2A8810;  // darker green for shading
    const SPOT_COLOR  = 0x1A6608;  // dark green spots
    const STEM_COLOR  = 0x228B18;  // medium green stem
    const LEAF_COLOR  = 0x1E7A14;  // dark green leaves
    const LEAF_VEIN   = 0x145A0C;  // very dark leaf vein
    const HELMET_TOP  = 0x8B20CC;  // bright purple dome top
    const HELMET_BRIM = 0x5A1088;  // dark purple brim band
    const HELMET_RIM  = 0x3A0A55;  // very dark purple rim
    const CABLE_COLOR = 0x1A5566;  // dark teal segmented cable
    const CABLE_RING  = 0x0D3344;  // darker teal segment ring
    const BALL_COLOR  = 0x7722BB;  // purple detonator ball
    const BROW_COLOR  = 0x1A0033;  // near-black purple brows
    const EYE_DARK    = 0x080010;  // very dark eye
    const PUPIL_BLUE  = 0x2244AA;  // small blue pupil
    const BODY_LIGHT  = 0x6CFF32;  // glossy upper body highlight

    // ── Two broad base leaves ──
    for (let side = -1; side <= 1; side += 2) {
      const leafGrp = new THREE.Group();
      // Main leaf blade — broad ellipse
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.30, 12, 8),
        phong(LEAF_COLOR, { shininess: 25, specular: 0x448833 })
      );
      leaf.scale.set(2.2, 0.28, 1.1);
      leafGrp.add(leaf);
      // Leaf vein
      const vein = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.010, 0.55, 5),
        phong(LEAF_VEIN, { shininess: 15 })
      );
      vein.rotation.z = Math.PI / 2;
      vein.position.x = side * 0.05;
      leafGrp.add(vein);
      // Secondary veins
      for (let v = 0; v < 3; v++) {
        const sv = new THREE.Mesh(
          new THREE.CylinderGeometry(0.006, 0.005, 0.20, 4),
          phong(LEAF_VEIN, { shininess: 10 })
        );
        sv.rotation.z = side * (0.5 + v * 0.25);
        sv.position.set(side * (0.08 + v * 0.10), 0.02, 0.01);
        leafGrp.add(sv);
      }
      leafGrp.position.set(side * 0.28, -0.38, 0.06);
      leafGrp.rotation.z = side * 0.18;
      leafGrp.rotation.y = side * 0.15;
      group.add(leafGrp);
    }

    // ── Short green stem ──
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.36, 0),
      new THREE.Vector3(0.01, -0.20, 0.01),
      new THREE.Vector3(0, -0.06, 0)
    ]);
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 8, 0.08, 10, false),
      phong(STEM_COLOR, { shininess: 20 })
    );
    group.add(stem);

    // ── Main pear/teardrop body — matte organic green ──
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 22, 22),
      phong(BODY_COLOR, { shininess: 7, specular: 0x080808 })
    );
    body.position.y = 0.20;
    body.scale.set(1.0, 1.15, 0.90);  // slightly taller = pear shape
    group.add(body);
    const bodyGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.30, 14, 12),
      phong(BODY_LIGHT, { shininess: 90, specular: 0xAAFF77, emissive: 0x227700, ei: 0.08 })
    );
    bodyGlow.position.set(0.06, 0.42, 0.35);
    bodyGlow.scale.set(1.1, 0.58, 0.20);
    bodyGlow.material.transparent = true;
    bodyGlow.material.opacity = 0.30;
    group.add(bodyGlow);

    // Body shading (darker green on lower-left for depth)
    const shade = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 14, 14),
      phong(BODY_SHADE, { shininess: 20 })
    );
    shade.position.set(-0.10, 0.05, -0.05);
    shade.scale.set(0.80, 0.70, 0.72);
    shade.material.transparent = true;
    shade.material.opacity = 0.45;
    group.add(shade);

    // ── Dark green circular spots scattered across body ──
    const spotData = [
      [ 0.00,  0.38,  0.38, 0.065],
      [ 0.22,  0.28,  0.35, 0.078],
      [-0.26,  0.22,  0.34, 0.090],
      [ 0.10,  0.05,  0.44, 0.055],
      [-0.18, -0.02,  0.42, 0.082],
      [ 0.28,  0.08,  0.36, 0.060],
      [-0.08,  0.30,  0.40, 0.050],
      [ 0.20,  0.48,  0.32, 0.068],
      [-0.30,  0.42,  0.28, 0.055],
      [ 0.00, -0.08,  0.44, 0.070],
      [ 0.32,  0.38,  0.26, 0.048],
      [-0.14,  0.15,  0.44, 0.042],
    ];
    for (const [sx, sy, sz, ss] of spotData) {
      const spot = new THREE.Mesh(
        new THREE.SphereGeometry(ss, 10, 8),
        phong(SPOT_COLOR, { shininess: 20 })
      );
      spot.position.set(sx, sy, sz);
      spot.scale.set(1.0, 1.0, 0.30);  // flat disc on surface
      group.add(spot);
    }

    // ── Purple helmet cap — dome + brim ──
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
      phong(HELMET_TOP, { shininess: 10, specular: 0x110022 })
    );
    dome.position.y = 0.64;
    dome.scale.set(1.05, 1.0, 0.92);
    group.add(dome);
    for (let i = -1; i <= 1; i++) {
      const seam = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(i * 0.10, 0.60, 0.28),
          new THREE.Vector3(i * 0.08, 0.74, 0.25),
          new THREE.Vector3(i * 0.05, 0.88, 0.12)
        ]), 6, 0.010, 5, false),
        phong(0x2A063E, { shininess: 20 })
      );
      group.add(seam);
    }
    // Shiny highlight on dome
    const domeHl = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      phong(0xDD99FF, { shininess: 120, emissive: 0xBB66EE, ei: 0.25 })
    );
    domeHl.position.set(0.06, 0.82, 0.18);
    domeHl.scale.set(0.9, 0.65, 0.5);
    group.add(domeHl);
    // Brim band (flat torus ring)
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.38, 0.10, 20),
      phong(HELMET_BRIM, { shininess: 60, specular: 0x9955CC })
    );
    brim.position.y = 0.62;
    brim.scale.set(1.0, 1, 0.92);
    group.add(brim);
    // Bottom rim ring (dark outline)
    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.365, 0.025, 8, 22),
      phong(HELMET_RIM, { shininess: 40 })
    );
    rimRing.position.y = 0.57;
    rimRing.rotation.x = Math.PI / 2;
    rimRing.scale.set(1.0, 1, 0.92);
    group.add(rimRing);
    // Connector cylinder between helmet and body
    const connector = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.10, 14),
      phong(HELMET_BRIM, { shininess: 50 })
    );
    connector.position.y = 0.70;
    group.add(connector);

    // ── Purple strap/band hanging down left side of head ──
    const strapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.20, 0.62, 0.22),
      new THREE.Vector3(-0.22, 0.50, 0.28),
      new THREE.Vector3(-0.20, 0.38, 0.30)
    ]);
    const strap = new THREE.Mesh(
      new THREE.TubeGeometry(strapCurve, 6, 0.038, 8, false),
      phong(HELMET_BRIM, { shininess: 45 })
    );
    group.add(strap);

    // ── Segmented teal cable fuse (curls up and over to one side) ──
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.76, 0),
      new THREE.Vector3(0.05, 0.90, 0.02),
      new THREE.Vector3(-0.05, 1.08, 0.01),
      new THREE.Vector3(-0.22, 1.20, 0),
      new THREE.Vector3(-0.42, 1.18, 0),
      new THREE.Vector3(-0.58, 1.05, 0),
      new THREE.Vector3(-0.65, 0.88, 0)
    ]);
    const cable = new THREE.Mesh(
      new THREE.TubeGeometry(cableCurve, 20, 0.040, 10, false),
      phong(CABLE_COLOR, { shininess: 60 })
    );
    group.add(cable);
    // Segmented rings along the cable
    const segCount = 8;
    for (let i = 0; i < segCount; i++) {
      const t = 0.05 + (i / (segCount - 1)) * 0.88;
      const pt = cableCurve.getPoint(t);
      const seg = new THREE.Mesh(
        new THREE.TorusGeometry(0.042, 0.014, 6, 12),
        phong(CABLE_RING, { shininess: 70 })
      );
      seg.position.copy(pt);
      // Orient ring perpendicular to cable direction
      const tangent = cableCurve.getTangent(t);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      group.add(seg);
    }
    // Purple detonator ball at cable end
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 14, 14),
      phong(BALL_COLOR, { shininess: 90, specular: 0xCC88FF, emissive: 0x330044, ei: 0.10 })
    );
    ball.position.set(-0.65, 0.88, 0);
    group.add(ball);
    // Shine on ball
    const ballHl = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      phong(0xEEAAFF, { shininess: 130, emissive: 0xCC88FF, ei: 0.35 })
    );
    ballHl.position.set(-0.62, 0.97, 0.06);
    group.add(ballHl);

    // ── Angry furrowed brows (dark purple/black) ──
    for (let side = -1; side <= 1; side += 2) {
      const browCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.05, 0.38, 0.42),
        new THREE.Vector3(side * 0.16, 0.40, 0.40),
        new THREE.Vector3(side * 0.27, 0.35, 0.36)
      ]);
      const brow = new THREE.Mesh(
        new THREE.TubeGeometry(browCurve, 6, 0.038, 8, false),
        phong(BROW_COLOR, { shininess: 30 })
      );
      group.add(brow);
      // Inner downward spike on brow
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.022, 0.09, 6),
        phong(BROW_COLOR, { shininess: 20 })
      );
      spike.position.set(side * 0.07, 0.325, 0.430);
      spike.rotation.x = 0.25;
      spike.rotation.z = side * -0.35;
      group.add(spike);
    }

    // ── Eyes — large dark ovals with small blue pupils ──
    for (let side = -1; side <= 1; side += 2) {
      // Dark eye socket
      const eyeSocket = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 12, 10),
        phong(EYE_DARK, { shininess: 20 })
      );
      eyeSocket.position.set(side * 0.155, 0.25, 0.41);
      eyeSocket.scale.set(1.0, 1.15, 0.55);
      group.add(eyeSocket);
      // Blue pupil (small, centered)
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 8, 8),
        phong(PUPIL_BLUE, { shininess: 80, specular: 0x88AAFF })
      );
      pupil.position.set(side * 0.155, 0.25, 0.435);
      group.add(pupil);
      // White sparkle
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 5, 5),
        phong(0xffffff, { emissive: 0xffffff, ei: 1.0 })
      );
      spark.position.set(side * 0.138, 0.268, 0.446);
      group.add(spark);
    }

    // ── Grumpy downward frown ──
    const frown = new THREE.Mesh(
      new THREE.TorusGeometry(0.072, 0.020, 8, 14, Math.PI * 0.65),
      phong(BROW_COLOR, { shininess: 20 })
    );
    frown.position.set(0, 0.08, 0.44);
    frown.rotation.z = Math.PI + 0.15;
    frown.rotation.x = -0.08;
    group.add(frown);

    // ── Armed indicator light (on top of connector) ──
    this._mineLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 8),
      new THREE.MeshPhongMaterial({ color: 0x666666, shininess: 60, emissive: 0x000000 })
    );
    this._mineLight.position.set(0, 0.78, 0);
    group.add(this._mineLight);
  }

  _spawnExplosion() {
    if (window.game && window.game._playSfx) window.game._playSfx('explosion');
    if (window.game && window.game._spawnHitEffect) window.game._spawnHitEffect(this.position.x, this.position.y + 0.45, this.position.z, 'thermal');
    const pos = this.position.clone();
    const scene = this.scene;
    const group = new THREE.Group();
    group.position.copy(pos);
    scene.add(group);

    // Fiery core flash
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xFFFF00, transparent: true, opacity: 1 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), coreMat);
    group.add(core);

    // Orange fireball
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xFF6600, transparent: true, opacity: 0.9 });
    const fireball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), fireMat);
    group.add(fireball);

    // Red outer glow
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xFF2200, transparent: true, opacity: 0.6 });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), glowMat);
    group.add(glow);

    // Dark smoke ring (low poly)
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x332211, transparent: true, opacity: 0.5 });
    const smoke = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.25, 5, 8), smokeMat);
    smoke.rotation.x = Math.PI / 2;
    group.add(smoke);

    // Dirt chunks flying out (few for performance)
    const chunks = [];
    for (let i = 0; i < 4; i++) {
      const size = 0.06 + Math.random() * 0.08;
      const chunkMat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x5A3A1A : 0x8B6914, transparent: true });
      const chunk = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), chunkMat);
      const angle = Math.random() * Math.PI * 2;
      const upVel = 1.5 + Math.random() * 2;
      const outVel = 0.8 + Math.random() * 1.5;
      chunk.userData.vel = new THREE.Vector3(
        Math.cos(angle) * outVel,
        upVel,
        Math.sin(angle) * outVel
      );
      chunk.position.set(0, 0.2, 0);
      group.add(chunk);
      chunks.push(chunk);
    }

    // Brief flash light
    const light = new THREE.PointLight(0xFF8800, 4, 5);
    light.position.set(0, 1, 0);
    group.add(light);

    let elapsed = 0;
    const duration = 1.2;
    const animate = () => {
      const dt = 0.016;
      elapsed += dt;
      const t = elapsed / duration;

      // Expand and fade spheres
      const expand = 1 + t * 2;
      core.scale.setScalar(expand * 0.8);
      fireball.scale.setScalar(expand);
      glow.scale.setScalar(expand * 1.2);
      smoke.scale.setScalar(1 + t * 2);
      smoke.position.y = t * 2;

      coreMat.opacity = Math.max(0, 1 - t * 2);
      fireMat.opacity = Math.max(0, 0.9 - t * 1.5);
      glowMat.opacity = Math.max(0, 0.6 - t * 0.8);
      smokeMat.opacity = Math.max(0, 0.5 - t * 0.5);
      light.intensity = Math.max(0, 8 * (1 - t * 1.5));

      // Animate chunks
      for (const c of chunks) {
        c.position.add(c.userData.vel.clone().multiplyScalar(dt));
        c.userData.vel.y -= 9.8 * dt;
        c.material.opacity = Math.max(0, 1 - t);
        c.material.transparent = true;
      }

      if (elapsed < duration) {
        requestAnimationFrame(animate);
      } else {
        scene.remove(group);
      }
    };
    requestAnimationFrame(animate);
  }

  _getMineTarget() {
    const zombies = window.game.zombies;
    for (const z of zombies) {
      if (!z.alive || z.dying || z.row !== this.row) continue;
      const dist = Math.abs(z.position.x - this.position.x);
      if (dist < 0.8) return z;
    }
    return null;
  }

  _getChomperTarget() {
    const zombies = window.game.zombies;
    let closest = null;
    let closestDist = 3.5;
    for (const z of zombies) {
      if (!z.alive || z.dying || z.row !== this.row) continue;
      const dist = z.position.x - this.position.x;
      if (dist > -0.5 && dist < closestDist) {
        closestDist = dist;
        closest = z;
      }
    }
    return closest;
  }

  _updateChomper(dt) {
    if (this.chomperState === 'idle') {
      // Look for nearby zombie
      const target = this._getChomperTarget();
      if (target) {
        this.chomperState = 'lunging';
        this.chomperTimer = 0;
        this.chomperLungeTarget = target;
      }
    } else if (this.chomperState === 'lunging') {
      this.chomperTimer += dt;
      // Lunge forward animation (0.3s)
      const t = Math.min(this.chomperTimer / 0.3, 1);
      const lunge = Math.sin(t * Math.PI) * 0.8;
      this.mesh.position.x = this.position.x + lunge;
      // Close mouth: rotate upper jaw down, lower jaw up
      const jawClose = t;
      if (this._upperPivot) this._upperPivot.rotation.x = -jawClose * 0.5;
      if (this._lowerPivot) this._lowerPivot.rotation.x = jawClose * 0.5;
      if (t >= 1) {
        // Kill the zombie instantly
        if (this.chomperLungeTarget && this.chomperLungeTarget.alive && !this.chomperLungeTarget.dying) {
          // Instantly remove zombie (eaten!)
          this.chomperLungeTarget.dying = true;
          this.chomperLungeTarget.destroy();
        }
        this.chomperLungeTarget = null;
        this.chomperState = 'chewing';
        this.chomperTimer = 0;
      }
    } else if (this.chomperState === 'chewing') {
      this.chomperTimer += dt;
      // Very dramatic chewing - big snapping jaw movements
      const chewCycle = Math.sin(this.chomperTimer * 10);
      const chewSnap = Math.pow(Math.abs(chewCycle), 0.4) * Math.sign(chewCycle);
      if (this._upperPivot) {
        this._upperPivot.rotation.x = -0.08 + chewSnap * 0.15;
      }
      if (this._lowerPivot) {
        this._lowerPivot.rotation.x = 0.08 - chewSnap * 0.15;
      }
      // Head bobs up and down while chewing
      this.mesh.position.y = this.position.y + Math.sin(this.chomperTimer * 8) * 0.12;
      // Body sways gently
      this.mesh.rotation.z = Math.sin(this.chomperTimer * 6) * 0.05;
      // Chewing takes 18 seconds
      if (this.chomperTimer >= 18) {
        this.chomperState = 'idle';
        this.chomperTimer = 0;
        // Reset jaw positions
        if (this._upperPivot) { this._upperPivot.rotation.x = 0; }
        if (this._lowerPivot) { this._lowerPivot.rotation.x = 0; }
      }
      // Return to original x position
      this.mesh.position.x += (this.position.x - this.mesh.position.x) * dt * 5;
    }
  }

  _addWallnutDamage(stage) {
    // Remove shell bumps (they look like white circles)
    const bumpsToRemove = this.mesh.children.filter(c => c.userData.isBump);
    bumpsToRemove.forEach(c => this.mesh.remove(c));

    const crackMat = new THREE.MeshBasicMaterial({ color: 0x1A0800 });
    const deepMat = new THREE.MeshBasicMaterial({ color: 0x0A0200 });

    // Use flat planes sitting on the surface for maximum visibility
    const addCrack = (points, width, mat) => {
      const curve = new THREE.CatmullRomCurve3(points);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 8, width, 4, false),
        mat || crackMat
      );
      tube.userData.isCrack = true;
      this.mesh.add(tube);
    };

    if (stage >= 1) {
      // Big diagonal crack from upper-right to lower-left
      addCrack([
        new THREE.Vector3(0.25, 0.72, 0.52),
        new THREE.Vector3(0.12, 0.58, 0.60),
        new THREE.Vector3(0.0, 0.42, 0.62),
        new THREE.Vector3(-0.12, 0.28, 0.58)
      ], 0.025, deepMat);
      // Branch from main crack
      addCrack([
        new THREE.Vector3(0.12, 0.58, 0.61),
        new THREE.Vector3(0.22, 0.50, 0.58),
        new THREE.Vector3(0.30, 0.40, 0.52)
      ], 0.018, crackMat);
      // Second crack on left side
      addCrack([
        new THREE.Vector3(-0.10, 0.70, 0.54),
        new THREE.Vector3(-0.20, 0.55, 0.58),
        new THREE.Vector3(-0.25, 0.38, 0.54)
      ], 0.022, deepMat);
      // Small branch
      addCrack([
        new THREE.Vector3(-0.20, 0.55, 0.59),
        new THREE.Vector3(-0.30, 0.50, 0.50)
      ], 0.015, crackMat);
    }
    if (stage >= 2) {
      // Massive center vertical crack
      addCrack([
        new THREE.Vector3(0.0, 0.80, 0.56),
        new THREE.Vector3(0.03, 0.60, 0.64),
        new THREE.Vector3(-0.02, 0.40, 0.64),
        new THREE.Vector3(0.0, 0.20, 0.56)
      ], 0.032, deepMat);
      // Big right crack
      addCrack([
        new THREE.Vector3(0.35, 0.65, 0.42),
        new THREE.Vector3(0.28, 0.52, 0.52),
        new THREE.Vector3(0.20, 0.35, 0.56),
        new THREE.Vector3(0.10, 0.22, 0.58)
      ], 0.026, deepMat);
      // Branching from center
      addCrack([
        new THREE.Vector3(0.03, 0.60, 0.64),
        new THREE.Vector3(0.15, 0.62, 0.60),
        new THREE.Vector3(0.25, 0.58, 0.55)
      ], 0.018, crackMat);
      addCrack([
        new THREE.Vector3(-0.02, 0.40, 0.64),
        new THREE.Vector3(-0.15, 0.35, 0.60),
        new THREE.Vector3(-0.28, 0.32, 0.52)
      ], 0.018, crackMat);
      // Bottom left web crack
      addCrack([
        new THREE.Vector3(-0.25, 0.38, 0.55),
        new THREE.Vector3(-0.35, 0.30, 0.48),
        new THREE.Vector3(-0.38, 0.20, 0.40)
      ], 0.022, deepMat);
      // Extra spiderweb from center
      addCrack([
        new THREE.Vector3(0.0, 0.50, 0.64),
        new THREE.Vector3(-0.10, 0.55, 0.62),
        new THREE.Vector3(-0.22, 0.58, 0.56)
      ], 0.015, crackMat);
      addCrack([
        new THREE.Vector3(0.0, 0.50, 0.64),
        new THREE.Vector3(0.08, 0.45, 0.64),
        new THREE.Vector3(0.18, 0.42, 0.60)
      ], 0.015, crackMat);
    }
  }

  _buildWallnut(group, phong) {
    // ── Color palette (matches image) ──
    const BODY_COLOR   = 0xF5A020;  // bright orange main body
    const BODY_DARK    = 0xD07800;  // darker orange shading
    const DOT_COLOR    = 0x4499EE;  // vivid blue polka dots
    const DOT_DARK     = 0x2266CC;  // darker blue on dot sides
    const BROW_COLOR   = 0x7B3A10;  // brown angry brows
    const CHIN_COLOR   = 0xE08010;  // slightly darker orange chin ridges
    const OUTLINE      = 0x3A1800;  // very dark brown outline/dark
    const VINE_COLOR   = 0x3D8A28;  // mid green curling arms
    const VINE_DARK    = 0x265C18;  // darker green vine shadow
    const ROOT_COLOR   = 0x7B4410;  // warm brown root feet
    const ROOT_DARK    = 0x4A2808;  // dark brown root shadow
    const BODY_LIGHT   = 0xFFC13A;  // warm highlight

    // ── Teardrop/onion body — matte organic ──
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.60, 24, 24),
      phong(BODY_COLOR, { shininess: 7, specular: 0x0a0a0a })
    );
    body.position.y = 0.45;
    body.scale.set(1.0, 1.35, 0.88);  // taller than wide = teardrop
    body.userData.isBump = false;
    group.add(body);
    const pointCap = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.28, 18),
      phong(BODY_COLOR, { shininess: 8, specular: 0x0a0a0a })
    );
    pointCap.position.set(-0.20, 1.22, 0.00);
    pointCap.rotation.z = -0.38;
    pointCap.scale.set(0.78, 1.0, 0.72);
    group.add(pointCap);
    const bodyHighlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 14, 12),
      phong(BODY_LIGHT, { shininess: 70, specular: 0xFFDD88, emissive: 0xAA5500, ei: 0.05 })
    );
    bodyHighlight.position.set(0.18, 0.78, 0.36);
    bodyHighlight.scale.set(0.78, 0.52, 0.18);
    bodyHighlight.material.transparent = true;
    bodyHighlight.material.opacity = 0.28;
    group.add(bodyHighlight);

    // Darker shading on lower-left side (gives 3D depth)
    const shade = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 16, 16),
      phong(BODY_DARK, { shininess: 20 })
    );
    shade.position.set(-0.08, 0.28, -0.05);
    shade.scale.set(0.85, 0.65, 0.75);
    shade.material.transparent = true;
    shade.material.opacity = 0.55;
    group.add(shade);

    // Dark outline ring (lower body border, like cartoon outline)
    const outlineRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.595, 0.028, 8, 24),
      phong(OUTLINE, { shininess: 5 })
    );
    outlineRing.position.y = 0.10;
    outlineRing.rotation.x = Math.PI / 2;
    outlineRing.scale.set(1.0, 1, 0.88);
    group.add(outlineRing);

    // ── Blue polka dots (8 scattered, matte) ──
    const dotData = [
      // [x, y, z, scale]
      [-0.10, 0.88, 0.42, 0.12],  // top-left
      [ 0.28, 0.82, 0.38, 0.10],  // top-right
      [-0.34, 0.62, 0.38, 0.18],  // mid-left BIG
      [ 0.32, 0.60, 0.36, 0.11],  // mid-right
      [-0.22, 0.38, 0.48, 0.14],  // lower-left
      [ 0.18, 0.30, 0.50, 0.13],  // lower-right
      [-0.05, 0.18, 0.52, 0.10],  // bottom-center
      [ 0.10, 0.70, 0.48, 0.09],  // upper-center-right
    ];
    for (const [dx, dy, dz, ds] of dotData) {
      // Main dot (matte blue)
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(ds, 12, 10),
        phong(DOT_COLOR, { shininess: 8, specular: 0x080808 })
      );
      dot.position.set(dx, dy, dz);
      dot.scale.set(1.0, 1.0, 0.35);  // flat against surface
      dot.userData.isBump = true;
      group.add(dot);
      // Darker edge on dot (left-side shadow)
      const dotEdge = new THREE.Mesh(
        new THREE.SphereGeometry(ds * 0.75, 10, 8),
        phong(DOT_DARK, { shininess: 25 })
      );
      dotEdge.position.set(dx - ds * 0.3, dy - ds * 0.1, dz - 0.01);
      dotEdge.scale.set(1.0, 1.0, 0.28);
      dotEdge.userData.isBump = true;
      group.add(dotEdge);
    }

    // ── Angry furrowed brows ──
    for (let side = -1; side <= 1; side += 2) {
      // Main thick brow
      const browCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.06, 0.72, 0.44),
        new THREE.Vector3(side * 0.18, 0.74, 0.42),
        new THREE.Vector3(side * 0.30, 0.68, 0.38)
      ]);
      const brow = new THREE.Mesh(
        new THREE.TubeGeometry(browCurve, 6, 0.038, 8, false),
        phong(BROW_COLOR, { shininess: 20 })
      );
      group.add(brow);
      // Inner spike/horn pointing downward from brow
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.025, 0.10, 6),
        phong(BROW_COLOR, { shininess: 15 })
      );
      spike.position.set(side * 0.08, 0.635, 0.455);
      spike.rotation.x = 0.3;
      spike.rotation.z = side * -0.3;
      group.add(spike);
    }

    // ── Glossy dark oval eyes, matching the muzzle plant treatment ──
    for (let side = -1; side <= 1; side += 2) {
      const eyeSocket = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 14, 12),
        phong(0x7A2A06, { shininess: 55, specular: 0xAA6622, emissive: 0x2A0900, ei: 0.04 })
      );
      eyeSocket.position.set(side * 0.19, 0.60, 0.455);
      eyeSocket.scale.set(1.08, 1.18, 0.42);
      group.add(eyeSocket);

      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.073, 14, 12),
        phong(0x050009, { shininess: 105, specular: 0x553322 })
      );
      eye.position.set(side * 0.19, 0.60, 0.493);
      eye.scale.set(0.9, 1.15, 0.46);
      group.add(eye);

      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 5, 5),
        phong(0xffffff, { emissive: 0xffffff, ei: 0.9 })
      );
      spark.position.set(side * 0.172, 0.622, 0.525);
      group.add(spark);
    }

    // ── Chin ridges (3 horizontal wavy ridges on lower face) ──
    for (let r = 0; r < 3; r++) {
      const ridgeY = 0.38 - r * 0.095;
      const ridgeZ = 0.46 + r * 0.020;
      const ridgeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.28 + r * 0.02, ridgeY,       ridgeZ - 0.04),
        new THREE.Vector3(-0.10,            ridgeY + 0.01, ridgeZ),
        new THREE.Vector3( 0.0,             ridgeY + 0.02, ridgeZ + 0.01),
        new THREE.Vector3( 0.10,            ridgeY + 0.01, ridgeZ),
        new THREE.Vector3( 0.28 - r * 0.02, ridgeY,       ridgeZ - 0.04)
      ]);
      const ridge = new THREE.Mesh(
        new THREE.TubeGeometry(ridgeCurve, 10, 0.022, 7, false),
        phong(OUTLINE, { shininess: 10 })
      );
      group.add(ridge);
      // Lighter raised ridge surface
      const ridgeLight = new THREE.Mesh(
        new THREE.TubeGeometry(ridgeCurve, 10, 0.014, 6, false),
        phong(CHIN_COLOR, { shininess: 30 })
      );
      group.add(ridgeLight);
    }

    // ── Central green stem/trunk ──
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.55, 0),
      new THREE.Vector3(0.02, -0.35, 0),
      new THREE.Vector3(0, -0.15, 0)
    ]);
    const trunk = new THREE.Mesh(
      new THREE.TubeGeometry(trunkCurve, 8, 0.11, 10, false),
      phong(VINE_COLOR, { shininess: 25 })
    );
    group.add(trunk);
    // Trunk highlight stripe
    const trunkHl = new THREE.Mesh(
      new THREE.TubeGeometry(trunkCurve, 8, 0.04, 6, false),
      phong(0x55CC44, { shininess: 35 })
    );
    trunkHl.scale.set(0.5, 1, 0.5);
    trunkHl.position.z = 0.06;
    group.add(trunkHl);

    // ── LEFT curling vine arm ──
    const lArmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3( 0.0,  0.12, 0),
      new THREE.Vector3(-0.20, 0.08, 0.02),
      new THREE.Vector3(-0.40,-0.02, 0.02),
      new THREE.Vector3(-0.55,-0.08, 0.01),
      new THREE.Vector3(-0.62,-0.22, 0),
      new THREE.Vector3(-0.55,-0.36, 0),
      new THREE.Vector3(-0.44,-0.38, 0)
    ]);
    const lArm = new THREE.Mesh(
      new THREE.TubeGeometry(lArmCurve, 14, 0.065, 10, false),
      phong(VINE_COLOR, { shininess: 28 })
    );
    group.add(lArm);
    // Dark inner shadow strip on arm
    const lArmDark = new THREE.Mesh(
      new THREE.TubeGeometry(lArmCurve, 14, 0.030, 8, false),
      phong(VINE_DARK, { shininess: 10 })
    );
    group.add(lArmDark);

    // ── RIGHT curling vine arm ──
    const rArmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3( 0.0,  0.12, 0),
      new THREE.Vector3( 0.20, 0.08, 0.02),
      new THREE.Vector3( 0.40,-0.02, 0.02),
      new THREE.Vector3( 0.55,-0.08, 0.01),
      new THREE.Vector3( 0.62,-0.22, 0),
      new THREE.Vector3( 0.55,-0.36, 0),
      new THREE.Vector3( 0.44,-0.38, 0)
    ]);
    const rArm = new THREE.Mesh(
      new THREE.TubeGeometry(rArmCurve, 14, 0.065, 10, false),
      phong(VINE_COLOR, { shininess: 28 })
    );
    group.add(rArm);
    const rArmDark = new THREE.Mesh(
      new THREE.TubeGeometry(rArmCurve, 14, 0.030, 8, false),
      phong(VINE_DARK, { shininess: 10 })
    );
    group.add(rArmDark);

    // ── Brown claw root feet (LEFT side — 3 toes) ──
    const leftFootAngles = [-0.55, -0.90, -1.25];
    for (let i = 0; i < 3; i++) {
      const a = leftFootAngles[i];
      const toeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.10, -0.55, 0.02),
        new THREE.Vector3(-0.10 + Math.cos(a) * 0.18, -0.60 + Math.sin(Math.abs(a)) * -0.12, 0.02),
        new THREE.Vector3(-0.10 + Math.cos(a) * 0.38, -0.65 + Math.sin(Math.abs(a)) * -0.10, 0.02)
      ]);
      const toe = new THREE.Mesh(
        new THREE.TubeGeometry(toeCurve, 6, 0.048 - i * 0.005, 7, false),
        phong(ROOT_COLOR, { shininess: 15 })
      );
      group.add(toe);
      // Dark shadow under toe
      const toeDark = new THREE.Mesh(
        new THREE.TubeGeometry(toeCurve, 6, 0.022, 5, false),
        phong(ROOT_DARK, { shininess: 5 })
      );
      group.add(toeDark);
    }

    // ── Brown claw root feet (RIGHT side — 3 toes) ──
    const rightFootAngles = [0.55, 0.90, 1.25];
    for (let i = 0; i < 3; i++) {
      const a = rightFootAngles[i];
      const toeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3( 0.10, -0.55, 0.02),
        new THREE.Vector3( 0.10 + Math.cos(a) * 0.18, -0.60 + Math.sin(Math.abs(a)) * -0.12, 0.02),
        new THREE.Vector3( 0.10 + Math.cos(a) * 0.38, -0.65 + Math.sin(Math.abs(a)) * -0.10, 0.02)
      ]);
      const toe = new THREE.Mesh(
        new THREE.TubeGeometry(toeCurve, 6, 0.048 - i * 0.005, 7, false),
        phong(ROOT_COLOR, { shininess: 15 })
      );
      group.add(toe);
      const toeDark = new THREE.Mesh(
        new THREE.TubeGeometry(toeCurve, 6, 0.022, 5, false),
        phong(ROOT_DARK, { shininess: 5 })
      );
      group.add(toeDark);
    }
  }

  _updatePlasmaPodAnimation(dt) {
    const rig = this._plasmaPodRig;
    if (!rig) return;

    this.plasmaAnimTime += dt;
    const idleFps = 7;
    const idleFrame = Math.floor(this.plasmaAnimTime * idleFps) % 4;
    const idlePoses = [
      { bob: 0.000, sway: 0.000, curve: 0.000, leaf: 0.000 },
      { bob: 0.035, sway: 0.018, curve: 0.018, leaf: 0.020 },
      { bob: 0.055, sway: 0.030, curve: 0.030, leaf: 0.035 },
      { bob: 0.015, sway: 0.010, curve: 0.010, leaf: 0.012 }
    ];
    const idle = idlePoses[idleFrame];
    this.plasmaIdleFrame = idleFrame;

    rig.headGroup.position.copy(rig.headBase);
    rig.headGroup.position.y += idle.bob;
    rig.headGroup.position.x += Math.sin(this.plasmaAnimTime * Math.PI * 2.0) * 0.010;
    rig.headGroup.rotation.z = idle.sway;
    rig.headGroup.scale.copy(rig.headBaseScale);

    rig.barrelGroup.position.copy(rig.barrelBase);
    rig.barrelGroup.scale.copy(rig.barrelBaseScale);
    rig.mouth.scale.copy(rig.mouthBaseScale);

    rig.stem.scale.copy(rig.stemBaseScale);
    rig.stem.scale.x = 1 + idle.curve * 0.65;
    rig.stem.rotation.z = idle.curve * -0.45;
    rig.stemShade.scale.copy(rig.stemShadeBaseScale);
    rig.stemShade.scale.x = rig.stem.scale.x;
    rig.stemShade.rotation.z = rig.stem.rotation.z;

    rig.leafGroups.forEach((leaf, index) => {
      const side = leaf.baseZ >= 0 ? 1 : -1;
      leaf.node.rotation.z = leaf.baseZ + side * idle.leaf * (index < 2 ? 1 : 0.55);
      leaf.node.position.y = leaf.baseY + idle.bob * 0.32;
    });
    rig.neckLeaves.forEach(leaf => {
      const side = leaf.baseZ >= 0 ? 1 : -1;
      leaf.node.rotation.z = leaf.baseZ + side * idle.leaf * 0.75;
    });

    rig.shootGlow.material.opacity = 0;
    this.plasmaShootFrame = -1;
    if (this.shootAnim > 0) {
      const progress = 1 - this.shootAnim;
      const shootFrame = Math.min(2, Math.floor(progress * 3));
      this.plasmaShootFrame = shootFrame;
      const shootPoses = [
        { recoil: 0.015, squash: 1.00, open: 1.00, glow: 0.10 },
        { recoil: 0.105, squash: 0.88, open: 1.28, glow: 0.85 },
        { recoil: 0.040, squash: 0.96, open: 1.08, glow: 0.25 }
      ];
      const pose = shootPoses[shootFrame];
      rig.headGroup.position.z -= pose.recoil;
      rig.headGroup.scale.set(
        rig.headBaseScale.x * (1 + (1 - pose.squash) * 0.18),
        rig.headBaseScale.y * pose.squash,
        rig.headBaseScale.z * (1 + (1 - pose.squash) * 0.12)
      );
      rig.barrelGroup.position.z -= pose.recoil * 0.45;
      rig.barrelGroup.scale.set(
        rig.barrelBaseScale.x * pose.open,
        rig.barrelBaseScale.y * pose.open,
        rig.barrelBaseScale.z * (1 - (pose.open - 1) * 0.18)
      );
      rig.mouth.scale.set(
        rig.mouthBaseScale.x * pose.open,
        rig.mouthBaseScale.y * pose.open,
        rig.mouthBaseScale.z
      );
      rig.stem.scale.y = rig.stemBaseScale.y * pose.squash;
      rig.stemShade.scale.y = rig.stemShadeBaseScale.y * pose.squash;
      rig.shootGlow.material.opacity = pose.glow;
      rig.shootGlow.scale.setScalar(1 + pose.glow * 0.85);
      rig.shootGlow.scale.z = 0.45;
    }
  }

  update(dt) {
    super.update(dt);
    if (!this.alive) return;
    // Gentle bobbing
    const idleClock = Date.now() * 0.001 + this.idlePhase;
    const breathe = 1 + Math.sin(idleClock * 2.2) * 0.018;
    this.mesh.scale.x = 1 + Math.sin(idleClock * 1.7) * 0.008;
    this.mesh.scale.y = breathe;
    this.mesh.scale.z = 1 - Math.sin(idleClock * 2.2) * 0.006;
    this.mesh.position.y = this.position.y + Math.sin(idleClock * 3) * 0.045;
    if (this._antennaGlow) {
      this._antennaGlow.scale.setScalar(1 + Math.sin(idleClock * 5.5) * 0.18);
      this._antennaGlow.material.opacity = 0.56 + Math.sin(idleClock * 4.5) * 0.18;
    }
    if (this._chargeGlow) {
      const charging = this.hasZombieInLane() ? Math.max(0, Math.min(1, (this.shootTimer - 0.85) / 0.60)) : 0;
      const chargePulse = charging * (0.45 + Math.sin(idleClock * 10) * 0.12);
      this._chargeGlow.material.opacity = chargePulse;
      this._chargeGlow.scale.setScalar(1 + charging * 0.9);
      this._chargeGlow.scale.z = 0.45;
      if (this._chargeLight) this._chargeLight.intensity = charging * 0.75;
    }
    if (this.type === 'peashooter') {
      this._updatePlasmaPodAnimation(dt);
    }
    if (this.type === 'peashooter' || this.type === 'snowpea') {
      this.shootTimer += dt;
      const fireInterval = window.game && window.game.getPlantFireInterval ? window.game.getPlantFireInterval(this.type) : 1.5;
      if (this.shootTimer >= fireInterval) {
        if (this.hasZombieInLane()) {
          this.shootTimer = 0;
          this.shootAnim = 1;
          this.shoot();
        }
      }
    }
    if (this.type === 'repeater') {
      this.shootTimer += dt;
      if (this.repeaterSecondShot > 0) {
        this.repeaterSecondShot -= dt;
        if (this.repeaterSecondShot <= 0) {
          this.shootAnim = 1;
          this.shoot();
        }
      }
      const fireInterval = window.game && window.game.getPlantFireInterval ? window.game.getPlantFireInterval(this.type) : 1.5;
      if (this.shootTimer >= fireInterval) {
        if (this.hasZombieInLane()) {
          this.shootTimer = 0;
          this.shootAnim = 1;
          this.shoot();
          this.repeaterSecondShot = 0.15;
        }
      }
    }
    if (this.type === 'potato_mine') {
      if (!this.mineArmed) {
        this.mineArmTimer += dt;
        // Takes 14 seconds to arm
        if (this.mineArmTimer >= 14) {
          this.mineArmed = true;
          this._minePopTimer = 0;
          // Light turns red when armed
          if (this._mineLight) {
            this._mineLight.material.color.setHex(0xFF0000);
            this._mineLight.material.emissive.setHex(0xFF0000);
            this._mineLight.material.emissiveIntensity = 0.8;
          }
        } else {
          // Blink the light dimly while arming
          if (this._mineLight) {
            const blink = Math.sin(Date.now() * 0.005) > 0;
            this._mineLight.material.emissive.setHex(blink ? 0x664400 : 0x000000);
            this._mineLight.material.emissiveIntensity = blink ? 0.3 : 0;
          }
        }
      }
      // Check for zombie contact only when armed
      if (this.mineArmed) {
        // Armed - blink red
        if (this._mineLight) {
          const blink = Math.sin(Date.now() * 0.01) > 0;
          this._mineLight.material.emissiveIntensity = blink ? 1.0 : 0.3;
        }
        // Pop up from underground in 0.5s
        if (this._minePopTimer !== undefined && this._minePopTimer < 0.5) {
          this._minePopTimer += dt;
          const popT = Math.min(this._minePopTimer / 0.5, 1);
          // Ease out bounce
          const eased = popT < 0.7 ? (popT / 0.7) * 1.15 : 1.15 - (popT - 0.7) / 0.3 * 0.15;
          this.position.y = 0.1 + eased * 0.5;
        } else {
          this.position.y = 0.6;
        }
      } else {
        // Stay underground while not armed
        this.position.y = 0.1;
      }
      if (this.mineArmed) {
        const target = this._getMineTarget();
        if (target) {
          // EXPLODE! Damage all zombies in radius
          const zombies = window.game.zombies;
          for (const z of zombies) {
            if (!z.alive || z.dying) continue;
            const dx = z.position.x - this.position.x;
            const dz = z.position.z - this.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 2.0) {
              z.explodeDeath();
            }
          }
          // Dramatic explosion effect
          this._spawnExplosion();
          // Self-destruct
          const tile = window.game.getTile(this.row, this.col);
          if (tile) tile.plant = null;
          this.destroy();
        }
      }
    }
    if (this.type === 'chomper') {
      this._updateChomper(dt);
    }
    if (this.type === 'sunflower') {
      this.sunTimer += dt;
      const sunInterval = window.game && window.game.getSolarBloomInterval ? window.game.getSolarBloomInterval(this.firstSunProduced) : (this.firstSunProduced ? 12 : 5);
      // Glow only in the last 3 seconds before producing sun
      const timeLeft = sunInterval - this.sunTimer;
      const glowProgress = timeLeft <= 3 ? 1 - (timeLeft / 3) : 0;
      const glowIntensity = glowProgress * glowProgress * (3 - 2 * glowProgress) * 0.8;
      this.mesh.traverse(child => {
        if (child.isMesh && child.material && child.material.emissive) {
          if (child.userData._sfBaseEmissive === undefined) {
            child.userData._sfBaseEmissive = child.material.emissive.getHex();
            child.userData._sfBaseEI = child.material.emissiveIntensity;
          }
          child.material.emissive.setHex(glowIntensity > 0.1 ? 0xFF7A18 : child.userData._sfBaseEmissive);
          child.material.emissiveIntensity = child.userData._sfBaseEI + glowIntensity;
        }
      });
      if (this.sunTimer >= sunInterval) {
        this.firstSunProduced = true;
        this.sunTimer = 0;
        // Reset glow
        this.mesh.traverse(child => {
          if (child.isMesh && child.material && child.userData._sfBaseEmissive !== undefined) {
            child.material.emissive.setHex(child.userData._sfBaseEmissive);
            child.material.emissiveIntensity = child.userData._sfBaseEI;
          }
        });
        const sun = new Sun(this.scene, this.position.x, this.position.y + 0.5, this.position.z, true);
        window.game.entities.push(sun);
        window.game.suns.push(sun);
      }
      // Happy sway
      this.mesh.rotation.z = Math.sin(Date.now() * 0.003) * 0.1;
    }
    // Shoot animation (recoil)
    if ((this.type === 'peashooter' || this.type === 'snowpea' || this.type === 'repeater') && this.shootAnim > 0) {
      this.shootAnim -= dt * 4;
      if (this.shootAnim < 0) this.shootAnim = 0;
      if (this.type !== 'peashooter') {
        const recoil = Math.sin(this.shootAnim * Math.PI) * 0.15;
        this.mesh.position.x = this.position.x - recoil;
        const puff = 1 + Math.sin(this.shootAnim * Math.PI) * 0.15;
        if (this.mesh.children[9]) this.mesh.children[9].scale.set(puff, puff * 0.95, puff * 0.95);
      }
    }
    // Hit flash
    if (this.hitFlash > 0) {
      this.hitFlash -= dt * 5;
      if (this.hitFlash < 0) this.hitFlash = 0;
      const flash = this.hitFlash > 0.5;
      this._traverseFlash(this.mesh, flash);
    }
    // Damage visuals for wallnut
    if (this.type === 'wallnut' && this.mesh.children[0]) {
      const ratio = this.hp / this.maxHp;
      let newStage = ratio < 0.33 ? 2 : (ratio < 0.66 ? 1 : 0);
      if (this._wallnutStage === undefined) this._wallnutStage = 0;
      if (newStage !== this._wallnutStage) {
        this._wallnutStage = newStage;
        if (newStage === 2) {
          this.mesh.children[0].material.color.setHex(0x9B7924);
        } else if (newStage === 1) {
          this.mesh.children[0].material.color.setHex(0xB0904A);
        }
        // Remove old crack meshes
        const toRemove = this.mesh.children.filter(c => c.userData.isCrack);
        toRemove.forEach(c => this.mesh.remove(c));
        // Add cracks and dents
        this._addWallnutDamage(newStage);
        // Deform body to look crumpled
        if (newStage >= 1) {
          this.mesh.children[0].scale.set(1 - newStage * 0.04, 1.05 - newStage * 0.05, 0.88 - newStage * 0.03);
        }
        // Re-store original colors after texture change
        this._clearOrigColors(this.mesh);
        this._storeOrigColors(this.mesh);
      }
      if (newStage === 2) {
        this.mesh.rotation.z = Math.sin(Date.now() * 0.01) * 0.06;
      } else if (newStage === 1) {
        this.mesh.rotation.z = Math.sin(Date.now() * 0.005) * 0.03;
      }
    }
  }

  hasZombieInLane() {
    return window.game.zombies.some(z => z.alive && !z.dying && z.row === this.row && z.position.x > this.position.x);
  }

  shoot() {
    const isFrozen = this.type === 'snowpea';
    if (window.game && window.game._playSfx) window.game._playSfx(isFrozen ? 'ion' : 'plasma');
    const p = new Projectile(this.scene, this.position.x + 0.5, this.position.y + 0.5, this.position.z, this.row, isFrozen, this.type);
    window.game.entities.push(p);
    window.game.projectiles.push(p);
  }

  _traverseFlash(obj, flash) {
    obj.children.forEach(c => {
      if (c.material && c.userData.origColor !== undefined) {
        c.material.color.setHex(flash ? 0xffffff : c.userData.origColor);
      }
      if (c.children && c.children.length > 0) this._traverseFlash(c, flash);
    });
  }

  _storeOrigColors(obj) {
    obj.children.forEach(c => {
      if (c.material && c.userData.origColor === undefined) {
        c.userData.origColor = c.material.color.getHex();
      }
      if (c.children && c.children.length > 0) this._storeOrigColors(c);
    });
  }

  _clearOrigColors(obj) {
    obj.children.forEach(c => {
      if (c.material) {
        c.userData.origColor = undefined;
      }
      if (c.children && c.children.length > 0) this._clearOrigColors(c);
    });
  }

  takeDamage(dmg) {
    this.hp -= dmg;
    this.hitFlash = 1;
    this._storeOrigColors(this.mesh);
    if (this.hp <= 0) {
      const tile = window.game.getTile(this.row, this.col);
      if (tile) tile.plant = null;
      this.destroy();
    }
  }
}
