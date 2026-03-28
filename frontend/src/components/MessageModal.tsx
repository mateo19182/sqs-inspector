import { useState } from 'react';
import { Message } from '../api';

interface MessageModalProps {
  message: Message;
  onClose: () => void;
}

export function MessageModal({ message, onClose }: MessageModalProps) {
  const [activeTab, setActiveTab] = useState<'raw' | 'html'>('raw');

  const formatBody = (body?: string) => {
    if (!body) return '(no body)';
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body;
    }
  };

  const getHtmlContent = (body?: string): string | null => {
    if (!body) return null;
    try {
      const parsed = JSON.parse(body);
      // Check for html or text field (both contain HTML in your example)
      const htmlContent = parsed.html || parsed.text;
      if (htmlContent && typeof htmlContent === 'string') {
        // Check if it looks like HTML
        if (htmlContent.trim().startsWith('<') || htmlContent.includes('<!DOCTYPE') || htmlContent.includes('<html')) {
          return htmlContent;
        }
      }
      return null;
    } catch {
      // If not JSON, check if body itself is HTML
      if (body.trim().startsWith('<') || body.includes('<!DOCTYPE') || body.includes('<html')) {
        return body;
      }
      return null;
    }
  };

  const htmlContent = getHtmlContent(message.body);
  const rawContent = formatBody(message.body);

  return (
    <div 
      className="modal-overlay"
      onClick={onClose}
    >
      <div 
        className="modal-content"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Message Details</h3>
          <button className="icon" onClick={onClose}>×</button>
        </div>

        <div className="modal-section">
          <label className="field-label">Message ID</label>
          <div className="field-value monospace">{message.messageId}</div>
        </div>

        <div className="modal-section">
          <div className="tabs-header">
            <label className="field-label">Body</label>
            <div className="tabs">
              <button 
                className={activeTab === 'raw' ? 'active' : 'secondary'}
                onClick={() => setActiveTab('raw')}
              >
                Raw
              </button>
              {htmlContent && (
                <button 
                  className={activeTab === 'html' ? 'active' : 'secondary'}
                  onClick={() => setActiveTab('html')}
                >
                  HTML Preview
                </button>
              )}
            </div>
          </div>
          
          {activeTab === 'raw' ? (
            <pre className="code-block raw">
              {rawContent}
            </pre>
          ) : (
            <div className="html-preview">
              <iframe
                srcDoc={htmlContent || ''}
                title="HTML Preview"
                sandbox="allow-same-origin"
                style={{
                  width: '100%',
                  height: '400px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'white'
                }}
              />
            </div>
          )}
        </div>

        {message.attributes && Object.keys(message.attributes).length > 0 && (
          <div className="modal-section">
            <label className="field-label">System Attributes</label>
            <pre className="code-block attributes">
              {JSON.stringify(message.attributes, null, 2)}
            </pre>
          </div>
        )}

        {message.messageAttributes && Object.keys(message.messageAttributes).length > 0 && (
          <div className="modal-section">
            <label className="field-label">Message Attributes</label>
            <pre className="code-block attributes">
              {JSON.stringify(message.messageAttributes, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
