import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Joyride, { CallBackProps, STATUS, EVENTS } from 'react-joyride';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, CheckCircle2, BookOpen, Gift, Users, Calendar, Shirt, Zap, Download, ClipboardList, Eye, ChevronRight, Package, FileText, CalendarClock } from 'lucide-react';
import { PaymentItem, SchoolFee, Enrollment } from '@/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { InstallmentMobileView } from './InstallmentMobileView';

// Helper function to get greeting based on time
const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
};

interface PaymentMobileProps {
  user: any;
  enrollment: any | null;
  payments: any[];
  allSchoolFees: any[];
  availableSchoolFees: any[];
  loading: boolean;
  error: string | null;
  handleSchoolFeeClick: (fee: any) => void;
  totalAmount: number;
  paidAmount: number;
  navigate: any;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  filteredPayments: any[];
  handleDownloadInvoice: (paymentId: number) => void;
  selectedFeeTypeMobile: string | null;
  setSelectedFeeTypeMobile: (type: string | null) => void;
  hasTuitionPayment?: boolean;
  paymentPlans?: any[];
  installments?: { [key: string]: any[] };
  handleViewInstallments?: (plan: any) => void;
  onPayInstallment?: (installment: any, plan: any) => void;
  // Desktop modal props for mobile use
  showSchoolFeeModal?: boolean;
  setShowSchoolFeeModal?: (show: boolean) => void;
  selectedSchoolFee?: SchoolFee | null;
  showPaymentPlanModal?: boolean;
  setShowPaymentPlanModal?: (show: boolean) => void;
  runTour?: boolean;
  setRunTour?: (run: boolean) => void;
  setTourStepIndex?: (index: number) => void;
  tourSteps?: any[];
  tourStepIndex?: number;
  handleTourCallback?: (data: any) => void;
}

// Fee type icons
const feeTypeIcons: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  'Tuition': { icon: <BookOpen className="w-5 h-5" />, color: 'bg-blue-100 text-blue-600', label: 'Tuition' },
  'Service Fee': { icon: <Package className="w-5 h-5" />, color: 'bg-slate-100 text-slate-600', label: 'Service Fee' },
  'Miscellaneous': { icon: <Zap className="w-5 h-5" />, color: 'bg-purple-100 text-purple-600', label: 'Miscellaneous' },
  'Contribution': { icon: <Gift className="w-5 h-5" />, color: 'bg-green-100 text-green-600', label: 'Contribution' },
  'Event Fee': { icon: <Calendar className="w-5 h-5" />, color: 'bg-orange-100 text-orange-600', label: 'Event Fee' },
  'Book': { icon: <ClipboardList className="w-5 h-5" />, color: 'bg-indigo-100 text-indigo-600', label: 'Book' },
  'Uniform': { icon: <Shirt className="w-5 h-5" />, color: 'bg-pink-100 text-pink-600', label: 'Uniform' },
  'Other': { icon: <Users className="w-5 h-5" />, color: 'bg-gray-100 text-gray-600', label: 'Other' },
};

const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  Pending: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    icon: <Clock className="w-4 h-4" />,
  },
  Verified: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    icon: <AlertCircle className="w-4 h-4" />,
  },
  Approved: {
    bg: "bg-green-100",
    text: "text-green-800",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  Rejected: {
    bg: "bg-red-100",
    text: "text-red-800",
    icon: <AlertCircle className="w-4 h-4" />,
  },
};

