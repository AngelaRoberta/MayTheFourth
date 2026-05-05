class Zombie extends GameObject3D {
  constructor(scene, row, x, type) {
    super(scene);
    this.type = type || 'normal';
    const labels = { normal: 'Imperial Trooper', conehead: 'Conehead Trooper', buckethead: 'Heavy Trooper', scout: 'Scout Trooper', droid: 'Droid Walker' };
    this.name = labels[this.type] || 'Imperial Trooper';
    this.row = row;
    this.maxHp = this.type === 'droid' ? 24 : this.type === 'buckethead' ? 30 : this.type === 'conehead' ? 20 : this.type === 'scout' ? 8 : 10;
    this.armFallen = false;
    this.headgearDamaged = false;
    this.hp = this.maxHp;
    this.headgearFallen = false;
    this.speed = this.type === 'scout' ? 0.58 : this.type === 'droid' ? 0.32 : 0.4;
    this.baseSpeed = this.speed;
    this.damage = 50;
    this.attackTimer = 0;
    this.targetPlant = null;
    this.frozen = false;
    this.frozenTimer = 0;
    this.hitFlash = 0;
    this.position.set(x, 0.75, row * 2 - 4);
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();

    const phong = (color, opts = {}) => new THREE.MeshPhongMaterial({
      color,
      shininess: opts.shininess !== undefined ? opts.shininess : 60,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.ei || 0,
      specular: opts.specular || 0x555555
    });

    // ── Stormtrooper color palette ──
    const WHITE       = 0xF4F0E8;  // clean off-white armor
    const WHITE_SHADE = 0xDDDAD0;  // shaded armor panels
    const WHITE_DARK  = 0xBBB8B0;  // recessed/dark panel edges
    const BLACK       = 0x0D0D0D;  // undersuit / visor
    const BLACK_SOFT  = 0x1A1A1A;  // softer black for joints
    const LENS_BLACK  = 0x050508;  // dark visor lenses
    const GRAY_MID    = 0x444444;  // dark panel detail
    const ZOMBIE_SKIN = 0x78B85E;
    const ZOMBIE_DARK = 0x315F34;
    const ZOMBIE_SPOT = 0x23502C;
    const EYE_YELLOW  = 0xF4E66A;
    const TOOTH       = 0xE9D8A0;
    const MOUTH_DARK  = 0x2B120F;
    const SCUFF       = 0x8A8374;

    const addScuff = (parent, x, y, z, sx = 1, sy = 1, rot = 0) => {
      const scuff = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 6, 5),
        phong(SCUFF, { shininess: 8, specular: 0x111111 })
      );
      scuff.position.set(x, y, z);
      scuff.scale.set(sx, sy, 0.18);
      scuff.rotation.z = rot;
      parent.add(scuff);
      return scuff;
    };

    // ── TORSO (child 0) ──
    const torsoGroup = new THREE.Group();

    // Black undersuit body core
    const undersuit = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.23, 0.30, 8, 12),
      phong(BLACK_SOFT, { shininess: 5 })
    );
    undersuit.position.y = 0.0;
    torsoGroup.add(undersuit);

    // Front chest plate — iconic stormtrooper two-panel chest
    const chestMain = new THREE.Mesh(
      new THREE.BoxGeometry(0.50, 0.38, 0.11),
      phong(WHITE, { shininess: 90, specular: 0xCCCCC0 })
    );
    chestMain.position.set(0, 0.10, 0.125);
    torsoGroup.add(chestMain);

    // Chest horizontal ridge divider
    const chestRidge = new THREE.Mesh(
      new THREE.BoxGeometry(0.50, 0.022, 0.09),
      phong(WHITE_DARK, { shininess: 50 })
    );
    chestRidge.position.set(0, 0.105, 0.155);
    torsoGroup.add(chestRidge);

    // Chest vertical center line
    const chestVLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.36, 0.075),
      phong(WHITE_DARK, { shininess: 50 })
    );
    chestVLine.position.set(0, 0.10, 0.150);
    torsoGroup.add(chestVLine);

    // Upper chest notch (left panel indent near shoulder)
    for (const sx of [-0.14, 0.14]) {
      const notch = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, 0.07, 0.06),
        phong(WHITE_DARK, { shininess: 40 })
      );
      notch.position.set(sx, 0.22, 0.145);
      torsoGroup.add(notch);
    }

    // Belly/ab plate — separate lower chest armor
    const bellyPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.22, 0.10),
      phong(WHITE, { shininess: 80, specular: 0xCCCCC0 })
    );
    bellyPlate.position.set(0, -0.19, 0.120);
    torsoGroup.add(bellyPlate);

    // Belly horizontal segment lines (3 rows)
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.018, 0.085),
        phong(WHITE_DARK, { shininess: 40 })
      );
      seg.position.set(0, -0.10 - i * 0.06, 0.145);
      torsoGroup.add(seg);
    }

    // Belt/waist — black with white rectangular segments
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.095, 0.115),
      phong(BLACK, { shininess: 10 })
    );
    belt.position.set(0, -0.32, 0.10);
    torsoGroup.add(belt);

    // Belt white box segments (3 across)
    for (let bx = -1; bx <= 1; bx++) {
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.072, 0.07),
        phong(WHITE_SHADE, { shininess: 60 })
      );
      seg.position.set(bx * 0.14, -0.32, 0.145);
      torsoGroup.add(seg);
    }

    // Back plate
    const backPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.55, 0.09),
      phong(WHITE_SHADE, { shininess: 70 })
    );
    backPlate.position.set(0, 0.0, -0.12);
    torsoGroup.add(backPlate);

    // Back detail ridges
    for (let i = 0; i < 2; i++) {
      const br = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.016, 0.065),
        phong(WHITE_DARK, { shininess: 40 })
      );
      br.position.set(0, 0.12 - i * 0.14, -0.145);
      torsoGroup.add(br);
    }

    // Dirt chips and battle wear, matching the rough trooper reference.
    addScuff(torsoGroup, -0.18, 0.21, 0.185, 1.4, 0.45, -0.35);
    addScuff(torsoGroup, 0.17, 0.02, 0.180, 1.0, 0.55, 0.55);
    addScuff(torsoGroup, -0.08, -0.18, 0.170, 1.2, 0.42, 0.20);
    addScuff(torsoGroup, 0.22, -0.26, 0.155, 0.9, 0.45, -0.15);

    // Shoulder pauldrons — rounded white plates
    for (let side = -1; side <= 1; side += 2) {
      const pld = new THREE.Mesh(
        new THREE.SphereGeometry(0.160, 16, 12),
        phong(WHITE, { shininess: 100, specular: 0xDDDDD8 })
      );
      pld.scale.set(1.30, 0.75, 1.05);
      pld.position.set(side * 0.31, 0.24, 0.02);
      torsoGroup.add(pld);
      // Pauldron lower edge ridge
      const pldEdge = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.07, 0.26),
        phong(WHITE_DARK, { shininess: 55 })
      );
      pldEdge.position.set(side * 0.40, 0.18, 0.0);
      torsoGroup.add(pldEdge);
      // Black connector at shoulder joint
      const pldConn = new THREE.Mesh(
        new THREE.SphereGeometry(0.070, 8, 8),
        phong(BLACK_SOFT, { shininess: 10 })
      );
      pldConn.position.set(side * 0.295, 0.15, 0.02);
      torsoGroup.add(pldConn);
    }

    // Buckethead: heavier dark armor overlay over the torso
    if (this.type === 'buckethead') {
      // Dark overlay chest
      const darkChest = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.44, 0.14),
        phong(0x1A1A22, { shininess: 25 })
      );
      darkChest.position.set(0, 0.08, 0.115);
      torsoGroup.add(darkChest);
      // Glowing red chest orb
      const chestOrb = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 14, 14),
        phong(0xFF1100, { shininess: 80, emissive: 0xFF2200, ei: 0.9, specular: 0xFF8844 })
      );
      chestOrb.position.set(0, 0.08, 0.205);
      torsoGroup.add(chestOrb);
      const orbRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.015, 8, 18),
        phong(0x330000, { shininess: 30 })
      );
      orbRing.position.set(0, 0.08, 0.200);
      orbRing.rotation.x = Math.PI / 2;
      torsoGroup.add(orbRing);
    }

    torsoGroup.position.y = 0;
    group.add(torsoGroup); // child 0

    // ── HEAD (child 1) ──
    const headGroup = new THREE.Group();

    // ── Exposed zombie trooper head with cracked helmet cap ──
    const helmetGroup = new THREE.Group();

    const zombieHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.285, 24, 20),
      phong(ZOMBIE_SKIN, { shininess: 10, specular: 0x224422 })
    );
    zombieHead.position.set(0, -0.03, 0.08);
    zombieHead.scale.set(0.92, 1.05, 0.82);
    helmetGroup.add(zombieHead);

    const faceShade = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 12),
      phong(ZOMBIE_DARK, { shininess: 6 })
    );
    faceShade.position.set(-0.05, -0.11, 0.18);
    faceShade.scale.set(0.72, 0.72, 0.30);
    faceShade.material.transparent = true;
    faceShade.material.opacity = 0.46;
    helmetGroup.add(faceShade);

    for (const [sx, sy, sz, ss] of [
      [-0.13, 0.02, 0.30, 0.035],
      [0.13, -0.13, 0.30, 0.030],
      [-0.02, -0.19, 0.32, 0.022],
      [0.18, 0.04, 0.22, 0.026]
    ]) {
      const spot = new THREE.Mesh(
        new THREE.SphereGeometry(ss, 7, 6),
        phong(ZOMBIE_SPOT, { shininess: 6 })
      );
      spot.position.set(sx, sy, sz);
      spot.scale.set(1.0, 0.82, 0.30);
      helmetGroup.add(spot);
    }

    // Main cracked helmet dome, sitting high so the zombie face shows.
    const helmetDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.310, 24, 18),
      phong(WHITE, { shininess: 100, specular: 0xCCCCC8 })
    );
    helmetDome.scale.set(1.02, 0.62, 0.92);
    helmetDome.position.set(0, 0.225, 0.0);
    helmetGroup.add(helmetDome);

    const helmetCut = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.085, 0.42),
      phong(BLACK, { shininess: 10 })
    );
    helmetCut.position.set(0, 0.095, 0.04);
    helmetGroup.add(helmetCut);

    // Black brow band across the cracked cap.
    const visorBand = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.045, 0.16),
      phong(BLACK, { shininess: 15 })
    );
    visorBand.position.set(0, 0.115, 0.245);
    helmetGroup.add(visorBand);

    const helmetRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.305, 0.020, 8, 24),
      phong(WHITE_DARK, { shininess: 45 })
    );
    helmetRim.position.set(0, 0.085, 0.020);
    helmetRim.rotation.x = Math.PI / 2;
    helmetRim.scale.set(1.02, 1, 0.80);
    helmetGroup.add(helmetRim);

    // Oversized yellow zombie eyes.
    const eyeLensData = [
      { x: -0.112, y: 0.018, z: 0.300 },
      { x:  0.112, y: 0.018, z: 0.300 }
    ];
    for (const ep of eyeLensData) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.083, 16, 14),
        phong(EYE_YELLOW, { shininess: 90, specular: 0xFFFFAA, emissive: 0x777000, ei: 0.12 })
      );
      eye.scale.set(1.0, 1.12, 0.48);
      eye.position.set(ep.x, ep.y, ep.z);
      helmetGroup.add(eye);
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 7, 7),
        phong(0x111000, { shininess: 35 })
      );
      pupil.position.set(ep.x + 0.014, ep.y - 0.004, ep.z + 0.046);
      helmetGroup.add(pupil);
      const glint = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 6, 6),
        phong(0xFFFFDD, { emissive: 0xffffff, ei: 0.7 })
      );
      glint.position.set(ep.x - 0.028, ep.y + 0.032, ep.z + 0.050);
      helmetGroup.add(glint);
    }

    // Nose slits and slack open mouth.
    for (const sx of [-1, 1]) {
      const nostril = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 6, 5),
        phong(0x0A140B, { shininess: 4 })
      );
      nostril.position.set(sx * 0.035, -0.072, 0.328);
      nostril.scale.set(0.85, 1.35, 0.35);
      helmetGroup.add(nostril);
    }

    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.165, 0.092, 0.055),
      phong(MOUTH_DARK, { shininess: 8 })
    );
    mouth.position.set(0, -0.172, 0.326);
    mouth.rotation.x = -0.05;
    helmetGroup.add(mouth);
    for (const [tx, ty, ts] of [[-0.055, -0.120, 0.020], [-0.015, -0.125, 0.018], [0.035, -0.124, 0.021], [0.070, -0.170, 0.017]]) {
      const tooth = new THREE.Mesh(
        new THREE.SphereGeometry(ts, 6, 5),
        phong(TOOTH, { shininess: 30, specular: 0xDDCC99 })
      );
      tooth.position.set(tx, ty, 0.357);
      tooth.scale.set(0.85, 1.2, 0.45);
      helmetGroup.add(tooth);
    }

    // Helmet ear and cheek armor panels remain around the exposed face.
    for (const sx of [-1, 1]) {
      const earDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.045, 14),
        phong(WHITE_SHADE, { shininess: 70 })
      );
      earDisc.rotation.z = Math.PI / 2;
      earDisc.position.set(sx * 0.312, -0.005, 0.045);
      helmetGroup.add(earDisc);
      const earDot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.048, 10),
        phong(BLACK_SOFT, { shininess: 20 })
      );
      earDot.rotation.z = Math.PI / 2;
      earDot.position.set(sx * 0.318, -0.005, 0.045);
      helmetGroup.add(earDot);
    }

    for (const sx of [-1, 1]) {
      const cheekPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.20, 0.24),
        phong(WHITE, { shininess: 90 })
      );
      cheekPlate.position.set(sx * 0.245, -0.125, 0.185);
      cheekPlate.rotation.y = sx * 0.36;
      helmetGroup.add(cheekPlate);
    }

    const crackedLines = [
      [[-0.19, 0.25, 0.25], [-0.14, 0.33, 0.19], [-0.10, 0.39, 0.12]],
      [[0.11, 0.20, 0.28], [0.16, 0.29, 0.20], [0.22, 0.35, 0.12]],
      [[-0.03, 0.16, 0.30], [0.02, 0.24, 0.24], [0.02, 0.34, 0.16]]
    ];
    for (const pts of crackedLines) {
      const crack = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 4, 0.006, 4, false),
        phong(0x28231C, { shininess: 4 })
      );
      helmetGroup.add(crack);
    }
    addScuff(helmetGroup, -0.20, 0.17, 0.29, 1.5, 0.45, -0.3);
    addScuff(helmetGroup, 0.18, 0.24, 0.24, 1.2, 0.40, 0.4);

    const neckGuard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.205, 0.220, 0.070, 20),
      phong(WHITE_SHADE, { shininess: 70 })
    );
    neckGuard.position.set(0, -0.285, 0.02);
    helmetGroup.add(neckGuard);

    headGroup.add(helmetGroup);

    // ── HEADGEAR variants ──
    if (this.type === 'conehead') {
      const coneGrp = new THREE.Group();
      // Orange rank stripe plate on top of helmet
      const rankPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.50, 0.095, 0.095),
        phong(0xFF6600, { shininess: 60 })
      );
      rankPlate.position.y = 0.47;
      coneGrp.add(rankPlate);
      // Stacked rank stripes going up
      for (let i = 0; i < 3; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, 0.020, 0.065),
          phong(0xFF8833)
        );
        stripe.position.y = 0.60 + i * 0.038;
        coneGrp.add(stripe);
      }
      // Glowing orange tip
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.042, 8, 8),
        phong(0xFF4400, { emissive: 0xFF2200, ei: 0.5 })
      );
      tip.position.y = 0.74;
      coneGrp.add(tip);
      headGroup.add(coneGrp);
    } else if (this.type === 'buckethead') {
      const bucketGrp = new THREE.Group();
      // Dark heavy officer cowl over helmet
      const cowl = new THREE.Mesh(
        new THREE.SphereGeometry(0.435, 22, 18),
        phong(0x0A0A12, { shininess: 20, specular: 0x111122 })
      );
      cowl.scale.set(1.06, 1.20, 1.02);
      cowl.position.set(0, 0.22, -0.01);
      bucketGrp.add(cowl);
      // Hood brim visor
      const hoodVisor = new THREE.Mesh(
        new THREE.BoxGeometry(0.70, 0.085, 0.36),
        phong(0x0E0E16, { shininess: 12 })
      );
      hoodVisor.position.set(0, 0.10, 0.05);
      bucketGrp.add(hoodVisor);
      // Side flaps
      for (const sx of [-1, 1]) {
        const flap = new THREE.Mesh(
          new THREE.BoxGeometry(0.155, 0.36, 0.21),
          phong(0x09090F, { shininess: 5 })
        );
        flap.position.set(sx * 0.355, -0.12, -0.01);
        flap.rotation.z = sx * 0.08;
        bucketGrp.add(flap);
      }
      // Top crest
      const darkCrest = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.12, 0.38),
        phong(0x151520, { shininess: 22 })
      );
      darkCrest.position.set(0, 0.40, 0.0);
      bucketGrp.add(darkCrest);
      // Glowing red eye replacements
      for (const sx of [-1, 1]) {
        const eyeGlow = new THREE.Mesh(
          new THREE.SphereGeometry(0.072, 14, 12),
          phong(0xFF0000, { shininess: 60, emissive: 0xFF2200, ei: 0.95, specular: 0xFF8844 })
        );
        eyeGlow.scale.set(1.0, 0.68, 0.55);
        eyeGlow.position.set(sx * 0.130, 0.10, 0.365);
        bucketGrp.add(eyeGlow);
        const eyeCore = new THREE.Mesh(
          new THREE.SphereGeometry(0.036, 8, 8),
          phong(0xFF8800, { shininess: 100, emissive: 0xFF6600, ei: 1.3 })
        );
        eyeCore.position.set(sx * 0.130, 0.10, 0.388);
        bucketGrp.add(eyeCore);
      }
      // Antennae
      for (const sx of [-1, 1]) {
        const antCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(sx * 0.07, 0.44, 0.16),
          new THREE.Vector3(sx * 0.11, 0.68, 0.10),
          new THREE.Vector3(sx * 0.09, 0.88, 0.03),
          new THREE.Vector3(sx * 0.045, 0.99, -0.03)
        ]);
        const ant = new THREE.Mesh(
          new THREE.TubeGeometry(antCurve, 8, 0.011, 5, false),
          phong(0x181820, { shininess: 30 })
        );
        bucketGrp.add(ant);
        const antTip = new THREE.Mesh(
          new THREE.SphereGeometry(0.022, 6, 6),
          phong(0x222230, { shininess: 40 })
        );
        antTip.position.set(sx * 0.045, 0.99, -0.03);
        bucketGrp.add(antTip);
      }
      headGroup.add(bucketGrp);
    }

    headGroup.position.y = 0.62;
    group.add(headGroup); // child 1

    // ── RIGHT ARM (child 2) — black undersuit + white armor bicep & forearm ──
    const rArmGroup = new THREE.Group();

    // Black undersuit upper arm
    const rUnderUpper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.055, 0.28, 10),
      phong(BLACK_SOFT, { shininess: 5 })
    );
    rUnderUpper.position.y = -0.10;
    rArmGroup.add(rUnderUpper);

    // White bicep armor
    const rBicep = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 10),
      phong(WHITE, { shininess: 90, specular: 0xCCCCC0 })
    );
    rBicep.scale.set(0.85, 1.30, 0.85);
    rBicep.position.y = -0.06;
    rArmGroup.add(rBicep);

    // Black elbow joint
    const rElbow = new THREE.Mesh(
      new THREE.SphereGeometry(0.058, 10, 8),
      phong(BLACK_SOFT, { shininess: 8 })
    );
    rElbow.position.y = -0.22;
    rArmGroup.add(rElbow);

    // White forearm plate
    const rForearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.060, 0.055, 0.24, 10),
      phong(WHITE, { shininess: 85, specular: 0xCCCCC0 })
    );
    rForearm.position.y = -0.33;
    rArmGroup.add(rForearm);

    // White gloved hand
    const rHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 12, 10),
      phong(ZOMBIE_SKIN, { shininess: 10, specular: 0x224422 })
    );
    rHand.scale.set(1.1, 0.85, 1.0);
    rHand.position.y = -0.48;
    rArmGroup.add(rHand);

    // Longer blaster rifle held across the armor.
    const blasterGrp = new THREE.Group();
    blasterGrp.position.set(0.02, -0.47, 0.11);
    blasterGrp.rotation.z = 0.05;
    const barrelTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.017, 0.42, 8),
      phong(0x171A1D, { shininess: 55, specular: 0x555555 })
    );
    barrelTop.rotation.x = Math.PI / 2;
    barrelTop.position.set(0, 0.025, 0.19);
    blasterGrp.add(barrelTop);
    const barrelLow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.015, 0.40, 8),
      phong(0x202428, { shininess: 45 })
    );
    barrelLow.rotation.x = Math.PI / 2;
    barrelLow.position.set(0, -0.018, 0.18);
    blasterGrp.add(barrelLow);
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.020, 0.050, 10),
      phong(0x08090A, { shininess: 30 })
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.004, 0.42);
    blasterGrp.add(muzzle);
    const blBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.060, 0.18),
      phong(0x222222, { shininess: 30 })
    );
    blBody.position.set(0, 0.0, 0.02);
    blasterGrp.add(blBody);
    const sight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8),
      phong(0x111111, { shininess: 35 })
    );
    sight.rotation.x = Math.PI / 2;
    sight.position.set(0, 0.055, 0.02);
    blasterGrp.add(sight);
    const blGrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.115, 0.045),
      phong(0x333333, { shininess: 20 })
    );
    blGrip.position.set(0, -0.080, -0.045);
    blGrip.rotation.x = 0.25;
    blasterGrp.add(blGrip);
    rArmGroup.add(blasterGrp);

    rArmGroup.position.set(0.355, 0.12, 0.0);
    group.add(rArmGroup); // child 2

    // ── LEFT ARM (child 3) ──
    const lArmGroup = new THREE.Group();

    const lUnderUpper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.055, 0.28, 10),
      phong(BLACK_SOFT, { shininess: 5 })
    );
    lUnderUpper.position.y = -0.10;
    lArmGroup.add(lUnderUpper);

    const lBicep = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 10),
      phong(WHITE, { shininess: 90, specular: 0xCCCCC0 })
    );
    lBicep.scale.set(0.85, 1.30, 0.85);
    lBicep.position.y = -0.06;
    lArmGroup.add(lBicep);

    const lElbow = new THREE.Mesh(
      new THREE.SphereGeometry(0.058, 10, 8),
      phong(BLACK_SOFT, { shininess: 8 })
    );
    lElbow.position.y = -0.22;
    lArmGroup.add(lElbow);

    const lForearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.060, 0.055, 0.24, 10),
      phong(WHITE, { shininess: 85, specular: 0xCCCCC0 })
    );
    lForearm.position.y = -0.33;
    lArmGroup.add(lForearm);

    const lHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 12, 10),
      phong(ZOMBIE_SKIN, { shininess: 10, specular: 0x224422 })
    );
    lHand.scale.set(1.1, 0.85, 1.0);
    lHand.position.set(0.05, -0.48, 0.10);
    lArmGroup.add(lHand);

    lArmGroup.position.set(-0.355, 0.12, 0.0);
    group.add(lArmGroup); // child 3

    // ── RIGHT LEG (child 4) ──
    const rLegGroup = new THREE.Group();

    // Black hip/crotch connector
    const rHipBlack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.076, 0.13, 10),
      phong(BLACK_SOFT, { shininess: 8 })
    );
    rHipBlack.position.y = 0.055;
    rLegGroup.add(rHipBlack);

    // White thigh armor
    const rThigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.092, 0.084, 0.24, 12),
      phong(WHITE, { shininess: 80, specular: 0xCCCCC0 })
    );
    rThigh.position.y = -0.055;
    rLegGroup.add(rThigh);

    // Thigh detail notch
    const rThighDetail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 0.08),
      phong(WHITE_DARK, { shininess: 50 })
    );
    rThighDetail.position.set(0.04, -0.03, 0.09);
    rLegGroup.add(rThighDetail);

    // Black knee joint
    const rKneeJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 10, 10),
      phong(BLACK_SOFT, { shininess: 10 })
    );
    rKneeJoint.position.y = -0.19;
    rLegGroup.add(rKneeJoint);

    // White knee cap
    const rKneeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 12, 10),
      phong(WHITE, { shininess: 90 })
    );
    rKneeCap.scale.set(1.15, 0.82, 0.88);
    rKneeCap.position.set(0, -0.185, 0.048);
    rLegGroup.add(rKneeCap);

    // White shin armor
    const rShin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.068, 0.26, 12),
      phong(WHITE, { shininess: 80, specular: 0xCCCCC0 })
    );
    rShin.position.y = -0.345;
    rLegGroup.add(rShin);

    // Shin front vertical ridge
    const rShinRidge = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.24, 0.055),
      phong(WHITE_DARK, { shininess: 55 })
    );
    rShinRidge.position.set(0, -0.345, 0.078);
    rLegGroup.add(rShinRidge);

    // White boot top
    const rBootTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.080, 0.088, 0.11, 12),
      phong(WHITE, { shininess: 75 })
    );
    rBootTop.position.y = -0.505;
    rLegGroup.add(rBootTop);

    // White boot foot
    const rBootFoot = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 12, 8),
      phong(WHITE, { shininess: 75 })
    );
    rBootFoot.scale.set(1.12, 0.52, 1.55);
    rBootFoot.position.set(0.01, -0.575, 0.055);
    rLegGroup.add(rBootFoot);

    // Black boot sole
    const rSole = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.028, 0.30),
      phong(BLACK, { shininess: 15 })
    );
    rSole.position.set(0.01, -0.615, 0.05);
    rLegGroup.add(rSole);

    rLegGroup.position.set(0.14, -0.42, 0);
    group.add(rLegGroup); // child 4

    // ── LEFT LEG (child 5) ──
    const lLegGroup = new THREE.Group();

    const lHipBlack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.076, 0.13, 10),
      phong(BLACK_SOFT, { shininess: 8 })
    );
    lHipBlack.position.y = 0.055;
    lLegGroup.add(lHipBlack);

    const lThigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.092, 0.084, 0.24, 12),
      phong(WHITE, { shininess: 80, specular: 0xCCCCC0 })
    );
    lThigh.position.y = -0.055;
    lLegGroup.add(lThigh);

    const lThighDetail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 0.08),
      phong(WHITE_DARK, { shininess: 50 })
    );
    lThighDetail.position.set(-0.04, -0.03, 0.09);
    lLegGroup.add(lThighDetail);

    const lKneeJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 10, 10),
      phong(BLACK_SOFT, { shininess: 10 })
    );
    lKneeJoint.position.y = -0.19;
    lLegGroup.add(lKneeJoint);

    const lKneeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 12, 10),
      phong(WHITE, { shininess: 90 })
    );
    lKneeCap.scale.set(1.15, 0.82, 0.88);
    lKneeCap.position.set(0, -0.185, 0.048);
    lLegGroup.add(lKneeCap);

    const lShin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.068, 0.26, 12),
      phong(WHITE, { shininess: 80, specular: 0xCCCCC0 })
    );
    lShin.position.y = -0.345;
    lLegGroup.add(lShin);

    const lShinRidge = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.24, 0.055),
      phong(WHITE_DARK, { shininess: 55 })
    );
    lShinRidge.position.set(0, -0.345, 0.078);
    lLegGroup.add(lShinRidge);

    const lBootTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.080, 0.088, 0.11, 12),
      phong(WHITE, { shininess: 75 })
    );
    lBootTop.position.y = -0.505;
    lLegGroup.add(lBootTop);

    const lBootFoot = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 12, 8),
      phong(WHITE, { shininess: 75 })
    );
    lBootFoot.scale.set(1.12, 0.52, 1.55);
    lBootFoot.position.set(-0.01, -0.575, 0.055);
    lLegGroup.add(lBootFoot);

    const lSole = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.028, 0.30),
      phong(BLACK, { shininess: 15 })
    );
    lSole.position.set(-0.01, -0.615, 0.05);
    lLegGroup.add(lSole);

    lLegGroup.position.set(-0.14, -0.42, 0);
    group.add(lLegGroup); // child 5

    this.mesh = group;
    this.mesh.position.copy(this.position);
    this.rotation.y = -Math.PI / 2;
    this._applyVariantSilhouette();
    this.fadeIn = 1.0;
    this._setOpacity(this.mesh, 0);
    this.scene.add(this.mesh);
  }

  _applyVariantSilhouette() {
    if (!this.mesh) return;
    if (this.type === 'scout') {
      this.mesh.scale.set(0.86, 0.92, 0.86);
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.045, 0.04),
        new THREE.MeshBasicMaterial({ color: 0x151515 })
      );
      visor.position.set(0, 1.28, 0.39);
      this.mesh.add(visor);
      const pack = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.34, 0.12),
        new THREE.MeshPhongMaterial({ color: 0xD8D3C8, shininess: 70 })
      );
      pack.position.set(0, 0.48, -0.23);
      this.mesh.add(pack);
    } else if (this.type === 'droid') {
      this.mesh.scale.set(0.74, 0.95, 0.74);
      this.mesh.traverse(c => {
        if (c.isMesh && c.material && c.material.color) {
          const original = c.material.color.getHex();
          if (original === 0xF4F0E8 || original === 0xDDDAD0 || original === 0xBBB8B0) {
            c.material = c.material.clone();
            c.material.color.setHex(0x8E887B);
            c.material.specular = new THREE.Color(0xCCCCCC);
            c.material.shininess = 120;
          }
        }
      });
      const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.018, 0.50, 6),
        new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 80 })
      );
      antenna.position.set(0.13, 1.56, 0.06);
      antenna.rotation.z = -0.18;
      this.mesh.add(antenna);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xFF3333 })
      );
      tip.position.set(0.18, 1.80, 0.06);
      this.mesh.add(tip);
      this._droidAntennaTip = tip;
    }
  }

  update(dt) {
    if (!this.alive) return;
    if (this._droidAntennaTip && this._droidAntennaTip.material) {
      this._droidAntennaTip.material.opacity = 0.6 + Math.sin(Date.now() * 0.012) * 0.35;
      this._droidAntennaTip.material.transparent = true;
    }

    // Death fall-forward animation
    if (this.dying) {
      this.deathTimer += dt;
      if (!this.fallInited) {
        this.fallInited = true;
        this.deathY = this.mesh.position.y;
        this.deathRotX = this.mesh.rotation.x;
        this.deathRotY = this.mesh.rotation.y;
        this.deathRotZ = this.mesh.rotation.z;
      }
      const fallProgress = Math.min(this.deathTimer / 0.6, 1);
      const eased = 1 - Math.pow(1 - fallProgress, 2);
      this.mesh.rotation.set(this.deathRotX, this.deathRotY, this.deathRotZ + eased * (-Math.PI / 2));
      this.mesh.position.y = this.deathY - eased * 0.35;
      if (this.deathTimer > 1.6) {
        const fadeProgress = Math.min((this.deathTimer - 1.6) / 0.8, 1);
        this._setOpacity(this.mesh, 1 - fadeProgress);
        if (fadeProgress >= 1) {
          this.destroy();
        }
      }
      return;
    }

    if (this.frozen) {
      this.frozenTimer -= dt;
      if (this.frozenTimer <= 0) {
        this.frozen = false;
        this.speed = this.baseSpeed;
        this._applyFreezeColor(false);
      }
    }

    this.targetPlant = null;
    const tiles = window.game.tiles;
    for (const tile of tiles) {
      if (tile.row === this.row && tile.plant && tile.plant.alive) {
        const px = tile.plant.position.x;
        if (Math.abs(this.position.x - px) < 0.8 && this.position.x > px - 0.3) {
          this.targetPlant = tile.plant;
          break;
        }
      }
    }

    if (this.targetPlant) {
      this.attackTimer += dt;
      const biteCycle = 0.628;
      if (this.attackTimer >= biteCycle) {
        this.attackTimer -= biteCycle;
        this.targetPlant.takeDamage(this.damage);
      }
    } else {
      this.position.x -= this.speed * dt;
      this.attackTimer = 0;
    }

    // Animations
    const spd = this.frozen ? 0.5 : 1;
    const t = Date.now() * 0.005 * spd;
    const rArm = this.mesh.children[2];
    const lArm = this.mesh.children[3];
    const rLeg = this.mesh.children[4];
    const lLeg = this.mesh.children[5];
    const headGrp = this.mesh.children[1];

    if (!this.targetPlant) {
      // Military march walk
      if (rLeg) {
        rLeg.rotation.x = Math.sin(t) * 0.40;
        rLeg.position.y = -0.42 + Math.abs(Math.sin(t)) * 0.04;
      }
      if (lLeg) {
        lLeg.rotation.x = Math.sin(t + Math.PI) * 0.40;
        lLeg.position.y = -0.42 + Math.abs(Math.sin(t + Math.PI)) * 0.04;
      }
      // Arms swing slightly — right arm forward with blaster
      if (rArm) {
        rArm.rotation.x = -0.20 + Math.sin(t + Math.PI) * 0.15;
        rArm.rotation.z = -0.10;
      }
      if (lArm) {
        lArm.rotation.x = -0.20 + Math.sin(t) * 0.15;
        lArm.rotation.z = 0.10;
      }
      // Slight head bob
      if (headGrp) {
        headGrp.rotation.z = Math.sin(t * 0.7) * 0.04;
        headGrp.rotation.x = 0.04 + Math.sin(t * 0.5) * 0.02;
      }
      this.mesh.rotation.x = 0.03;
      this.mesh.rotation.z = Math.sin(t) * 0.025;
      this.mesh.position.y = this.position.y + Math.abs(Math.sin(t * 2)) * 0.03;

      if (this.armFallen) {
        this.mesh.rotation.z = Math.sin(t) * 0.12;
        this.mesh.position.y = this.position.y + Math.abs(Math.sin(t)) * 0.06;
      }
    } else {
      // Attack — raise right arm to aim blaster
      const at = Math.sin(Date.now() * 0.01) * 0.3;
      if (rArm) {
        rArm.rotation.x = -0.80 + at;
        rArm.rotation.z = -0.08;
      }
      if (lArm) {
        lArm.rotation.x = -0.35 - at * 0.3;
        lArm.rotation.z = 0.10;
      }
      if (headGrp) headGrp.rotation.x = -0.08 + Math.sin(Date.now() * 0.01) * 0.06;
      this.mesh.rotation.x = 0.05;
    }

    // Fade in
    if (this.fadeIn > 0) {
      this.fadeIn -= dt * 2;
      if (this.fadeIn < 0) this.fadeIn = 0;
      this._setOpacity(this.mesh, 1 - this.fadeIn);
    }

    // Hit flash
    if (this.hitFlash > 0) {
      this.hitFlash -= dt * 5;
      if (this.hitFlash <= 0) {
        this.hitFlash = 0;
        this._traverseFlash(this.mesh, false);
      } else {
        this._traverseFlash(this.mesh, this.hitFlash > 0.2);
      }
    }

    super.update(dt);
  }

  _traverseFlash(obj, flash) {
    obj.children.forEach(c => {
      if (c.material && c.userData.origColor !== undefined) {
        c.material.color.setHex(flash ? 0xffffff : c.userData.origColor);
      }
      if (c.children && c.children.length > 0) {
        this._traverseFlash(c, flash);
      }
    });
  }

  _setOpacity(obj, opacity) {
    if (obj.material) {
      obj.material.transparent = true;
      obj.material.opacity = opacity;
    }
    if (obj.children) obj.children.forEach(c => this._setOpacity(c, opacity));
  }

  _storeOrigColors(obj) {
    obj.children.forEach(c => {
      if (c.material && c.userData.origColor === undefined) {
        c.userData.origColor = c.material.color.getHex();
      }
      if (c.children && c.children.length > 0) {
        this._storeOrigColors(c);
      }
    });
  }

  explodeDeath() {
    if (this.dying) return;
    if (window.game && window.game._playSfx) window.game._playSfx('explosion');
    this.dying = true;
    this.exploding = true;
    this.deathTimer = 0;
    const parts = [];
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      child.position.add(this.mesh.position);
      child.rotation.copy(this.mesh.rotation);
      this.scene.add(child);
      const angle = Math.random() * Math.PI * 2;
      const upVel = 3 + Math.random() * 5;
      const outVel = 2 + Math.random() * 4;
      child.userData.vel = new THREE.Vector3(
        Math.cos(angle) * outVel,
        upVel,
        Math.sin(angle) * outVel
      );
      child.userData.rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      );
      parts.push(child);
    }
    this.scene.remove(this.mesh);
    const scene = this.scene;
    let elapsed = 0;
    const animate = () => {
      const dt = 0.016;
      elapsed += dt;
      for (const p of parts) {
        p.position.add(p.userData.vel.clone().multiplyScalar(dt));
        p.userData.vel.y -= 12 * dt;
        p.rotation.x += p.userData.rotVel.x * dt;
        p.rotation.y += p.userData.rotVel.y * dt;
        p.rotation.z += p.userData.rotVel.z * dt;
        const fade = Math.max(0, 1 - elapsed / 1.5);
        p.traverse(c => {
          if (c.material) {
            c.material.transparent = true;
            c.material.opacity = fade;
          }
        });
      }
      if (elapsed < 1.5) {
        requestAnimationFrame(animate);
      } else {
        for (const p of parts) scene.remove(p);
        this.alive = false;
      }
    };
    requestAnimationFrame(animate);
  }

  takeDamage(dmg, freeze) {
    if (this.dying) return;
    this.hp -= dmg;
    if (this.hitFlash > 0) {
      this._traverseFlash(this.mesh, false);
    }
    this.hitFlash = 0.4;
    this._storeOrigColors(this.mesh);
    if (freeze) {
      this.frozen = true;
      this.frozenTimer = window.game && window.game.getFreezeDuration ? window.game.getFreezeDuration() : 3;
      this.speed = this.baseSpeed * 0.4;
      this._applyFreezeColor(true);
    }
    if (!this.headgearDamaged) {
      const shouldDamage = (this.type === 'conehead' && this.hp <= 15) ||
                           (this.type === 'buckethead' && this.hp <= 20);
      if (shouldDamage) {
        this.headgearDamaged = true;
        this._damageHeadgear();
      }
    }
    if (!this.headgearFallen) {
      const shouldFall = (this.type === 'conehead' && this.hp <= 10) ||
                         (this.type === 'buckethead' && this.hp <= 10);
      if (shouldFall) {
        this.headgearFallen = true;
        this._dropHeadgear();
      }
    }
    if (!this.armFallen && this.hp <= 5 && this.hp > 0) {
      this.armFallen = true;
      this._dropArm();
    }
    if (this.hp <= 0) {
      this.dying = true;
      this.deathTimer = 0;
      this.deathDuration = 0.6;
    }
  }

  _applyFreezeColor(frozen) {
    this.mesh.traverse(c => {
      if (c.isMesh && c.material) {
        if (frozen) {
          if (c.userData._preFreezeColor === undefined) {
            c.userData._preFreezeColor = c.material.color.getHex();
            c.userData._preFreezeEmissive = c.material.emissive ? c.material.emissive.getHex() : 0;
          }
          const orig = c.userData._preFreezeColor;
          const r = ((orig >> 16) & 0xff) / 255;
          const g = ((orig >> 8) & 0xff) / 255;
          const b = (orig & 0xff) / 255;
          c.material = c.material.clone();
          c.material.color.setRGB(r * 0.35, g * 0.45, Math.min(1, b * 0.4 + 0.55));
          c.material.emissive = new THREE.Color(0x224488);
          c.material.emissiveIntensity = 0.25;
        } else {
          if (c.userData._preFreezeColor !== undefined) {
            c.material = c.material.clone();
            c.material.color.setHex(c.userData._preFreezeColor);
            c.material.emissive = new THREE.Color(c.userData._preFreezeEmissive);
            c.material.emissiveIntensity = 0;
            delete c.userData._preFreezeColor;
            delete c.userData._preFreezeEmissive;
          }
        }
      }
    });
    this._clearOrigColors(this.mesh);
    this._storeOrigColors(this.mesh);
  }

  _clearOrigColors(obj) {
    obj.children.forEach(c => {
      if (c.material) c.userData.origColor = undefined;
      if (c.children && c.children.length > 0) this._clearOrigColors(c);
    });
  }

  _damageHeadgear() {
    const headGroup = this.mesh.children[1];
    if (!headGroup) return;
    const lastChild = headGroup.children[headGroup.children.length - 1];
    if (!lastChild || !lastChild.isGroup) return;
    lastChild.rotation.z = 0.3;
    lastChild.rotation.x = 0.15;
    if (this.type === 'conehead') {
      const rankPlate = lastChild.children[0];
      if (rankPlate) { rankPlate.scale.set(1.1, 0.7, 0.9); rankPlate.rotation.z = 0.15; }
    } else if (this.type === 'buckethead') {
      const cap = lastChild.children[0];
      if (cap) { cap.scale.set(0.88, 0.80, 1.05); cap.rotation.z = 0.15; }
    }
  }

  _dropArm() {
    // Visually show battle damage — scorch marks on armor
    this.mesh.traverse(c => {
      if (c.material && c.material.color) {
        const hex = c.material.color.getHex();
        if (hex === 0xF4F0E8 || hex === 0xDDDAD0 || hex === 0xBBB8B0) {
          c.material = c.material.clone();
          c.material.color.setHex(0xAAAAAA);
          c.material.emissive = new THREE.Color(0x110800);
          c.material.emissiveIntensity = 0.15;
        }
      }
    });
    const headGroup = this.mesh.children[1];
    if (headGroup) {
      headGroup.rotation.z = 0.15;
      headGroup.position.x = 0.03;
    }
    const armGroup = this.mesh.children[2];
    if (!armGroup) return;
    this.mesh.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3();
    armGroup.getWorldPosition(worldPos);
    const phong = (color) => new THREE.MeshPhongMaterial({ color, shininess: 10 });
    const stump = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), phong(0x0D0D0D));
    stump.position.set(0.355, 0.12, 0.0);
    this.mesh.add(stump);
    this.mesh.remove(armGroup);
    armGroup.position.copy(worldPos);
    this.scene.add(armGroup);
    const vel = new THREE.Vector3((Math.random() - 0.5) * 1.5, 2, (Math.random() - 0.5) * 1.5);
    const rotVel = new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    const scene = this.scene;
    let elapsed = 0;
    const animate = () => {
      const dt = 0.016;
      elapsed += dt;
      armGroup.position.add(vel.clone().multiplyScalar(dt));
      vel.y -= 12 * dt;
      armGroup.rotation.x += rotVel.x * dt;
      armGroup.rotation.y += rotVel.y * dt;
      armGroup.rotation.z += rotVel.z * dt;
      if (elapsed > 1.0) {
        const fade = Math.max(0, 1 - (elapsed - 1.0) / 0.5);
        armGroup.traverse(c => {
          if (c.material) { c.material.transparent = true; c.material.opacity = fade; }
        });
      }
      if (elapsed < 1.5) {
        requestAnimationFrame(animate);
      } else {
        scene.remove(armGroup);
      }
    };
    requestAnimationFrame(animate);
  }

  _dropHeadgear() {
    const headGroup = this.mesh.children[1];
    if (!headGroup) return;
    const lastChild = headGroup.children[headGroup.children.length - 1];
    if (!lastChild || !lastChild.isGroup) return;
    const gear = lastChild;
    headGroup.remove(gear);
    const worldPos = new THREE.Vector3();
    headGroup.getWorldPosition(worldPos);
    gear.position.copy(worldPos);
    gear.position.y += 0.4;
    this.scene.add(gear);
    const vel = new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2);
    const rotVel = new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    const scene = this.scene;
    let elapsed = 0;
    const animate = () => {
      const dt = 0.016;
      elapsed += dt;
      gear.position.add(vel.clone().multiplyScalar(dt));
      vel.y -= 12 * dt;
      gear.rotation.x += rotVel.x * dt;
      gear.rotation.y += rotVel.y * dt;
      gear.rotation.z += rotVel.z * dt;
      if (elapsed > 1.0) {
        const fade = Math.max(0, 1 - (elapsed - 1.0) / 0.5);
        gear.traverse(c => {
          if (c.material) { c.material.transparent = true; c.material.opacity = fade; }
        });
      }
      if (elapsed < 1.5) {
        requestAnimationFrame(animate);
      } else {
        scene.remove(gear);
      }
    };
    requestAnimationFrame(animate);
  }
}
