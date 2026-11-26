// Lead Domain Service for AgencyOS
// Implements atomic Lead -> Client + Project + Invoice conversion in a single SQL transaction.

import crypto from 'crypto';

/**
 * Atomically converts a lead into a client, an initial project, and an invoice.
 * @param {import('pg').Pool} pool
 * @param {string} leadId
 * @param {string} employeeId
 * @param {object} [options]
 * @returns {Promise<{ ok: boolean, client: object, project: object, invoice?: object }>}
 */
export async function convertLead(pool, leadId, employeeId, options = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch and validate lead
    const leadRes = await client.query('SELECT data FROM leads WHERE id=$1 FOR UPDATE', [leadId]);
    const lead = leadRes.rows[0]?.data;
    if (!lead) {
      throw new Error(`Lead with ID '${leadId}' not found.`);
    }
    if (lead.status === 'converted') {
      throw new Error(`Lead '${lead.company}' has already been converted.`);
    }

    const now = new Date().toISOString();
    const cleanName = (lead.company || lead.name || 'Unnamed Client').trim();
    const clientId = options.clientId || `cli-${crypto.randomUUID().slice(0, 8)}`;
    const clientCode = options.clientCode || `CLI-${Date.now().toString().slice(-4)}`;

    // 2. Insert into clients
    const clientRecord = {
      id: clientId,
      clientCode,
      companyName: cleanName,
      contactPerson: lead.contactPerson || lead.name || cleanName,
      email: lead.email || '',
      phone: lead.phone || '',
      status: 'active',
      source: lead.source || 'lead_conversion',
      convertedFromLeadId: leadId,
      createdAt: now,
      updatedAt: now,
    };

    await client.query(
      `INSERT INTO clients (id, client_code, company_name, email, phone, status, data, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [clientId, clientCode, cleanName, clientRecord.email, clientRecord.phone, 'active', clientRecord, employeeId]
    );

    // 3. Create Project
    const projectId = options.projectId || `prj-${crypto.randomUUID().slice(0, 8)}`;
    const projectCode = options.projectCode || `PRJ-${Date.now().toString().slice(-4)}`;
    const projectRecord = {
      id: projectId,
      projectCode,
      name: `${cleanName} Onboarding Project`,
      clientId,
      status: 'planning',
      projectManagerId: lead.assignedEmployeeId || employeeId,
      budget: Number(lead.estimatedValue) || 0,
      createdAt: now,
      updatedAt: now,
    };

    await client.query(
      `INSERT INTO projects (id, project_code, name, client_id, status, project_manager_id, data, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [projectId, projectCode, projectRecord.name, clientId, 'planning', projectRecord.projectManagerId, projectRecord, employeeId]
    );

    // 4. Optionally create initial Invoice if estimated value > 0
    let invoiceRecord = null;
    const estValue = Number(lead.estimatedValue) || 0;
    if (estValue > 0) {
      const invoiceId = options.invoiceId || `inv-${crypto.randomUUID().slice(0, 8)}`;
      const invoiceNumber = options.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
      invoiceRecord = {
        id: invoiceId,
        invoiceNumber,
        clientId,
        projectId,
        issueDate: now.slice(0, 10),
        dueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        totalAmount: estValue,
        balanceAmount: estValue,
        status: 'draft',
        items: [
          {
            description: `Initial Engagement Retainer: ${cleanName}`,
            quantity: 1,
            unitPrice: estValue,
            amount: estValue,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      await client.query(
        `INSERT INTO invoices (id, number, client_id, issue_date, due_date, total, balance, status, data, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [invoiceId, invoiceNumber, clientId, invoiceRecord.issueDate, invoiceRecord.dueDate, estValue, estValue, 'draft', invoiceRecord, employeeId]
      );
    }

    // 5. Update lead status to 'converted'
    const updatedLead = {
      ...lead,
      status: 'converted',
      convertedClientId: clientId,
      convertedProjectId: projectId,
      convertedAt: now,
    };

    await client.query(
      `UPDATE leads SET status='converted', data=$1, updated_at=now(), updated_by=$2 WHERE id=$3`,
      [updatedLead, employeeId, leadId]
    );

    // 6. Record in audit_logs
    const auditId = `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const auditEvent = {
      id: auditId,
      userId: employeeId,
      action: 'LEAD_CONVERTED',
      relatedRecord: `Lead:${leadId} -> Client:${clientId}`,
      date: now.slice(0, 10),
      time: new Date().toLocaleTimeString('en-IN'),
    };
    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, related_record, date, time, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [auditId, employeeId, 'LEAD_CONVERTED', `Lead:${leadId} -> Client:${clientId}`, auditEvent.date, auditEvent.time, auditEvent]
    );

    await client.query('COMMIT');
    return {
      ok: true,
      client: clientRecord,
      project: projectRecord,
      invoice: invoiceRecord,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
