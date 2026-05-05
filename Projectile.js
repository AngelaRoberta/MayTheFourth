class Projectile extends GameObject3D {
  constructor(scene, x, y, z, row, frozen, sourceType) {
    super(scene);
    this.name = 'Projectile';
    this.row = row;
    this.frozen = frozen || false;
    this.sourceType = sourceType || (this.frozen ? 'snowpea' : 'peashooter');
    this.speed = 10;
    this.damage = 1;
    this.lifeTime = 0;
    this.position.set(x, y, z);
    this.createMesh();
  }
  createMesh() {
    const group = new THREE.Group();
    const thermal = this.sourceType === 'potato_mine';
    const color = thermal ? 0xFF8A18 : (this.frozen ? 0x4DDBFF : 0x38FF5D);
    const coreColor = thermal ? 0xFFE0A0 : (this.frozen ? 0xE4FBFF : 0xD9FFE2);
    const trailColor = thermal ? 0xFF4D00 : (this.frozen ? 0x1A6FFF : 0x00B83E);
    const boltLength = this.frozen ? 0.62 : (this.sourceType === 'repeater' ? 0.52 : 0.46);

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.050, boltLength, 12),
      new THREE.MeshBasicMaterial({ color: coreColor })
    );
    core.rotation.z = Math.PI / 2;
    group.add(core);

    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.090, 0.115, boltLength * 1.12, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: this.frozen ? 0.42 : 0.36, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glow.rotation.z = Math.PI / 2;
    group.add(glow);

    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(this.frozen ? 0.105 : 0.085, 14, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.86 })
    );
    nose.position.x = boltLength * 0.50;
    nose.scale.set(1.15, 0.70, 0.70);
    group.add(nose);

    const trail = new THREE.Mesh(
      new THREE.ConeGeometry(this.frozen ? 0.135 : 0.105, 0.48, 14),
      new THREE.MeshBasicMaterial({ color: trailColor, transparent: true, opacity: this.frozen ? 0.28 : 0.24, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    trail.rotation.z = -Math.PI / 2;
    trail.position.x = -boltLength * 0.62;
    trail.scale.set(1.0, 0.7, 0.7);
    group.add(trail);

    const wake = new THREE.Mesh(
      new THREE.CylinderGeometry(this.frozen ? 0.020 : 0.016, this.frozen ? 0.085 : 0.070, 0.95, 12),
      new THREE.MeshBasicMaterial({ color: trailColor, transparent: true, opacity: this.frozen ? 0.22 : 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    wake.rotation.z = Math.PI / 2;
    wake.position.x = -boltLength * 0.86;
    wake.scale.set(1, 0.72, 0.72);
    group.add(wake);

    const light = new THREE.PointLight(color, this.frozen ? 0.45 : 0.32, 1.6);
    light.position.x = boltLength * 0.10;
    group.add(light);

    if (this.frozen) {
      for (let i = 0; i < 3; i++) {
        const shard = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.040, 0),
          new THREE.MeshBasicMaterial({ color: 0xBFF6FF, transparent: true, opacity: 0.82 })
        );
        shard.position.set(-0.10 + i * 0.13, Math.sin(i * 2.1) * 0.070, Math.cos(i * 1.7) * 0.055);
        shard.rotation.set(i * 0.8, i * 0.4, i * 0.6);
        group.add(shard);
      }
    }

    this._glow = glow;
    this._trail = trail;
    this._wake = wake;
    this._light = light;
    this.mesh = group;
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }
  update(dt) {
    if (!this.alive) return;
    this.lifeTime += dt;
    this.position.x += this.speed * dt;
    if (this.mesh) {
      const pulse = 1 + Math.sin(this.lifeTime * 34) * 0.08;
      if (this._glow) this._glow.scale.set(1, pulse, pulse);
      if (this._trail) this._trail.material.opacity = (this.frozen ? 0.28 : 0.24) + Math.sin(this.lifeTime * 26) * 0.05;
      if (this._wake) this._wake.material.opacity = (this.frozen ? 0.22 : 0.18) + Math.sin(this.lifeTime * 20) * 0.035;
      if (this._light) this._light.intensity = (this.frozen ? 0.45 : 0.32) * pulse;
      this.rotation.x += dt * (this.frozen ? 7 : 4);
    }
    if (this.position.x > 14) this.destroy();
    // Check zombie collision
    const zombies = window.game.zombies;
    for (const z of zombies) {
      if (!z.alive || z.dying || z.row !== this.row) continue;
      if (Math.abs(this.position.x - z.position.x) < 0.5 && Math.abs(this.position.z - z.position.z) < 0.5) {
        z.takeDamage(this.damage, this.frozen);
        if (window.game && window.game._spawnHitEffect) {
          window.game._spawnHitEffect(this.position.x, this.position.y, this.position.z, this.frozen ? 'cryo' : 'plasma');
        }
        if (window.game && window.game._playSfx) window.game._playSfx('hit');
        this.destroy();
        return;
      }
    }
    super.update(dt);
  }
}
