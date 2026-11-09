import json,sys,zipfile,struct
from pathlib import Path
p=Path(sys.argv[1]);out={}
with zipfile.ZipFile(p) as z:
 for abi,bits,machine in [('armeabi-v7a',1,40),('arm64-v8a',2,183)]:
  files=[n for n in z.namelist() if n.startswith('lib/'+abi+'/') and n.endswith('.so')]
  assert files, 'Missing '+abi
  for name in files:
   data=z.read(name)[:20];assert data[:4]==b'\x7fELF' and data[4]==bits and struct.unpack('<H',data[18:20])[0]==machine, name
  out[abi]=len(files)
 assert z.testzip() is None
print(json.dumps({'native_libraries_verified':out}))
