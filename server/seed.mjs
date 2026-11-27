// server/seed.mjs
// Authoritative Database Seeder for AgencyOS
// Seeds mandatory master data into a fresh or existing database idempotently:
// - Default Company Profile (app_settings: paa_company)
// - Initial Departments (departments table)
// - Initial Designations (designations table)
// - Initial System Roles & Organizational Chart (app_settings: paa_x_os_org)
// - Initial Employees & Super Admin Account (employees table)
// - Initial Password Hashes & Credentials (user_credentials table)
// - Initial Statutory Compliance & Payroll Rules (app_settings: paa_x_statutory)

import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool, T } from './migrate.mjs';

const DEFAULT_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(8).toString('hex') + '!Aa1';
const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL || 'rajesh.sharma@priorityadsagency.com';

const DEPARTMENTS = [
  { id: 'dept-1', name: 'Executive & Strategy', code: 'EXEC', employeeCount: 2, description: 'Executive leadership & business direction' },
  { id: 'dept-2', name: 'Human Resources', code: 'HR', employeeCount: 1, description: 'Talent acquisition, payroll, and culture' },
  { id: 'dept-3', name: 'Engineering & Development', code: 'ENG', employeeCount: 2, description: 'Web, mobile, AI systems and technical delivery' },
  { id: 'dept-4', name: 'Sales & Field Force', code: 'SALES', employeeCount: 1, description: 'Client acquisition, field visits, and CRM' },
  { id: 'dept-5', name: 'Finance & Accounts', code: 'FIN', employeeCount: 1, description: 'Billing, payroll processing, and audit' },
  { id: 'dept-6', name: 'Creative & Digital Media', code: 'MEDIA', employeeCount: 1, description: 'Ad campaigns, branding, and content creation' },
];

const DESIGNATIONS = [
  { id: 'desig-1', title: 'Managing Director & CEO', departmentId: 'dept-1', level: 'L6' },
  { id: 'desig-2', title: 'Lead HR Manager', departmentId: 'dept-2', level: 'L4' },
  { id: 'desig-3', title: 'Technical Project Manager', departmentId: 'dept-3', level: 'L4' },
  { id: 'desig-4', title: 'Senior AI & Full Stack Developer', departmentId: 'dept-3', level: 'L3' },
  { id: 'desig-5', title: 'Senior Field Sales Executive', departmentId: 'dept-4', level: 'L2' },
  { id: 'desig-6', title: 'Finance & Operations Lead', departmentId: 'dept-5', level: 'L4' },
  { id: 'desig-7', title: 'Co-Founder & Director', departmentId: 'dept-1', level: 'L6' },
];

const COMPANY_CONFIG = {
  name: "Priority Ads Agency",
  tagline: "Your success is our priority",
  code: "AGENCY-OS",
  address: "SV Arcade No.116, Gurunath Layout, Opp Bus Stop Huralichikkanahalli Hesragatta Main Road Bangalore -560090",
  phone: "+91 7760665912",
  email: "rajesh.sharma@priorityadsagency.com",
  website: "www.priorityadsagency.com",
  gstNumber: "29AAACP9812K1Z8",
  panNumber: "AAACP9812K",
  currency: "INR",
  timeZone: "Asia/Kolkata",
  officeStartTime: "09:30",
  officeEndTime: "18:30",
  graceMinutes: 15,
  minWorkingHoursFullDay: 8.0,
  minWorkingHoursHalfDay: 4.0,
  logoUrl: "/logo.png",
  stampUrl: "/assets/aistudio/image_0f46d769.png",
};

