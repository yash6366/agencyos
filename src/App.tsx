// AGENCYOS_SPLIT_DONE
// AGENCYOS_HUBS_DONE
// AGENCYOS_DB_DONE
// AGENCYOS_V5_P26_DONE
// AGENCYOS_V4_P25_DONE
import React, { useState, useEffect } from 'react';
import { RoleLogin } from './components/RoleLogin'; // AGENCYOS_V2_PART4
import './os/os.css'; // AGENCYOS_V3_OS
import { OsLogin } from './os/OsLogin';
import { OsSidebar, OsTopbar, OsHeader } from './os/OsShell';
import { ToastHost } from './os/OsUi';
import { renderOsPage } from './os/OsRouter';
import { HubTabs } from './os/osHubs';
import { AccessAdmin, ForcePasswordChange } from './components/AccessAdmin';
import { FinanceDashboard } from './components/FinanceDashboard';
import { DocumentCenter } from './components/DocumentCenter'; // AGENCYOS_V2_PART13
import { FinanceBook } from './components/FinanceBook';
import { ClientReimbursementModule } from './components/ClientReimbursementModule'; // AGENCYOS_V2_PART11
import { canAccess, homeTab, ROLE_LABEL, setFieldAccess } from './lib/rbac';
import { useShared } from './lib/sharedStore';
import { AppProvider, useApp } from './context/AppContext';
import { RoleDashboardView } from './components/RoleDashboardView';
import { AnalyticsView } from './components/AnalyticsView';
import { AttendanceModule } from './components/AttendanceModule';
import { FieldForceModule } from './components/FieldForceModule';
import { CrmModule } from './components/CrmModule';
import { ProjectsTasksModule } from './components/ProjectsTasksModule';
import { ReimbursementsPayrollModule } from './components/ReimbursementsPayrollModule';
import { SalesBillingModule } from './components/SalesBillingModule';
import { EmployeesModule } from './components/EmployeesModule';
import { LeaveManagementModule } from './components/LeaveManagementModule';
import { HrPayrollModule } from './components/HrPayrollModule'; // AGENCYOS_V2_PART2
import { DealsModule, DealsTab } from './components/DealsModule'; // AGENCYOS_V2_PART3
import { FieldGpsModule } from './components/FieldGpsModule';
import { AgencyWatchers } from './components/AgencyWatchers';
import { AuditSettingsModule } from './components/AuditSettingsModule';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { AddEntityModals } from './components/AddEntityModals';
import { useRouter } from './lib/router';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { MyProfileModal } from './components/MyProfileModal';
import { GoogleCalendarModal } from './components/GoogleCalendarModal';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  UserCheck,
  Building2,
  FileText,
  FileCheck,
  Briefcase,
  CheckSquare,
  ListTodo,
  Receipt,
  CreditCard,
  DollarSign,
  MapPin,
  ShieldAlert,
  Settings,
  Sun,
  Moon,
  Bell,
  LogOut,
  LogIn,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Shield,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { UserRole } from './types';
import { installExportGuard, setExportCtx } from './os/osP25';
import './os/osP26';
import './os/osSeedRoles';

