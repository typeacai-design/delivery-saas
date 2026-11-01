import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { RemoteCache } from '../src/remote-cache.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(import.meta.url),exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/useRemote.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:name=>name==='./remote-cache'?{RemoteCache}:require(name),AbortController,Error});
const {RemoteProvider,useRemote,useRemoteCache}=exports;
let state,cache;
function Probe({resource='a',enabled=true,load}){cache=useRemoteCache();state=useRemote(load,{key:resource,enabled});return React.createElement('result',null,JSON.stringify(state))}
function Tree({show=true,identity='user-a',...props}){return React.createElement(RemoteProvider,{key:identity},show?React.createElement(Probe,props):null)}
test('Actual hooks reuse a tab result on remount, preserve stale data during refresh and isolate the next login',async()=>{
 let calls=0;const load=async()=>({total:++calls});let tree;
 await act(async()=>{tree=create(React.createElement(Tree,{load}))});assert.equal(calls,1);assert.equal(state.data.total,1);
 await act(async()=>{tree.update(React.createElement(Tree,{load,show:false}))});
 await act(async()=>{tree.update(React.createElement(Tree,{load}))});assert.equal(calls,1);assert.equal(state.data.total,1);
 let finish;const slow=()=>new Promise(r=>{finish=r});
 await act(async()=>{tree.update(React.createElement(Tree,{load:slow}));cache.invalidate('a')});assert.equal(state.loading,true);assert.equal(state.data.total,1);
 await act(async()=>{finish({total:2})});assert.equal(state.data.total,2);assert.equal(state.loading,false);
 await act(async()=>{tree.update(React.createElement(Tree,{load:slow,identity:'user-b'}))});assert.equal(state.data,null);assert.equal(state.loading,true);
 await act(async()=>{tree.unmount()});
});
test('Changing a date/filter key never displays results belonging to the previous filter',async()=>{
 let tree;const load=async()=>({date:'yesterday'});await act(async()=>{tree=create(React.createElement(Tree,{load,resource:'yesterday'}))});assert.equal(state.data.date,'yesterday');
 let finish;const slow=()=>new Promise(r=>{finish=r});await act(async()=>{tree.update(React.createElement(Tree,{load:slow,resource:'today'}))});assert.equal(state.data,null);assert.equal(state.loading,true);
 await act(async()=>{finish({date:'today'})});assert.equal(state.data.date,'today');await act(async()=>{tree.unmount()});
});
test('An inactive tab defers invalidation reads until visible and manual retry runs once',async()=>{
 let calls=0,tree;const load=async()=>({n:++calls});await act(async()=>{tree=create(React.createElement(Tree,{load,enabled:false}))});assert.equal(calls,0);
 await act(async()=>{tree.update(React.createElement(Tree,{load}))});assert.equal(calls,1);
 await act(async()=>{tree.update(React.createElement(Tree,{load,enabled:false}));cache.invalidate('a')});assert.equal(calls,1);assert.equal(state.data.n,1);
 await act(async()=>{tree.update(React.createElement(Tree,{load}))});assert.equal(calls,2);
 await act(async()=>{state.retry()});assert.equal(calls,3);await act(async()=>{tree.unmount()});
});
