// Generated AI product photos: gallery uses the actual images committed under demo/assets.
import { DEMO_PRODUCTS } from './catalog.js';

for (const card of document.querySelectorAll('.product')) {
  const widget=card.querySelector('rawnak-fit');
  const product=DEMO_PRODUCTS[widget?.getAttribute('product-id')];
  const stage=card.querySelector('.art');
  if(!product||!stage)continue;

  stage.replaceChildren();
  stage.classList.add('real-product-photo');
  const image=new Image();
  image.src=product.photos[0].src;
  image.alt=product.name+' — '+product.photos[0].view;
  image.loading='lazy';
  image.decoding='async';
  image.addEventListener('error',()=>{
    image.alt='تعذر تحميل صورة المنتج';
    stage.classList.add('image-failed');
  });
  const stamp=document.createElement('span');
  stamp.className='ai-photo-stamp';stamp.textContent='AI GENERATED · DEMO';
  const nav=document.createElement('div');nav.className='photo-nav';
  for (const [idx,p] of product.photos.entries()) {
    const button=document.createElement('button');
    button.type='button';
    button.textContent=p.view;
    button.className=idx===0?'active':'';
    button.setAttribute('aria-pressed',String(idx===0));
    button.addEventListener('click',()=>{
      image.src=p.src;
      image.alt=product.name+' — '+p.view;
      stage.classList.remove('image-failed');
      for(const b of nav.querySelectorAll('button')){b.classList.remove('active');b.setAttribute('aria-pressed','false');}
      button.classList.add('active');button.setAttribute('aria-pressed','true');
    });
    nav.append(button);
  }
  stage.append(image,stamp,nav);

  const details=card.querySelector('.details');
  const link=document.createElement('a');
  link.className='process-link';
  link.href='./process.html?sku='+encodeURIComponent(product.sku);
  link.textContent='شاهد الصور والتحليل والنتيجة  ↗';
  details?.append(link);
}
