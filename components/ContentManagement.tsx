import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Mail, 
  Globe, 
  Book, 
  Megaphone,
  Plus,
  Edit,
  Eye,
  Trash2,
  Save,
  X,
  Send,
  Clock,
  Users,
  BarChart3,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';
import { 
  EmailTemplate, 
  LandingPage, 
  WikiPage, 
  Announcement,
  ContentAnalytics
} from '../types';
import EmailTemplateEditor from './EmailTemplateEditor';

interface ContentManagementProps {}

const ContentManagement: React.FC<ContentManagementProps> = () => {
  const [activeTab, setActiveTab] = useState<'email' | 'landing' | 'wiki' | 'announcements' | 'analytics'>('email');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Email Templates
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  
  // Landing Pages
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<LandingPage | null>(null);
  const [showPageEditor, setShowPageEditor] = useState(false);
  
  // Wiki
  const [wikiPages, setWikiPages] = useState<WikiPage[]>([]);
  const [selectedWikiPage, setSelectedWikiPage] = useState<WikiPage | null>(null);
  const [showWikiEditor, setShowWikiEditor] = useState(false);
  
  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [showAnnouncementEditor, setShowAnnouncementEditor] = useState(false);
  
  // Analytics
  const [analytics, setAnalytics] = useState<ContentAnalytics | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'email':
          await loadEmailTemplates();
          break;
        case 'landing':
          await loadLandingPages();
          break;
        case 'wiki':
          await loadWikiPages();
          break;
        case 'announcements':
          await loadAnnouncements();
          break;
        case 'analytics':
          await loadAnalytics();
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmailTemplates = async () => {
    const getEmailTemplates = httpsCallable(functions, 'getEmailTemplates');
    const result = await getEmailTemplates();
    setEmailTemplates(result.data as EmailTemplate[]);
  };

  const loadLandingPages = async () => {
    const getLandingPages = httpsCallable(functions, 'getLandingPages');
    const result = await getLandingPages();
    setLandingPages(result.data as LandingPage[]);
  };

  const loadWikiPages = async () => {
    const getWikiPages = httpsCallable(functions, 'getWikiPages');
    const result = await getWikiPages();
    setWikiPages(result.data as WikiPage[]);
  };

  const loadAnnouncements = async () => {
    const getAnnouncements = httpsCallable(functions, 'getAnnouncements');
    const result = await getAnnouncements();
    setAnnouncements(result.data as Announcement[]);
  };

  const loadAnalytics = async () => {
    const getContentAnalytics = httpsCallable(functions, 'getContentAnalytics');
    const result = await getContentAnalytics();
    setAnalytics(result.data as ContentAnalytics);
  };

  const handleCreateEmailTemplate = async (templateData: Partial<EmailTemplate>) => {
    try {
      const createEmailTemplate = httpsCallable(functions, 'createEmailTemplate');
      await createEmailTemplate(templateData);
      await loadEmailTemplates();
      setShowTemplateEditor(false);
    } catch (error) {
      console.error('Error creating email template:', error);
    }
  };

  const handleCreateLandingPage = async (pageData: Partial<LandingPage>) => {
    try {
      const createLandingPage = httpsCallable(functions, 'createLandingPage');
      await createLandingPage(pageData);
      await loadLandingPages();
      setShowPageEditor(false);
    } catch (error) {
      console.error('Error creating landing page:', error);
    }
  };

  const handleCreateWikiPage = async (pageData: Partial<WikiPage>) => {
    try {
      const createWikiPage = httpsCallable(functions, 'createWikiPage');
      await createWikiPage(pageData);
      await loadWikiPages();
      setShowWikiEditor(false);
    } catch (error) {
      console.error('Error creating wiki page:', error);
    }
  };

  const handleCreateAnnouncement = async (announcementData: Partial<Announcement>) => {
    try {
      const createAnnouncement = httpsCallable(functions, 'createAnnouncement');
      await createAnnouncement(announcementData);
      await loadAnnouncements();
      setShowAnnouncementEditor(false);
    } catch (error) {
      console.error('Error creating announcement:', error);
    }
  };

  const filteredEmailTemplates = emailTemplates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLandingPages = landingPages.filter(page =>
    page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    page.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    page.metaTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredWikiPages = wikiPages.filter(page =>
    page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    page.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    page.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredAnnouncements = announcements.filter(announcement =>
    announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    announcement.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    announcement.priority.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeColor = (type: string) => {
    const colors = {
      info: 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300',
      warning: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300',
      success: 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300',
      error: 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300',
      maintenance: 'text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300',
      feature: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900 dark:text-indigo-300'
    };
    return colors[type as keyof typeof colors] || colors.info;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300',
      medium: 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300',
      high: 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-300',
      urgent: 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const renderEmailTemplates = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>
        <button
          onClick={() => setShowTemplateEditor(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Template</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmailTemplates.map((template) => (
          <div key={template.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {template.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {template.subject}
                </p>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    template.isActive 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {template.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {template.category}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedTemplate(template)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedTemplate(template);
                    setShowTemplateEditor(true);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>Type: {template.type}</p>
              <p>Variables: {template.variables.length}</p>
              <p>Updated: {new Date(template.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderLandingPages = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search pages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>
        <button
          onClick={() => setShowPageEditor(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Page</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLandingPages.map((page) => (
          <div key={page.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {page.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  /{page.slug}
                </p>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    page.isPublished 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                    {page.isPublished ? 'Published' : 'Draft'}
                  </span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    SEO: {page.seoScore}/100
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.open(`/landing/${page.slug}`, '_blank')}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedPage(page)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedPage(page);
                    setShowPageEditor(true);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>Views: {page.analytics.views.toLocaleString()}</p>
              <p>Conversions: {page.analytics.conversions}</p>
              <p>Bounce Rate: {page.analytics.bounceRate.toFixed(1)}%</p>
              <p>Updated: {new Date(page.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderWikiPages = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search wiki..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>
        <button
          onClick={() => setShowWikiEditor(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Page</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWikiPages.map((page) => (
          <div key={page.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {page.title}
                </h3>
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    page.isPublished 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                    {page.isPublished ? 'Published' : 'Draft'}
                  </span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {page.category}
                  </span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                    v{page.version}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {page.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                    >
                      {tag}
                    </span>
                  ))}
                  {page.tags.length > 3 && (
                    <span className="text-xs text-gray-500">+{page.tags.length - 3}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedWikiPage(page)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedWikiPage(page);
                    setShowWikiEditor(true);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>Views: {page.viewCount.toLocaleString()}</p>
              <p>Children: {page.children.length}</p>
              <p>Updated: {new Date(page.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAnnouncements = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search announcements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>
        <button
          onClick={() => setShowAnnouncementEditor(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Announcement</span>
        </button>
      </div>

      <div className="space-y-4">
        {filteredAnnouncements.map((announcement) => (
          <div key={announcement.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {announcement.title}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(announcement.type)}`}>
                    {announcement.type}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(announcement.priority)}`}>
                    {announcement.priority}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    announcement.isActive 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {announcement.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <p className="text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                  {announcement.content}
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <div>
                    <span className="font-medium">Target:</span> {announcement.targetAudience}
                  </div>
                  <div>
                    <span className="font-medium">Views:</span> {announcement.viewCount.toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Dismissed:</span> {announcement.dismissedBy.length}
                  </div>
                  <div>
                    <span className="font-medium">Start:</span> {new Date(announcement.startDate).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {announcement.showOnDashboard && (
                    <span className="flex items-center">
                      <Eye className="w-3 h-3 mr-1" />
                      Dashboard
                    </span>
                  )}
                  {announcement.showAsPopup && (
                    <span className="flex items-center">
                      <Megaphone className="w-3 h-3 mr-1" />
                      Popup
                    </span>
                  )}
                  {announcement.isDismissible && (
                    <span className="flex items-center">
                      <X className="w-3 h-3 mr-1" />
                      Dismissible
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => setSelectedAnnouncement(announcement)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedAnnouncement(announcement);
                    setShowAnnouncementEditor(true);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      {analytics && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <Mail className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Email Templates</h3>
                  <p className="text-2xl font-bold text-blue-600">{analytics.emailTemplates.totalTemplates}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {analytics.emailTemplates.activeTemplates} active
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <Globe className="w-8 h-8 text-green-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Landing Pages</h3>
                  <p className="text-2xl font-bold text-green-600">{analytics.landingPages.totalPages}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {analytics.landingPages.publishedPages} published
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <Book className="w-8 h-8 text-purple-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Wiki Pages</h3>
                  <p className="text-2xl font-bold text-purple-600">{analytics.wiki.totalPages}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {analytics.wiki.publishedPages} published
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <Megaphone className="w-8 h-8 text-orange-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Announcements</h3>
                  <p className="text-2xl font-bold text-orange-600">{analytics.announcements.totalAnnouncements}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {analytics.announcements.activeAnnouncements} active
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Landing Page Performance */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Top Performing Landing Pages
              </h3>
              <div className="space-y-3">
                {analytics.landingPages.topPerforming.map((page, index) => (
                  <div key={page.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{page.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {page.conversions} conversions
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {page.views.toLocaleString()} views
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {page.conversions > 0 ? ((page.conversions / page.views) * 100).toFixed(1) : 0}% CVR
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Wiki Page Views */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Most Viewed Wiki Pages
              </h3>
              <div className="space-y-3">
                {analytics.wiki.topViewed.map((page, index) => (
                  <div key={page.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{page.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">#{index + 1}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {page.views.toLocaleString()} views
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Email Template Categories
              </h3>
              <div className="space-y-2">
                {Object.entries(analytics.emailTemplates.categoryStats).map(([category, count]) => (
                  <div key={category} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{category}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Wiki Categories
              </h3>
              <div className="space-y-2">
                {Object.entries(analytics.wiki.categoryStats).map(([category, count]) => (
                  <div key={category} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{category}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Announcement Types
              </h3>
              <div className="space-y-2">
                {Object.entries(analytics.announcements.typeStats).map(([type, count]) => (
                  <div key={type} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{type}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Content Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage email templates, landing pages, documentation, and announcements
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'email', label: 'Email Templates', icon: Mail },
            { key: 'landing', label: 'Landing Pages', icon: Globe },
            { key: 'wiki', label: 'Documentation', icon: Book },
            { key: 'announcements', label: 'Announcements', icon: Megaphone },
            { key: 'analytics', label: 'Analytics', icon: BarChart3 }
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
          {activeTab === 'email' && renderEmailTemplates()}
          {activeTab === 'landing' && renderLandingPages()}
          {activeTab === 'wiki' && renderWikiPages()}
          {activeTab === 'announcements' && renderAnnouncements()}
          {activeTab === 'analytics' && renderAnalytics()}
        </div>
      )}

      {/* Email Template Editor */}
      <EmailTemplateEditor
        template={selectedTemplate}
        isOpen={showTemplateEditor}
        onClose={() => {
          setShowTemplateEditor(false);
          setSelectedTemplate(null);
        }}
        onSave={async () => {
          await loadEmailTemplates();
          setShowTemplateEditor(false);
          setSelectedTemplate(null);
        }}
      />

      {/* Other modals/editors would go here - simplified for brevity */}
      {showPageEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {selectedPage ? 'Edit Landing Page' : 'New Landing Page'}
              </h2>
              <button
                onClick={() => {
                  setShowPageEditor(false);
                  setSelectedPage(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Landing page editor interface would be implemented here with drag & drop builder, SEO settings, etc.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentManagement;
