import { useState, useEffect, useRef, useMemo } from 'react';
import { getQueueMessages, purgeQueue, redriveMessage, Message, Queue } from '../api';
import { MessageModal } from './MessageModal';

const MESSAGE_COUNTS = [10, 50, 100, 200, 500];

interface MessageListProps {
  queue: Queue | null;
}

export function MessageList({ queue }: MessageListProps) {
  const messageCache = useRef<Map<string, Message[]>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [filter, setFilter] = useState('');
  const [batches, setBatches] = useState(1);
  const [purgeState, setPurgeState] = useState<'idle' | 'confirming' | 'purging'>('idle');
  const [redriving, setRedriving] = useState<Set<string>>(new Set());

  const fetchMessages = async () => {
    if (!queue) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getQueueMessages(queue.name, batches);
      setMessages(data.messages);
      messageCache.current.set(queue.name, data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Restore cached messages on queue switch — no auto-fetch
  useEffect(() => {
    setFilter('');
    setError(null);
    if (queue) {
      const cached = messageCache.current.get(queue.name);
      setMessages(cached || []);
    } else {
      setMessages([]);
    }
  }, [queue?.name]);

  const filteredMessages = useMemo(() => {
    if (!filter.trim()) return messages;
    const term = filter.toLowerCase();
    return messages.filter(msg => msg.body?.toLowerCase().includes(term));
  }, [messages, filter]);

  const formatBody = (body?: string) => {
    if (!body) return '(no body)';
    if (body.length > 100) return body.substring(0, 100) + '...';
    return body;
  };

  const maxReceiveCount = queue?.maxReceiveCount ?? null;
  const isDlq = queue?.name.endsWith('-dlq') ?? false;
  const targetQueueName = isDlq ? queue!.name.replace(/-dlq$/, '-queue') : null;

  const handlePurge = async () => {
    if (!queue) return;
    setPurgeState('purging');
    try {
      await purgeQueue(queue.name);
      setMessages([]);
      messageCache.current.delete(queue.name);
      setPurgeState('idle');
    } catch {
      setPurgeState('idle');
    }
  };

  const handleRedrive = async (e: React.MouseEvent, msg: Message) => {
    e.stopPropagation();
    if (!queue || !targetQueueName || !msg.messageId) return;
    setRedriving(prev => new Set(prev).add(msg.messageId!));
    try {
      await redriveMessage(queue.name, msg.messageId, targetQueueName);
      setMessages(prev => {
        const updated = prev.filter(m => m.messageId !== msg.messageId);
        messageCache.current.set(queue.name, updated);
        return updated;
      });
    } finally {
      setRedriving(prev => { const next = new Set(prev); next.delete(msg.messageId!); return next; });
    }
  };

  const getReceiveBadge = (msg: Message) => {
    const count = parseInt(msg.attributes?.ApproximateReceiveCount || '0');
    if (!maxReceiveCount) return null;
    const danger = count >= maxReceiveCount - 1;
    const warn = count >= Math.ceil(maxReceiveCount * 0.6);
    const cls = danger ? 'receive-badge danger' : warn ? 'receive-badge warn' : 'receive-badge';
    return <span className={cls}>{count}/{maxReceiveCount} receives</span>;
  };

  if (!queue) return <div className="empty-state">Select a queue to view messages</div>;
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
        <h2>Messages in {queue.name}</h2>
        <div className="header-controls">
          <label className="batches-control">
            <span>Batches</span>
            <input
              type="number"
              min={1}
              max={20}
              value={batches}
              onChange={e => setBatches(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
              className="batches-input"
            />
          </label>
          <button onClick={fetchMessages}>Refresh</button>
          {purgeState === 'idle' && (
            <button className="secondary danger" onClick={() => setPurgeState('confirming')}>Purge</button>
          )}
          {purgeState === 'confirming' && (
            <span className="purge-confirm">
              <span>Purge all messages?</span>
              <button onClick={handlePurge}>Yes</button>
              <button className="secondary" onClick={() => setPurgeState('idle')}>No</button>
            </span>
          )}
          {purgeState === 'purging' && (
            <button className="secondary" disabled>Purging...</button>
          )}
        </div>
      </div>

      <div className="message-filter">
        <input
          type="text"
          placeholder="Filter by message content..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="filter-input"
        />
        {filter && (
          <span className="filter-info">
            {filteredMessages.length} of {messages.length} messages
          </span>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="empty-state">
          {loading ? 'Loading messages...' : messageCache.current.has(queue.name) ? 'No messages in queue' : 'Click "Refresh" to fetch messages.'}
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="empty-state">No messages match "{filter}"</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredMessages.map((msg, index) => (
            <div
              key={msg.messageId || index}
              onClick={() => setSelectedMessage(msg)}
              className="message-item"
            >
              <div className="message-item-id">
                <span>ID: {msg.messageId?.substring(0, 20)}...</span>
                <span className="message-item-actions">
                  {getReceiveBadge(msg)}
                  {isDlq && (
                    <button
                      className="redrive-btn"
                      onClick={e => handleRedrive(e, msg)}
                      disabled={redriving.has(msg.messageId!)}
                    >
                      {redriving.has(msg.messageId!) ? 'Moving...' : `Redrive to ${targetQueueName}`}
                    </button>
                  )}
                </span>
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
