"""Package a JS-only update over the verified 0.3.3 native test runtime.

Fail closed if native dependencies, the Hermes ABI, assets, or baseline bytes differ.
Output is unsigned: zipalign and apksigner are required afterwards.
This is only valid while there are no native module/config changes besides version.
"""
import argparse
import hashlib
import json
import pathlib
import struct
import zipfile

BASELINE_SHA = '86bb5670bdbfcbb56f7e507505c75f9b9fc62dec91020caf7de1edd7b16cd50f'
NATIVE_DEPS = {'@expo-google-fonts/inter':'0.4.2','@supabase/supabase-js':'2.118.0','expo':'58.0.21','expo-audio':'58.0.10','expo-auth-session':'58.0.16','expo-clipboard':'58.0.4','expo-crypto':'58.0.7','expo-file-system':'58.0.13','expo-font':'58.0.11','expo-image-picker':'58.0.10','expo-linear-gradient':'58.0.3','expo-print':'58.0.8','expo-secure-store':'58.0.2','expo-status-bar':'58.0.4','expo-web-browser':'58.0.7','lucide-react-native':'1.66.0','react':'19.3.0','react-native':'0.88.1','react-native-safe-area-context':'5.10.1','react-native-svg':'15.16.0','react-native-url-polyfill':'4.0.0'}

def update_manifest(raw):
    data=bytearray(raw)
    strings=[]
    offsets=[]
    utf8=False
    def length8(pos):
        n=data[pos];pos+=1
        if n&128:n=((n&127)<<8)|data[pos];pos+=1
        return n,pos
    def length16(pos):
        n=struct.unpack_from('<H',data,pos)[0];pos+=2
        if n&32768:n=((n&32767)<<16)|struct.unpack_from('<H',data,pos)[0];pos+=2
        return n,pos
    def change_string(index):
        assert strings[index]=='0.3.3','Unexpected baseline version name'
        pos,count=offsets[index]
        value='0.3.4'.encode('utf-8' if utf8 else 'utf-16-le')
        assert len(value)==count
        data[pos:pos+count]=value
    pos=struct.unpack_from('<H',data,2)[0]
    changed_code=changed_name=False
    while pos<len(data):
        kind,header,size=struct.unpack_from('<HHI',data,pos)
        assert size>=header>=8 and pos+size<=len(data)
        if kind==1:
            count=struct.unpack_from('<I',data,pos+8)[0]
            flags,start=struct.unpack_from('<II',data,pos+16)
            utf8=bool(flags&256)
            for i in range(count):
                start_pos=pos+start+struct.unpack_from('<I',data,pos+header+i*4)[0]
                if utf8:
                    _,cursor=length8(start_pos);n,cursor=length8(cursor);raw_string=data[cursor:cursor+n];text=raw_string.decode('utf-8');offsets.append((cursor,n))
                else:
                    n,cursor=length16(start_pos);raw_string=data[cursor:cursor+n*2];text=raw_string.decode('utf-16-le');offsets.append((cursor,n*2))
                strings.append(text)
        elif kind==0x102:
            name=struct.unpack_from('<I',data,pos+20)[0]
            if strings[name]=='manifest':
                start,step,count=struct.unpack_from('<HHH',data,pos+24)
                for i in range(count):
                    attr=pos+16+start+i*step
                    _,name,raw_index=struct.unpack_from('<III',data,attr)
                    value_type=data[attr+15]
                    value=struct.unpack_from('<I',data,attr+16)[0]
                    if strings[name]=='versionCode':
                        assert value_type==0x10 and value==8
                        struct.pack_into('<I',data,attr+16,9);changed_code=True
                    elif strings[name]=='versionName':
                        assert value_type==3
                        change_string(value)
                        if raw_index!=0xffffffff and raw_index!=value:change_string(raw_index)
                        changed_name=True
        pos+=size
    assert changed_code and changed_name
    return bytes(data)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('baseline',type=pathlib.Path)
    parser.add_argument('bundle',type=pathlib.Path)
    parser.add_argument('assets',type=pathlib.Path)
    parser.add_argument('output',type=pathlib.Path)
    args=parser.parse_args()
    root=pathlib.Path(__file__).resolve().parents[1]
    deps=json.loads((root/'package.json').read_text())['dependencies']
    assert all(deps.get(k)==v for k,v in NATIVE_DEPS.items()),'Native dependency version changed'
    assert set(deps)-set(NATIVE_DEPS)=={'@supabase/ssr'} and deps['@supabase/ssr']=='0.12.7','Unreviewed new dependency'
    baseline=args.baseline.read_bytes();assert hashlib.sha256(baseline).hexdigest()==BASELINE_SHA,'Baseline checksum differs'
    bundle=args.bundle.read_bytes();assert bundle[:8]==bytes.fromhex('c61fbc03c103191f'),'Not Hermes bytecode'
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(args.baseline) as old:
        assert old.read('assets/index.android.bundle')[:12]==bundle[:12],'Hermes bytecode ABI changed'
        old_hashes={hashlib.sha256(old.read(n)).digest() for n in old.namelist() if n.startswith(('assets/','res/')) and not n.endswith('/')}
        assets=[p for p in args.assets.rglob('*') if p.is_file() and p.name!='keep.xml']
        keep=args.assets/'raw/keep.xml'
        assert keep.read_text().strip()=='<resources xmlns:tools="http://schemas.android.com/tools" tools:keep="@raw/assets_orderalert" />','Unexpected resource keep rules'
        assert assets,'No exported assets to verify'
        for p in assets:assert hashlib.sha256(p.read_bytes()).digest() in old_hashes,'New/changed native resource: '+str(p)
        with zipfile.ZipFile(args.output,'w',allowZip64=True) as out:
            for entry in old.infolist():
                if entry.filename.startswith('META-INF/') and (entry.filename.upper().endswith(('.SF','.RSA','.DSA','.EC')) or entry.filename=='META-INF/MANIFEST.MF'):continue
                value=old.read(entry.filename)
                if entry.filename=='AndroidManifest.xml':value=update_manifest(value)
                elif entry.filename=='assets/index.android.bundle':value=bundle
                out.writestr(entry,value)
    with zipfile.ZipFile(args.output) as out:assert out.testzip() is None
    print('Verified JS-only package:',args.output)
    print('Resources unchanged:',len(assets))

if __name__=='__main__':main()

