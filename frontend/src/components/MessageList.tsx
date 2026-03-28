import { useState, useEffect } from 'react';
import { getQueueMessages, Message } from '../api';
import { MessageModal } from './MessageModal';

interface MessageListProps {
  queueName: string | null;
}

export function MessageList({ queueName }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const fetchMessages = async () => {
    if (!queueName) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await getQueueMessages(queueName);
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [queueName]);

  const formatBody = (body?: string) => {
    if (!body) return '(no body)';
    if (body.length > 100) return body.substring(0, 100) + '...';
    return body;
  };

  if (!queueName) return <div className="empty-state">Select a queue to view messages</div>;
  if (loading) return <div className="loading">Loading messages...</div>;
  if (error) return (
    <div className="error-state">
      <p>Error: {error}</p>
      <button onClick={fetchMessages}>Retry</button>
    </div>
  );

  return (
    <div className="message-list">
      <div className="message-list-header">
        <h2>Messages in {queueName}</h2>
        <button onClick={fetchMessages}>Refresh</button>
      </div>
      
      {messages.length === 0 ? (
        <div className="empty-state">No messages in queue</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.map((msg, index) => (
            <div
              key={msg.messageId || index}
              onClick={() => setSelectedMessage(msg)}
              className="message-item"
            >
              <div className="message-item-id">
                ID: {msg.messageId?.substring(0, 20)}...
              </div>
              <div className="message-item-preview">
                {formatBody(msg.body)}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedMessage && (
        <MessageModal 
          message={selectedMessage} 
          onClose={() => setSelectedMessage(null)} 
        />
      )}
    </div>
  );
}
