import React, { useState, useEffect } from 'react';
import { 
  Save, 
  X, 
  Eye, 
  Send, 
  Type, 
  Image, 
  Link, 
  Bold, 
  Italic, 
  Code,
  Plus,
  Trash2,
  Copy
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';
import { EmailTemplate, EmailVariable } from '../types';

interface EmailTemplateEditorProps {
  template?: EmailTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
  template,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    htmlContent: '',
    textContent: '',
    type: 'promotional' as const,
    category: 'marketing',
    variables: [] as EmailVariable[],
    isActive: true,
    previewText: ''
  });

  const [previewMode, setPreviewMode] = useState<'html' | 'text'>('html');
  const [showVariableManager, setShowVariableManager] = useState(false);
  const [newVariable, setNewVariable] = useState<Partial<EmailVariable>>({
    name: '',
    description: '',
    defaultValue: '',
    required: false
  });

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        type: template.type,
        category: template.category,
        variables: template.variables,
        isActive: template.isActive,
        previewText: template.previewText || ''
      });
    } else {
      setFormData({
        name: '',
        subject: '',
        htmlContent: '',
        textContent: '',
        type: 'promotional',
        category: 'marketing',
        variables: [],
        isActive: true,
        previewText: ''
      });
    }
  }, [template]);

  const handleSave = async () => {
    try {
      if (template) {
        const updateEmailTemplate = httpsCallable(functions, 'updateEmailTemplate');
        await updateEmailTemplate({
          id: template.id,
          ...formData
        });
      } else {
        const createEmailTemplate = httpsCallable(functions, 'createEmailTemplate');
        await createEmailTemplate(formData);
      }
      onSave();
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const addVariable = () => {
    if (newVariable.name && newVariable.description) {
      setFormData(prev => ({
        ...prev,
        variables: [...prev.variables, {
          name: newVariable.name!,
          description: newVariable.description!,
          defaultValue: newVariable.defaultValue || '',
          required: newVariable.required || false
        }]
      }));
      setNewVariable({
        name: '',
        description: '',
        defaultValue: '',
        required: false
      });
      setShowVariableManager(false);
    }
  };

  const removeVariable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index)
    }));
  };

  const insertVariable = (variableName: string) => {
    const variableTag = `{{${variableName}}}`;
    const textarea = document.getElementById('htmlContent') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const newText = text.substring(0, start) + variableTag + text.substring(end);
      
      setFormData(prev => ({
        ...prev,
        htmlContent: newText
      }));
      
      // Restaurar posição do cursor
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variableTag.length, start + variableTag.length);
      }, 0);
    }
  };

  const generatePreview = () => {
    let content = previewMode === 'html' ? formData.htmlContent : formData.textContent;
    
    // Substituir variáveis pelos valores padrão
    formData.variables.forEach(variable => {
      const placeholder = `{{${variable.name}}}`;
      content = content.replace(
        new RegExp(placeholder, 'g'),
        variable.defaultValue || `[${variable.name}]`
      );
    });
    
    return content;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {template ? 'Edit Email Template' : 'New Email Template'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex h-[calc(95vh-140px)]">
          {/* Main Editor */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Enter template name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="marketing">Marketing</option>
                    <option value="transactional">Transactional</option>
                    <option value="notification">Notification</option>
                    <option value="welcome">Welcome</option>
                    <option value="reminder">Reminder</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="promotional">Promotional</option>
                    <option value="transactional">Transactional</option>
                    <option value="system">System</option>
                  </select>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Template is active
                  </label>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Enter email subject"
                />
              </div>

              {/* Preview Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preview Text (optional)
                </label>
                <input
                  type="text"
                  value={formData.previewText}
                  onChange={(e) => setFormData(prev => ({ ...prev, previewText: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Text that appears in email previews"
                />
              </div>

              {/* Variables */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Variables
                  </label>
                  <button
                    onClick={() => setShowVariableManager(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Variable</span>
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {formData.variables.map((variable, index) => (
                    <div key={index} className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1 text-sm">
                      <button
                        onClick={() => insertVariable(variable.name)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-2"
                        title={`Insert {{${variable.name}}}`}
                      >
                        {variable.name}
                      </button>
                      <button
                        onClick={() => removeVariable(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Content Editor */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    HTML Content
                  </label>
                  <textarea
                    id="htmlContent"
                    value={formData.htmlContent}
                    onChange={(e) => setFormData(prev => ({ ...prev, htmlContent: e.target.value }))}
                    className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm"
                    placeholder="Enter HTML content..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Text Content (fallback)
                  </label>
                  <textarea
                    value={formData.textContent}
                    onChange={(e) => setFormData(prev => ({ ...prev, textContent: e.target.value }))}
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm"
                    placeholder="Enter plain text content..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="w-1/3 border-l border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Preview</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPreviewMode('html')}
                    className={`px-2 py-1 text-xs rounded ${
                      previewMode === 'html'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    HTML
                  </button>
                  <button
                    onClick={() => setPreviewMode('text')}
                    className={`px-2 py-1 text-xs rounded ${
                      previewMode === 'text'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Text
                  </button>
                </div>
              </div>
              
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 min-h-[300px] bg-white dark:bg-gray-900">
                {previewMode === 'html' ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: generatePreview() }}
                    className="prose prose-sm max-w-none dark:prose-invert"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                    {generatePreview()}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Variables: {formData.variables.length} | 
            HTML: {formData.htmlContent.length} chars | 
            Text: {formData.textContent.length} chars
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!formData.name || !formData.subject}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{template ? 'Update' : 'Create'} Template</span>
            </button>
          </div>
        </div>

        {/* Variable Manager Modal */}
        {showVariableManager && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Add Variable
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Variable Name
                  </label>
                  <input
                    type="text"
                    value={newVariable.name}
                    onChange={(e) => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="e.g., firstName, companyName"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newVariable.description}
                    onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Brief description of this variable"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Default Value
                  </label>
                  <input
                    type="text"
                    value={newVariable.defaultValue}
                    onChange={(e) => setNewVariable(prev => ({ ...prev, defaultValue: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Default value for preview"
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="required"
                    checked={newVariable.required}
                    onChange={(e) => setNewVariable(prev => ({ ...prev, required: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="required" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Required variable
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowVariableManager(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={addVariable}
                  disabled={!newVariable.name || !newVariable.description}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
                >
                  Add Variable
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailTemplateEditor;
