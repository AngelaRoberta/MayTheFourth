class Sun extends GameObject3D {
  constructor(scene, x, y, z, fromPlant) {
    super(scene);
    this.name = 'Sun';
    this.lifetime = 9;
    this.collected = false;
    this.fromPlant = fromPlant;
    this.fadeOut = 0;
    this.collectTarget = null;
    this.collectTimer = 0;
    this.collectStart = null;
    if (fromPlant) {
      // Spawn at sunflower, move up
      this.position.set(x, y, z);
      this.targetY = y + 1.2;
      this.moveDir = 1; // up
    } else {
      // Sky sun, fall down
      this.position.set(x, y, z);
      this.targetY = 0.8;
      this.moveDir = -1; // down
    }
    this.createMesh();
  }
  createMesh() {
    const group = new THREE.Group();
    const phong = (color, opts = {}) => new THREE.MeshPhongMaterial({ color, shininess: opts.shininess || 50, emissive: opts.emissive || 0x000000, emissiveIntensity: opts.ei || 0, specular: opts.specular || 0x222222 });

    // ── Build a 5-pointed star shape using BufferGeometry ──
    const starShape = new THREE.Shape();
    const outerR = 0.30;
    const innerR = 0.13;
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      if (i === 0) starShape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else starShape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    starShape.closePath();

    // Extruded star body
    const extrudeSettings = { depth: 0.12, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3 };
    const starGeo = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
    starGeo.center();
    const starMat = phong(0xFF8A18, { shininess: 80, emissive: 0xCC3A00, ei: 0.55, specular: 0xFFD08A });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    group.add(starMesh);

    // Glowing inner core sphere (gives depth/light)
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 12),
      phong(0xFFC247, { shininess: 40, emissive: 0xFF7A00, ei: 0.7 })
    );
    core.material.transparent = true;
    core.material.opacity = 0.7;
    group.add(core);

    // ── Cute face on the front of the star ──
    // Eyes
    for (let side = -1; side <= 1; side += 2) {
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), phong(0xffffff, { shininess: 90 }));
      eyeW.position.set(side * 0.082, 0.038, 0.072);
      eyeW.scale.set(1, 1.15, 0.75);
      group.add(eyeW);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), phong(0x221100));
      pupil.position.set(side * 0.082, 0.036, 0.085);
      group.add(pupil);
      // Sparkle
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 4), phong(0xffffff, { emissive: 0xffffff, ei: 1.0 }));
      hl.position.set(side * 0.070, 0.052, 0.089);
      group.add(hl);
    }

    // Smile
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.012, 7, 10, Math.PI), phong(0x7A2400));
    smile.position.set(0, -0.048, 0.072);
    smile.rotation.x = Math.PI;
    smile.rotation.z = Math.PI;
    group.add(smile);

    // ── Star tip point sparkles (small glowing orbs at each tip) ──
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 7, 7),
        phong(0xFFD27A, { shininess: 90, emissive: 0xFF8C00, ei: 0.8 })
      );
      tip.position.set(Math.cos(a) * outerR * 0.88, Math.sin(a) * outerR * 0.88, 0);
      group.add(tip);
    }

    this.mesh = group;
    this.mesh.position.copy(this.position);
    if (this.fromPlant) {
      this.mesh.scale.setScalar(0.01);
      this.growTimer = 0;
      this.growDuration = 0.5;
    }
    this.scene.add(this.mesh);
  }

  _setMeshOpacity(opacity) {
    this.mesh.traverse(child => {
      if (child.isMesh && child.material) {
        child.material.transparent = true;
        child.material.depthWrite = opacity > 0.99;
        child.material.opacity = Math.min(opacity, child.material.opacity !== undefined ? opacity : 1);
        child.material.emissiveIntensity = (child.material.userData._origEI !== undefined ? child.material.userData._origEI : (child.material.userData._origEI = child.material.emissiveIntensity)) * opacity;
        child.material.needsUpdate = true;
      }
    });
  }

  update(dt) {
    if (!this.alive) return;

    // Collected: fly to sun UI
    if (this.collected) {
      this.collectTimer += dt;
      const duration = 0.5;
      const t = Math.min(this.collectTimer / duration, 1);
      const ease = t * t * (3 - 2 * t); // smoothstep
      // Lerp 3D position toward a point near camera (top-left)
      this.position.x = this.collectStart.x + (this.collectTarget.x - this.collectStart.x) * ease;
      this.position.y = this.collectStart.y + (this.collectTarget.y - this.collectStart.y) * ease;
      this.position.z = this.collectStart.z + (this.collectTarget.z - this.collectStart.z) * ease;
      this.mesh.scale.setScalar(1 - ease * 0.7);
      this._setMeshOpacity(1 - ease * 0.5);
      if (t >= 1) this.destroy();
      super.update(dt);
      return;
    }

    // Grow animation for sunflower suns
    if (this.fromPlant && this.growTimer !== undefined && this.growTimer < this.growDuration) {
      this.growTimer += dt;
      const t = Math.min(this.growTimer / this.growDuration, 1);
      this.mesh.scale.setScalar(t);
    }

    // Move toward target
    if (this.moveDir > 0) {
      // Moving up (sunflower sun)
      if (this.position.y < this.targetY) {
        this.position.y += 0.8 * dt;
        if (this.position.y > this.targetY) this.position.y = this.targetY;
      }
    } else {
      // Falling down (sky sun)
      if (this.position.y > this.targetY) {
        this.position.y -= 1.5 * dt;
        if (this.position.y < this.targetY) this.position.y = this.targetY;
      }
    }

    this.rotation.y += dt * 2;
    this.lifetime -= dt;

    // Fade out during last 2 seconds
    if (this.lifetime <= 2) {
      const opacity = Math.max(0, this.lifetime / 2);
      this._setMeshOpacity(opacity);
    }

    if (this.lifetime <= 0) this.destroy();
    super.update(dt);
  }

  collect() {
    if (this.collected) return;
    this.collected = true;
    if (window.game && window.game._playSfx) window.game._playSfx('collect');
    this.collectTimer = 0;
    this.collectStart = this.position.clone();

    // Compute a 3D target near the sun UI (top-left of screen)
    const sunCounter = document.getElementById('sun-counter');
    const rect = sunCounter.getBoundingClientRect();
    const ndcX = ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1;
    const ndcY = -((rect.top + rect.height / 2) / window.innerHeight) * 2 + 1;
    const target = new THREE.Vector3(ndcX, ndcY, 0.5);
    target.unproject(window.game.camera);
    // Place target partway between camera and unprojected point
    const cam = window.game.camera.position;
    const dir = target.sub(cam).normalize();
    this.collectTarget = cam.clone().add(dir.multiplyScalar(3));

    window.game.sun += 25;
    document.getElementById('sun-amount').textContent = window.game.sandboxMode ? '∞' : window.game.sun;
    const sc = document.getElementById('sun-counter');
    sc.classList.remove('pulse');
    void sc.offsetWidth;
    sc.classList.add('pulse');
  }
}
