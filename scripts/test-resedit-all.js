import fs from 'fs';
import path from 'path';
import * as ResEdit from 'resedit';

console.log('Testing icon.ico in root:');
try {
  const buf = fs.readFileSync('icon.ico');
  const icon = ResEdit.Data.IconFile.from(buf);
  console.log('root icon.ico parsed successfully, count:', icon.icons.length);
} catch (e) {
  console.error('root icon.ico FAILED:', e);
}

console.log('Testing build-resources/icon.ico:');
try {
  const buf = fs.readFileSync('build-resources/icon.ico');
  const icon = ResEdit.Data.IconFile.from(buf);
  console.log('build-resources icon.ico parsed successfully, count:', icon.icons.length);
} catch (e) {
  console.error('build-resources icon.ico FAILED:', e);
}
