import { zipSync, strToU8 } from 'fflate'
import { reportTabs, type ReportResult } from './merchant-reports.ts'
const esc=(v:unknown)=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const pkg='http://schemas.openxmlformats.org/package/2006/relationships'
export function reportWorkbook(r:ReportResult){
 const s=r.summary
 const sheets:{name:string;rows:(string|number)[][]}[]=[
  {name:'Resumo',rows:[['Período inicial',r.filters.from],['Período final',r.filters.to],['Situação',r.filters.status||'Todas'],['Pagamento',r.filters.payment||'Todos'],['Fuso horário','America/Sao_Paulo'],['Vendas pagas',s.vendas],['Entradas',s.entradas],['Saídas',s.saidas],['Saldo',s.saldo],['Pedidos pagos',s.pedidos],['Ticket médio',s.ticket]]},
  ...reportTabs.map(([id,name])=>({name,rows:[['Descrição','Quantidade','Valor (R$)'],...r.rows[id].map(x=>[x.nome,x.qtd,x.total])]})),
  {name:'Visualizações',rows:[['Período',r.filters.visits],['Total',r.visits.total],['Dia','Visualizações'],...r.visits.porDia.map(x=>[x.data,x.views])]}
 ]
 const files:Record<string,Uint8Array>={}
 const xml=(path:string,value:string)=>{files[path]=strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+value)}
 xml('[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`)
 xml('_rels/.rels',`<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
 xml('xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${sheets.map((x,i)=>`<sheet name="${esc(x.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`)
 xml('xl/_rels/workbook.xml.rels',`<Relationships xmlns="${pkg}">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`)
 sheets.forEach((s,i)=>xml(`xl/worksheets/sheet${i+1}.xml`,`<worksheet xmlns="${ns}"><cols><col min="1" max="1" width="39" customWidth="1"/><col min="2" max="3" width="20" customWidth="1"/></cols><sheetData>${s.rows.map((row,j)=>`<row r="${j+1}">${row.map((v,k)=>{const ref=String.fromCharCode(65+k)+(j+1);return typeof v==='number'?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`}).join('')}</row>`).join('')}</sheetData></worksheet>`))
 return zipSync(files,{level:6})
}
