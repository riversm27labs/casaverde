import { env } from './runtime.mjs';
import { invoiceAPI } from './invoice-api.mjs';
import { canBindInvited } from './auth.mjs';
const OWNER = process.env.OWNER_EMAIL?.toLowerCase() || 'admin@localhost';
const json = (v, status = 200) => Response.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
const db = () => env.DB;
async function rows(kind) { const r = await db().prepare('SELECT id,data,created FROM records WHERE kind=? ORDER BY created DESC').bind(kind).all(); return r.results.map((x) => ({ ...JSON.parse(x.data), id: x.id, created: x.created })); }
async function settings() { const r = await db().prepare("SELECT data FROM records WHERE id='settings'").first(); return { ...{ name: 'Casa Verde', headline: 'A natureza. Em sua melhor forma.', description: 'Vasos que são presença. Jardins que acolhem. Transforme sua casa em um lugar onde a vida floresce.', whatsapp: '', address: '', hours: '', instagram: '', categories: ['Vasos ornamentais', 'Plantas', 'Composições verdes', 'Acessórios'], adminEmails: [] }, ...(r ? JSON.parse(r.data) : {}) }; }
async function admin(req) { const id = req.headers.get('oai-authenticated-user-id'); const email = (req.headers.get('oai-authenticated-user-email') || '').toLowerCase(); if (!id || !email)
    return false; if (email === OWNER)
    await db().prepare('INSERT INTO admins(email,user_id) VALUES(?,?) ON CONFLICT(email) DO NOTHING').bind(email, id).run(); const r = await db().prepare('SELECT user_id FROM admins WHERE email=?').bind(email).first(); if (!r)
    return false; if (!r.user_id) {
    if (email !== OWNER && !await canBindInvited())
        return false;
    await db().prepare('UPDATE admins SET user_id=? WHERE email=? AND user_id IS NULL').bind(id, email).run();
} const bound = await db().prepare('SELECT user_id FROM admins WHERE email=?').bind(email).first(); return bound?.user_id === id; }
function txt(v, max = 200) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function image(v) { return typeof v === 'string' && /^\/api\/images\/[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(v); }
function url(v) { const s = txt(v, 500); return s.startsWith('https://') ? s : ''; }
async function save(id, kind, data) { await db().prepare('INSERT INTO records(id,kind,data,created) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(id, kind, JSON.stringify(data), Date.now()).run(); }
export async function api(req) {
    try {
        const u = new URL(req.url), p = u.pathname.replace(/^\/api\//, '').split('/');
        if (p[0] === 'images' && req.method === 'GET') {
            if (!/^[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(p[1] || ''))
                return json({ error: 'Imagem inválida' }, 404);
            const file = await env.BUCKET.get(p[1]);
            if (!file)
                return json({ error: 'Imagem não encontrada' }, 404);
            return new Response(file.body, { headers: { 'Content-Type': file.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'public,max-age=31536000,immutable', 'X-Content-Type-Options': 'nosniff' } });
        }
        if (p[0] === 'catalog' && req.method === 'GET') {
            const [s, products, projects] = await Promise.all([settings(), rows('products'), rows('projects')]);
            delete s.adminEmails;
            // Dados públicos e iguais para todos: o CDN pode servir a mesma resposta por 30s (e uma versão antiga por até 2 min enquanto renova).
            return Response.json({ settings: s, products: products.filter((x) => x.published).map((x) => ({ id: x.id, created: x.created, name: x.name, description: x.description, category: x.category, images: x.images, price: x.price, stock: x.stock, dimensions: x.dimensions, material: x.material, featured: x.featured, published: !!x.published })), projects: projects.filter((x) => x.published) }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120' } });
        }
        if (p[0] === 'inquiries' && req.method === 'POST') {
            if (req.headers.get('origin') !== u.origin)
                return json({ error: 'Origem inválida' }, 403);
            const b = await req.json();
            if (b.website)
                return json({ error: 'Solicitação inválida' }, 400);
            const name = txt(b.name, 100), phone = txt(b.phone, 30), message = txt(b.message, 3000);
            if (!name || (!/^\+?[\d ()-]{8,30}$/.test(phone) || phone.replace(/\D/g, '').length < 10 || phone.replace(/\D/g, '').length > 15) || !message)
                return json({ error: 'Preencha nome, telefone e sua ideia.' }, 400);
            const ip = req.headers.get('x-real-ip') || 'local';
            const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip)))).map(x => x.toString(16).padStart(2, '0')).join('');
            const recent = await db().prepare("SELECT COUNT(*) as n FROM records WHERE kind='inquiries' AND created>? AND json_extract(data,'$.ip')=?").bind(Date.now() - 3600000, hash).first();
            if (recent.n >= 8)
                return json({ error: 'Limite de solicitações atingido. Tente mais tarde.' }, 429);
            const products = await rows('products');
            const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map((x) => { const product = products.find((y) => y.id === x.id && y.published && y.stock !== 'esgotado'); return product ? { id: product.id, name: product.name, qty: Math.max(1, Math.min(99, Number(x.qty) || 1)), price: product.price } : null; }).filter(Boolean);
            const id = crypto.randomUUID();
            await save(id, 'inquiries', { name, phone, message, items, status: 'nova', ip: hash });
            return json({ id });
        }
        if (p[0] === 'me')
            return json({ admin: await admin(req), email: req.headers.get('oai-authenticated-user-email') || null, owner: (req.headers.get('oai-authenticated-user-email') || '').toLowerCase() === OWNER });
        if (!await admin(req))
            return json({ error: 'Entre com uma conta autorizada para administrar a loja.' }, 401);
        if (req.method !== 'GET' && req.headers.get('origin') !== u.origin)
            return json({ error: 'Origem inválida' }, 403);
        const invoiceResponse = await invoiceAPI(req, p);
        if (invoiceResponse)
            return invoiceResponse;
        if (p[0] === 'dashboard' && req.method === 'GET') {
            const [s, products, projects, inquiries, invoices] = await Promise.all([settings(), rows('products'), rows('projects'), rows('inquiries'), rows('invoices')]);
            return json({ settings: s, products, projects, invoices, inquiries: inquiries.map(({ ip, ...x }) => x) });
        }
        if (p[0] === 'bulk-products' && req.method === 'POST') {
            const b = await req.json();
            if (!Array.isArray(b.products) || !b.products.length || b.products.length > 100)
                return json({ error: 'Selecione de 1 a 100 produtos por importação.' }, 400);
            const normalize = (v) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
            const existing = await rows('products'), names = new Set(existing.map((x) => normalize(x.name))), ids = new Set(existing.map((x) => x.id));
            const prepared = [];
            let skipped = 0;
            for (const item of b.products) {
                const id = txt(item.id, 36), name = txt(item.name, 120);
                if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id) || !name)
                    return json({ error: 'Há um produto sem nome ou identificador válido. Revise a lista.' }, 400);
                const price = item.price === null || item.price === '' || item.price === undefined ? null : Number(item.price);
                if (price !== null && (!Number.isFinite(price) || price < 0 || price > 1e7))
                    return json({ error: 'Preço inválido em ' + name + '.' }, 400);
                const images = (Array.isArray(item.images) ? item.images : []).slice(0, 6);
                if (images.some((x) => !image(x)))
                    return json({ error: 'Foto inválida em ' + name + '.' }, 400);
                if (ids.has(id) || (b.skipDuplicates !== false && names.has(normalize(name)))) {
                    skipped++;
                    continue;
                }
                for (const photo of images)
                    if (!await env.BUCKET.head(photo.split('/').pop()))
                        return json({ error: 'Uma foto de ' + name + ' não foi enviada. Tente novamente.' }, 400);
                const data = { name, price, category: txt(item.category, 60) || 'Novidades', description: txt(item.description, 3000), code: txt(item.code, 100), material: txt(item.material, 200), dimensions: txt(item.dimensions, 200), images, stock: 'disponivel', published: images.length > 0, awaitingPhoto: images.length === 0, featured: false };
                prepared.push({ id, data });
                ids.add(id);
                names.add(normalize(name));
            }
            const results = prepared.length ? await db().batch(prepared.map(x => db().prepare('INSERT INTO records(id,kind,data,created) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(x.id, 'products', JSON.stringify(x.data), Date.now()))) : [];
            const created = results.reduce((n, r) => n + (r.meta?.changes || 0), 0);
            return json({ created, skipped: skipped + prepared.length - created, awaitingPhoto: prepared.filter(x => x.data.awaitingPhoto).length, ids: prepared.map(x => x.id) });
        }
        if (p[0] === 'quick-publish' && req.method === 'POST') {
            const b = await req.json();
            const id = txt(b.requestId, 36);
            if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id) || !image(b.image))
                return json({ error: 'Não foi possível publicar esta foto.' }, 400);
            const exists = await db().prepare('SELECT kind,data FROM records WHERE id=?').bind(id).first();
            if (exists) {
                if (JSON.parse(exists.data).images?.[0] !== b.image)
                    return json({ error: 'Identificador já utilizado.' }, 409);
                return json({ id, kind: exists.kind });
            }
            const key = b.image.split('/').pop();
            if (!await env.BUCKET.head(key))
                return json({ error: 'A foto ainda não terminou de enviar. Tente novamente.' }, 400);
            const kind = b.kind === 'projects' ? 'projects' : 'products';
            const data = { name: kind === 'products' ? 'Produto #' + id.slice(0, 4).toUpperCase() : 'Trabalho #' + id.slice(0, 4).toUpperCase(), description: '', images: [b.image], published: true, featured: false };
            if (kind === 'products')
                Object.assign(data, { price: null, category: 'Novidades', stock: 'disponivel', dimensions: '', material: '' });
            else
                data.location = '';
            await db().prepare('INSERT INTO records(id,kind,data,created) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id, kind, JSON.stringify(data), Date.now()).run();
            return json({ id, kind });
        }
        if (p[0] === 'upload' && req.method === 'POST') {
            if (Number(req.headers.get('content-length')) > 4.4e6)
                return json({ error: 'Máximo de 4 MB por foto.' }, 413);
            const form = await req.formData(), file = form.get('file');
            if (!(file instanceof File) || file.size > 4e6 || !file.size)
                return json({ error: 'Envie uma foto de até 4 MB.' }, 400);
            const bytes = new Uint8Array(await file.arrayBuffer());
            let ext = '', mime = '';
            if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
                ext = 'jpg';
                mime = 'image/jpeg';
            }
            else if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
                ext = 'png';
                mime = 'image/png';
            }
            else if (new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') {
                ext = 'webp';
                mime = 'image/webp';
            }
            else if (new TextDecoder().decode(bytes.slice(0, 3)) === 'GIF') {
                ext = 'gif';
                mime = 'image/gif';
            }
            if (!ext)
                return json({ error: 'Formato não aceito. Use JPG, PNG, WebP ou GIF.' }, 400);
            const key = crypto.randomUUID() + '.' + ext;
            await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
            return json({ url: '/api/images/' + key });
        }
        if (p[0] === 'settings' && req.method === 'PUT') {
            const b = await req.json();
            const old = await settings();
            const phone = txt(b.whatsapp, 20).replace(/\D/g, '');
            if (phone && !/^55\d{10,11}$/.test(phone))
                return json({ error: 'Informe WhatsApp com 55 + DDD + número.' }, 400);
            const data = { name: txt(b.name, 80) || 'Casa Verde', headline: txt(b.headline, 120), description: txt(b.description, 1000), whatsapp: phone, address: txt(b.address, 300), hours: txt(b.hours, 400), instagram: url(b.instagram), categories: (Array.isArray(b.categories) ? b.categories : []).map((x) => txt(x, 60)).filter(Boolean).slice(0, 30), adminEmails: old.adminEmails || [] };
            if ((req.headers.get('oai-authenticated-user-email') || '').toLowerCase() === OWNER) {
                data.adminEmails = [...new Set((Array.isArray(b.adminEmails) ? b.adminEmails : []).map((x) => txt(x, 200).toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x) && x !== OWNER))].slice(0, 10);
                const existing = await db().prepare('SELECT email FROM admins').all();
                const statements = [];
                for (const x of existing.results)
                    if (x.email !== OWNER && !data.adminEmails.includes(x.email))
                        statements.push(db().prepare('DELETE FROM admins WHERE email=?').bind(x.email));
                for (const email of data.adminEmails)
                    statements.push(db().prepare('INSERT INTO admins(email,user_id) VALUES(?,NULL) ON CONFLICT(email) DO NOTHING').bind(email));
                if (statements.length)
                    await db().batch(statements);
            }
            await save('settings', 'settings', data);
            return json({ ok: true });
        }
        if (['products', 'projects'].includes(p[0]) && ['POST', 'PUT'].includes(req.method)) {
            const b = await req.json();
            const name = txt(b.name, 120);
            if (!name)
                return json({ error: 'Informe o nome.' }, 400);
            const images = (Array.isArray(b.images) ? b.images : []).filter(image).slice(0, 6);
            if (b.published && !images.length)
                return json({ error: 'Adicione pelo menos uma foto antes de publicar.' }, 400);
            const data = { name, description: txt(b.description, 3000), images, published: !!b.published, featured: !!b.featured };
            if (p[0] === 'products') {
                const price = b.price === '' || b.price === null ? null : Number(b.price);
                if (price !== null && (!Number.isFinite(price) || price < 0 || price > 1e7))
                    return json({ error: 'Preço inválido.' }, 400);
                Object.assign(data, { price, category: txt(b.category, 60) || 'Outros', stock: ['disponivel', 'sob-encomenda', 'esgotado'].includes(b.stock) ? b.stock : 'disponivel', dimensions: txt(b.dimensions, 200), material: txt(b.material, 200) });
            }
            else
                data.location = txt(b.location, 200);
            let id = crypto.randomUUID();
            if (req.method === 'PUT') {
                id = p[1];
                const exists = await db().prepare('SELECT id,data FROM records WHERE id=? AND kind=?').bind(id, p[0]).first();
                if (!exists)
                    return json({ error: 'Registro não encontrado' }, 404);
                if (p[0] === 'products') {
                    const old = JSON.parse(exists.data);
                    data.awaitingPhoto = !images.length && !!old.awaitingPhoto;
                    data.code = txt(b.code === undefined ? old.code : b.code, 100);
                    for (const key of ['unitCost', 'quantityReceived', 'unit', 'gtin', 'supplierCode', 'supplierKey', 'supplier', 'supplierCnpj', 'lastInvoice', 'pricing', 'pricingStale'])
                        if (old[key] !== undefined)
                            data[key] = old[key];
                    data.awaitingPrice = !!old.awaitingPrice && data.price === null;
                    data.published = data.published && !data.awaitingPrice;
                }
            }
            await save(id, p[0], data);
            return json({ id });
        }
        if (['products', 'projects'].includes(p[0]) && req.method === 'DELETE') {
            await db().prepare('DELETE FROM records WHERE id=? AND kind=?').bind(p[1], p[0]).run();
            return json({ ok: true });
        }
        if (p[0] === 'inquiries' && req.method === 'PUT') {
            const b = await req.json();
            const r = await db().prepare("SELECT data FROM records WHERE id=? AND kind='inquiries'").bind(p[1]).first();
            if (!r)
                return json({ error: 'Solicitação não encontrada' }, 404);
            if (!['nova', 'em atendimento', 'concluída'].includes(b.status))
                return json({ error: 'Status inválido' }, 400);
            await save(p[1], 'inquiries', { ...JSON.parse(r.data), status: b.status });
            return json({ ok: true });
        }
        return json({ error: 'Rota não encontrada' }, 404);
    }
    catch (e) {
        console.error('Casa Verde API', e);
        return json({ error: 'Não foi possível concluir. Tente novamente.' }, 500);
    }
}
