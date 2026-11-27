// AGENCYOS_SPLIT_DONE
// AGENCYOS_V5_P26_DONE
// AGENCYOS_V4_P25_DONE
// AGENCYOS_V3_OS: renders the new AgencyOS screens (existing screens are rendered by App.tsx)
import React, { useEffect, useRef, lazy, Suspense } from 'react';
import { FounderDashboard, OpsDashboard, MyDashboard, SalesDashboard, HrDashboard, TeamDashboard, ReportsDashboard } from './OsDashboards';
import * as P from './OsPages';
import { RecordPage, RECORDS } from './OsRecords';
import * as Q from './OsP25Pages';
import { renderP26, RECORDS26 } from './OsP26Pages';

const SalesBillingModule = lazy(() => import('../components/SalesBillingModule').then(m => ({ default: m.SalesBillingModule })));
const DocumentCenter = lazy(() => import('../components/DocumentCenter').then(m => ({ default: m.DocumentCenter })));
const HrPayrollModule = lazy(() => import('../components/HrPayrollModule').then(m => ({ default: m.HrPayrollModule })));

const FallbackLoader = () => (
  <div className="flex items-center justify-center p-12 text-slate-400 text-sm font-medium">
    <div className="w-4 h-4 mr-2 border-2 border-slate-300 border-t-[#0B1738] rounded-full animate-spin" />
    Loading enterprise module...
  </div>
);

const InvoiceBuilder: React.FC<{ openAddModal: (t: string, d?: any) => void }> = ({ openAddModal }) => {
  const done = useRef(false);
  useEffect(() => { if (!done.current) { done.current = true; openAddModal('invoice'); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Suspense fallback={<FallbackLoader />}>
      <SalesBillingModule only="invoices" onOpenCreateQuotationModal={() => openAddModal('quotation')} onOpenCreateInvoiceModal={() => openAddModal('invoice')} onOpenRecordPaymentModal={(invId) => openAddModal('payment', { invoiceId: invId })} onOpenAddExpenseModal={() => openAddModal('expense')} />
    </Suspense>
  );
};

/** Returns the new screen for this tab, or null if the tab is one of the existing screens. */
export function renderOsPage(tab: string, openAddModal: (t: string, d?: any) => void): React.ReactNode {
  switch (tab) {
    case 'founder': return <FounderDashboard />;
    case 'ops-dashboard': return <OpsDashboard />;
    case 'my-dashboard': return <MyDashboard />;
    case 'sales-overview': return <SalesDashboard />;
    case 'sales-report': return <SalesDashboard report />;
    case 'people-overview': return <HrDashboard />;
    case 'team-report': return <TeamDashboard />;
    case 'reports': return <ReportsDashboard />;
    case 'approvals': return <P.ApprovalsPage />;
    case 'alerts': return <P.AlertsPage />;
    case 'calendar': return <P.CalendarPage />;
    case 'content-calendar': return <P.ContentCalendarPage />;
    case 'pipeline': return <P.PipelinePage />;
    case 'followups': return <P.FollowupsPage />;
    case 'lost': return <P.LostPage />;
    case 'lead-profile': return <P.LeadProfile />;
    case 'client-profile': return <P.ClientProfile />;
    case 'project-profile': return <P.ProjectProfile />;
    case 'employee-profile': return <P.EmployeeProfile />;
    case 'onboarding': return <P.OnboardingPage />;
    case 'services': return <P.ServicesPage />;
    case 'capacity': return <P.CapacityPage />;
    case 'hierarchy': return <Q.OrgStructurePage />;
    case 'tl-dashboard': return <Q.TeamLeaderDashboard />;
    case 'lead-rules': return <Q.LeadRulesPage />;
    case 'task-review': return <Q.TaskReviewPage />;
    case 'exits': return <Q.ExitsPage />;
    case 'permission-actions': return <Q.ActionPermissionsPage />;
    case 'permissions': return <P.PermissionsPage />;
    case 'payments': return <P.PaymentsPage />;
    case 'receivables': return <P.ReceivablesPage openAddModal={openAddModal} />;
    case 'expenses': return <P.ExpensesPage />;
    case 'profitability': return <P.ProfitabilityPage />;
    case 'weekly-reports': return <P.WeeklyReportsPage />;
    case 'templates': return <P.TemplatesPage />;
    case 'signatures': return <P.SignaturesPage />;
    case 'security': return <P.SecurityPage />;
    case 'backups': return <P.BackupsPage />;
    case 'company': return <P.CompanyPage />;
    case 'integrations': return <P.IntegrationsPage />;
    case 'inbox':
    case 'communication': return <P.InboxPage />;
    case 'invoice-builder': return <InvoiceBuilder openAddModal={openAddModal} />;
    case 'document-builder': return <Suspense fallback={<FallbackLoader />}><DocumentCenter /></Suspense>;
    case 'my-payslips': return <Suspense fallback={<FallbackLoader />}><HrPayrollModule key="my_payslips" initialTab="my_payslips" /></Suspense>;
    default: if (RECORDS26[tab] || ['global-search', 'my-profile', 'lead-import', 'lead-analytics', 'sales-targets', 'service-teams', 'approval-policy', 'approval-history', 'retention-report', 'report-builder'].includes(tab)) return renderP26(tab, RecordPage);
      return RECORDS[tab] ? <RecordPage key={tab} cfg={RECORDS[tab]} /> : null;
  }
}
