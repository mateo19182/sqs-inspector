import { SQSClient, GetQueueUrlCommand, GetQueueAttributesCommand, ReceiveMessageCommand, ListQueuesCommand } from '@aws-sdk/client-sqs';
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
    // List all queues
    const listCommand = new ListQueuesCommand({});
    const listResponse = await sqsClient.send(listCommand);
    
    const queueUrls = listResponse.QueueUrls || [];
    
    // Get attributes for each queue
    const queues = await Promise.all(
      queueUrls.map(async (url) => {
        const attrsCommand = new GetQueueAttributesCommand({
          QueueUrl: url,
          AttributeNames: ['All']
        });
        const attrsResponse = await sqsClient.send(attrsCommand);
        
        const name = url.split('/').pop() || 'unknown';
        return {
          name,
          url,
          approximateNumberOfMessages: parseInt(attrsResponse.Attributes?.ApproximateNumberOfMessages || '0'),
          approximateNumberOfMessagesNotVisible: parseInt(attrsResponse.Attributes?.ApproximateNumberOfMessagesNotVisible || '0'),
          created: attrsResponse.Attributes?.CreatedTimestamp,
          lastModified: attrsResponse.Attributes?.LastModifiedTimestamp,
          messageRetentionPeriod: parseInt(attrsResponse.Attributes?.MessageRetentionPeriod || '0')
        };
      })
    );
    
    // Filter for email queues
    const emailQueues = queues.filter(q => 
      q.name.includes('email') || q.name.includes('dlq')
    );
    
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
    
    // Get queue URL
    const getUrlCommand = new GetQueueUrlCommand({ QueueName: queueName });
    const urlResponse = await sqsClient.send(getUrlCommand);
    const queueUrl = urlResponse.QueueUrl;
    
    if (!queueUrl) {
      return res.status(404).json({ error: 'Queue not found' });
    }
    
    // Receive messages (non-destructive, just peeking)
    const receiveCommand = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 0,
      AttributeNames: ['All'],
      MessageAttributeNames: ['All']
    });
    
    const receiveResponse = await sqsClient.send(receiveCommand);
    const messages = receiveResponse.Messages || [];
    
    res.json({
      queueName,
      queueUrl,
      messageCount: messages.length,
      messages: messages.map(msg => ({
        messageId: msg.MessageId,
        receiptHandle: msg.ReceiptHandle,
        body: msg.Body,
        attributes: msg.Attributes,
        messageAttributes: msg.MessageAttributes,
        md5OfBody: msg.MD5OfBody,
        md5OfMessageAttributes: msg.MD5OfMessageAttributes
      }))
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.listen(PORT, () => {
  console.log(`SQS Inspector backend running on http://localhost:${PORT}`);
});
