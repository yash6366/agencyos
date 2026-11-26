// Invoice Domain Service for AgencyOS
// Validates line items, enforces multi-state GST tax calculations, and provides atomic invoice generation.

import crypto from 'crypto';

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

/**
 * Calculates GST components based on intra-state vs inter-state rules.
 * @param {number} taxableAmount
 * @param {number} ratePercent (e.g. 18 for 18% GST)
 * @param {string} agencyStateCode 2-digit GST state code (default: '29' Karnataka)
 * @param {string} clientStateCode 2-digit GST state code
 * @returns {{ isInterState: boolean, cgstRate: number, cgstAmount: number, sgstRate: number, sgstAmount: number, igstRate: number, igstAmount: number, totalTax: number }}
 */
export function calculateGstTax(taxableAmount, ratePercent = 18, agencyStateCode = '29', clientStateCode = '29') {
  const taxable = Math.max(0, round2(taxableAmount));
  const rate = Math.max(0, Number(ratePercent) || 0);
  const isInterState = String(agencyStateCode).trim() !== String(clientStateCode).trim();

  if (isInterState) {
    const igstRate = rate;
    const igstAmount = round2((taxable * igstRate) / 100);
    return {
      isInterState: true,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate,
      igstAmount,
      totalTax: igstAmount,
    };
  } else {
    const halfRate = rate / 2;
    const cgstAmount = round2((taxable * halfRate) / 100);
    const sgstAmount = round2((taxable * halfRate) / 100);
    return {
      isInterState: false,
      cgstRate: halfRate,
      cgstAmount,
      sgstRate: halfRate,
      sgstAmount,
      igstRate: 0,
      igstAmount: 0,
      totalTax: round2(cgstAmount + sgstAmount),
    };
  }
}

/**
 * Validates invoice line items and calculates totals.
 * @param {Array<{ description: string, quantity: number, unitPrice: number, taxRate?: number }>} items
 * @param {number} [discount]
 * @param {string} [agencyState]
 * @param {string} [clientState]
 */
export function calculateInvoiceTotals(items = [], discount = 0, agencyState = '29', clientState = '29') {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Invoice must have at least one line item.');
  }

  const validatedItems = [];
  let subtotal = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const desc = String(it.description || '').trim();
    if (!desc) throw new Error(`Line item #${idx + 1} is missing a description.`);
    
    const qty = Number(it.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`Line item #${idx + 1} has an invalid quantity: ${it.quantity}. Must be greater than 0.`);
    }

    const price = Number(it.unitPrice);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Line item #${idx + 1} has an invalid unit price: ${it.unitPrice}. Cannot be negative.`);
    }

    const lineAmount = round2(qty * price);
    subtotal = round2(subtotal + lineAmount);

    validatedItems.push({
      ...it,
      description: desc,
      quantity: qty,
      unitPrice: price,
      amount: lineAmount,
    });
  }

  const safeDiscount = Math.max(0, Math.min(subtotal, round2(discount)));
  const taxableSubtotal = round2(subtotal - safeDiscount);
  const tax = calculateGstTax(taxableSubtotal, 18, agencyState, clientState);
  const grandTotal = round2(taxableSubtotal + tax.totalTax);

  return {
    items: validatedItems,
    subtotal,
    discount: safeDiscount,
    taxableSubtotal,
    tax,
    total: grandTotal,
  };
}

/**
 * Creates an invoice in the database inside a transaction.
 * @param {import('pg').Pool} pool
 * @param {object} invoiceData
 * @param {string} employeeId
 */
export async function createInvoice(pool, invoiceData, employeeId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const clientId = String(invoiceData.clientId || '').trim();
    if (!clientId) throw new Error('Client ID is required to create an invoice.');

    // Verify client exists
    const clientRes = await client.query('SELECT data FROM clients WHERE id=$1', [clientId]);
    const clientRecord = clientRes.rows[0]?.data;
    if (!clientRecord) throw new Error(`Client with ID '${clientId}' does not exist.`);

    const clientState = clientRecord.gstStateCode || clientRecord.stateCode || invoiceData.clientStateCode || '29';
    const agencyState = invoiceData.agencyStateCode || '29';

    const calculated = calculateInvoiceTotals(
      invoiceData.items,
      invoiceData.discount || 0,
      agencyState,
      clientState
    );

    const now = new Date().toISOString();
    const invoiceId = invoiceData.id || `inv-${crypto.randomUUID().slice(0, 8)}`;
    const invoiceNumber = invoiceData.number || `INV-${Date.now().toString().slice(-6)}`;

    const fullRecord = {
      id: invoiceId,
      invoiceNumber,
      clientId,
      projectId: invoiceData.projectId || null,
      issueDate: invoiceData.issueDate || now.slice(0, 10),
      dueDate: invoiceData.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      items: calculated.items,
      subtotal: calculated.subtotal,
      discount: calculated.discount,
      taxableSubtotal: calculated.taxableSubtotal,
      taxDetails: calculated.tax,
      totalAmount: calculated.total,
      balanceAmount: calculated.total,
      status: invoiceData.status || 'unpaid',
      notes: invoiceData.notes || '',
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await client.query(
      `INSERT INTO invoices (id, number, client_id, issue_date, due_date, total, balance, status, data, version, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        invoiceId,
        invoiceNumber,
        clientId,
        fullRecord.issueDate,
        fullRecord.dueDate,
        calculated.total,
        calculated.total,
        fullRecord.status,
        fullRecord,
        1,
        employeeId,
      ]
    );

    // Audit log
    const auditId = `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, related_record, date, time, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        auditId,
        employeeId,
        'INVOICE_CREATED',
        `Invoice:${invoiceId} (${invoiceNumber}) Total: ₹${calculated.total}`,
        now.slice(0, 10),
        new Date().toLocaleTimeString('en-IN'),
        { id: auditId, invoiceId, invoiceNumber, total: calculated.total },
      ]
    );

    await client.query('COMMIT');
    return fullRecord;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
