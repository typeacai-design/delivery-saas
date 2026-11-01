/** Technical density export only; artwork is the approved generated app-icon.png. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [baseline,folder='dist/icon-update']=process.argv.slice(2);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(!baseline||sha(fs.readFileSync(baseline))!=='7320e77dc7557301623474809b715332694de1c62386acaaf10e3ec8ced5cdf0')throw Error('Expected verified Android 0.3.1 baseline');
const paths={mdpi:['res/d2.webp','res/yw.webp'],hdpi:['res/MO.webp','res/fq.webp'],xhdpi:['res/qs.webp','res/u5.webp'],xxhdpi:['res/Sn.webp','res/j_.webp'],xxxhdpi:['res/sK.webp','res/-6.webp']};
fs.mkdirSync(folder,{recursive:true});
const manifest=[];
for(const [density,names] of Object.entries(paths))for(const [index,name] of names.entries()){
 const old=execFileSync('unzip',['-p',baseline,name]);
 const oldFile=path.join(folder,`old-${density}${index?'-round':''}.webp`);fs.writeFileSync(oldFile,old);
 const size=Number(execFileSync('identify',['-format','%w',oldFile],{encoding:'utf8'}));
 if(![48,72,96,144,192].includes(size))throw Error('Unexpected launcher dimensions');
 const file=`${density}${index?'-round':''}.webp`;
 const args=['assets/app-icon.png','-resize',`${size}x${size}`];
 if(index)args.push('(','+clone','-alpha','transparent','-fill','white','-draw',`circle ${size/2},${size/2} ${size/2},0`,')','-alpha','off','-compose','CopyOpacity','-composite');
 args.push('-define','webp:lossless=true',path.join(folder,file));execFileSync('convert',args);
 manifest.push({density,path:name,size,file,old_sha256:sha(old),new_sha256:sha(fs.readFileSync(path.join(folder,file)))});
}
fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(`Exported ${manifest.length} launcher resources`);
