class LawnMower extends GameObject3D {
  constructor(scene, row) {
    super(scene);
    this.name = 'LawnMower';
    this.row = row;
    this.triggered = false;
    this.position.set(-9.4, 0.42, row * 2 - 4);
    this._rollAngle = 0;
    this._headBobTime = 0;
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();

    const mat = (color, opts = {}) => new THREE.MeshPhongMaterial({
      color,
      shininess: opts.shininess !== undefined ? opts.shininess : 80,
      specular: opts.specular || 0x444444,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity || 0
    });

    // ── BODY SPHERE ──
    const bodyGroup = new THREE.Group();
    group.add(bodyGroup);
    this._bodyGroup = bodyGroup;

    // Main white/cream sphere
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 32, 24),
      mat(0xF5F0E8, { shininess: 120, specular: 0x888888 })
    );
    bodyGroup.add(body);

    // Orange horizontal band — equator stripe
    const bandGeo = new THREE.TorusGeometry(0.42, 0.055, 12, 48);
    const band1 = new THREE.Mesh(bandGeo, mat(0xE8730A, { shininess: 90, specular: 0x663300 }));
    band1.rotation.x = Math.PI / 2;
    band1.position.y = 0.0;
    bodyGroup.add(band1);

    // Upper orange band
    const band2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.355, 0.04, 10, 40),
      mat(0xE8730A, { shininess: 90 })
    );
    band2.rotation.x = Math.PI / 2;
    band2.position.y = 0.20;
    bodyGroup.add(band2);

    // Lower orange band
    const band3 = new THREE.Mesh(
      new THREE.TorusGeometry(0.355, 0.04, 10, 40),
      mat(0xE8730A, { shininess: 90 })
    );
    band3.rotation.x = Math.PI / 2;
    band3.position.y = -0.20;
    bodyGroup.add(band3);

    // Panel details on body — raised rectangular plates
    const panelPositions = [
      { theta: 0,           phi: Math.PI / 2,      w: 0.14, h: 0.10 },
      { theta: Math.PI * 0.55, phi: Math.PI / 2,   w: 0.10, h: 0.14 },
      { theta: -Math.PI * 0.55, phi: Math.PI / 2,  w: 0.10, h: 0.14 },
      { theta: Math.PI,     phi: Math.PI / 2,       w: 0.13, h: 0.09 },
      { theta: Math.PI * 0.28, phi: Math.PI * 0.32, w: 0.08, h: 0.06 },
    ];
    for (const p of panelPositions) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, p.h, 0.025),
        mat(0xEAE5D8, { shininess: 60 })
      );
      const r = 0.425;
      panel.position.set(
        r * Math.sin(p.phi) * Math.cos(p.theta),
        r * Math.cos(p.phi),
        r * Math.sin(p.phi) * Math.sin(p.theta)
      );
      panel.lookAt(new THREE.Vector3(
        panel.position.x * 2, panel.position.y * 2, panel.position.z * 2
      ));
      bodyGroup.add(panel);
    }

    // Small circular ports / rivets on body
    const portAngles = [0.4, 1.1, 1.9, 2.7, 3.5, 4.3, 5.0];
    for (let i = 0; i < portAngles.length; i++) {
      const theta = portAngles[i];
      const phi = Math.PI / 2 + (i % 2 === 0 ? 0.28 : -0.28);
      const port = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8),
        mat(i % 3 === 0 ? 0xE8730A : 0x888888, { shininess: 110 })
      );
      const r = 0.43;
      port.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
      port.lookAt(new THREE.Vector3(
        port.position.x * 2.5, port.position.y * 2.5, port.position.z * 2.5
      ));
      port.rotateX(Math.PI / 2);
      bodyGroup.add(port);
    }

    // ── HEAD DOME ──
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.40;
    group.add(headGroup);
    this._headGroup = headGroup;

    // White dome
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      mat(0xF2EDE0, { shininess: 110, specular: 0x777777 })
    );
    headGroup.add(dome);

    // Dome base ring
    const domeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.022, 10, 32),
      mat(0xC8C0B0, { shininess: 60 })
    );
    domeRing.rotation.x = Math.PI / 2;
    headGroup.add(domeRing);

    // Main eye — large black lens
    const eyeOuter = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 20, 16),
      mat(0x111111, { shininess: 200, specular: 0x555555 })
    );
    eyeOuter.position.set(0.21, 0.08, 0);
    headGroup.add(eyeOuter);

    // Eye iris — glowing blue
    const eyeIris = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 12),
      mat(0x4488FF, { shininess: 255, specular: 0x88AAFF, emissive: 0x2244CC, emissiveIntensity: 0.8 })
    );
    eyeIris.position.set(0.255, 0.08, 0);
    headGroup.add(eyeIris);

    // Eye pupil
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 10, 8),
      mat(0x000000, { shininess: 255 })
    );
    pupil.position.set(0.275, 0.08, 0);
    headGroup.add(pupil);

    // Eye socket ring — orange
    const eyeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.088, 0.016, 8, 20),
      mat(0xE8730A, { shininess: 100 })
    );
    eyeRing.position.set(0.21, 0.08, 0);
    eyeRing.rotation.y = Math.PI / 2;
    headGroup.add(eyeRing);

    // Small secondary sensor dot
    const sensor = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 10, 8),
      mat(0xFF3333, { shininess: 200, emissive: 0xCC0000, emissiveIntensity: 0.6 })
    );
    sensor.position.set(0.245, 0.16, 0.08);
    headGroup.add(sensor);

    // Small utility arm nub on side
    const armNub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.06, 8),
      mat(0xCCC8BA, { shininess: 60 })
    );
    armNub.rotation.z = Math.PI / 2;
    armNub.position.set(0.0, -0.04, 0.27);
    headGroup.add(armNub);

    // Orange head panel stripe
    const headPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.05, 0.03),
      mat(0xE8730A, { shininess: 80 })
    );
    headPanel.position.set(0.0, 0.15, 0.22);
    headPanel.rotation.x = -0.3;
    headGroup.add(headPanel);

    // Dome top detail
    const topDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 8, 8),
      mat(0xE8730A, { shininess: 100 })
    );
    topDot.position.set(0, 0.275, 0);
    headGroup.add(topDot);

    // ── NECK CONNECTOR (thin ring between dome and body) ──
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.06, 20),
      mat(0xD8D2C4, { shininess: 50 })
    );
    neck.position.y = 0.38;
    group.add(neck);

    // ── THRUSTER GLOW (bottom of sphere, visible when triggered) ──
    const thruster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.10, 0.08, 12),
      mat(0xFF6600, { shininess: 150, emissive: 0xFF4400, emissiveIntensity: 0.0 })
    );
    thruster.position.y = -0.38;
    bodyGroup.add(thruster);
    this._thruster = thruster;

    // ── SHADOW DISC under droid ──
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.41;
    group.add(shadow);

    this.mesh = group;
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  trigger() {
    this.triggered = true;
    // Flash thruster glow on activation
    if (this._thruster) {
      this._thruster.material.emissiveIntensity = 1.0;
    }
  }

  update(dt) {
    if (!this.alive) return;

    this._headBobTime += dt;

    if (this.triggered) {
      this.position.x += 14 * dt;

      // Roll body sphere forward
      this._rollAngle += 14 * dt / 0.42; // angular velocity = linear / radius
      if (this._bodyGroup) {
        this._bodyGroup.rotation.z = -this._rollAngle;
      }

      // Head stays upright but wobbles slightly
      if (this._headGroup) {
        this._headGroup.rotation.z = Math.sin(this._headBobTime * 18) * 0.08;
        this._headGroup.rotation.x = Math.sin(this._headBobTime * 11) * 0.05;
      }

      // Thruster pulse
      if (this._thruster) {
        this._thruster.material.emissiveIntensity = 0.6 + Math.sin(this._headBobTime * 30) * 0.4;
      }

      // Kill zombies in path
      for (const z of window.game.zombies) {
        if (z.alive && z.row === this.row && Math.abs(z.position.x - this.position.x) < 0.9) {
          z.takeDamage(9999, false);
        }
      }

      if (this.position.x > 14) this.destroy();

    } else {
      // Idle: gentle hover bob and head look-around
      const bob = Math.sin(this._headBobTime * 1.4) * 0.018;
      this.mesh.position.y = this.position.y + bob;

      if (this._headGroup) {
        this._headGroup.rotation.y = Math.sin(this._headBobTime * 0.7) * 0.25;
        this._headGroup.rotation.x = Math.sin(this._headBobTime * 0.5) * 0.06;
      }
    }

    super.update(dt);
  }
}
