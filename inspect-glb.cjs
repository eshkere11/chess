const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
const fs = require('fs');

async function inspectGLB() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const data = fs.readFileSync('./public/models/ChessModels.glb');

    loader.parse(data, '', (gltf) => {
      try {
        const scene = gltf.scene;
        
        console.log('\n=== SCENE HIERARCHY ===\n');
        const printHierarchy = (obj, depth = 0) => {
          const indent = '  '.repeat(depth);
          console.log(indent + obj.type + ':', obj.name || '(unnamed)');
          if (obj.isMesh && obj.geometry) {
            console.log(indent + '  └─ vertices:', obj.geometry.attributes.position?.count || 0);
          }
          if (obj.children && obj.children.length > 0) {
            obj.children.forEach(child => printHierarchy(child, depth + 1));
          }
        };
        printHierarchy(scene);
        
        console.log('\n=== ALL MESH NAMES ===\n');
        const meshes = [];
        scene.traverse(obj => {
          if (obj.isMesh) {
            meshes.push(obj.name);
            console.log('✓ Mesh:', obj.name);
          }
        });
        
        console.log('\n=== ANALYSIS ===\n');
        
        const pieceTypes = ['Pawn', 'Rook', 'Knight', 'Bishop', 'Queen', 'King'];
        const found = pieceTypes.filter(p => meshes.some(m => m.toLowerCase().includes(p.toLowerCase())));
        const missing = pieceTypes.filter(p => !found.includes(p));
        
        console.log('Piece types found:', found.length + '/' + pieceTypes.length);
        if (found.length > 0) console.log('  Found:', found.join(', '));
        if (missing.length > 0) console.log('  Missing:', missing.join(', '));
        
        console.log('\nTotal meshes in model:', meshes.length);
        console.log('\nLoading strategy:');
        const hasMultipleMeshes = meshes.length > 1;
        if (hasMultipleMeshes) {
          console.log('  → Clone individual meshes by name');
        } else {
          console.log('  → Extract pieces from combined mesh');
        }
        
        resolve();
      } catch (err) {
        reject(err);
      }
    }, undefined, (error) => {
      reject(error);
    });
  });
}

inspectGLB()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
