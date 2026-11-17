(function sdkModule(){
  'use strict';
  const VERSION = '0.1.0';
  const ROOT = new URL('../', document.currentScript?.src || location.href);
  const SUPPORTED = Object.freeze({
    watch: 'watch', bangle: 'bracelet', bracelet: 'bracelet',
    glasses: 'glasses', tshirt: 'tee', shirt: 'tee',
    jacket: 'jacket', bag: 'bag', shoes: 'shoes'
  });
  const ICONS = Object.freeze({
    watch: '⌚', bangle: '◯', bracelet: '◯', glasses: '🕶',
    tshirt: '👕', shirt: '👕', jacket: '🧥', bag: '👜', shoes: '👟'
  });
  const css = String.raw`
    :host{display:inline-block;font:inherit;--rf-accent:#c8f29d;--rf-ink:#14331e}
    button{font:inherit;cursor:pointer}
    .trigger{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:0;
      background:var(--rf-accent);color:var(--rf-ink);border-radius:12px;padding:13px 20px;
      font-size:14px;font-weight:700;transition:transform .15s,filter .15s}
    .trigger:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.04)}
    .trigger:focus-visible,.close:focus-visible,.cart:focus-visible,.fallback:focus-visible{outline:3px solid #86b6e5;outline-offset:3px}
    .trigger:disabled{opacity:.65;cursor:not-allowed}
    .overlay{position:fixed;inset:0;z-index:2147483646;background:#03110de8;
      display:flex;align-items:center;justify-content:center;padding:18px}
    .overlay[hidden]{display:none}
    .dialog{box-sizing:border-box;direction:rtl;width:min(100%,980px);height:min(94dvh,940px);
      background:#0f251b;border:1px solid #bce6ad49;box-shadow:0 24px 90px #0009;
      border-radius:20px;overflow:hidden;display:flex;flex-direction:column;color:#edf8e6}
    .top{padding:12px 17px;display:flex;align-items:center;gap:14px;justify-content:space-between;
      background:#162f22;border-bottom:1px solid #ffffff21}
    .title{font-size:14px;font-weight:700;min-width:0}
    .meta{color:#b8d4bb;font-size:11px;display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis}
    .close{background:#244735;color:#fff;border:1px solid #ffffff33;border-radius:10px;padding:8px 12px;flex-shrink:0}
    iframe{border:0;flex:1;width:100%;background:#091b12;min-height:0}
    .bottom{padding:11px 14px;background:#10261c;border-top:1px solid #ffffff24;
      display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .note{font-size:11px;color:#bed0bf;max-width:440px;line-height:1.55}
    .actions{display:flex;align-items:center;gap:9px}
    .cart{background:var(--rf-accent);color:var(--rf-ink);padding:9px 13px;border:0;border-radius:9px;font-weight:700}
    .fallback{color:#d7f6b4;text-decoration:underline;font-size:12px}
    @media(max-width:650px){.overlay{padding:0}.dialog{width:100%;height:100dvh;border-radius:0;border:0}
      .top{padding:10px}.bottom{padding:10px}.note{font-size:10px}
      .actions{width:100%;justify-content:space-between}}
  `;

  const normalizeId = (value, max = 96) =>
    String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);

  class RawnakFit extends HTMLElement {
    static get observedAttributes() {
      return ['store-id','product-id','variant-id','category','button-text','product-name','disabled'];
    }
    constructor() {
      super();
      this.attachShadow({mode:'open'});
      this.isOpen = false;
      this.prevFocus = null;
      this._onEscape = (e) => {
        if (e.key === 'Escape' && this.isOpen) {e.stopPropagation();this.close();}
        if (e.key === 'Tab' && this.isOpen) this._trapFocus(e);
      };
    }
    connectedCallback() { this.render(); }
    disconnectedCallback() { this.close(); }
    attributeChangedCallback() {
      if (!this.isConnected) return;
      if (this.isOpen) this.close();
      this.render();
    }
    get category() {return normalizeId(this.getAttribute('category'),28).toLowerCase();}
    get hasValidCategory() {return Object.prototype.hasOwnProperty.call(SUPPORTED,this.category);}
    get storeId() {return normalizeId(this.getAttribute('store-id'));}
    get productId() {return normalizeId(this.getAttribute('product-id'));}
    get variantId() {return normalizeId(this.getAttribute('variant-id'));}
    get productName() {return normalizeId(this.getAttribute('product-name'),130) || this.productId || 'منتج تجريبي';}
    get enabled() {return this.hasValidCategory && !this.hasAttribute('disabled');}
    get previewURL() {
      const url = new URL(ROOT.href);
      url.searchParams.set('embed','1');
      url.searchParams.set('item',SUPPORTED[this.category]);
      url.searchParams.set('store',this.storeId);
      url.searchParams.set('sku',this.productId);
      url.searchParams.set('variant',this.variantId);
      url.searchParams.set('title',this.productName);
      url.searchParams.set('sdk',VERSION);
      return url.href;
    }
    render() {
      const root = this.shadowRoot;
      root.replaceChildren();
      const style = document.createElement('style');style.textContent = css;
      const trigger = document.createElement('button');
      trigger.className='trigger';trigger.part='button';trigger.type='button';
      trigger.textContent=(ICONS[this.category] || '✳')+' '+(this.getAttribute('button-text') || 'جرّبه عليك');
      trigger.disabled=!this.enabled;
      trigger.title=this.hasValidCategory?'تجربة AR توضيحية وليست قياسًا دقيقًا':'المحرك ده لسه غير متاح في نسخة التجربة';
      trigger.setAttribute('aria-haspopup','dialog');
      trigger.addEventListener('click',()=>this.open());
      root.append(style,trigger);
      this.trigger=trigger;
    }
    open() {
      if (!this.enabled || this.isOpen || !this.shadowRoot) return;
      this.prevFocus=document.activeElement;
      this.isOpen=true;
      const mask = document.createElement('div');
      mask.className='overlay';mask.part='overlay';
      const dialog = document.createElement('div');dialog.className='dialog';
      dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
      dialog.setAttribute('aria-label','تجربة '+this.productName);
      const top=document.createElement('div');top.className='top';
      const heading=document.createElement('div');heading.className='title';
      heading.textContent='✳ RAWNAK FIT · '+this.productName;
      const meta=document.createElement('span');meta.className='meta';
      meta.textContent='Store: '+(this.storeId || 'demo')+' · SKU: '+(this.productId || 'demo')+' · '+this.category;
      heading.append(meta);
      const exit=document.createElement('button');exit.className='close';exit.type='button';exit.textContent='إغلاق ×';
      exit.setAttribute('aria-label','إغلاق المراية');exit.addEventListener('click',()=>this.close());
      top.append(heading,exit);

      const frame=document.createElement('iframe');
      frame.src=this.previewURL;
      frame.title='مراية RAWNAK الافتراضية — تجربة توضيحية';
      frame.allow='camera';
      frame.setAttribute('allowfullscreen','');
      frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');

      const footer=document.createElement('div');footer.className='bottom';
      const note=document.createElement('div');note.className='note';
      note.textContent='معاينة AR تجريبية برسومات عامة، مش مجسم المنتج الحقيقي أو ضمان المقاس. الصورة تُعالج داخل المتصفح.';
      const actions=document.createElement('div');actions.className='actions';
      const fallback=document.createElement('a');fallback.className='fallback';fallback.href=this.previewURL;
      fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.textContent='فتح المراية في صفحة مستقلة ↗';
      const cart=document.createElement('button');cart.className='cart';cart.type='button';cart.textContent='إضافة للسلة';
      cart.addEventListener('click',()=>{
        this.dispatchEvent(new CustomEvent('rawnak-fit:add-to-cart',{
          bubbles:true,composed:true,
          detail:{ storeId:this.storeId, productId:this.productId, variantId:this.variantId,
                   category:this.category, origin:'rawnak-fit-sdk-demo' }
        }));
        this.close();
      });
      actions.append(fallback,cart);footer.append(note,actions);
      dialog.append(top,frame,footer);mask.append(dialog);
      mask.addEventListener('click',event=>{if(event.target===mask)this.close();});
      this.shadowRoot.append(mask);
      this.mask=mask;this.frame=frame;this.exit=exit;
      document.addEventListener('keydown',this._onEscape,true);
      exit.focus();
      this.dispatchEvent(new CustomEvent('rawnak-fit:open',{
        bubbles:true,composed:true,detail:{storeId:this.storeId,productId:this.productId}
      }));
    }
    _trapFocus(e) {
      const elements=[...this.mask.querySelectorAll('button:not([disabled]),a[href]')];
      if (!elements.length) return;
      const first=elements[0],last=elements[elements.length-1];
      if (e.shiftKey && this.shadowRoot.activeElement===first){e.preventDefault();last.focus();}
      else if (!e.shiftKey && this.shadowRoot.activeElement===last){e.preventDefault();first.focus();}
    }
    close() {
      if (!this.isOpen) return;
      this.isOpen=false;
      document.removeEventListener('keydown',this._onEscape,true);
      this.mask?.remove();
      this.mask=null;this.frame=null;this.exit=null;
      this.trigger?.focus();
      this.dispatchEvent(new CustomEvent('rawnak-fit:close',{
        bubbles:true,composed:true,detail:{storeId:this.storeId,productId:this.productId}
      }));
    }
  }
  if (!customElements.get('rawnak-fit')) customElements.define('rawnak-fit',RawnakFit);
})();
