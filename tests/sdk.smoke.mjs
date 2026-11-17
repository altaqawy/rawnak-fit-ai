import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const sdk=readFileSync(path.resolve(here,'../sdk/rawnak-fit.js'),'utf8');
assert.ok(sdk.includes("setAttribute('part','button')"), 'shadow parts use writable HTML attribute');
assert.ok(!sdk.includes("trigger.part='button'") && !sdk.includes("mask.part='overlay'"), 'Element.part is read-only');
const registry=new Map();
const documentListeners=new Map();
const events=[];
class FakeElement{
  constructor(tag='div'){
    this.tag=tag; this.attrs={};this.children=[];this.listeners={};
    this.style={};this.isConnected=true;this.shadowRoot=null;
  }
  attachShadow(){this.shadowRoot=new FakeElement('shadow-root');return this.shadowRoot;}
  append(...nodes){this.children.push(...nodes);for(const x of nodes)if(x)x.parentNode=this;}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(name,value){this.attrs[name]=String(value);}
  getAttribute(name){return this.attrs[name]??null;}
  hasAttribute(name){return Object.hasOwn(this.attrs,name);}
  addEventListener(name,listener){this.listeners[name]=listener;}
  focus(){fakeDocument.activeElement=this;}
  remove(){this.removed=true;this.parentNode && (this.parentNode.children=this.parentNode.children.filter(x=>x!==this));}
  dispatchEvent(event){events.push(event);return true;}
  querySelectorAll(){return [];}
}
class HTMLElementMock extends FakeElement{constructor(){super('rawnak-fit');}}
class CustomEventMock{constructor(type,options){this.type=type;this.detail=options?.detail;this.bubbles=options?.bubbles;this.composed=options?.composed;}}
const fakeDocument={
  currentScript:{src:'https://altaqawy.github.io/rawnak-fit-ai/sdk/rawnak-fit.js'},
  activeElement:null,
  createElement:type=>new FakeElement(type),
  addEventListener:(type,handler)=>documentListeners.set(type,handler),
  removeEventListener:type=>documentListeners.delete(type)
};
const context={
  HTMLElement:HTMLElementMock,
  CustomEvent:CustomEventMock,
  customElements:{get:tag=>registry.get(tag),define:(tag,cls)=>registry.set(tag,cls)},
  document:fakeDocument,
  location:{href:'https://shop.example.com/product/test'},
  URL,console
};
runInNewContext(sdk,context);
assert.ok(registry.has('rawnak-fit'),'web component registers from external script');

const Widget=registry.get('rawnak-fit');
const widget=new Widget();
widget.setAttribute('store-id','store-alpha');
widget.setAttribute('product-id','WATCH-001');
widget.setAttribute('variant-id','silver-42');
widget.setAttribute('category','watch');
widget.setAttribute('product-name','Classic Watch');
widget.connectedCallback();
assert.equal(widget.enabled,true);
assert.equal(widget.trigger.disabled,false);
widget.open();
assert.equal(widget.isOpen,true);
assert.equal(widget.frame.tag,'iframe');
assert.equal(widget.frame.allow,'camera','cross-origin iframe must allow camera');
assert.ok(documentListeners.has('keydown'),'keyboard navigation handler added');
const url=new URL(widget.frame.src);
assert.equal(url.origin,'https://altaqawy.github.io');
assert.equal(url.pathname,'/rawnak-fit-ai/');
assert.equal(url.searchParams.get('item'),'watch');
assert.equal(url.searchParams.get('sku'),'WATCH-001');
assert.equal(url.searchParams.get('variant'),'silver-42');
assert.equal(url.searchParams.get('embed'),'1');

const cart=widget.mask.children[0].children[2].children[1].children[1];
assert.equal(cart.tag,'button');
cart.listeners.click();
assert.equal(widget.isOpen,false);
assert.equal(widget.mask,null,'iframe removed on close');
assert.ok(!documentListeners.has('keydown'),'listener removed');
const cartEvent=events.find(e=>e.type==='rawnak-fit:add-to-cart');
assert.equal(cartEvent.detail.productId,'WATCH-001');
assert.equal(cartEvent.detail.variantId,'silver-42');
assert.equal(cartEvent.detail.origin,'rawnak-fit-sdk-demo');

widget.setAttribute('category','ring');
widget.attributeChangedCallback();
assert.equal(widget.enabled,false,'unsupported ring try-on is disabled rather than misrepresented');
assert.equal(widget.trigger.disabled,true);

const glasses=new Widget();
glasses.setAttribute('category','glasses');
glasses.setAttribute('product-id','GLASSES-TEST-01');
glasses.connectedCallback();
assert.equal(new URL(glasses.previewURL).searchParams.get('item'),'glasses');
const clothes=new Widget();
clothes.setAttribute('category','tshirt');
clothes.connectedCallback();
assert.equal(new URL(clothes.previewURL).searchParams.get('item'),'tee');

console.log('SDK smoke tests passed: component registration, category selection, camera allowance, events and cleanup.');