function MainApp() {
  const {
    theme,
    toggleTheme,
    company,
    currentUser,
    currentRole,
    switchRole,
    switchUser,
    employees,
    activeTab,
    setActiveTab,
    isAuthenticated,
    login,
    logout,
    notifications,
    markNotificationAsRead
  } = useApp();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { tab: routerTab } = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Sync router URL with activeTab
  useEffect(() => {
    if (routerTab && routerTab !== activeTab) {
      setActiveTab(routerTab);
    }
  }, [routerTab, activeTab, setActiveTab]);

  // Global keyboard shortcut: Ctrl+K / Cmd+K opens search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => { if (theme === 'dark') toggleTheme(); }, [theme]); // light theme only
  setExportCtx(currentRole, activeTab); installExportGuard();
  useEffect(() => { const em = sessionStorage.getItem('paa_x_db_autologin'); if (em) { sessionStorage.removeItem('paa_x_db_autologin'); login(em); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  // Collapsible sidebar sections
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    hr: false,
    crm: false,
    work: false,
    finance: false,
    field: false
  });

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Modal Controller
  const [modalType, setModalType] = useState<string | null>(null);
  const [modalContextData, setModalContextData] = useState<any>(null);

  const openAddModal = (type: string, data?: any) => {
    setModalType(type);
    setModalContextData(data);
  };

  const closeAddModal = () => {
    setModalType(null);
    setModalContextData(null);
  };

  // Login page form state
  const [loginEmail, setLoginEmail] = useState('rajesh.sharma@priorityadsagency.com');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [loginRole, setLoginRole] = useState<UserRole>('super_admin');
  const [rememberMe, setRememberMe] = useState(true);

  const unreadNotifs = notifications.filter(n => !n.read);
  useShared<Record<string, string[]>>('paa_x_perm_overrides', {}); // AGENCYOS_V2_PART14 re-render menu when permissions change
  setFieldAccess(currentRole !== 'employee' || currentUser.workMode === 'field'); // AGENCYOS_V2_PART20
  const allowed = canAccess(currentRole, activeTab);
  useEffect(() => {
    if (isAuthenticated && !canAccess(currentRole, activeTab)) setActiveTab(homeTab(currentRole, currentRole === 'employee' && currentUser.workMode === 'field'));
  }, [isAuthenticated, currentRole, activeTab]);

  // Available personas matching screenshot
  const personas: { id: string; name: string; role: UserRole; icon: string; label: string }[] = [
    { id: 'emp-1', name: 'Rajesh Sharma', role: 'super_admin', icon: '👑', label: 'Super Admin (Rajesh Sharma)' },
    { id: 'emp-2', name: 'Priya Sharma', role: 'hr', icon: '👔', label: 'HR Lead (Priya Sharma)' },
    { id: 'emp-3', name: 'Karthik Rao', role: 'project_manager', icon: '💼', label: 'Project Manager (Karthik Rao)' },
    { id: 'emp-5', name: 'Rahul Verma', role: 'employee', icon: '🚗', label: 'Field Sales Exec (Rahul Verma)' },
    { id: 'emp-4', name: 'Ananya Desai', role: 'employee', icon: '💻', label: 'Sr Developer (Ananya Desai)' },
    { id: 'emp-6', name: 'Suresh Kumar', role: 'admin', icon: '📊', label: 'Accounts Lead (Suresh Kumar)' },
    { id: 'emp-7', name: 'Ningappa B.', role: 'super_admin', icon: '🖋️', label: 'Director & Signatory (Ningappa B.)' },
  ];

  // ==========================================
  // DEDICATED HIGH-END LOGIN PAGE
  // ==========================================
  if (!isAuthenticated) return <OsLogin />; // AGENCYOS_V3_OS

  return (
    <div className="app">
      <OsSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
      />
      <div className="main">
        <OsTopbar
          onMenu={() => setSidebarOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenProfile={() => setProfileOpen(true)}
          onOpenCalendar={() => setCalendarOpen(true)}
        />
        <main className="page">
          <OsHeader />
          <HubTabs />
          {!allowed && <div className="notice"><b>This screen is not available for your role.</b>&nbsp;Ask the Founder to switch it ON in the Permission Matrix.</div>}
        <div className="os-embed">
          {allowed && renderOsPage(activeTab, openAddModal)}
          {allowed && (activeTab === 'dashboard' || activeTab === 'owner_desk') && (
            <RoleDashboardView onOpenAddModal={openAddModal} forcedDesk="executive" />
          )}
          {allowed && activeTab === 'hr_desk' && (
            <RoleDashboardView onOpenAddModal={openAddModal} forcedDesk="hr" />
          )}
          {allowed && activeTab === 'pm_desk' && (
            <RoleDashboardView onOpenAddModal={openAddModal} forcedDesk="pm" />
          )}
          {allowed && activeTab === 'field_force_desk' && (
            <RoleDashboardView onOpenAddModal={openAddModal} forcedDesk="field" />
          )}
          {allowed && activeTab === 'employee_desk' && (
            <RoleDashboardView onOpenAddModal={openAddModal} forcedDesk="employee" />
          )}
          {allowed && activeTab === 'analytics' && <AnalyticsView />}
          {allowed && activeTab === 'attendance' && <AttendanceModule onOpenRegularizeModal={() => openAddModal('regularization')} />}
          {allowed && activeTab === 'leave' && <LeaveManagementModule />}
          {allowed && activeTab === 'hr_onboarding' && <HrPayrollModule key="hr_onboarding" initialTab="onboarding" />}
          {allowed && activeTab === 'hr_payroll' && <HrPayrollModule key="hr_payroll" initialTab="payroll" />}
          <AgencyWatchers />
          <ForcePasswordChange />
          {allowed && activeTab === 'finance_desk' && <FinanceDashboard onOpen={setActiveTab} />}
          {allowed && activeTab === 'access_admin' && <AccessAdmin />}
          {allowed && activeTab === 'document_center' && <DocumentCenter />}
          {allowed && activeTab === 'business_finance' && <FinanceBook />}
          {allowed && activeTab === 'client_reimbursements' && <ClientReimbursementModule />}
          {allowed && activeTab === 'deals_quotations' && <div className="hub-tabs"><button className="hub-tab active" onClick={() => openAddModal('quotation')}>+ Create Quotation</button></div>}
          {allowed && activeTab.startsWith('deals_') && <DealsModule key={activeTab} initialTab={activeTab.slice(6) as DealsTab} />}
          {allowed && activeTab === 'field_gps' && <FieldGpsModule />}
          {allowed && activeTab === 'field_force' && (
            <FieldForceModule
              onOpenStartVisitModal={() => openAddModal('field_visit')}
              onOpenExpenseModal={(vId) => openAddModal('field_expense', { visitId: vId })}
            />
          )}
          {allowed && (activeTab === 'crm' || activeTab === 'leads') && (
            <CrmModule
              initialSubTab="leads"
              onOpenAddLeadModal={() => openAddModal('lead')}
              onOpenAddClientModal={() => openAddModal('client')}
            />
          )}
          {allowed && activeTab === 'clients' && (
            <CrmModule
              initialSubTab="clients"
              onOpenAddLeadModal={() => openAddModal('lead')}
              onOpenAddClientModal={() => openAddModal('client')}
            />
          )}
          {allowed && activeTab === 'projects' && (
            <ProjectsTasksModule
              initialViewMode="projects"
              onOpenAddProjectModal={() => openAddModal('project')}
              onOpenAddTaskModal={() => openAddModal('task')}
              onOpenDailyActivityModal={(taskId, projectId) => openAddModal('daily_activity', { taskId, projectId })}
            />
          )}
          {allowed && activeTab === 'task_operations' && (
            <ProjectsTasksModule
              initialViewMode="task_operations"
              onOpenAddProjectModal={() => openAddModal('project')}
              onOpenAddTaskModal={() => openAddModal('task')}
              onOpenDailyActivityModal={(taskId, projectId) => openAddModal('daily_activity', { taskId, projectId })}
            />
          )}
          {allowed && activeTab === 'my_tasks' && (
            <ProjectsTasksModule
              initialViewMode="my_tasks"
              onOpenAddProjectModal={() => openAddModal('project')}
              onOpenAddTaskModal={() => openAddModal('task')}
              onOpenDailyActivityModal={(taskId, projectId) => openAddModal('daily_activity', { taskId, projectId })}
            />
          )}
          {allowed && activeTab === 'reimbursements' && (
            <ReimbursementsPayrollModule
              onOpenAddReimbursementModal={() => openAddModal('reimbursement')}
            />
          )}
          {allowed && activeTab === 'billing' && (
            <SalesBillingModule
              only="invoices"
              onOpenCreateQuotationModal={() => openAddModal('quotation')}
              onOpenCreateInvoiceModal={() => openAddModal('invoice')}
              onOpenRecordPaymentModal={(invId) => openAddModal('payment', { invoiceId: invId })}
              onOpenAddExpenseModal={() => openAddModal('expense')}
            />
          )}
          {allowed && activeTab === 'employees' && (
            <EmployeesModule
              onOpenAddEmployeeModal={() => openAddModal('employee')}
            />
          )}
          {allowed && activeTab === 'audit_settings' && <AuditSettingsModule />}
        </div>

        </main>
      </div>
      <ToastHost />

      {/* Global Modals & Document Viewer */}
      <DocumentViewerModal />
      <AddEntityModals
        modalType={modalType}
        onClose={closeAddModal}
        contextData={modalContextData}
      />
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <MyProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      <GoogleCalendarModal isOpen={calendarOpen} onClose={() => setCalendarOpen(false)} />

    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
