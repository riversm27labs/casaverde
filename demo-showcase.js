(() => {
  let enabled = true, current, demo;
  try { enabled = localStorage.getItem('cv-demo-visible') !== 'false'; } catch {}
  const catalog = fetch('/demo/catalog.json').then(response => { if (!response.ok) throw Error('Demonstração indisponível'); return response.json(); });
  const control = document.createElement('label');
  control.className = 'demo-switch';
  control.innerHTML = `<input id="demo-visible" type="checkbox" ${enabled ? 'checked' : ''}> Exibir vitrine demonstrativa`;
  $('#colecao').prepend(control);
  const extra = document.createElement('section'); extra.id = 'demo-showcase'; extra.className = 'department-section'; extra.hidden = true;
  $('#colecao').after(extra);
  const notice = `<div class="demo-notice"><b>DEMONSTRAÇÃO — NÃO DISPONÍVEL PARA COMPRA</b><span>Imagens ilustrativas geradas. Estes modelos não têm preço, estoque ou venda habilitada.</span></div>`;
  function cards(items) {
    return items.map(item => `<article class="product demo-product"><button class="product-image" data-demo-view="${esc(item.id)}" aria-label="Detalhes demonstrativos de ${esc(item.name)}"><img src="${esc(item.image)}" alt="Ilustração demonstrativa de ${esc(item.name)}" loading="lazy"><span class="tag">DEMONSTRAÇÃO</span></button><div class="product-body"><span class="product-category">${esc(item.category)}</span><h3>${esc(item.name)}</h3><p class="demo-unavailable">DEMONSTRAÇÃO — NÃO DISPONÍVEL PARA COMPRA</p><div class="product-actions"><button class="outline" data-demo-view="${esc(item.id)}">Conhecer o modelo →</button></div></div></article>`).join('');
  }
  function bind(root) {
    root.querySelectorAll('[data-demo-view]').forEach(button => button.onclick = () => {
      const item = demo.items.find(model => model.id === button.dataset.demoView);
      $('#detail-body').innerHTML = `<img class="detail-photo" src="${esc(item.image)}" alt="Ilustração de ${esc(item.name)}"><p class="demo-unavailable">${esc(demo.notice)}</p><div class="eyebrow">${esc(item.category)}</div><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><small>${esc(demo.source)}</small><p>Este modelo não pode ser adicionado ao carrinho.</p>`;
      $('#detail').showModal();
    });
  }
  async function render(result) {
    current = result;
    try { demo = await catalog; } catch { return; }
    extra.hidden = true;
    control.hidden = result.settings.demoShowcase === false;
    if (result.settings.demoShowcase === false) return;
    const inline = result.total === 0;
    if (!enabled) return;
    const term = $('#search').value.toLocaleLowerCase('pt-BR');
    const items = demo.items.filter(item => !term || (item.name + ' ' + item.category).toLocaleLowerCase('pt-BR').includes(term));
    if (inline && !$('#category').value && !$('#min-price').value && !$('#max-price').value) {
      $('#catalog-title').textContent = 'Vasos & plantas — demonstração';
      $('#catalog-products').innerHTML = `<div class="demo-grid-notice">${notice}</div>` + cards(items);
      if (!items.length) $('#catalog-products').innerHTML += '<p class="empty">Nenhum modelo demonstrativo encontrado para esta busca.</p>';
      $('#page-info').textContent = `${items.length} modelos demonstrativos · Sem venda`;
      $('#prev').disabled = true; $('#next').disabled = true;
      bind($('#catalog-products'));
      if (!term) {
        $('#banner-product').innerHTML = `<div class="demo-banner-pair"><img src="/demo/planta-costela-de-adao.png" alt="Planta ilustrativa de demonstração"><img src="/demo/vaso-canelado-marfim.png" alt="Vaso ilustrativo de demonstração"><small>Imagens de demonstração · Sem venda</small></div>`;
        if (!result.categories.length) $('#category-cards').innerHTML = ['Vasos decorativos','Plantas ornamentais'].map(category => `<a class="category-card" href="#colecao"><img src="${demo.items.find(item => item.category === category).image}" alt=""><span>${esc(category)}<small class="demo-category-label">Demonstração</small></span></a>`).join('');
      }
    } else if (result.total > 0 && !hasFilters()) {
      extra.hidden = false;
      extra.innerHTML = '<div class="section-heading"><h2>Inspirações: vasos & plantas</h2></div>' + notice + `<div class="products">${cards(demo.items)}</div>`;
      bind(extra);
    }
  }
  $('#demo-visible').onchange = async event => {
    enabled = event.target.checked;
    try { localStorage.setItem('cv-demo-visible', String(enabled)); } catch {}
    await load();
    if (!enabled && current?.total === 0) {
      $('#banner-product').innerHTML = '<div class="brand-scene"><img src="/brand/casa-verde.png" alt="Casa Verde"><small>Plantas · Vasos · Jardinagem</small></div>';
      renderCategories(current.categories, current.products);
    }
  };
  window.CasaVerdeDemo = {render};
})();
