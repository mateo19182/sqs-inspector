const API_BASE = '/api';

export interface Queue {
  name: string;
  url: string;
  approximateNumberOfMessages: number;
  approximateNumberOfMessagesNotVisible: number;
  created?: string;
  lastModified?: string;
  messageRetentionPeriod: number;
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

export async function getQueueMessages(queueName: string): Promise<QueueMessagesResponse> {
  const response = await fetch(`${API_BASE}/queues/${encodeURIComponent(queueName)}/messages`);
  if (!response.ok) throw new Error('Failed to fetch messages');
  return response.json();
}
