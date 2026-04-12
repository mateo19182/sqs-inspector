const API_BASE = '/api';

export interface Queue {
  name: string;
  url: string;
  approximateNumberOfMessages: number;
  approximateNumberOfMessagesNotVisible: number;
  created?: string;
  lastModified?: string;
  messageRetentionPeriod: number;
  maxReceiveCount: number | null;
}

export interface Message {
  messageId?: string;
  receiptHandle?: string;
  body?: string;
  attributes?: Record<string, string>;
  messageAttributes?: Record<string, { stringValue?: string; dataType?: string }>;
  md5OfBody?: string;
}

export interface QueueMessagesResponse {
  queueName: string;
  queueUrl: string;
  messageCount: number;
  messages: Message[];
}

export async function getQueues(): Promise<Queue[]> {
  const response = await fetch(`${API_BASE}/queues`);
  if (!response.ok) throw new Error('Failed to fetch queues');
  return response.json();
}

export async function getQueueMessages(queueName: string, maxBatches: number = 1): Promise<QueueMessagesResponse> {
  const params = new URLSearchParams({ maxBatches: String(maxBatches) });
  const response = await fetch(`${API_BASE}/queues/${encodeURIComponent(queueName)}/messages?${params}`);
  if (!response.ok) throw new Error('Failed to fetch messages');
  return response.json();
}

export async function purgeQueue(queueName: string): Promise<void> {
  const response = await fetch(`${API_BASE}/queues/${encodeURIComponent(queueName)}/messages`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to purge queue');
}

export async function redriveMessage(queueName: string, messageId: string, targetQueueName: string): Promise<void> {
  const response = await fetch(`${API_BASE}/queues/${encodeURIComponent(queueName)}/messages/redrive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId, targetQueueName }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to redrive message');
  }
}
