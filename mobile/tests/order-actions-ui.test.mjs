import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {discountAmount,reviewUrl} from '../src/order-actions-model.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(import.meta.url),host=name=>({children,...props})=>React.createElement(name,props,children);
const order={id:'30000000-0000-4000-8000-000000000001',codigo:'00241/26',status:'entregue',valor_total:24,valor_subtotal:20,pago:false,pedido_itens:[],cliente_whatsapp:'47999999999'};
function setup(status='entregue'){
 const calls=[],copies=[],events=[],exports={},current={...order,status};
 const rn={View:host('view'),ScrollView:host('scroll'),TextInput:host('input'),Pressable:host('pressable'),ActivityIndicator:host('loading'),Modal:host('modal'),Alert:{alert:(...args)=>events.push(args)}};
 const source=ts.transpileModule(fs.readFileSync('src/OrderActions.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(source,{exports,Error,Number,String,console,require:name=>{
  if(name==='react'||name==='react/jsx-runtime')return require(name);
  if(name==='react-native')return rn;
  if(name==='react-native-safe-area-context')return {SafeAreaView:host('safe')};
  if(name==='lucide-react-native')return new Proxy({},{get:(_,name)=>host('icon-'+String(name))});
  if(name==='expo-clipboard')return {setStringAsync:async s=>copies.push(s)};
  if(name==='./ui')return {Text:host('text'),Button:({title,onPress,disabled})=>React.createElement('pressable',{title,accessibilityLabel:title,onPress,disabled}),Notice:host('notice'),s:{}};
  if(name==='./domain')return {money:n=>'R$ '+n,addons:()=>[],stageLabels:{entregue:'Entregue',cancelado:'Cancelado'}};
  if(name==='./useRemote')return {useRemoteCache:()=>({}),useRemote:()=>({data:{order:current,couriers:[]},loading:false,retry:()=>{}})};
  if(name==='./order-cache')return {confirmOrder:()=>{},confirmMutation:()=>{}};
  if(name==='./transport')return {request:async(...args)=>{calls.push(args);return {token:'a'.repeat(43)}}};
  if(name==='./api')return {order:async()=>current};
  if(name==='./order-tools-api')return {couriers:async()=>[],assignCourier:async()=>({})};
  if(name==='./order-actions-model')return {discountAmount,reviewUrl};
  if(name==='./merchant-layout')return {palette:{green:'#19894e'}};
  throw Error(name);
 }});
 const props={order:current,storeId:'store',busy:false,refresh:()=>events.push('refresh'),...Object.fromEntries(['onEdit','onPaid','onWhatsApp','onPrint','onCancel'].map(k=>[k,()=>events.push(k)]))};
 return {Component:exports.default,props,calls,copies,events};
}
const buttons=t=>t.root.findAllByType('pressable'),button=(t,title)=>buttons(t).find(n=>n.props.accessibilityLabel===title);
test('Delivered card buttons follow the website order with eight functioning controls',async()=>{
 const h=setup();let t;await act(async()=>{t=create(React.createElement(h.Component,h.props))});
 assert.deepEqual(buttons(t).map(n=>n.props.accessibilityLabel),['Editar pedido','Marcar pago','WhatsApp','Imprimir','Desconto','Cancelar','Ver detalhes e entregador','Copiar link de avaliação']);
 for(const title of ['Editar pedido','Marcar pago','WhatsApp','Imprimir','Cancelar'])await act(async()=>{button(t,title).props.onPress()});
 assert.deepEqual(h.events,['onEdit','onPaid','onWhatsApp','onPrint','onCancel']);
 await act(async()=>{button(t,'Copiar link de avaliação').props.onPress()});assert.equal(h.calls[0][2],'POST');assert.equal(h.copies[0],'https://wedelivery.site/avaliar/'+'a'.repeat(43));
 await act(async()=>{t.unmount()});
});
test('Discount uses the validated atomic order API and lets the server calculate totals',async()=>{
 const h=setup();let t;await act(async()=>{t=create(React.createElement(h.Component,h.props))});
 await act(async()=>{button(t,'Desconto').props.onPress()});const input=t.root.findByType('input');await act(async()=>{input.props.onChangeText('2,50')});
 await act(async()=>{button(t,'Aplicar desconto').props.onPress()});assert.equal(h.calls[0][1],`/api/pedidos/${order.id}`);assert.equal(h.calls[0][2],'PATCH');assert.equal(h.calls[0][3].valor_desconto,2.5);assert.equal(h.calls[0][3].valor_total,undefined);
 await act(async()=>{t.unmount()});
});
test('Cancelled card requires confirmation before deleting and has no review link',async()=>{
 const h=setup('cancelado');let t;await act(async()=>{t=create(React.createElement(h.Component,h.props))});
 assert.equal(button(t,'Copiar link de avaliação'),undefined);assert.equal(button(t,'Marcar pago').props.disabled,true);
 await act(async()=>{button(t,'Apagar').props.onPress()});assert.equal(h.calls.length,0);await act(async()=>{h.events[0][2][1].onPress()});assert.equal(h.calls[0][2],'DELETE');assert.equal(h.calls[0][1],`/api/pedidos/${order.id}/apagar`);
 await act(async()=>{t.unmount()});
});