export const PaymentMobileView = ({
  user,
  enrollment,
  payments,
  allSchoolFees,
  availableSchoolFees,
  loading,
  error,
  handleSchoolFeeClick,
  totalAmount,
  paidAmount,
  navigate,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  filteredPayments,
  handleDownloadInvoice,
  selectedFeeTypeMobile,
  setSelectedFeeTypeMobile,
  hasTuitionPayment = false,
  paymentPlans = [],
  installments = {},
  handleViewInstallments,
  onPayInstallment,
  showSchoolFeeModal,
  setShowSchoolFeeModal,
  selectedSchoolFee,
  showPaymentPlanModal,
  setShowPaymentPlanModal,
  runTour,
  setRunTour,
  setTourStepIndex,
  tourSteps = [],
  tourStepIndex = 0,
  handleTourCallback,
}: PaymentMobileProps) => {
  const [showEmptyFeeTypes, setShowEmptyFeeTypes] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipTimeout, setTooltipTimeout] = useState<NodeJS.Timeout | null>(null);
  const [activeDockTab, setActiveDockTab] = useState<'installments' | 'payments'>('payments');
  const [tourScrollOffset, setTourScrollOffset] = useState(20);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(56);
  const hasInstallments = paymentPlans.length > 0;
  const dockTabs = [
    ...(hasInstallments ? (['installments'] as const) : []),
    'payments' as const,
  ];
  const activeIndex = Math.max(0, dockTabs.indexOf(activeDockTab));
  const dockHorizontalPadding = 16;
  const dockTabWidth = 72;
  const dockTabGap = 4;
  const indicatorWidthPx = activeDockTab === 'installments' ? 80 : 62;
  const indicatorWidth = `${indicatorWidthPx}px`;
  const indicatorLeft = `${dockHorizontalPadding + activeIndex * (dockTabWidth + dockTabGap) + (dockTabWidth - indicatorWidthPx) / 2}px`;

  useEffect(() => {
    if (!hasInstallments && activeDockTab === 'installments') {
      setActiveDockTab('payments');
    }
  }, [activeDockTab, hasInstallments]);

  const handleTooltipShow = () => {
    setShowTooltip(true);
    
    // Clear any existing timeout
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
    }
    
    // Auto-hide after 2 seconds
    const timeout = setTimeout(() => {
      setShowTooltip(false);
    }, 2000);
    
    setTooltipTimeout(timeout);
  };

  const handleTooltipHide = () => {
    setShowTooltip(false);
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
      setTooltipTimeout(null);
    }
  };

  const getFeesForType = (feeType: string) => {
    return availableSchoolFees.filter(fee => fee.fee_type === feeType);
  };

  const handleFeeIconClick = (feeType: string) => {
    const feesOfType = getFeesForType(feeType);
    if (feesOfType.length > 0) {
      // Show fee type modal to let user select specific fee
      setSelectedFeeTypeMobile(feeType);
    }
  };

  const greeting = getGreeting();

  // Define all fee types in order
  const allFeeTypes = ['Tuition', 'Service Fee', 'Miscellaneous', 'Contribution', 'Event Fee', 'Book', 'Uniform', 'Other'] as const;

  // Filter available fee types based on toggle state
  const availableFeeTypes = allFeeTypes.filter((feeType) => {
    if (!showEmptyFeeTypes) {
      const feesOfType = getFeesForType(feeType);
      return feesOfType.length > 0;
    }
    return true;
  });

  // Determine display mode: text for 2-4 fees, icons for 5+
  const useTextDisplay = availableFeeTypes.length >= 2 && availableFeeTypes.length <= 4;

  useEffect(() => {
    const updateTourViewportSettings = () => {
      const mobile = window.matchMedia('(max-width: 767px)').matches;
      setIsSmallScreen(mobile);

      if (!mobile) {
        setTourScrollOffset(20);
        return;
      }

      const mobileHeader = document.querySelector('[data-mobile-header="true"]') as HTMLElement | null;
      const headerHeight = mobileHeader?.getBoundingClientRect().height ?? 56;
      setMobileHeaderHeight(Math.ceil(headerHeight));
      setTourScrollOffset(Math.ceil(headerHeight + 16));
    };

    updateTourViewportSettings();
    window.addEventListener('resize', updateTourViewportSettings);

    return () => {
      window.removeEventListener('resize', updateTourViewportSettings);
    };
  }, []);

  const normalizedTourSteps = useMemo(() => {
    if (!isSmallScreen) return tourSteps;

    return (tourSteps || []).map((step: any) => {
      if (!step?.placement) return step;
      if (step.placement === 'left' || step.placement === 'right') {
        return { ...step, placement: 'top' as const };
      }
      return step;
    });
  }, [tourSteps, isSmallScreen]);

  const mobileTourContentTopSpaceClass = isSmallScreen && (runTour || false)
    ? (mobileHeaderHeight >= 72 ? 'pt-24' : mobileHeaderHeight >= 64 ? 'pt-20' : 'pt-16')
    : '';

  useEffect(() => {
    if (!isSmallScreen || !runTour) return;

    const currentStep = (normalizedTourSteps as any[])?.[tourStepIndex || 0];
    const targetSelector = typeof currentStep?.target === 'string' ? currentStep.target : '';

    if (!targetSelector || targetSelector === 'body') return;

    const targetElement = document.querySelector(targetSelector) as HTMLElement | null;
    if (!targetElement) return;

    const rect = targetElement.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top;
    const safeTop = Math.max(0, absoluteTop - (mobileHeaderHeight + 24));
    window.scrollTo({ top: safeTop, behavior: 'auto' });
  }, [runTour, tourStepIndex, normalizedTourSteps, isSmallScreen, mobileHeaderHeight]);

  // Joyride styling configuration
  const joyrideStyling = {
    options: {
      primaryColor: '#2563eb',
      textColor: '#1f2937',
      backgroundColor: '#ffffff',
      overlayColor: 'rgba(0, 0, 0, 0.5)',
      spotlightShadow: '0 0 15px rgba(0, 0, 0, 0.5)',
    },
    tooltip: {
      borderRadius: 8,
      fontSize: 14,
    },
    buttonNext: {
      backgroundColor: '#2563eb',
      fontSize: 14,
      borderRadius: 6,
      padding: '8px 16px',
    },
    buttonBack: {
      color: '#6b7280',
      fontSize: 14,
      marginRight: 10,
      marginLeft: 'auto',
    },
    buttonSkip: {
      color: '#6b7280',
      fontSize: 14,
    },
    buttonClose: {
      height: 14,
      width: 14,
      right: 15,
      top: 15,
    },
  };

  return (
    <>
      <Joyride
        steps={normalizedTourSteps}
        run={runTour || false}
        stepIndex={tourStepIndex || 0}
        callback={handleTourCallback}
        continuous
        showProgress
        showSkipButton
        disableOverlayClose
        spotlightClicks
        disableScrolling={false}
        scrollOffset={tourScrollOffset}
        spotlightPadding={5}
        styles={joyrideStyling}
        locale={{
          back: 'Previous',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          open: 'Open the dialog',
          skip: 'Skip tour',
        }}
      />
      
      {/* Conditionally render based on active dock tab */}
      {activeDockTab === 'installments' && hasInstallments ? (
        <InstallmentMobileView
          paymentPlans={paymentPlans}
          installments={installments}
          payments={payments}
          onPayInstallment={onPayInstallment}
        />
      ) : (
        <div
          className={`p-3 space-y-3 ${hasInstallments ? 'pb-24' : 'pb-3'} ${mobileTourContentTopSpaceClass}`}
        >
      {/* Greeting Header */}
      <div id="payment-header" className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-3 space-y-1">
        <p className="text-xs opacity-90">{greeting}</p>
        <h1 className="text-lg font-bold">
          {user?.first_name} {user?.last_name}!
        </h1>
      </div>

      {/* Total Charges */}
      <Card id="summary-stats-section" className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="pt-4">
          <p className="text-xs text-gray-600 mb-1">Amount Due</p>
          <p className="text-3xl font-bold text-blue-600">
            ₱{totalAmount.toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* Amount Paid */}
      <div id="payment-summary-section" className="grid grid-cols-2 gap-2">
        <Card className="shadow-lg border-0 bg-green-50">
          <CardContent className="pt-3">
            <p className="text-xs text-green-600 mb-1">Amount Paid</p>
            <p className="text-lg font-bold text-green-700">
              ▲ ₱{paidAmount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg border-0 bg-gray-50">
          <CardContent className="pt-3">
            <p className="text-xs text-gray-600 mb-1">Total Discounts</p>
            <p className="text-lg font-bold text-gray-700">
              ▲ ₱{payments.reduce((sum, p) => sum + Number(p.total_discount), 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fee Type Icons Grid */}
      <div className="space-y-2" id="school-fees-section">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">School Fees</h3>
          <div 
            className="relative"
            onMouseEnter={handleTooltipShow}
            onMouseLeave={handleTooltipHide}
            onTouchStart={handleTooltipShow}
          >
            <Switch
              checked={showEmptyFeeTypes}
              onCheckedChange={setShowEmptyFeeTypes}
              className="scale-75"
            />
            {/* Tooltip */}
            <div className={`absolute right-0 top-full mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap transition-opacity pointer-events-none z-50 ${
              showTooltip ? 'opacity-100' : 'opacity-0'
            }`}>
              {showEmptyFeeTypes ? 'Hide unavailable fees' : 'Show all fee types'}
            </div>
          </div>
        </div>

        {/* Text-based display for 2-4 fees */}
        {useTextDisplay && (
          <div className="space-y-2">
            {availableFeeTypes.map((feeType) => {
              const feeConfig = feeTypeIcons[feeType];
              const feesOfType = getFeesForType(feeType);
              const hasFees = feesOfType.length > 0;
              const hasApprovedPayment = payments.some(p =>
                (p.payment_for.toLowerCase().includes(feeType.toLowerCase()) ||
                  (feeType === 'Tuition' && p.payment_type.includes('Tuition'))) &&
                p.status === 'Approved'
              );
              const isDisabled = !hasFees || hasApprovedPayment || (!hasTuitionPayment && feeType !== 'Tuition');

              return (
                <button
                  key={feeType}
                  onClick={() => handleFeeIconClick(feeType)}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isDisabled
                      ? 'opacity-35 cursor-not-allowed bg-gray-50 border-gray-200'
                      : 'cursor-pointer hover:border-blue-500 hover:bg-blue-50 border-gray-300 bg-white'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    hasFees && !isDisabled ? feeConfig.color : 'bg-gray-100 text-gray-400'
                  }`}>
                    {feeConfig.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`font-semibold text-sm ${isDisabled ? 'text-gray-400' : 'text-gray-700'}`}>
                      {feeType}
                    </p>
                    <p className="text-xs text-gray-500">
                      {feesOfType.length} {feesOfType.length === 1 ? 'fee' : 'fees'} available
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isDisabled ? 'text-gray-300' : 'text-gray-400'}`} />
                </button>
              );
            })}
          </div>
        )}

        {/* Icon-based display for 5+ fees */}
        {!useTextDisplay && (
          <div className="grid grid-cols-8 gap-2">
            {availableFeeTypes.map((feeType) => {
              const feeConfig = feeTypeIcons[feeType];
              const feesOfType = getFeesForType(feeType);
              const hasFees = feesOfType.length > 0;
              const hasApprovedPayment = payments.some(p =>
                (p.payment_for.toLowerCase().includes(feeType.toLowerCase()) ||
                  (feeType === 'Tuition' && p.payment_type.includes('Tuition'))) &&
                p.status === 'Approved'
              );
              const isDisabled = !hasFees || hasApprovedPayment || (!hasTuitionPayment && feeType !== 'Tuition');

              return (
                <button
                  key={feeType}
                  onClick={() => handleFeeIconClick(feeType)}
                  disabled={isDisabled}
                  title={feeType}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all relative group ${
                    isDisabled
                      ? 'opacity-35 cursor-not-allowed'
                      : 'cursor-pointer hover:scale-110'
                  } ${hasApprovedPayment ? 'opacity-60' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${hasFees && !isDisabled ? feeConfig.color : 'bg-gray-100 text-gray-400'}`}>
                    <div className="w-5 h-5">
                      {feeConfig.icon}
                    </div>
                  </div>
                  {/* Tooltip (display below icon on mobile) */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {feeType}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!showEmptyFeeTypes && availableFeeTypes.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            <p className="text-xs">No fees available for your grade level</p>
            <p className="text-xs mt-1">Toggle to see all fee categories</p>
          </div>
        )}
      </div>

      {/* Payment Details Section */}
      <div className="space-y-2" id="payment-details-section">
        <h3 className="text-sm font-semibold text-gray-700">Payment Details</h3>

        {/* Search and Filter */}
        <div id="search-filter-section" className="flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by description or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50 border-muted text-sm py-2"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-muted/50 border-muted text-sm h-9">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Verified">Verified</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Payment Items List - Minimalist */}
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {loading ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-xs text-muted-foreground">Loading...</p>
            </div>
          ) : error ? (
            <div className="text-center py-4 text-red-600">
              <AlertCircle className="w-5 h-5 mx-auto mb-1" />
              <p className="text-xs">{error}</p>
            </div>
          ) : filteredPayments.length > 0 ? (
            filteredPayments.map((payment) => {
              const config = statusConfig[payment.status];
              return (
                <div
                  key={payment.id}
                  className="bg-white dark:bg-gray-800 rounded-xl p-3 space-y-2 border border-gray-100 dark:border-gray-700 shadow-sm"
                >
                  {/* Header: Title and Status */}
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex-1 line-clamp-2">
                      {payment.payment_for}
                    </h4>
                    <Badge className={`${config.bg} border-0 flex-shrink-0`}>
                      <span className={`${config.text} text-xs font-medium`}>{payment.status}</span>
                    </Badge>
                  </div>

                  {/* Receipt and Date */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-mono">RCP-{payment.receipt_number}</span>
                    {payment.payment_date && (
                      <>
                        <span>•</span>
                        <span>{new Date(payment.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </>
                    )}
                  </div>

                  {/* Amount Section */}
                  <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Amount</span>
                      <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                        ₱{Number(payment.net_amount).toLocaleString()}
                      </span>
                    </div>
                    {Number(payment.total_discount) > 0 && (
                      <div className="flex items-baseline justify-between mt-0.5">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Discount</span>
                        <span className="text-xs font-medium text-green-600 dark:text-green-400">
                          -₱{Number(payment.total_discount).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No payments found</p>
              <p className="text-xs mt-1">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Important Notice */}
      <Card className="shadow-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20" id="important-notice-section">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <AlertCircle className="w-4 h-4" />
            Important
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
            <li>• Payment must be made by due date</li>
            <li>• Confirmation sent via email</li>
            <li>• All payments are non-refundable</li>
          </ul>
        </CardContent>
      </Card>
      </div>
      )}

      {/* Floating Dock */}
      {hasInstallments && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-white/95 dark:bg-gray-900/95 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 px-4 py-2 flex items-center gap-1 backdrop-blur-xl relative">
            {/* Animated indicator line */}
            <div 
              className="absolute bottom-1 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full transition-all duration-500 ease-in-out"
              style={{
                width: indicatorWidth,
                left: indicatorLeft,
              }}
            />
            
            {/* Installments Tab */}
            <button
              onClick={() => setActiveDockTab('installments')}
              className="w-[72px] h-12 flex items-center justify-center rounded-xl transition-all duration-500 ease-in-out overflow-hidden relative"
            >
              <div className={`absolute inset-0 flex flex-col items-center justify-center transition-transform duration-500 ease-in-out ${
                activeDockTab === 'installments' 
                  ? '-translate-y-full' 
                  : 'translate-y-0'
              }`}>
                <CalendarClock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
              <div className={`absolute inset-0 flex flex-col items-center justify-center transition-transform duration-500 ease-in-out ${
                activeDockTab === 'installments' 
                  ? 'translate-y-0' 
                  : 'translate-y-full'
              }`}>
                <span className="font-semibold text-[11px] text-blue-600 dark:text-blue-400">
                  Installments
                </span>
              </div>
            </button>

            {/* Payments Tab */}
            <button
              onClick={() => setActiveDockTab('payments')}
              className="w-[72px] h-12 flex items-center justify-center rounded-xl transition-all duration-500 ease-in-out overflow-hidden relative"
            >
              <div className={`absolute inset-0 flex flex-col items-center justify-center transition-transform duration-500 ease-in-out ${
                activeDockTab === 'payments' 
                  ? '-translate-y-full' 
                  : 'translate-y-0'
              }`}>
                <FileText className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
              <div className={`absolute inset-0 flex flex-col items-center justify-center transition-transform duration-500 ease-in-out ${
                activeDockTab === 'payments' 
                  ? 'translate-y-0' 
                  : 'translate-y-full'
              }`}>
                <span className="font-semibold text-[11px] text-blue-600 dark:text-blue-400">
                  Payments
                </span>
              </div>
            </button>

          </div>
        </div>
      )}
    </>
  );
};

// Modal for showing fees of a specific type
export const FeeTypeModal = ({
  isOpen,
  onClose,
  feeType,
  fees,
  onFeeSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  feeType: string | null;
  fees: SchoolFee[];
  onFeeSelect: (fee: SchoolFee) => void;
}) => {
  const feeConfig = feeType ? feeTypeIcons[feeType] : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {feeConfig && (
              <div className={`w-8 h-8 rounded flex items-center justify-center ${feeConfig.color}`}>
                {feeConfig.icon}
              </div>
            )}
            <DialogTitle className="text-lg">{feeType} Fees</DialogTitle>
          </div>
          <DialogDescription>
            Select a fee to proceed with payment
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable container - max 5 items visible */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {fees.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm">No {feeType?.toLowerCase()} fees available</p>
              <p className="text-xs mt-1">All fees have been paid or none match your grade level</p>
            </div>
          ) : (
            fees.map((fee) => (
            <button
              key={fee.id}
              onClick={() => {
                onFeeSelect(fee);
                onClose();
              }}
              className="w-full p-3 border border-border rounded-lg hover:bg-blue-50 hover:border-blue-500 transition-all text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground mb-1">
                    {fee.fee_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Type: {fee.fee_type}
                  </p>
                  {fee.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {fee.description}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-blue-600">
                    ₱{Number(fee.amount).toLocaleString()}
                  </p>
                  {fee.is_required && (
                    <Badge className="bg-red-100 text-red-800 text-xs mt-1">
                      Required
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
