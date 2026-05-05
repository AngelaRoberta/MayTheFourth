class Tile extends GameObject3D {
  constructor(scene, row, col) {
    super(scene);
    this.name = 'Tile';
    this.row = row;
    this.col = col;
    this.plant = null;
    this.position.set(col * 2 - 8, 0.05, row * 2 - 4);
    this.createMesh();
  }
  createMesh() {
    const geo = new THREE.BoxGeometry(1.8, 0.1, 1.8);
    const light = (this.row + this.col) % 2 === 0;
    const mat = new THREE.MeshLambertMaterial({ color: light ? 0xC8A050 : 0xB8903A });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);

    const seed = (this.row * 17 + this.col * 31) % 97;
    const detailGroup = new THREE.Group();
    detailGroup.position.set(this.position.x, this.position.y + 0.058, this.position.z);

    if (seed % 3 !== 1) {
      const crackMat = new THREE.MeshBasicMaterial({ color: 0x6F4A1E, transparent: true, opacity: 0.45 });
      const crackCount = 1 + (seed % 3);
      for (let i = 0; i < crackCount; i++) {
        const crack = new THREE.Mesh(
          new THREE.PlaneGeometry(0.48 + ((seed + i) % 4) * 0.12, 0.026),
          crackMat
        );
        crack.rotation.x = -Math.PI / 2;
        crack.rotation.z = ((seed * 0.47 + i * 1.7) % Math.PI) - Math.PI / 2;
        crack.position.set(
          -0.50 + (((seed + i * 19) % 100) / 100) * 1.0,
          0,
          -0.52 + (((seed + i * 23) % 100) / 100) * 1.0
        );
        detailGroup.add(crack);
      }
    }

    const duneMat = new THREE.MeshLambertMaterial({ color: 0xD8B065, transparent: true, opacity: 0.34 });
    for (let i = 0; i < 2; i++) {
      const drift = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42 + ((seed + i) % 5) * 0.05, 0.12),
        duneMat
      );
      drift.rotation.x = -Math.PI / 2;
      drift.rotation.z = ((seed + i * 13) % 8) * 0.35;
      drift.position.set(
        -0.55 + (((seed + i * 11) % 100) / 100) * 1.1,
        0.003,
        -0.58 + (((seed + i * 7) % 100) / 100) * 1.16
      );
      detailGroup.add(drift);
    }

    this.scene.add(detailGroup);
    this.detailGroup = detailGroup;
  }

  destroy() {
    super.destroy();
    if (this.detailGroup) this.scene.remove(this.detailGroup);
  }
}
