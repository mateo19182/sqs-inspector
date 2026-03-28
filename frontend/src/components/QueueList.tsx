import { useState, useEffect } from 'react';
import { getQueues, Queue } from '../api';

interface QueueListProps {
  selectedQueue: string | null;
  onSelectQueue: (queueName: string) => void;
}

export function QueueList({ selectedQueue, onSelectQueue }: QueueListProps) {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchQueues();
  }, []);

  const formatNumber = (n: number) => n.toLocaleString();

  if (loading) return <div className="loading">Loading queues...</div>;
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
        <button onClick={fetchQueues}>Refresh</button>
      </div>
      
      {queues.length === 0 ? (
        <div className="empty-state">No SQS queues found in this region.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {queues.map(queue => (
            <div
              key={queue.name}
              onClick={() => onSelectQueue(queue.name)}
              className={`queue-item ${selectedQueue === queue.name ? 'selected' : ''}`}
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