const BASE_EMPLOYEES = [
  {
    id: 'emp-1',
    employeeId: 'PAA-EMP-001',
    name: 'Rajesh Sharma',
    email: ADMIN_EMAIL,
    phone: '+91 9845011223',
    role: 'super_admin',
    status: 'active',
    departmentId: 'dept-1',
    designationId: 'desig-1',
    employmentType: 'Full-time',
    joiningDate: '2020-01-10',
    workMode: 'office',
    workLocation: 'Bangalore HQ',
    experienceYears: 15,
    assignedProjectIds: [],
    salary: { basic: 85000, hra: 34000, allowances: 28000, bonus: 18000, incentives: 25000, deductions: 6000, netSalary: 184000 },
  },
  {
    id: 'emp-2',
    employeeId: 'PAA-EMP-002',
    name: 'Priya Sharma',
    email: 'priya.sharma@priorityadsagency.com',
    phone: '+91 9845012345',
    role: 'hr',
    status: 'active',
    departmentId: 'dept-2',
    designationId: 'desig-2',
    employmentType: 'Full-time',
    joiningDate: '2022-03-01',
    workMode: 'office',
    workLocation: 'Bangalore HQ',
    experienceYears: 7,
    assignedProjectIds: [],
    reportingManagerId: 'emp-1',
    salary: { basic: 40000, hra: 16000, allowances: 12000, bonus: 4000, incentives: 5000, deductions: 3500, netSalary: 73500 },
  },
  {
    id: 'emp-3',
    employeeId: 'PAA-EMP-003',
    name: 'Karthik Rao',
    email: 'karthik.rao@priorityadsagency.com',
    phone: '+91 9742299881',
    role: 'project_manager',
    status: 'active',
    departmentId: 'dept-3',
    designationId: 'desig-3',
    employmentType: 'Full-time',
    joiningDate: '2022-08-15',
    workMode: 'office',
    workLocation: 'Bangalore HQ',
    experienceYears: 9,
    assignedProjectIds: [],
    reportingManagerId: 'emp-1',
    salary: { basic: 55000, hra: 22000, allowances: 15000, bonus: 6000, incentives: 8000, deductions: 4200, netSalary: 101800 },
  },
  {
    id: 'emp-4',
    employeeId: 'PAA-EMP-004',
    name: 'Ananya Desai',
    email: 'ananya.desai@priorityadsagency.com',
    phone: '+91 9988776655',
    role: 'employee',
    status: 'active',
    departmentId: 'dept-3',
    designationId: 'desig-4',
    employmentType: 'Full-time',
    joiningDate: '2023-05-02',
    workMode: 'office',
    workLocation: 'Bangalore HQ',
    experienceYears: 4,
    assignedProjectIds: [],
    reportingManagerId: 'emp-3',
    salary: { basic: 45000, hra: 18000, allowances: 12000, bonus: 5000, incentives: 6000, deductions: 3800, netSalary: 82200 },
  },
  {
    id: 'emp-5',
    employeeId: 'PAA-EMP-005',
    name: 'Rahul Verma',
    email: 'rahul.verma@priorityadsagency.com',
    phone: '+91 9123456789',
    role: 'employee',
    status: 'active',
    departmentId: 'dept-4',
    designationId: 'desig-5',
    employmentType: 'Full-time',
    joiningDate: '2023-02-14',
    workMode: 'field',
    workLocation: 'Field / On-Site',
    experienceYears: 5,
    assignedProjectIds: [],
    reportingManagerId: 'emp-1',
    salary: { basic: 32000, hra: 12800, allowances: 10000, bonus: 4000, incentives: 15000, deductions: 2800, netSalary: 71000 },
  },
  {
    id: 'emp-6',
    employeeId: 'PAA-EMP-006',
    name: 'Sneha Patel',
    email: 'sneha.patel@priorityadsagency.com',
    phone: '+91 9876543210',
    role: 'finance',
    status: 'active',
    departmentId: 'dept-5',
    designationId: 'desig-6',
    employmentType: 'Full-time',
    joiningDate: '2021-11-01',
    workMode: 'office',
    workLocation: 'Bangalore HQ',
    experienceYears: 8,
    assignedProjectIds: [],
    reportingManagerId: 'emp-1',
    salary: { basic: 50000, hra: 20000, allowances: 14000, bonus: 5000, incentives: 7000, deductions: 4000, netSalary: 92000 },
  },
  {
    id: 'emp-7',
    employeeId: 'PAA-EMP-007',
    name: 'Vikram Malhotra',
    email: 'vikram.malhotra@priorityadsagency.com',
    phone: '+91 9811223344',
    role: 'super_admin',
    status: 'active',
    departmentId: 'dept-1',
    designationId: 'desig-7',
    employmentType: 'Full-time',
    joiningDate: '2020-01-10',
    workMode: 'office',
    workLocation: 'Bangalore HQ',
    experienceYears: 16,
    assignedProjectIds: [],
    salary: { basic: 85000, hra: 34000, allowances: 28000, bonus: 18000, incentives: 25000, deductions: 6000, netSalary: 184000 },
  },
];

