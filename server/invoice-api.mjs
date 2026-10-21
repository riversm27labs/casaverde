import { env } from './runtime.mjs';
import { calculatePricing } from './pricing.mjs';
const db = () => env.DB;
const out = (v, s = 200) => Response.json(v, { status: s, headers: { 'Cache-Control': 'no-store' } });
const text = (x, max = 200) => typeof x === 'string' ? x.trim().slice(0, max) : '';
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const photo = (s) => typeof s === 'string' && /^\/api\/images\/[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(s);
const sha = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map(n => n.toString(16).padStart(2, '0')).join('');
export async function invoiceAPI(req, path) {
    if (path[0] === 'pricing' && req.method === 'POST') {
        const r = await db().prepare("SELECT data FROM records WHERE id=? AND kind='products'").bind(path[1]).first();
        if (!r)
            return out({ error: 'Produto não encontrado.' }, 404);
        const body = await req.json();
        let pricing;
        try {
            pricing = calculatePricing(body);
        }
        catch (e) {
            return out({ error: e.message }, 400);
        }
        const old = JSON.parse(r.data), published = old.images?.length > 0 && (old.awaitingPrice || old.awaitingPhoto) ? true : !!old.published;
        const data = { ...old, unitCost: pricing.unitCost, price: pricing.price, pricing: { ...pricing, updatedAt: Date.now() }, pricingStale: false, awaitingPrice: false, published };
        await db().prepare('UPDATE records SET data=? WHERE id=? AND kind=?').bind(JSON.stringify(data), path[1], 'products').run();
        return out({ price: data.price, published, pricing });
    }
    if (path[0] === 'invoice-documents') {
        if (req.method === 'POST') {
            if (Number(req.headers.get('content-length')) > 4.4e6)
                return out({ error: 'Máximo de 4 MB por documento.' }, 413);
            const form = await req.formData(), file = form.get('file');
            if (!(file instanceof File) || !file.size || file.size > 4e6)
                return out({ error: 'Envie um documento de até 4 MB.' }, 400);
            const bytes = new Uint8Array(await file.arrayBuffer());
            let ext = '', mime = '';
            if (new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-') {
                ext = 'pdf';
                mime = 'application/pdf';
            }
            else if (bytes[0] === 255 && bytes[1] === 216) {
                ext = 'jpg';
                mime = 'image/jpeg';
            }
            else if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78) {
                ext = 'png';
                mime = 'image/png';
            }
            else {
                const sample = new TextDecoder().decode(bytes.slice(0, 2000));
                if (/<(?:\w+:)?(?:nfeProc|NFe)\b/.test(sample) && !sample.includes('<!DOCTYPE')) {
                    ext = 'xml';
                    mime = 'application/xml';
                }
            }
            if (!ext)
                return out({ error: 'Use XML de NF-e, PDF, JPG ou PNG.' }, 400);
            const key = crypto.randomUUID() + '.' + ext;
            await env.BUCKET.put('invoices/' + key, bytes, { httpMetadata: { contentType: mime } });
            return out({ key, name: text(file.name, 150) });
        }
        if (req.method === 'GET' && /^[a-f0-9-]+\.(pdf|jpg|png|xml)$/.test(path[1] || '')) {
            const file = await env.BUCKET.get('invoices/' + path[1]);
            if (!file)
                return out({ error: 'Documento não encontrado.' }, 404);
            return new Response(file.body, { headers: { 'Content-Type': file.httpMetadata?.contentType || 'application/octet-stream', 'Content-Disposition': 'attachment; filename="nota.' + path[1].split('.').pop() + '"', 'Cache-Control': 'private,no-store', 'X-Content-Type-Options': 'nosniff' } });
        }
    }
    if (path[0] !== 'invoice-import' || req.method !== 'POST')
        return null;
    const b = await req.json(), invoice = b.invoice || {}, reference = text(invoice.reference, 150);
    if (!reference)
        return out({ error: 'Informe a chave de acesso ou referência da nota.' }, 400);
    if (b.reviewed !== true)
        return out({ error: 'Confira os dados e marque a confirmação antes de importar.' }, 400);
    if (!Array.isArray(b.products) || !b.products.length || b.products.length > 50)
        return out({ error: 'Envie de 1 a 50 itens por lote.' }, 400);
    const docs = (Array.isArray(invoice.documents) ? invoice.documents : []).slice(0, 20);
    for (const d of docs)
        if (!/^[a-f0-9-]+\.(pdf|jpg|png|xml)$/.test(d.key || ''))
            return out({ error: 'Documento inválido.' }, 400);
    const invoiceId = 'invoice:' + await sha(norm(reference)), supplier = text(invoice.supplier, 200), supplierCnpj = text(invoice.supplierCnpj, 20).replace(/\D/g, ''), supplierKey = supplierCnpj || norm(supplier) || norm(reference);
    const productsResult = await db().prepare("SELECT id,data FROM records WHERE kind='products'").all();
    const products = productsResult.results.map((x) => ({ ...JSON.parse(x.data), id: x.id }));
    const prepared = [], receiptIds = new Set();
    for (const x of b.products) {
        const name = text(x.name, 120), code = text(x.code, 100), gtin = text(x.gtin, 14), quantity = Number(x.quantity), unitCost = Number(x.unitCost), sourceItem = text(x.sourceItem, 150);
        if (!name || !sourceItem || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1e8 || x.unitCost === null || x.unitCost === '' || !Number.isFinite(unitCost) || unitCost < 0 || unitCost > 1e7)
            return out({ error: 'Confira nome, quantidade e custo de ' + (name || 'cada item') + '.' }, 400);
        if (gtin && !/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(gtin))
            return out({ error: 'Código de barras inválido em ' + name + '.' }, 400);
        const receiptId = 'receipt:' + await sha(invoiceId + '|' + sourceItem);
        if (receiptIds.has(receiptId))
            continue;
        receiptIds.add(receiptId);
        const existingReceipt = await db().prepare("SELECT id FROM records WHERE id=? AND kind='invoiceItems'").bind(receiptId).first();
        if (existingReceipt)
            continue;
        let existing = x.matchProductId ? products.find((p) => p.id === x.matchProductId) : null;
        if (x.matchProductId && !existing)
            return out({ error: 'Produto de destino não encontrado para ' + name + '.' }, 400);
        if (!existing)
            existing = products.find((p) => (gtin && p.gtin === gtin) || (code && p.supplierCode === code && p.supplierKey === supplierKey));
        const images = (Array.isArray(x.images) ? x.images : []).filter(photo).slice(0, 6);
        for (const url of images)
            if (!await env.BUCKET.head(url.split('/').pop()))
                return out({ error: 'Foto não encontrada em ' + name + '.' }, 400);
        const productId = existing?.id || text(x.id, 36);
        if (!/^[a-f0-9-]{36}$/.test(productId))
            return out({ error: 'Identificador inválido em ' + name + '.' }, 400);
        const source = { reference, invoiceId, sourceItem, number: text(invoice.number, 30), supplier, receivedAt: Date.now() };
        const row = { name, code, gtin, quantity, unitCost, unit: text(x.unit, 20) || 'UN', lineTotal: x.lineTotal === null || x.lineTotal === '' ? null : Number(x.lineTotal), sourceItem, productId, invoiceId };
        const fresh = { name, description: text(x.description, 3000), category: text(x.category, 60) || 'Novidades', code, gtin, supplierCode: code, supplierKey, supplier, supplierCnpj, unitCost, quantityReceived: quantity, unit: row.unit, price: null, images, stock: 'disponivel', published: false, awaitingPhoto: !images.length, awaitingPrice: true, featured: false, lastInvoice: source };
        prepared.push({ existing, productId, receiptId, row, fresh, source });
        if (!existing)
            products.push({ ...fresh, id: productId });
    }
    const statements = [];
    for (const x of prepared) {
        if (x.existing) {
            statements.push(db().prepare("UPDATE records SET data=json_set(data,'$.unitCost',?,'$.quantityReceived',COALESCE(json_extract(data,'$.quantityReceived'),0)+?,'$.supplierCode',?,'$.supplierKey',?,'$.supplier',?,'$.supplierCnpj',?,'$.gtin',?,'$.pricingStale',json('true'),'$.stock','disponivel','$.lastInvoice',json(?)) WHERE id=? AND kind='products' AND NOT EXISTS(SELECT 1 FROM records WHERE id=?)").bind(x.row.unitCost, x.row.quantity, x.row.code, supplierKey, supplier, supplierCnpj, x.row.gtin || x.existing.gtin || '', JSON.stringify(x.source), x.productId, x.receiptId));
        }
        else
            statements.push(db().prepare("INSERT INTO records(id,kind,data,created) SELECT ?,'products',?,? WHERE NOT EXISTS(SELECT 1 FROM records WHERE id=?) ON CONFLICT(id) DO NOTHING").bind(x.productId, JSON.stringify(x.fresh), Date.now(), x.receiptId));
        statements.push(db().prepare("INSERT INTO records(id,kind,data,created) VALUES(?,'invoiceItems',?,?) ON CONFLICT(id) DO NOTHING").bind(x.receiptId, JSON.stringify(x.row), Date.now()));
    }
    if (statements.length)
        await db().batch(statements);
    const count = await db().prepare("SELECT COUNT(*) as n FROM records WHERE kind='invoiceItems' AND json_extract(data,'$.invoiceId')=?").bind(invoiceId).first();
    const receiptRows = await db().prepare("SELECT data FROM records WHERE kind='invoiceItems' AND json_extract(data,'$.invoiceId')=?").bind(invoiceId).all();
    const productIds = [...new Set(receiptRows.results.map((x) => JSON.parse(x.data).productId))];
    const prior = await db().prepare("SELECT data FROM records WHERE id=? AND kind='invoices'").bind(invoiceId).first();
    const previous = prior ? JSON.parse(prior.data) : {};
    const allDocs = [...new Map([...(previous.documents || []), ...docs].map((d) => [d.key, d])).values()];
    const metadata = { productIds, reference, number: text(invoice.number, 30), series: text(invoice.series, 20), supplier, supplierCnpj, issuedAt: text(invoice.issuedAt, 60), documents: allDocs.map((d) => ({ key: d.key, name: text(d.name, 150) })), items: count?.n || 0 };
    await db().prepare("INSERT INTO records(id,kind,data,created) VALUES(?,'invoices',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").bind(invoiceId, JSON.stringify(metadata), Date.now()).run();
    return out({ processed: prepared.length, skipped: b.products.length - prepared.length, totalItems: count?.n || 0, invoiceId });
}
