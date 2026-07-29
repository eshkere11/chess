import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'fs';

const loader = new GLTFLoader();
const data = fs.readFileSync('./public/models/ChessModels.glb');

loader.parse(data, '', (gltf) => {
  const scene = gltf.scene;
  
  console.log('\n=== SCENE HIERARCHY ===\n');
  const printHierarchy = (obj, depth = 0) => {
    const indent = '  '.repeat(depth);
    console.log(indent + obj.type + ':', obj.name || '(unnamed)');
    if (obj.isMesh && obj.geometry) {
      console.log(indent + '  └─ vertices:', obj.geometry.attributes.position?.count || 0);
    }
    obj.children?.forEach(child => printHierarchy(child, depth + 1));
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
  
  console.log('\nLoading strategy:');
  const hasMultipleMeshes = meshes.length > 1;
  if (hasMultipleMeshes) {
    console.log('  → Clone individual meshes by name');
  } else {
    console.log('  → Extract pieces from combined mesh');
  }
  
  process.exit(0);
}, undefined, (error) => {
  console.error('Error loading GLB:', error);
  process.exit(1);
});