// Complete role accounts matrix ensuring 1 account per system role
const ROLE_ACCOUNTS = [
  ['manager', 'Arjun Mehta', 'gm', 'leadership', 'General Manager'],
  ['recruiter', 'Kavya Nair', 'recruiter', 'hr', 'Recruiter'],
  ['hr_executive', 'Divya Rao', 'hrexec', 'hr', 'HR Executive'],
  ['finance', 'Vikram Iyer', 'finance', 'finance', 'Accounts & Finance Manager'],
  ['accountant', 'Sneha Kulkarni', 'accountant', 'finance', 'Accountant'],
  ['billing_executive', 'Rohit Jain', 'billing', 'finance', 'Billing Executive'],
  ['sales_manager', 'Manoj Reddy', 'salesmanager', 'sales', 'Sales Manager'],
  ['sales_team_leader', 'Pooja Shetty', 'salestl', 'sales', 'Sales Team Leader'],
  ['sales_executive', 'Anil Kumar', 'sales', 'sales', 'Sales Executive'],
  ['telecaller', 'Meena Joshi', 'telecaller', 'sales', 'Telecaller'],
  ['business_development', 'Farhan Ali', 'bde', 'sales', 'Sales Executive'],
  ['client_relationship_manager', 'Neha Gupta', 'crm', 'crm', 'Client Relationship Manager'],
  ['client_support_executive', 'Ravi Teja', 'support', 'crm', 'Client Support Executive'],
  ['operations_manager', 'Suresh Babu', 'operations', 'ops', 'Operations / Project Manager'],
  ['project_manager', 'Kiran Rao', 'pm', 'ops', 'Operations / Project Manager'],
  ['project_coordinator', 'Lakshmi Prasad', 'coordinator', 'ops', 'Project Coordinator'],
  ['team_leader', 'Deepak Verma', 'teamlead', 'perf', 'Team Leader'],
  ['employee', 'Sanjay Patil', 'specialist', 'perf', 'Meta Ads Specialist'],
  ['intern', 'Aditi Singh', 'intern', 'creative', 'Graphic Designer'],
  ['automation_specialist', 'Nikhil Bhat', 'automation', 'leadgen', 'WhatsApp Automation Executive'],
  ['freelancer', 'Kiran Das', 'freelancer', 'external', 'Freelancer'],
  ['consultant', 'Prakash Menon', 'consultant', 'external', 'Consultant'],
  ['auditor', 'Ramesh Hegde', 'auditor', 'external', 'Auditor'],
  ['vendor', 'PrintCo Vendor', 'vendor', 'external', 'Vendor'],
  ['admin', 'Owner Admin', 'owner', 'leadership', 'Founder / Owner / Super Admin'],
];

