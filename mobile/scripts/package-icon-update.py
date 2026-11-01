"""Resource-only update for verified Android 0.3.1. DEX, JS, libraries and resource IDs remain byte-identical. Output must be zipaligned and signed."""
import pathlib,hashlib,json,zipfile,struct,sys
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
        assert strings[index]=='0.3.1','Unexpected baseline version name'
        pos,count=offsets[index]
        value='0.3.2'.encode('utf-8' if utf8 else 'utf-16-le')
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
                        assert value_type==0x10 and value==6
                        struct.pack_into('<I',data,attr+16,7);changed_code=True
                    elif strings[name]=='versionName':
                        assert value_type==3
                        change_string(value)
                        if raw_index!=0xffffffff and raw_index!=value:change_string(raw_index)
                        changed_name=True
        pos+=size
    assert changed_code and changed_name
    return bytes(data)

def main():
    baseline, folder, output=map(pathlib.Path,sys.argv[1:])
    assert hashlib.sha256(baseline.read_bytes()).hexdigest()=='7320e77dc7557301623474809b715332694de1c62386acaaf10e3ec8ced5cdf0'
    entries=json.loads((folder/'manifest.json').read_text())
    expected={'res/d2.webp','res/yw.webp','res/MO.webp','res/fq.webp','res/qs.webp','res/u5.webp','res/Sn.webp','res/j_.webp','res/sK.webp','res/-6.webp'}
    assert len(entries)==10 and {e['path'] for e in entries}==expected
    replacements={e['path']:folder/e['file'] for e in entries}
    with zipfile.ZipFile(baseline) as old,zipfile.ZipFile(output,'w') as new:
        for e in entries:
            assert hashlib.sha256(old.read(e['path'])).hexdigest()==e['old_sha256']
            assert hashlib.sha256(replacements[e['path']].read_bytes()).hexdigest()==e['new_sha256']
        for entry in old.infolist():
            if entry.filename.startswith('META-INF/') and (entry.filename.upper().endswith(('.SF','.RSA','.DSA','.EC')) or entry.filename=='META-INF/MANIFEST.MF'):continue
            data=old.read(entry.filename)
            if entry.filename=='AndroidManifest.xml':data=update_manifest(data)
            elif entry.filename in replacements:data=replacements[entry.filename].read_bytes()
            new.writestr(entry,data)
    with zipfile.ZipFile(output) as new: assert new.testzip() is None
    print('Verified launcher replacement:',len(entries),'resources')
if __name__=='__main__':main()
