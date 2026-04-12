import { useState } from 'react';
import { getQueues, Queue } from '../api';

interface QueueListProps {
  selectedQueue: Queue | null;
  onSelectQueue: (queue: Queue) => void;
}

export function QueueList({ selectedQueue, onSelectQueue }: QueueListProps) {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueues = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getQueues();
      setQueues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // No auto-fetch — queues are loaded only on manual refresh

  const formatNumber = (n: number) => n.toLocaleString();

  if (error) return (
    <div className="error-state">
      <p>Error: {error}</p>
      <button onClick={fetchQueues}>Retry</button>
    </div>
  );

  return (
    <div className="queue-list">
      <div className="queue-list-header">
        <h2>Queues</h2>
        <button onClick={fetchQueues} disabled={loading}>
          {loading ? 'Loading...' : queues.length === 0 ? 'Load Queues' : 'Refresh'}
        </button>
      </div>

      {queues.length === 0 ? (
        <div className="empty-state">
          {loading ? 'Loading queues...' : 'Click "Load Queues" to fetch queue list.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {queues.map(queue => (
            <div
              key={queue.name}
              onClick={() => onSelectQueue(queue)}
              className={`queue-item ${selectedQueue?.name === queue.name ? 'selected' : ''}`}
            >
              <div className="queue-item-name">{queue.name}</div>
              <div className="queue-item-stats">
                Available: {formatNumber(queue.approximateNumberOfMessages)} | 
                In flight: {formatNumber(queue.approximateNumberOfMessagesNotVisible)}
              </div>
              <div className="queue-item-meta">
                Retention: {Math.floor(queue.messageRetentionPeriod / 86400)} days
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
