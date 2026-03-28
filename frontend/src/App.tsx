import { useState } from 'react';
import { QueueList } from './components/QueueList';
import { MessageList } from './components/MessageList';

function App() {
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header">
        <h1>SQS Inspector</h1>
      </header>
      
      <div className="app-layout">
        <div className="sidebar">
          <QueueList 
            selectedQueue={selectedQueue} 
            onSelectQueue={setSelectedQueue} 
          />
        </div>
        
        <div className="content">
          <MessageList queueName={selectedQueue} />
        </div>
      </div>
    </div>
  );
}

export default App;
