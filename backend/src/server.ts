import { SQSClient, GetQueueUrlCommand, GetQueueAttributesCommand, ReceiveMessageCommand, ListQueuesCommand, PurgeQueueCommand, SendMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// AWS credentials from environment or ~/.aws/credentials
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'eu-south-2',
});

app.use(cors());
app.use(express.json());

// Get queue URLs by name prefix
app.get('/api/queues', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching queues...`);
    // List all queues
    const listCommand = new ListQueuesCommand({});
    const listResponse = await sqsClient.send(listCommand);
    
    const queueUrls = listResponse.QueueUrls || [];
    console.log(`[${new Date().toISOString()}] Found ${queueUrls.length} total queues`);
    
    // Get attributes for each queue
    const queues = await Promise.all(
      queueUrls.map(async (url) => {
        const attrsCommand = new GetQueueAttributesCommand({
          QueueUrl: url,
          AttributeNames: ['All']
        });
        const attrsResponse = await sqsClient.send(attrsCommand);
        
        const name = url.split('/').pop() || 'unknown';
        const redrivePolicy = attrsResponse.Attributes?.RedrivePolicy
          ? JSON.parse(attrsResponse.Attributes.RedrivePolicy)
          : null;
        return {
          name,
          url,
          approximateNumberOfMessages: parseInt(attrsResponse.Attributes?.ApproximateNumberOfMessages || '0'),
          approximateNumberOfMessagesNotVisible: parseInt(attrsResponse.Attributes?.ApproximateNumberOfMessagesNotVisible || '0'),
          created: attrsResponse.Attributes?.CreatedTimestamp,
          lastModified: attrsResponse.Attributes?.LastModifiedTimestamp,
          messageRetentionPeriod: parseInt(attrsResponse.Attributes?.MessageRetentionPeriod || '0'),
          maxReceiveCount: redrivePolicy?.maxReceiveCount ?? null,
        };
      })
    );
    
    // Filter for email queues
    const emailQueues = queues.filter(q => 
      q.name.includes('email') || q.name.includes('dlq')
    );
    
    console.log(`[${new Date().toISOString()}] Returning ${emailQueues.length} email queues`);
    
    res.json(emailQueues);
  } catch (error) {
    console.error('Error fetching queues:', error);
    res.status(500).json({ error: 'Failed to fetch queues' });
  }
});

// Get messages from a specific queue
app.get('/api/queues/:queueName/messages', async (req, res) => {
  try {
    const { queueName } = req.params;
    const maxBatches = Math.min(Math.max(parseInt(req.query.maxBatches as string) || 1, 1), 20);

    // Get queue URL
    const getUrlCommand = new GetQueueUrlCommand({ QueueName: queueName });
    const urlResponse = await sqsClient.send(getUrlCommand);
    const queueUrl = urlResponse.QueueUrl;

    if (!queueUrl) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    console.log(`[${new Date().toISOString()}] Peeking messages from ${queueName} (${maxBatches} batches)...`);

    const seen = new Map<string, typeof messages[number]>();
    const messages: {
      messageId?: string;
      receiptHandle?: string;
      body?: string;
      attributes?: Record<string, string>;
      messageAttributes?: Record<string, any>;
      md5OfBody?: string;
      md5OfMessageAttributes?: string;
    }[] = [];

    let emptyBatches = 0;

    for (let i = 0; i < maxBatches; i++) {
      const receiveCommand = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 0,
        VisibilityTimeout: 0,
        AttributeNames: ['All'],
        MessageAttributeNames: ['All']
      });

      const receiveResponse = await sqsClient.send(receiveCommand);
      const batch = receiveResponse.Messages || [];

      if (batch.length === 0) {
        emptyBatches++;
        if (emptyBatches >= 2) break; // Stop early if queue seems empty
        continue;
      }

      for (const msg of batch) {
        if (msg.MessageId && !seen.has(msg.MessageId)) {
          const mapped = {
            messageId: msg.MessageId,
            receiptHandle: msg.ReceiptHandle,
            body: msg.Body,
            attributes: msg.Attributes,
            messageAttributes: msg.MessageAttributes,
            md5OfBody: msg.MD5OfBody,
            md5OfMessageAttributes: msg.MD5OfMessageAttributes
          };
          seen.set(msg.MessageId, mapped);
          messages.push(mapped);
        }
      }
    }

    console.log(`[${new Date().toISOString()}] Found ${messages.length} unique messages in ${queueName}`);

    res.json({
      queueName,
      queueUrl,
      messageCount: messages.length,
      messages,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Purge all messages from a queue
app.delete('/api/queues/:queueName/messages', async (req, res) => {
  try {
    const { queueName } = req.params;
    const getUrlCommand = new GetQueueUrlCommand({ QueueName: queueName });
    const urlResponse = await sqsClient.send(getUrlCommand);
    const queueUrl = urlResponse.QueueUrl;
    if (!queueUrl) return res.status(404).json({ error: 'Queue not found' });

    console.log(`[${new Date().toISOString()}] Purging queue ${queueName}...`);
    await sqsClient.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));
    res.json({ success: true });
  } catch (error) {
    console.error('Error purging queue:', error);
    res.status(500).json({ error: 'Failed to purge queue' });
  }
});

// Redrive a message from a DLQ back to the target queue
app.post('/api/queues/:queueName/messages/redrive', async (req, res) => {
  try {
    const { queueName } = req.params;
    const { messageId, targetQueueName } = req.body as { messageId: string; targetQueueName: string };

    const sourceUrlResp = await sqsClient.send(new GetQueueUrlCommand({ QueueName: queueName }));
    const sourceQueueUrl = sourceUrlResp.QueueUrl;
    if (!sourceQueueUrl) return res.status(404).json({ error: 'Source queue not found' });

    const targetUrlResp = await sqsClient.send(new GetQueueUrlCommand({ QueueName: targetQueueName }));
    const targetQueueUrl = targetUrlResp.QueueUrl;
    if (!targetQueueUrl) return res.status(404).json({ error: 'Target queue not found' });

    // Scan the DLQ to find the specific message and lock it with a visibility timeout
    let foundMessage: { Body?: string; MessageId?: string; ReceiptHandle?: string; MessageAttributes?: Record<string, any> } | null = null;
    for (let i = 0; i < 20 && !foundMessage; i++) {
      const receiveResp = await sqsClient.send(new ReceiveMessageCommand({
        QueueUrl: sourceQueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 0,
        VisibilityTimeout: 30,
        AttributeNames: ['All'],
        MessageAttributeNames: ['All'],
      }));
      const batch = receiveResp.Messages || [];
      if (batch.length === 0) break;
      foundMessage = batch.find(m => m.MessageId === messageId) ?? null;
    }

    if (!foundMessage) {
      return res.status(404).json({ error: 'Message not found in queue' });
    }

    console.log(`[${new Date().toISOString()}] Redriving message ${messageId} from ${queueName} to ${targetQueueName}...`);

    await sqsClient.send(new SendMessageCommand({
      QueueUrl: targetQueueUrl,
      MessageBody: foundMessage.Body,
      ...(foundMessage.MessageAttributes && Object.keys(foundMessage.MessageAttributes).length > 0
        ? { MessageAttributes: foundMessage.MessageAttributes }
        : {}),
    }));

    await sqsClient.send(new DeleteMessageCommand({
      QueueUrl: sourceQueueUrl,
      ReceiptHandle: foundMessage.ReceiptHandle,
    }));

    res.json({ success: true });
  } catch (error) {
    console.error('Error redriving message:', error);
    res.status(500).json({ error: 'Failed to redrive message' });
  }
});

app.listen(PORT, () => {
  console.log(`SQS Inspector backend running on http://localhost:${PORT}`);
});
