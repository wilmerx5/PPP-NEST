"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitUnevenTargets = splitUnevenTargets;
exports.fillInvoiceFromCatalog = fillInvoiceFromCatalog;
exports.planBulkInvoicesFromCatalog = planBulkInvoicesFromCatalog;
function splitUnevenTargets(total, quantity) {
    const n = Math.max(1, Math.floor(quantity));
    const T = Math.max(0, Math.round(total));
    if (n === 1)
        return [T];
    const weights = Array.from({ length: n }, (_, i) => {
        const wave = 0.65 + 0.7 * Math.abs(Math.sin((i + 1) * 2.3));
        const jitter = 0.55 + Math.random() * 0.9;
        return wave * jitter;
    });
    const wSum = weights.reduce((a, b) => a + b, 0) || 1;
    const amounts = weights.map((w) => Math.floor((T * w) / wSum / 100) * 100);
    let allocated = amounts.reduce((a, b) => a + b, 0);
    amounts[n - 1] += T - allocated;
    const minEach = Math.max(5_000, Math.floor(T / (n * 10)));
    for (let i = 0; i < n; i++) {
        if (amounts[i] < minEach) {
            const need = minEach - amounts[i];
            let donor = amounts.indexOf(Math.max(...amounts));
            if (donor === i) {
                donor = amounts.findIndex((a, j) => j !== i && a === Math.max(...amounts.filter((_, k) => k !== i)));
            }
            if (donor >= 0 && amounts[donor] - need >= minEach) {
                amounts[donor] -= need;
                amounts[i] += need;
            }
        }
    }
    allocated = amounts.reduce((a, b) => a + b, 0);
    amounts[n - 1] += T - allocated;
    return amounts;
}
function addLine(map, p, unitPrice) {
    const prev = map.get(p.id);
    if (prev) {
        prev.quantity += 1;
        prev.lineTotal = prev.quantity * prev.unitPrice;
    }
    else {
        map.set(p.id, {
            productId: p.id,
            name: p.name,
            code: p.code,
            unitPrice,
            quantity: 1,
            lineTotal: unitPrice,
            ...(p.defaultAttributes?.length
                ? { attributes: p.defaultAttributes.map((a) => ({ ...a })) }
                : {}),
        });
    }
}
function fillInvoiceFromCatalog(targetAmount, products) {
    const pool = products
        .map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        price: Math.round(Number(p.price) || 0),
        defaultAttributes: p.defaultAttributes,
    }))
        .filter((p) => p.price > 0);
    if (!pool.length || targetAmount <= 0)
        return [];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const lines = new Map();
    let sum = 0;
    const maxOvershoot = Math.max(3_000, Math.floor(targetAmount * 0.06));
    let guard = 0;
    while (sum < targetAmount && guard++ < 800) {
        const remaining = targetAmount - sum;
        const fitting = pool.filter((p) => p.price <= remaining + (sum === 0 ? maxOvershoot : 0));
        let pick = null;
        if (fitting.length) {
            const good = fitting.filter((p) => remaining - p.price === 0 || remaining - p.price >= Math.min(...pool.map((x) => x.price)) || remaining - p.price <= maxOvershoot);
            const bag = good.length ? good : fitting;
            pick = bag[Math.floor(Math.random() * bag.length)];
        }
        else if (sum === 0) {
            pick = [...pool].sort((a, b) => Math.abs(a.price - targetAmount) - Math.abs(b.price - targetAmount))[0];
        }
        else {
            break;
        }
        if (!pick)
            break;
        if (sum > 0 && sum + pick.price > targetAmount + maxOvershoot)
            break;
        addLine(lines, pick, pick.price);
        sum += pick.price;
    }
    const cheapest = [...pool].sort((a, b) => a.price - b.price)[0];
    if (cheapest &&
        sum < targetAmount &&
        targetAmount - sum >= cheapest.price &&
        sum + cheapest.price <= targetAmount + maxOvershoot) {
        addLine(lines, cheapest, cheapest.price);
        sum += cheapest.price;
    }
    return [...lines.values()];
}
function planBulkInvoicesFromCatalog(targetTotal, quantity, products, maxDeviationRatio = 0.08) {
    const targets = splitUnevenTargets(targetTotal, quantity);
    const invoices = targets.map((targetAmount, index) => {
        const lines = fillInvoiceFromCatalog(targetAmount, products);
        const sum = lines.reduce((s, l) => s + l.lineTotal, 0);
        return { index: index + 1, targetAmount, lines, sum };
    });
    const plannedSum = invoices.reduce((s, inv) => s + inv.sum, 0);
    const deviation = plannedSum - targetTotal;
    const deviationRatio = targetTotal > 0 ? Math.abs(deviation) / targetTotal : 0;
    const withinTolerance = invoices.length === quantity &&
        invoices.every((inv) => inv.lines.length > 0) &&
        (Math.abs(deviation) <= 8_000 || deviationRatio <= maxDeviationRatio);
    let message = '';
    if (!products.length) {
        message = 'No hay productos activos en el catálogo para armar el lote.';
    }
    else if (invoices.some((inv) => !inv.lines.length)) {
        message = 'No se pudieron llenar todas las facturas con el catálogo (precios / total).';
    }
    else if (!withinTolerance) {
        message = `Suma planificada ${plannedSum.toLocaleString('es-CO')} vs objetivo ${targetTotal.toLocaleString('es-CO')} (desvío ${(deviationRatio * 100).toFixed(1)}%).`;
    }
    else {
        message = `Listo: ${quantity} facturas con montos distintos desde el catálogo (suma ≈ objetivo).`;
    }
    return {
        targetTotal,
        quantity,
        invoices,
        plannedSum,
        deviation,
        deviationRatio,
        withinTolerance,
        maxDeviationRatio,
        message,
    };
}
//# sourceMappingURL=factus-bulk-select.util.js.map