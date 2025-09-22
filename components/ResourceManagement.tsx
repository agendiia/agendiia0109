import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  TrendingUp, 
  Database, 
  Wifi, 
  Zap, 
  Users, 
  Calendar,
  DollarSign,
  Bell,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';
import { 
  ResourceUsage, 
  ResourceViolation, 
  ExternalServiceUsage, 
  CostAlert,
  ResourceMonitoring 
} from '../types';

const ResourceManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'usage' | 'violations' | 'monitoring' | 'alerts' | 'rateLimit'>('usage');
  const [loading, setLoading] = useState(false);
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage[]>([]);
  const [violations, setViolations] = useState<ResourceViolation[]>([]);
  const [externalUsage, setExternalUsage] = useState<ExternalServiceUsage | null>(null);
  const [costAlerts, setCostAlerts] = useState<CostAlert[]>([]);
  const [monitoring, setMonitoring] = useState<ResourceMonitoring | null>(null);
  const [rateLimitStats, setRateLimitStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'usage':
          await loadResourceUsage();
          break;
        case 'violations':
          await loadViolations();
          break;
        case 'monitoring':
          await loadMonitoring();
          break;
        case 'alerts':
          await loadCostAlerts();
          break;
        case 'rateLimit':
          await loadRateLimitStats();
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResourceUsage = async () => {
    const getResourceUsage = httpsCallable(functions, 'getResourceUsage');
    const result = await getResourceUsage();
    setResourceUsage(result.data as ResourceUsage[]);
  };

  const loadViolations = async () => {
    const getResourceViolations = httpsCallable(functions, 'getResourceViolations');
    const result = await getResourceViolations();
    setViolations(result.data as ResourceViolation[]);
  };

  const loadMonitoring = async () => {
    const getExternalServiceUsage = httpsCallable(functions, 'getExternalServiceUsage');
    const result = await getExternalServiceUsage();
    setExternalUsage(result.data as ExternalServiceUsage);
  };

  const loadCostAlerts = async () => {
    const getCostAlerts = httpsCallable(functions, 'getCostAlerts');
    const result = await getCostAlerts();
    setCostAlerts(result.data as CostAlert[]);
  };

  const loadRateLimitStats = async () => {
    const getRateLimitStats = httpsCallable(functions, 'getRateLimitStats');
    const result = await getRateLimitStats();
    setRateLimitStats(result.data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Normal': return 'text-green-600 dark:text-green-400';
      case 'Warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'OverLimit': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Low': return 'text-blue-600 dark:text-blue-400';
      case 'Medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'High': return 'text-orange-600 dark:text-orange-400';
      case 'Critical': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getUsagePercentage = (used: number, limit: number, unlimited: boolean) => {
    if (unlimited) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const renderResourceUsage = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {resourceUsage.map((usage) => (
          <div key={usage.userId} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {usage.userEmail}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Plano: {usage.plan}
                </p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(usage.status)}`}>
                {usage.status}
              </div>
            </div>

            <div className="space-y-4">
              {/* Storage */}
              <div className="flex items-center space-x-3">
                <Database className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span>Storage</span>
                    <span>
                      {usage.quotas.storage.unlimited ? 'Unlimited' : 
                        `${formatBytes(usage.quotas.storage.used * 1024 * 1024)} / ${formatBytes(usage.quotas.storage.limit * 1024 * 1024)}`
                      }
                    </span>
                  </div>
                  {!usage.quotas.storage.unlimited && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                      <div 
                        className={`h-2 rounded-full ${
                          getUsagePercentage(usage.quotas.storage.used, usage.quotas.storage.limit, false) > 80 
                            ? 'bg-red-500' : getUsagePercentage(usage.quotas.storage.used, usage.quotas.storage.limit, false) > 60
                            ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${getUsagePercentage(usage.quotas.storage.used, usage.quotas.storage.limit, false)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Bandwidth */}
              <div className="flex items-center space-x-3">
                <Wifi className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span>Bandwidth</span>
                    <span>
                      {usage.quotas.bandwidth.unlimited ? 'Unlimited' : 
                        `${usage.quotas.bandwidth.used.toFixed(2)} GB / ${usage.quotas.bandwidth.limit} GB`
                      }
                    </span>
                  </div>
                  {!usage.quotas.bandwidth.unlimited && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                      <div 
                        className={`h-2 rounded-full ${
                          getUsagePercentage(usage.quotas.bandwidth.used, usage.quotas.bandwidth.limit, false) > 80 
                            ? 'bg-red-500' : getUsagePercentage(usage.quotas.bandwidth.used, usage.quotas.bandwidth.limit, false) > 60
                            ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${getUsagePercentage(usage.quotas.bandwidth.used, usage.quotas.bandwidth.limit, false)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* API Calls */}
              <div className="flex items-center space-x-3">
                <Zap className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span>API Calls</span>
                    <span>
                      {usage.quotas.apiCalls.unlimited ? 'Unlimited' : 
                        `${usage.quotas.apiCalls.used.toLocaleString()} / ${usage.quotas.apiCalls.limit.toLocaleString()}`
                      }
                    </span>
                  </div>
                  {!usage.quotas.apiCalls.unlimited && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                      <div 
                        className={`h-2 rounded-full ${
                          getUsagePercentage(usage.quotas.apiCalls.used, usage.quotas.apiCalls.limit, false) > 80 
                            ? 'bg-red-500' : getUsagePercentage(usage.quotas.apiCalls.used, usage.quotas.apiCalls.limit, false) > 60
                            ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${getUsagePercentage(usage.quotas.apiCalls.used, usage.quotas.apiCalls.limit, false)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Appointments */}
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span>Appointments</span>
                    <span>
                      {usage.quotas.appointments.unlimited ? 'Unlimited' : 
                        `${usage.quotas.appointments.used} / ${usage.quotas.appointments.limit}`
                      }
                    </span>
                  </div>
                  {!usage.quotas.appointments.unlimited && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                      <div 
                        className={`h-2 rounded-full ${
                          getUsagePercentage(usage.quotas.appointments.used, usage.quotas.appointments.limit, false) > 80 
                            ? 'bg-red-500' : getUsagePercentage(usage.quotas.appointments.used, usage.quotas.appointments.limit, false) > 60
                            ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${getUsagePercentage(usage.quotas.appointments.used, usage.quotas.appointments.limit, false)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderViolations = () => (
    <div className="space-y-4">
      {violations.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Violations Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            All users are within their resource limits.
          </p>
        </div>
      ) : (
        violations.map((violation) => (
          <div key={violation.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <AlertTriangle className={`w-6 h-6 mt-1 ${getSeverityColor(violation.severity)}`} />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {violation.type} Violation
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    User: {violation.userId}
                  </p>
                  <p className="text-gray-800 dark:text-gray-200">
                    {violation.message}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {new Date(violation.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(violation.severity)}`}>
                  {violation.severity}
                </span>
                {violation.action && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {violation.action}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderMonitoring = () => (
    <div className="space-y-6">
      {externalUsage && (
        <>
          {/* Firebase Usage */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Database className="w-5 h-5 mr-2" />
              Firebase Usage
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {externalUsage.firebase.reads.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Reads</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {externalUsage.firebase.writes.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Writes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {formatBytes(externalUsage.firebase.storage * 1024 * 1024)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Storage</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  ${externalUsage.firebase.cost.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Cost</div>
              </div>
            </div>
          </div>

          {/* Stripe Usage */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Stripe Usage
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {externalUsage.stripe.transactions.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Transactions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {externalUsage.stripe.webhooks.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Webhooks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  ${externalUsage.stripe.cost.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Cost</div>
              </div>
            </div>
          </div>

          {/* Email Usage */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Email Usage (SMTP)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {externalUsage.brevo.emails.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Emails Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  ${externalUsage.brevo.cost.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Cost</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderCostAlerts = () => (
    <div className="space-y-4">
      {costAlerts.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Cost Alerts
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            All services are within budget thresholds.
          </p>
        </div>
      ) : (
        costAlerts.map((alert) => (
          <div key={alert.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <AlertCircle className={`w-6 h-6 mt-1 ${getSeverityColor(alert.severity)}`} />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {alert.service} Cost Alert
                  </h3>
                  <p className="text-gray-800 dark:text-gray-200 mb-2">
                    {alert.message}
                  </p>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Current: ${alert.currentAmount.toFixed(2)}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      Threshold: ${alert.threshold.toFixed(2)}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      Type: {alert.alertType}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                {alert.severity}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderRateLimitStats = () => (
    <div className="space-y-6">
      {rateLimitStats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* User Rate Limiter */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                User Rate Limiter
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Keys</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {rateLimitStats.userRateLimiter?.totalKeys || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Active Windows</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {rateLimitStats.userRateLimiter?.activeWindows || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Admin Rate Limiter */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Admin Rate Limiter
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Keys</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {rateLimitStats.adminRateLimiter?.totalKeys || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Active Windows</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {rateLimitStats.adminRateLimiter?.activeWindows || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Global Rate Limiter */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Global Rate Limiter
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Keys</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {rateLimitStats.globalRateLimiter?.totalKeys || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Active Windows</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {rateLimitStats.globalRateLimiter?.activeWindows || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Rate Limiting Configuration */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Rate Limiting Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-white">User Limits</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">50 requests/minute</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">60 second window</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-white">Admin Limits</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">200 requests/minute</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">60 second window</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-white">Global Limits</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">100 requests/minute</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">60 second window</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Loading Rate Limit Statistics
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Fetching current rate limiting data...
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Resource Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor and manage platform resources, quotas, and costs
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'usage', label: 'Resource Usage', icon: TrendingUp },
            { key: 'violations', label: 'Violations', icon: AlertTriangle },
            { key: 'monitoring', label: 'External Services', icon: Database },
            { key: 'alerts', label: 'Cost Alerts', icon: Bell },
            { key: 'rateLimit', label: 'Rate Limiting', icon: Shield }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div>
          {activeTab === 'usage' && renderResourceUsage()}
          {activeTab === 'violations' && renderViolations()}
          {activeTab === 'monitoring' && renderMonitoring()}
          {activeTab === 'alerts' && renderCostAlerts()}
          {activeTab === 'rateLimit' && renderRateLimitStats()}
        </div>
      )}
    </div>
  );
};

export default ResourceManagement;
