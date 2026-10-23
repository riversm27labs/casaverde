const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = value => Number.isFinite(value) && value > 0 ? new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(value) : 'Sob consulta';
const plantIcon = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 30h18l-3 13H18ZM24 30V15M24 24C9 24 8 12 8 12s16-2 16 12ZM24 18C24 5 39 5 39 5s1 13-15 13Z"/></svg>';
const placeholderImage = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(plantIcon.replace('<svg viewBox="0 0 48 48" aria-hidden="true">', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="-40 -24 128 128" fill="none" stroke="#6e826c" stroke-width="1.1" style="background:#f0f3e9">').replace('</svg>', '<text x="24" y="62" text-anchor="middle" font-family="Arial,sans-serif" font-size="3.5" letter-spacing=".5" fill="#6e826c" stroke="none">FOTO EM BREVE</text></svg>'));
const cartIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 3h3l3 13h11l3-9H6"/><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/></svg>';
const placeholder = () => `<div class="placeholder-photo">${plantIcon}<span>Foto em breve</span></div>`;
const available = product => product?.stock !== 'esgotado' && Number.isFinite(product?.price) && product.price > 0;
const photo = product => product?.images?.[0] || placeholderImage;
let cart = [], data, cache = new Map(), page = 1, sequence = 0, cartSequence = 0, timer, initialized = false, requestId = crypto.randomUUID();
try {
  const saved = JSON.parse(localStorage.getItem('cv-cart') || '[]');
  if (Array.isArray(saved)) cart = saved.filter(item => item && typeof item.id === 'string' && Number.isInteger(item.qty) && item.qty > 0 && item.qty <= 99).slice(0, 30);
} catch { /* Carrinho corrompido não impede acesso à loja. */ }

async function request(route, body) {
  let response;
  try { response = await fetch('/api/' + route, body ? {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)} : {}); }
  catch { throw Error('Não foi possível acessar a loja. Confira sua conexão e tente novamente.'); }
  let result;
  try { result = await response.json(); }
  catch { throw Error('A loja retornou uma resposta inválida. Tente novamente.'); }
  if (!response.ok) throw Error(result.error || 'Não foi possível concluir. Tente novamente.');
  return result;
}
function persist() {
  try { localStorage.setItem('cv-cart', JSON.stringify(cart)); } catch { /* Continua funcionando nesta aba. */ }
  const count = cart.reduce((total, item) => total + item.qty, 0);
  $('#cart-count').textContent = count;
  $('#cart-open').setAttribute('aria-label', `Abrir carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`);
}
function imageFallbacks(root) {
  root.querySelectorAll('img').forEach(image => {
    image.onerror = () => { image.onerror = null; image.src = placeholderImage; };
  });
}
function productCard(product) {
  const stock = product.stock === 'esgotado' ? 'Esgotado' : product.stock === 'sob-encomenda' ? 'Sob encomenda' : 'Disponível para solicitação';
  return `<article class="product">
    <button class="product-image" data-view="${esc(product.id)}" aria-label="Ver detalhes de ${esc(product.name)}">
      ${product.images?.length ? `<img loading="lazy" src="${esc(photo(product))}" alt="${esc(product.name)}">` : placeholder()}
      ${product.featured ? '<span class="tag">Destaque</span>' : product.stock === 'esgotado' ? '<span class="tag">Esgotado</span>' : ''}
    </button>
    <div class="product-body"><span class="product-category">${esc(product.category)}</span><h3>${esc(product.name)}</h3><p class="product-price">${money(product.price)}</p><span class="availability ${available(product) ? '' : 'unavailable'}">${esc(stock)}</span>
      <div class="product-actions"><button class="primary" data-add="${esc(product.id)}" ${available(product) ? '' : 'disabled'} aria-label="Adicionar ${esc(product.name)} ao carrinho">${cartIcon} ${available(product) ? 'Adicionar ao carrinho' : product.stock === 'esgotado' ? 'Indisponível' : 'Preço sob consulta'}</button><a class="product-details" href="#produto/${esc(product.id)}" data-view="${esc(product.id)}">Ver detalhes →</a></div>
    </div></article>`;
}
function bindProducts(root) {
  root.querySelectorAll('[data-view]').forEach(button => button.onclick = event => {
    event.preventDefault();
    history.replaceState(null, '', '#produto/' + button.dataset.view);
    detail(button.dataset.view);
  });
  root.querySelectorAll('[data-add]').forEach(button => button.onclick = async () => {
    button.disabled = true;
    try { await addToCart(button.dataset.add, 1); }
    catch (error) { showCatalogError(error.message); }
    finally { button.disabled = !available(cache.get(button.dataset.add)); }
  });
  imageFallbacks(root);
}
function showCatalogError(message) {
  $('#load-error').hidden = false;
  $('#load-error').textContent = message;
  $('#retry').hidden = false;
}
function hasFilters() {
  return ['search','category','min-price','max-price'].some(id => $('#' + id).value !== '');
}
async function load() {
  const version = ++sequence;
  $('#load-error').hidden = false;
  $('#load-error').textContent = 'Carregando produtos…';
  $('#retry').hidden = true;
  $('#catalog-products').setAttribute('aria-busy', 'true');
  const params = new URLSearchParams({page, q:$('#search').value, sort:$('#sort').value, category:$('#category').value, min:$('#min-price').value, max:$('#max-price').value});
  try {
    const result = await request('catalog?' + params);
    if (version !== sequence) return;
    if (!Array.isArray(result.products) || !Array.isArray(result.categories) || !Number.isFinite(result.total)) throw Error('O catálogo não pôde ser carregado. Tente novamente em instantes.');
    data = result;
    result.products.forEach(product => cache.set(product.id, product));
    $('#catalog-products').innerHTML = result.products.length ? result.products.map(productCard).join('') : `<div class="empty">${plantIcon}<h3>${hasFilters() ? 'Nenhum produto encontrado.' : 'O próximo toque de verde está chegando.'}</h3><p>${hasFilters() ? 'Ajuste os filtros ou busque outro produto.' : 'Ainda não há produtos publicados no catálogo. Conte o que procura: a Casa Verde pode atender sua solicitação.'}</p><a class="outline" href="#contato">Falar com a loja →</a></div>`;
    bindProducts($('#catalog-products'));
    $('#catalog-title').textContent = $('#category').value || (hasFilters() ? 'Resultados da busca' : 'Destaques da loja');
    $('#page-info').textContent = `${result.total} produtos · Página ${page} de ${Math.max(1, Math.ceil(result.total / 12))}`;
    $('#prev').disabled = page <= 1;
    $('#next').disabled = page * 12 >= result.total;
    $('#load-error').hidden = true;
    const selectedCategory = $('#category').value;
    $('#category').innerHTML = '<option value="">Todas as categorias</option>' + result.categories.map(category => `<option ${category === selectedCategory ? 'selected' : ''}>${esc(category)}</option>`).join('');
    $('#department-sections').hidden = hasFilters();
    if (!initialized) { initialized = true; applySettings(result); buildHomeCollections(result); }
    await window.CasaVerdeDemo?.render(result);
  } catch (error) {
    if (version === sequence) { showCatalogError(error.message); $('#catalog-products').innerHTML = ''; }
  } finally {
    if (version === sequence) $('#catalog-products').setAttribute('aria-busy', 'false');
  }
}
function filterCategory(category) {
  $('#category').value = category;
  $('#search').value = ''; $('#min-price').value = ''; $('#max-price').value = '';
  page = 1;
  load();
  $('#main-nav').classList.remove('mobile-open');
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
  $('#colecao').scrollIntoView({behavior:'smooth'});
}
function bindCategories(root) {
  root.querySelectorAll('[data-category]').forEach(link => link.onclick = event => { event.preventDefault(); filterCategory(link.dataset.category); });
}
function renderCategories(categories, products) {
  $('#category-links').innerHTML = categories.map(category => `<a href="#colecao" data-category="${esc(category)}">${esc(category)}</a>`).join('');
  $('#category-cards').innerHTML = categories.length ? categories.map(category => {
    const example = products.find(product => product.category === category && product.images?.length);
    return `<a class="category-card" href="#colecao" data-category="${esc(category)}"><img src="${esc(example ? photo(example) : placeholderImage)}" alt="" width="58" height="58"><span>${esc(category)}</span></a>`;
  }).join('') : '<p class="category-empty">As categorias serão exibidas quando houver produtos publicados.</p>';
  bindCategories($('#category-links')); bindCategories($('#category-cards'));
  imageFallbacks($('#category-cards'));
}
async function buildHomeCollections(result) {
  renderCategories(result.categories, result.products);
  const heroProduct = result.products.find(product => product.images?.length && available(product));
  if (heroProduct) {
    $('#banner-product').innerHTML = `<a class="banner-real-product" href="#produto/${esc(heroProduct.id)}" data-view="${esc(heroProduct.id)}"><img fetchpriority="high" src="${esc(photo(heroProduct))}" alt="${esc(heroProduct.name)}"><span class="banner-product-caption"><b>${esc(heroProduct.name)}</b>${money(heroProduct.price)} · Ver produto →</span></a>`;
    bindProducts($('#banner-product'));
  }
  // Consultas limitadas a três departamentos reais; nenhuma categoria é criada.
  const groups = [
    {title:'Vasos & cachepôs', matches:/vaso|cachep[oô]/i},
    {title:'Plantas para o seu espaço', matches:/planta|flor|muda|ornamenta/i},
    {title:'Tudo para cuidar do seu verde', matches:/jardin|substrato|adubo|ferrament|acess[oó]rio/i}
  ];
  const selected = groups.map(group => ({...group, category:result.categories.find(category => group.matches.test(category))})).filter(group => group.category);
  const collections = await Promise.allSettled(selected.map(async group => {
    const response = await request('catalog?' + new URLSearchParams({page:1,category:group.category}));
    response.products.forEach(product => cache.set(product.id, product));
    return {...group, products:response.products.slice(0,4)};
  }));
  const successful = collections.filter(collection => collection.status === 'fulfilled').map(collection => collection.value);
  $('#department-sections').innerHTML = successful.filter(group => group.products.length).map(group => `<section class="department-section"><div class="section-heading"><h2>${esc(group.title)}</h2><a class="textlink" href="#colecao" data-category="${esc(group.category)}">Ver categoria →</a></div><div class="products">${group.products.map(productCard).join('')}</div></section>`).join('');
  bindProducts($('#department-sections')); bindCategories($('#department-sections'));
  renderCategories(result.categories, [...result.products, ...successful.flatMap(group => group.products)]);
  await window.CasaVerdeDemo?.render(result);
}
function applySettings(result) {
  const settings = result.settings;
  document.title = settings.name + ' | Plantas, vasos e jardinagem';
  document.querySelectorAll('.shop-name').forEach(element => element.textContent = settings.name);
  if (settings.headline) $('#institutional-headline').textContent = settings.headline;
  if (settings.description) $('#institutional-description').textContent = settings.description;
  const companyInfo = [settings.hours, settings.address].filter(Boolean);
  if (companyInfo.length) $('#top-company-info').textContent = companyInfo.join(' · ');
  if (companyInfo.length) $('#store-info').innerHTML = [settings.address,settings.hours].filter(Boolean).map(text => `<p>${esc(text)}</p>`).join('');
  if (/^55\d{10,11}$/.test(settings.whatsapp)) {
    const link = 'https://wa.me/' + settings.whatsapp;
    $('#whatsapp').href = link; $('#whatsapp').hidden = false;
    $('#store-info').insertAdjacentHTML('beforeend', `<a href="${link}" target="_blank" rel="noopener">WhatsApp da loja ↗</a>`);
  }
  if (settings.instagram?.startsWith('https://')) document.querySelectorAll('.ig-slot').forEach(element => element.innerHTML = `<a href="${esc(settings.instagram)}" target="_blank" rel="noopener">Instagram ↗</a>`);
  if (result.projects.length) {
    $('#trabalhos').hidden = false;
    $('#gallery').innerHTML = result.projects.map(project => `<article class="project-card"><img src="${esc(photo(project))}" alt="${esc(project.name)}" loading="lazy"><h3>${esc(project.name)}</h3><p>${esc(project.description)}</p><small>${esc(project.location)}</small></article>`).join('');
    imageFallbacks($('#gallery'));
  }
}
async function addToCart(id, qty) {
  const product = await request('catalog/' + encodeURIComponent(id));
  cache.set(id, product);
  const existing = cart.find(item => item.id === id);
  if (!available(product)) throw Error('Produto indisponível para solicitação. Consulte a loja.');
  if (!Number.isInteger(qty) || qty < 1 || qty + (existing?.qty || 0) > 99 || (!existing && cart.length >= 30)) throw Error('Informe de 1 a 99 unidades. Limite de 30 produtos.');
  if (existing) existing.qty += qty;
  else cart.push({id, qty, price:product.price});
  requestId = crypto.randomUUID(); persist();
  if ($('#detail').open) $('#detail').close();
  await openCart();
}
async function detail(id) {
  try {
    const product = await request('catalog/' + encodeURIComponent(id)); cache.set(id, product);
    $('#detail-body').innerHTML = `<img id="detail-photo" class="detail-photo" src="${esc(photo(product))}" alt="${esc(product.name)}"><div class="thumbs">${(product.images || []).map(image => `<button data-photo="${esc(image)}" aria-label="Ampliar foto"><img src="${esc(image)}" alt="${esc(product.name)}"></button>`).join('')}</div><div class="eyebrow">${esc(product.category)}</div><h3>${esc(product.name)}</h3><strong>${money(product.price)}</strong><p class="preserve">${esc(product.description)}</p><p>${esc(product.dimensions)} ${esc(product.material)}</p><p>${product.stock === 'esgotado' ? 'Esgotado' : product.stock === 'sob-encomenda' ? 'Sob encomenda · prazo a confirmar' : 'Disponível · sujeito à confirmação comercial'}</p><label>Quantidade<input id="detail-qty" type="number" min="1" max="99" value="1" step="1"></label><p id="detail-status" role="status"></p><button id="add" class="primary" ${available(product) ? '' : 'disabled'}>Adicionar ao carrinho +</button><p><a href="#contato" id="product-contact" class="textlink">Consultar este produto</a></p><small>Entrega e pagamento a combinar com a loja. Nenhuma cobrança nesta etapa.</small>`;
    if (!$('#detail').open) $('#detail').showModal();
    imageFallbacks($('#detail'));
    document.querySelectorAll('[data-photo]').forEach(button => button.onclick = () => $('#detail-photo').src = button.dataset.photo);
    $('#product-contact').onclick = () => { $('#detail').close(); $('#message').value = 'Gostaria de saber mais sobre ' + product.name; };
    $('#add').onclick = async () => {
      const button = $('#add'); button.disabled = true;
      try { await addToCart(id, Number($('#detail-qty').value)); }
      catch (error) { $('#detail-status').textContent = error.message; }
      finally { button.disabled = !available(product); }
    };
  } catch (error) { showCatalogError(error.message); }
}
async function openCart() {
  const version = ++cartSequence;
  if (!$('#cart').open) $('#cart').showModal();
  $('#cart-request').disabled = true; $('#cart-items').textContent = 'Conferindo produtos…'; $('#cart-total').textContent = '';
  await Promise.all(cart.map(async item => {
    try { cache.set(item.id, await request('catalog/' + encodeURIComponent(item.id))); }
    catch { cache.delete(item.id); }
  }));
  if (version !== cartSequence) return;
  $('#cart-items').innerHTML = cart.length ? cart.map(item => {
    const product = cache.get(item.id);
    return `<div class="cart-row"><img src="${esc(photo(product))}" alt=""><div><b>${esc(product?.name || 'Produto indisponível')}</b><p>${money(product?.price)} · Subtotal: ${money(product?.price * item.qty)}</p><label>Quantidade<input data-qty="${esc(item.id)}" type="number" min="1" max="99" step="1" value="${item.qty}"></label></div><button class="filter" data-remove="${esc(item.id)}">Remover</button></div>`;
  }).join('') : '<div class="empty">' + plantIcon + '<h3>Seu carrinho está vazio.</h3><p>Explore os produtos e adicione seus favoritos.</p></div>';
  imageFallbacks($('#cart'));
  document.querySelectorAll('[data-qty]').forEach(input => input.onchange = () => {
    const qty = Number(input.value);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) { input.setCustomValidity('Informe um inteiro de 1 a 99.'); input.reportValidity(); $('#cart-request').disabled = true; return; }
    input.setCustomValidity(''); cart.find(item => item.id === input.dataset.qty).qty = qty; requestId = crypto.randomUUID(); persist(); openCart();
  });
  document.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => { cart = cart.filter(item => item.id !== button.dataset.remove); requestId = crypto.randomUUID(); persist(); openCart(); });
  if (!cart.length) return;
  try {
    const quote = await request('quote', {items:cart});
    if (version !== cartSequence) return;
    const changed = quote.items.some(item => cart.find(existing => existing.id === item.id).price !== item.price);
    quote.items.forEach(item => cart.find(existing => existing.id === item.id).price = item.price);
    persist();
    $('#cart-total').textContent = (changed ? 'Preço atualizado pela loja. Confira os valores acima. ' : '') + 'Total dos itens: ' + money(quote.total) + '. Entrega e pagamento a combinar. Nenhuma cobrança nesta etapa.';
    $('#cart-request').disabled = false;
  } catch (error) { if (version === cartSequence) $('#cart-total').textContent = error.message; }
}
$('#cart-open').onclick = openCart;
$('#cart-request').onclick = () => {
  $('#cart').close(); $('#contato').scrollIntoView({behavior:'smooth'});
  $('#message').value = 'Gostaria de confirmar a disponibilidade dos produtos selecionados.';
  $('#contact-form [name=service]').value = 'Produtos e vasos';
  $('#selection-note').textContent = cart.map(item => `${item.qty} × ${cache.get(item.id)?.name || item.id} · ${money(item.price)}`).join('\n');
};
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());
document.querySelectorAll('[data-service]').forEach(link => link.onclick = () => { $('#contact-form [name=service]').value = link.dataset.service; });
$('#contact-form').onsubmit = async event => {
  event.preventDefault();
  const form = event.target, button = form.querySelector('[type=submit]'); button.disabled = true; $('#form-status').textContent = 'Enviando…';
  try {
    const body = Object.fromEntries(new FormData(form));
    body.message = [body.service ? 'Interesse: ' + body.service : '', body.location ? 'Localização: ' + body.location : '', body.message].filter(Boolean).join('\n');
    body.items = cart; body.requestId = requestId;
    const result = await request('inquiries', body);
    $('#form-status').textContent = 'Solicitação registrada: ' + result.id + '. Status: aguardando avaliação da Casa Verde. Nenhum pagamento realizado. Guarde este protocolo.';
    cart = []; persist(); requestId = crypto.randomUUID(); form.reset(); $('#selection-note').textContent = '';
  } catch (error) { $('#form-status').textContent = error.message + ' Seus dados foram mantidos. Confira novamente o carrinho se o preço mudou.'; }
  finally { button.disabled = false; }
};
for (const id of ['search','min-price','max-price']) $('#' + id).oninput = () => { clearTimeout(timer); page = 1; timer = setTimeout(load, 300); };
for (const id of ['sort','category']) $('#' + id).onchange = () => { page = 1; load(); };
$('#search-form').onsubmit = event => { event.preventDefault(); clearTimeout(timer); page = 1; load(); $('#colecao').scrollIntoView({behavior:'smooth'}); };
$('#clear-filters').onclick = () => { for (const id of ['search','min-price','max-price','category']) $('#' + id).value = ''; $('#sort').value = 'destaques'; page = 1; load(); };
$('#prev').onclick = () => { page--; load(); }; $('#next').onclick = () => { page++; load(); }; $('#retry').onclick = load;
$('#menu-toggle').onclick = () => { const open = $('#menu-toggle').getAttribute('aria-expanded') !== 'true'; $('#menu-toggle').setAttribute('aria-expanded', open); $('#main-nav').classList.toggle('mobile-open', open); };
$('#main-nav').querySelectorAll('a').forEach(link => link.onclick = () => { $('#main-nav').classList.remove('mobile-open'); $('#menu-toggle').setAttribute('aria-expanded', 'false'); });
document.querySelectorAll('a[href="#colecao"]:not([data-category])').forEach(link => link.onclick = event => { event.preventDefault(); filterCategory(''); });
if (matchMedia('(max-width:760px)').matches) $('#filter-panel').open = false;
persist(); load();
if (location.hash.startsWith('#produto/')) detail(decodeURIComponent(location.hash.slice(9)));