export async function seedDatabase(targetPool = pool) {
  const client = await targetPool.connect();
  try {
    console.log('[AgencyOS Seed] Starting master data seeding...');
    await client.query('BEGIN');

    // 1. Seed Company Settings
    await client.query(
      `INSERT INTO public.app_settings (key, value, updated_by)
       VALUES ($1, $2, 'seed')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      ['paa_company', JSON.stringify(COMPANY_CONFIG)]
    );

    // 2. Seed Departments
    for (let i = 0; i < DEPARTMENTS.length; i++) {
      const dept = DEPARTMENTS[i];
      await client.query(
        `INSERT INTO public.departments (id, name, data, pos, updated_by)
         VALUES ($1, $2, $3, $4, 'seed')
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, data = EXCLUDED.data`,
        [dept.id, dept.name, dept, i]
      );
    }

    // 3. Seed Designations
    for (let i = 0; i < DESIGNATIONS.length; i++) {
      const desig = DESIGNATIONS[i];
      await client.query(
        `INSERT INTO public.designations (id, title, department_id, data, pos, updated_by)
         VALUES ($1, $2, $3, $4, 'seed')
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, department_id = EXCLUDED.department_id, data = EXCLUDED.data`,
        [desig.id, desig.title, desig.departmentId, desig, i]
      );
    }

    // 4. Seed Base Employees & Org Structure
    const orgMap = {};
    const defaultPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    for (let i = 0; i < BASE_EMPLOYEES.length; i++) {
      const emp = BASE_EMPLOYEES[i];
      await client.query(
        `INSERT INTO public.employees (id, employee_code, name, email, phone, role, status, data, pos, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'seed')
         ON CONFLICT (id) DO UPDATE SET employee_code = EXCLUDED.employee_code, name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role, data = EXCLUDED.data`,
        [emp.id, emp.employeeId, emp.name, emp.email, emp.phone, emp.role, emp.status, emp, i]
      );

      // Seed credentials
      await client.query(
        `INSERT INTO public.user_credentials (employee_id, password_hash, must_change, updated_by)
         VALUES ($1, $2, true, 'seed')
         ON CONFLICT (employee_id) DO NOTHING`,
        [emp.id, defaultPasswordHash]
      );

      orgMap[emp.id] = {
        unit: emp.departmentId === 'dept-1' ? 'leadership' : emp.departmentId === 'dept-2' ? 'hr' : emp.departmentId === 'dept-3' ? 'ops' : emp.departmentId === 'dept-5' ? 'finance' : 'sales',
        position: emp.name,
        reportsTo: emp.reportingManagerId || '',
      };
    }

    // 5. Seed Extended Role Accounts
    let empCodeCounter = 101;
    for (let i = 0; i < ROLE_ACCOUNTS.length; i++) {
      const [role, name, user, unit, position] = ROLE_ACCOUNTS[i];
      const email = `${user}@priorityadsagency.com`;
      const empId = `emp-role-${role}`;
      const employeeCode = `PAA-EMP-${empCodeCounter++}`;

      const roleEmpData = {
        id: empId,
        employeeId: employeeCode,
        name,
        email,
        phone: '+91 9988776655',
        role,
        status: 'active',
        departmentId: 'dept-3',
        designationId: 'desig-4',
        employmentType: 'Full-time',
        joiningDate: new Date().toISOString().slice(0, 10),
        workMode: 'office',
        workLocation: 'Bangalore HQ',
        experienceYears: 1,
        assignedProjectIds: [],
        salary: { basic: 20000, hra: 8000, allowances: 4000, bonus: 0, incentives: 0, deductions: 0, netSalary: 32000 },
      };

      await client.query(
        `INSERT INTO public.employees (id, employee_code, name, email, phone, role, status, data, pos, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'seed')
         ON CONFLICT (id) DO UPDATE SET employee_code = EXCLUDED.employee_code, name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role, data = EXCLUDED.data`,
        [empId, employeeCode, name, email, roleEmpData.phone, role, 'active', roleEmpData, 100 + i]
      );

      await client.query(
        `INSERT INTO public.user_credentials (employee_id, password_hash, must_change, updated_by)
         VALUES ($1, $2, true, 'seed')
         ON CONFLICT (employee_id) DO NOTHING`,
        [empId, defaultPasswordHash]
      );

      orgMap[empId] = { unit, position, reportsTo: role === 'employee' ? 'emp-role-team_leader' : '' };
    }

    // 6. Seed Org Settings
    await client.query(
      `INSERT INTO public.app_settings (key, value, updated_by)
       VALUES ($1, $2, 'seed')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      ['paa_x_os_org', JSON.stringify(orgMap)]
    );

    // 7. Seed Initial Leave Balances for all active employees
    const allEmpsRes = await client.query('SELECT id FROM public.employees');
    for (const row of allEmpsRes.rows) {
      const balanceData = {
        id: `lb-${row.id}`,
        employeeId: row.id,
        casualLeave: 12,
        casualLeaveUsed: 0,
        sickLeave: 12,
        sickLeaveUsed: 0,
        privilegeLeave: 15,
        privilegeLeaveUsed: 0,
        compOff: 0,
        compOffUsed: 0,
        year: new Date().getFullYear(),
      };

      await client.query(
        `INSERT INTO public.leave_balances (id, employee_id, data, updated_by)
         VALUES ($1, $2, $3, 'seed')
         ON CONFLICT (id) DO NOTHING`,
        [balanceData.id, row.id, balanceData]
      );
    }

    // 8. Seed Initial Demonstration Clients, Leads & Projects only if explicitly requested (SEED_DEMO_DATA=true) and tables are empty
    const shouldSeedDemo = process.env.SEED_DEMO_DATA === 'true' || process.env.NODE_ENV === 'development';
    const clientCheck = await client.query('SELECT count(*)::int n FROM public.clients');
    if (shouldSeedDemo && clientCheck.rows[0].n === 0) {
      const demoClients = [
        {
          id: 'cli-demo-1',
          clientCode: 'CLI-2026-001',
          companyName: 'Apex Health Systems',
          industry: 'Healthcare & Lifesciences',
          phone: '+91 98450 11223',
          email: 'contact@apexhealth.in',
          status: 'active',
          address: 'Richmond Circle, Bengaluru, Karnataka 560025',
          stateCode: '29',
          gstNumber: '29AABCA1234D1Z5',
          createdAt: new Date().toISOString()
        },
        {
          id: 'cli-demo-2',
          clientCode: 'CLI-2026-002',
          companyName: 'Zenith Retail Tech',
          industry: 'E-commerce & Retail',
          phone: '+91 98860 33445',
          email: 'growth@zenithretail.com',
          status: 'active',
          address: 'Bandra Kurla Complex, Mumbai, Maharashtra 400051',
          stateCode: '27',
          gstNumber: '27AABCA5678D1Z2',
          createdAt: new Date().toISOString()
        }
      ];

      for (let i = 0; i < demoClients.length; i++) {
        const c = demoClients[i];
        await client.query(
          `INSERT INTO public.clients (id, client_code, company_name, phone, email, status, data, pos, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'seed')
           ON CONFLICT (id) DO NOTHING`,
          [c.id, c.clientCode, c.companyName, c.phone, c.email, c.status, c, i]
        );
      }

      const demoLeads = [
        {
          id: 'lead-demo-1',
          leadCode: 'LEAD-2026-001',
          company: 'Nexus Mobility Innovations',
          contactPerson: 'Aditya Mehta',
          phone: '+91 97410 55667',
          email: 'aditya@nexusmobility.in',
          source: 'LinkedIn Enterprise Inbound',
          status: 'qualified',
          estimatedValue: 450000,
          assignedEmployeeId: 'emp-5',
          createdAt: new Date().toISOString()
        },
        {
          id: 'lead-demo-2',
          leadCode: 'LEAD-2026-002',
          company: 'Kavita Organics Pvt Ltd',
          contactPerson: 'Kavita Rao',
          phone: '+91 99000 88990',
          email: 'kavita@kavitaorganics.com',
          source: 'Direct Field Visit',
          status: 'proposal_sent',
          estimatedValue: 280000,
          assignedEmployeeId: 'emp-5',
          createdAt: new Date().toISOString()
        }
      ];

      for (let i = 0; i < demoLeads.length; i++) {
        const l = demoLeads[i];
        await client.query(
          `INSERT INTO public.leads (id, lead_code, company, phone, email, source, status, estimated_value, assigned_employee_id, data, pos, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'seed')
           ON CONFLICT (id) DO NOTHING`,
          [l.id, l.leadCode, l.company, l.phone, l.email, l.source, l.status, l.estimatedValue, l.assignedEmployeeId, l, i]
        );
      }
    }

    await client.query('COMMIT');
    console.log('[AgencyOS Seed] Master data seeding completed successfully.');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AgencyOS Seed] Seeding failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Allow CLI execution: node server/seed.mjs
if (process.argv[1] && process.argv[1].endsWith('seed.mjs')) {
  seedDatabase()
    .then(() => {
      console.log('Database seed finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed process failed:', err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
